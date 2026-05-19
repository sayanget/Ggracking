import asyncio
import time
from playwright.async_api import async_playwright

async def main():
    tracking_no = "SPXMCO115400412373"
    url = "https://t.17track.net/en"
    
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
        
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=30000)
        
        print("Waiting for textarea...")
        # Let's locate the input textarea. Usually it is a textarea or has a class or placeholder.
        # In 17track, let's find it. Let's look for a textarea element or placeholder.
        # In 17track, the input area is usually a textarea. Let's try to type into "textarea"
        await page.wait_for_selector("textarea", timeout=15000)
        
        # Click and clear
        print("Clearing textarea...")
        await page.click("textarea")
        # Select all and delete
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        
        print(f"Typing tracking number: {tracking_no}...")
        await page.fill("textarea", tracking_no)
        
        # Now click the Track / Next button.
        # Let's find the button. In the text body it has "Next" (or "track" or has class "btn-track").
        # Let's search for a button with text "Next" or class containing "btn" or "track".
        print("Clicking Next/Track button...")
        # Let's try multiple selectors or click by text
        try:
            await page.click("button:has-text('Next')")
        except:
            try:
                await page.click(".btn-track")
            except:
                # Fallback: press Enter in the textarea
                await page.press("textarea", "Enter")
                
        print("Waiting for tracking results to load...")
        # Wait up to 10 seconds for AJAX/results
        await page.wait_for_timeout(10000)
        
        # Take a screenshot
        await page.screenshot(path="17track_typed_result.png")
        print("Screenshot saved to 17track_typed_result.png")
        
        # Extract body text
        body_text = await page.inner_text("body")
        print("Length of body text:", len(body_text))
        
        with open("17track_typed_body.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print("Saved body text to 17track_typed_body.txt")
        
        print("Contains SPXMCO:", "SPXMCO" in body_text)
        print("Contains SpeedX:", "SpeedX" in body_text)
        print("Contains Delivered:", "Delivered" in body_text or "delivered" in body_text.lower())
        
        await browser.close()
        
    print(f"Time taken: {time.time() - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
