import requests
import re

def test():
    url = "https://externalcall.17track.net/single.shtml?nums=SPXMCO115400412373&fc=0&lang=en&h=560"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    r = requests.get(url, headers=headers, timeout=10)
    print("Status:", r.status_code)
    
    # Save the HTML to check it
    with open("widget_single.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("Saved to widget_single.html")
    
    # Find all script elements
    script_srcs = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', r.text)
    print("Script Sources:")
    for src in script_srcs:
        print(" -", src)
        
if __name__ == "__main__":
    test()
