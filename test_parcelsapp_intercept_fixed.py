import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        request_urls = []
        page.on("request", lambda r: request_urls.append((r.method, r.url, r.post_data)))
        
        url = "https://parcelsapp.com/en/tracking/SPXMCO115400412373"
        print(f"Navigating to {url}...")
        try:
            await page.goto(url, wait_until="networkidle", timeout=20000)
        except Exception as e:
            print("Navigation timed out or failed:", e)
            
        await page.wait_for_timeout(5000)
        
        # Save requests to JSON
        data_to_save = []
        for method, req_url, post_data in request_urls:
            if "parcels" in req_url or "api" in req_url or "track" in req_url:
                data_to_save.append({
                    "method": method,
                    "url": req_url,
                    "post_data": post_data
                })
                
        with open("parcels_requests.json", "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
            
        print("Saved requests to parcels_requests.json")
        
        # Get body text and save to file to avoid stdout encoding issues
        text = await page.inner_text("body")
        with open("parcels_body.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Saved body text to parcels_body.txt")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
