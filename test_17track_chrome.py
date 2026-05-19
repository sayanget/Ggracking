import asyncio
import time
from playwright.async_api import async_playwright

async def main():
    tracking_no = "SPXMCO115400412373"
    url = f"https://t.17track.net/en#nums={tracking_no}"
    
    start_time = time.time()
    async with async_playwright() as p:
        print("Launching browser with channel='chrome'...")
        try:
            # We use the system's installed Chrome in headless mode
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
        # Avoid webdriver detection
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=30000)
        
        print("Waiting for page elements...")
        await page.wait_for_timeout(10000)
        
        # Take a screenshot to verify
        await page.screenshot(path="17track_chrome.png")
        print("Screenshot saved to 17track_chrome.png")
        
        # Extract body text
        body_text = await page.inner_text("body")
        print("Length of body text:", len(body_text))
        
        with open("17track_chrome_body.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print("Saved body text to 17track_chrome_body.txt")
        
        # Search for status keywords
        print("Contains SPXMCO:", "SPXMCO" in body_text)
        print("Contains SpeedX:", "SpeedX" in body_text)
        print("Contains Delivered:", "Delivered" in body_text or "delivered" in body_text.lower())
        
        await browser.close()
        
    print(f"Time taken: {time.time() - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
