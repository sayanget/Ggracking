import requests
import json

def test():
    url = "https://externalcall.17track.net/rest/v1/track/active"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://externalcall.17track.net/single.shtml?nums=SPXMCO115400412373&fc=0&lang=en&h=560",
        "Origin": "https://externalcall.17track.net"
    }
    
    payload = {
        "guid": "",
        "data": [{"num": "SPXMCO115400412373"}]
    }
    
    print(f"POST {url} ...")
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        print("Status:", r.status_code)
        print("Content-Type:", r.headers.get("Content-Type", ""))
        print("Snippet:")
        print(r.text[:500])
        
        # Keywords check
        for kw in ["Delivered", "SPXMCO", "Ocala"]:
            print(f"Keyword '{kw}' found:", kw in r.text)
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
