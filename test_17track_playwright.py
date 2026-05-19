import asyncio
import time
from playwright.async_api import async_playwright

async def main():
    tracking_no = "SPXMCO115400412373"
    url = f"https://t.17track.net/en#nums={tracking_no}"
    
    start_time = time.time()
    async with async_playwright() as p:
        print("Launching browser...")
        # Let's launch a headless Chromium browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US"
        )
        page = await context.new_page()
        
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=30000)
        
        print("Waiting for page load and elements...")
        # Wait for the status element to load
        # In 17track, the tracking card has status text, e.g. class "text-capitalize" or "status-text" or inside a list
        # Let's wait for a while to let AJAX load the tracking data
        await page.wait_for_timeout(8000)
        
        # Let's take a screenshot to see what's on the page
        await page.screenshot(path="17track_headless.png")
        print("Screenshot saved to 17track_headless.png")
        
        # Let's extract all text content from the page to see what got loaded
        body_text = await page.inner_text("body")
        print("Length of body text:", len(body_text))
        
        # Let's save body text to file
        with open("17track_headless_body.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print("Saved body text to 17track_headless_body.txt")
        
        # Search for tracking number or SpeedX/Ocala/Delivered in the text
        print("Contains SPXMCO:", "SPXMCO" in body_text)
        print("Contains SpeedX:", "SpeedX" in body_text)
        print("Contains Delivered:", "Delivered" in body_text or "delivered" in body_text.lower())
        
        await browser.close()
        
    print(f"Time taken: {time.time() - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
