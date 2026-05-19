#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
import sys
import time
import urllib.request
import urllib.error
import asyncio
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

HOST = "0.0.0.0"
PORT = 7000
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.txt")
COOKIE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookie.txt")

# In-memory caching for 17track status to prevent rate-limiting and speed up repetitive queries
TRACKING_CACHE = {}
CACHE_TTL = 300 # 5 minutes

def get_saved_token():
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def get_saved_cookie():
    if os.path.exists(COOKIE_FILE):
        with open(COOKIE_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def save_config(token, cookie):
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(token.strip())
    with open(COOKIE_FILE, "w", encoding="utf-8") as f:
        f.write(cookie.strip())

async def scrape_17track(waybill):
    from playwright.async_api import async_playwright
    url = f"https://extcall.17track.net/en/track#apitype=1&nums={waybill}"
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True, 
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled"]
            )
        except Exception as e:
            # Fallback to standard chromium if system Chrome launch fails
            print(f"Failed to launch system Chrome: {e}. Trying standard Chromium...")
            browser = await p.chromium.launch(headless=True)
            
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
        )
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        
        # Speed up loading by blocking images, media, fonts, and trackers
        async def block_resources(route):
            req_type = route.request.resource_type
            req_url = route.request.url
            if req_type in ["image", "media", "font"] or "google-analytics" in req_url or "doubleclick" in req_url or "criteo" in req_url:
                await route.abort()
            else:
                await route.continue_()
                
        await page.route("**/*", block_resources)
        await page.goto(url, timeout=30000)
        
        # Poll up to 5 seconds for tracking widget elements to render
        for _ in range(25):
            body_text = await page.inner_text("body")
            if "Destination" in body_text or "Origin" in body_text or "Not Found" in body_text or "not found" in body_text.lower():
                break
            await asyncio.sleep(0.2)
            
        body_text = await page.inner_text("body")
        lines = [line.strip() for line in body_text.split("\n") if line.strip()]
        
        status = ""
        latest_event = ""
        latest_time = ""
        
        try:
            idx = lines.index(waybill)
            if idx + 1 < len(lines):
                status = lines[idx + 1]
            
            for j in range(len(lines)):
                if "Sync Time" in lines[j]:
                    if j + 2 < len(lines):
                        latest_time = lines[j+1]
                        latest_event = lines[j+2]
                        break
        except Exception:
            # Fallback check for Not Found
            for line in lines:
                if "not found" in line.lower():
                    status = "Not Found"
                    break
                    
        await browser.close()
        
        return {
            "status": status,
            "latest_event": latest_event,
            "time": latest_time
        }

class TrackingProxyHandler(SimpleHTTPRequestHandler):
    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            self._send_json(200, {
                "token": get_saved_token(),
                "cookie": get_saved_cookie()
            })
            return
            
        if parsed.path == "/api/17track":
            query_params = parse_qs(parsed.query)
            waybill = query_params.get("waybill", [""])[0].strip()
            if not waybill:
                self._send_json(400, {"error": "Missing waybill parameter"})
                return
                
            now = time.time()
            if waybill in TRACKING_CACHE:
                cached = TRACKING_CACHE[waybill]
                if now - cached["timestamp"] < CACHE_TTL:
                    print(f"17track status cache hit for waybill: {waybill}")
                    self._send_json(200, {
                        "success": True,
                        "status": cached["status"],
                        "latest_event": cached["latest_event"],
                        "time": cached["time"],
                        "cached": True
                    })
                    return
                    
            try:
                print(f"Scraping 17track status for waybill: {waybill}...")
                res = asyncio.run(scrape_17track(waybill))
                
                # Cache results
                TRACKING_CACHE[waybill] = {
                    "status": res["status"],
                    "latest_event": res["latest_event"],
                    "time": res["time"],
                    "timestamp": now
                }
                
                self._send_json(200, {
                    "success": True,
                    "status": res["status"],
                    "latest_event": res["latest_event"],
                    "time": res["time"]
                })
            except Exception as e:
                print(f"Failed to scrape 17track for waybill {waybill}: {str(e)}")
                self._send_json(500, {"error": str(e)})
            return

        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(length)
        
        if parsed.path == "/api/config":
            try:
                data = json.loads(body_raw.decode("utf-8"))
                save_config(data.get("token", ""), data.get("cookie", ""))
                self._send_json(200, {"success": True})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if parsed.path == "/api/tracking":
            try:
                token = get_saved_token()
                cookie = get_saved_cookie()

                if not token:
                    self._send_json(401, {"error": "Token not configured"})
                    return

                target_url = "https://dms.gofoexpress.com/prod-api/waybill/track/private/list"
                req = urllib.request.Request(target_url, data=body_raw, method="POST")
                
                # Standard headers
                req.add_header("Content-Type", "application/json;charset=utf-8")
                req.add_header("Accept", "application/json, text/plain, */*")
                
                # Auth headers
                raw_token = token.replace("Bearer ", "").strip()
                req.add_header("Authorization", f"Bearer {raw_token}")
                req.add_header("Admin-Token", raw_token)
                
                if cookie:
                    req.add_header("Cookie", cookie)

                # RuoYi/DMS Specific headers from verified cURL
                req.add_header("lang", "zh")
                req.add_header("source", "WEB")
                req.add_header("tenant-id", "us")
                req.add_header("app-code", "gofo-base")
                req.add_header("auth-tag-x", "unauthorized")
                req.add_header("X-Requested-With", "XMLHttpRequest")
                req.add_header("User-Time-Zone", "America/Los_Angeles")
                
                # Origin/Referer
                req.add_header("Referer", "https://dms.gofoexpress.com/gofo-base/epss/trackManage2/Tracking")
                req.add_header("Origin", "https://dms.gofoexpress.com")
                
                # User Agent matching user's cURL
                req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0")

                print(f"Proxying to: {target_url}")
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_body = response.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(res_body)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(res_body)
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8") if e.fp else ""
                print(f"HTTP Error {e.code}: {error_body}")
                self._send_json(e.code, {"error": f"API Error {e.code}", "details": error_body})
            except Exception as e:
                print(f"Server Error: {str(e)}")
                self._send_json(500, {"error": str(e)})
            return

def main():
    print(f"Starting Tracking Server at http://{HOST}:{PORT}")
    server = ThreadingHTTPServer((HOST, PORT), TrackingProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")

if __name__ == "__main__":
    main()
