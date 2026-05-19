import sys
from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Go to 17track en query page
        url = "https://t.17track.net/en#nums=SPXMCO115400412373"
        print(f"Navigating to {url}...")
        page.goto(url)
        
        # Wait for the track result to load
        print("Waiting for page load / elements...")
        page.wait_for_timeout(5000) # Wait 5 seconds for ajax requests
        
        # Let's take a screenshot to see what's loaded
        page.screenshot(path="playwright_test.png")
        print("Screenshot saved to playwright_test.png")
        
        # Let's print some elements or text
        content = page.content()
        print("Page Content length:", len(content))
        
        # Find where SPXMCO115400412373 is in text
        text_content = page.evaluate("() => document.body.innerText")
        print("InnerText snippet:")
        print(text_content[:2000])
        
        browser.close()

if __name__ == "__main__":
    test()
