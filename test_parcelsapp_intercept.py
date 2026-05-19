import asyncio
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
        
        print("\nAll Requests Intercepted:")
        for method, req_url, post_data in request_urls:
            if "parcels" in req_url or "api" in req_url or "track" in req_url:
                print(f"[{method}] {req_url}")
                if post_data:
                    print("  Payload:", post_data[:200])
                    
        # Get body text
        text = await page.inner_text("body")
        print("\nLength of inner text:", len(text))
        print("Snippet of text:")
        print(text[:1000])
        
        await page.screenshot(path="parcels_intercept.png")
        print("Screenshot saved to parcels_intercept.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
