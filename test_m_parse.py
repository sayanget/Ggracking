import requests

def test():
    url = "https://m.17track.net/en/track?nums=SPXMCO115400412373"
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    r = requests.get(url, headers=headers, timeout=10)
    print("Status:", r.status_code)
    
    # Save the HTML to check it
    with open("m_track.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("Saved to m_track.html")
    
    # Search for tracking numbers or keyword 'Delivered' or 'SpeedX' in the HTML
    keywords = ["SPXMCO", "Delivered", "SpeedX", "Ocala", "state", "status", "data"]
    for kw in keywords:
        found = kw in r.text
        print(f"Keyword '{kw}' found:", found)

if __name__ == "__main__":
    test()
