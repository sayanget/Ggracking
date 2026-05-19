import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Intercept and log all requests
        request_urls = []
        page.on("request", lambda r: request_urls.append((r.method, r.url)))
        
        url = "https://externalcall.17track.net/single.shtml?nums=SPXMCO115400412373&fc=0&lang=en&h=560"
        print(f"Navigating to {url}...")
        try:
            await page.goto(url, wait_until="networkidle", timeout=15000)
        except Exception as e:
            print("Navigation timed out or failed, but continuing... error:", e)
            
        # Wait a few seconds for any ajax requests to finish
        await page.wait_for_timeout(5000)
        
        print("\nAll Requests Intercepted:")
        for method, req_url in request_urls:
            if "track" in req_url or "api" in req_url or "post" in req_url.lower():
                print(f"[{method}] {req_url}")
                
        # Take a screenshot to see if it loaded the tracking result
        await page.screenshot(path="widget_intercept.png")
        print("Screenshot saved to widget_intercept.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
