import requests

def test():
    url = "https://externalcall.17track.net/single.shtml?nums=SPXMCO115400412373&fc=0&lang=en&h=560"
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
        print("Snippet:")
        print(r.text[:500])
        
        # Check if tracking details or script tags exist
        print("Keywords check:")
        for kw in ["Delivered", "SPXMCO", "Ocala", "script", "iframe", "yq"]:
            print(f"Keyword '{kw}' found:", kw in r.text)
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
