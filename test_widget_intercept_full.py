import asyncio
import time
import json
from playwright.async_api import async_playwright

async def main():
    tracking_no = "SPXMCO115400412373"
    url = f"https://extcall.17track.net/en/track#apitype=1&nums={tracking_no}"
    
    start_time = time.time()
    async with async_playwright() as p:
        print("Launching browser with channel='chrome'...")
        try:
            browser = await p.chromium.launch(
                headless=True, 
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled"]
            )
        except Exception as e:
            print("Failed to launch system Chrome, trying standard Chromium...", e)
            browser = await p.chromium.launch(headless=True)
            
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
        )
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        
        intercepted = []
        
        async def handle_response(response):
            req = response.request
            try:
                text = await response.text()
            except:
                text = "<binary or failed>"
            intercepted.append({
                "url": req.url,
                "method": req.method,
                "status": response.status,
                "headers": req.headers,
                "post_data": req.post_data,
                "response_text": text[:1000]
            })
            
        page.on("response", handle_response)
        
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=30000)
        
        print("Waiting for page elements...")
        await page.wait_for_timeout(10000)
        
        # Save intercepted requests to a JSON file
        with open("widget_responses.json", "w", encoding="utf-8") as f:
            json.dump(intercepted, f, indent=2, ensure_ascii=False)
        print("Saved intercepted responses to widget_responses.json")
        
        # Search intercepted responses for tracking number or status
        for item in intercepted:
            req_url = item["url"]
            if "track" in req_url or "api" in req_url or "post" in req_url.lower():
                print(f"\n[{item['method']}] {req_url} (Status: {item['status']})")
                if item["post_data"]:
                    print("  Post Data:", item["post_data"])
                print("  Response Snippet:", item["response_text"][:500])
                
        await browser.close()
        
    print(f"Time taken: {time.time() - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
