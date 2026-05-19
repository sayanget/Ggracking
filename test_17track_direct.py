import requests
import json

def test():
    urls = [
        "https://www.17track.net/rest/v1/track/active",
        "https://t.17track.net/rest/v1/track/active",
        "https://api.17track.net/track/v1/gettrackinfo"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.17track.net/en",
        "Origin": "https://www.17track.net"
    }
    
    payload = {
        "guid": "",
        "data": [{"num": "SPXMCO115400412373"}]
    }
    
    for url in urls:
        print(f"\nPOST {url} ...")
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=10)
            print("Status:", r.status_code)
            print("Content-Type:", r.headers.get("Content-Type", ""))
            print("Snippet:", r.text[:200])
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    test()
