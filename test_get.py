import requests

def test():
    urls = [
        "https://www.17track.net/en/express/single?nums=SPXMCO115400412373",
        "https://m.17track.net/en/track?nums=SPXMCO115400412373"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    for url in urls:
        print(f"GET {url}...")
        try:
            r = requests.get(url, headers=headers, timeout=10)
            print("Status:", r.status_code)
            print("Content length:", len(r.text))
            print("Title:", r.text[:2000].split("<title>")[-1].split("</title>")[0] if "<title>" in r.text else "No title")
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    test()
