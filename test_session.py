import requests

def test():
    s = requests.Session()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br"
    }
    
    # 1. GET homepage to acquire cookies
    print("GET https://t.17track.net/en ...")
    try:
        r1 = s.get("https://t.17track.net/en", headers=headers, timeout=10)
        print("GET Status:", r1.status_code)
        print("Cookies acquired:", s.cookies.get_dict())
    except Exception as e:
        print("GET Error:", e)
        return
        
    # 2. POST to active endpoint
    url = "https://t.17track.net/rest/v1/track/active"
    headers.update({
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "Origin": "https://t.17track.net",
        "Referer": "https://t.17track.net/en",
        "X-Requested-With": "XMLHttpRequest"
    })
    
    payload = {
        "guid": "",
        "data": [{"num": "SPXMCO115400412373"}]
    }
    
    print(f"POST {url} ...")
    try:
        r2 = s.post(url, json=payload, headers=headers, timeout=10)
        print("POST Status:", r2.status_code)
        print("Content-Type:", r2.headers.get("Content-Type", ""))
        print("Snippet:", r2.text[:500])
    except Exception as e:
        print("POST Error:", e)

if __name__ == "__main__":
    test()
