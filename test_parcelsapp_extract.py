import requests
import re

def test():
    url = "https://parcelsapp.com/en/tracking/SPXMCO115400412373"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    r = requests.get(url, headers=headers, timeout=10)
    print("Status:", r.status_code)
    
    # Save the HTML to check it
    with open("parcels.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("Saved to parcels.html")
    
    # Print lines containing 'api' or 'parcels' or 'uuid' or 'tracking' or 'script'
    lines = r.text.split("\n")
    for line in lines:
        if any(x in line for x in ["api", "parcels", "uuid", "tracking", "var ", "const "]):
            if len(line.strip()) < 500:
                print(line.strip())

if __name__ == "__main__":
    test()
