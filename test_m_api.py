import requests

def test():
    urls = [
        "https://m.17track.net/rest/v1/track/active"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "Origin": "https://m.17track.net",
        "Referer": "https://m.17track.net/en/track?nums=SPXMCO115400412373"
    }
    
    payload = {
        "guid": "",
        "data": [{"num": "SPXMCO115400412373"}]
    }
    
    for url in urls:
        print(f"POST {url}...")
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=10)
            print("Status:", r.status_code)
            print("Content-Type:", r.headers.get("Content-Type", ""))
            print("Snippet:", r.text[:200])
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    test()
