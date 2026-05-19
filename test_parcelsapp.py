import requests
import json

def test():
    url = "https://parcelsapp.com/en/tracking/SPXMCO115400412373"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    print(f"GET {url}...")
    try:
        r = requests.get(url, headers=headers, timeout=10)
        print("Status:", r.status_code)
        print("Length:", len(r.text))
        
        # Check if tracking info is present
        print("Keywords check:")
        for kw in ["Delivered", "SPXMCO", "Ocala", "SpeedX"]:
            print(f"Keyword '{kw}' found:", kw in r.text)
            
        # ParcelsApp usually returns the data inside a script block or makes an AJAX POST to /api/v2/parcels
        # Let's check if the HTML has references to /api/v2/parcels or window.data or similar
        if "/api/v2/parcels" in r.text:
            print("Found /api/v2/parcels in HTML!")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
