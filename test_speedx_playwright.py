import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Navigate to SpeedX tracking page
        url = "https://www.speedx.io/tracking?nums=SPXMCO115400412373"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        
        # Wait a bit for tracking details to render
        await page.wait_for_timeout(5000)
        
        # Take a screenshot
        await page.screenshot(path="speedx_playwright.png")
        print("Screenshot saved to speedx_playwright.png")
        
        # Print page content / text to see if tracking details are there
        text = await page.inner_text("body")
        print("Length of inner text:", len(text))
        print("Snippet of text:")
        print(text[:2000])
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
