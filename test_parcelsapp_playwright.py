import asyncio
import time
from playwright.async_api import async_playwright

async def main():
    tracking_no = "SPXMCO115400412373"
    url = f"https://parcelsapp.com/en/tracking/{tracking_no}"
    
    start_time = time.time()
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US"
        )
        page = await context.new_page()
        
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=30000)
        
        print("Waiting for page elements...")
        # ParcelsApp loads tracking results dynamically. Let's wait up to 15 seconds.
        # Let's check the DOM structure for status.
        # Usually it has something like class "status" or the status text is under the tracking ID.
        await page.wait_for_timeout(10000)
        
        # Take a screenshot to verify
        await page.screenshot(path="parcelsapp_headless.png")
        print("Screenshot saved to parcelsapp_headless.png")
        
        # Extract body text
        body_text = await page.inner_text("body")
        print("Length of body text:", len(body_text))
        
        with open("parcelsapp_headless_body.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print("Saved body text to parcelsapp_headless_body.txt")
        
        # Let's search for status keywords
        print("Contains Delivered:", "Delivered" in body_text or "delivered" in body_text.lower())
        print("Contains SpeedX:", "SpeedX" in body_text)
        
        await browser.close()
        
    print(f"Time taken: {time.time() - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
