import requests
import urllib.parse

def encode_tracking_id(tracking_id: str) -> str:
    encoded = []
    for c in tracking_id:
        val = (ord(c) - 50) % 126
        encoded.append(chr(val))
    enc_str = "".join(encoded)
    res = ""
    for c in enc_str:
        if c == '!':
            res += '!'
        else:
            res += f"%{ord(c):02X}"
    # Double encode percent signs
    return res.replace("%", "%25")

def test():
    tracking = "SPXMCO115400412373"
    enc_tracking = encode_tracking_id(tracking)
    print("Double Encoded Tracking:", enc_tracking)
    
    session = requests.Session()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    # 1. GET page to establish session/cookies
    get_url = f"https://parcelsapp.com/en/tracking/{tracking}"
    print("GETting page to get cookies...")
    r_get = session.get(get_url, headers=headers, timeout=15)
    print("GET Status:", r_get.status_code)
    print("Cookies:", session.cookies.get_dict())
    
    # 2. POST to api/v2/parcels
    post_url = "https://parcelsapp.com/api/v2/parcels"
    
    se_val = "1280x720,1280x720,1280x720,no,Win32,Gecko,Mozilla,Netscape,Google Inc.,true,no,Google Inc. (Google),ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver),true,true,cGFyY2Vsc2FwcC5jb20=,Error: DOWN\n    at C (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:18412)\n    at Object.QozGm (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:22425)\n    at HTMLDocument.querySelector (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:24343)\n    at Fi (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:86674)\n    at Ri.e.mount (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:86392)\n    at HTMLDocument.<anonymous> (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:143685),1156,18,3326705770"
    
    payload = {
        "trackingId": enc_tracking,
        "carrier": "Auto-Detect",
        "language": "zh",
        "country": "Unknown",
        "platform": "web-desktop",
        "wd": "true",
        "c": "false",
        "p": "0",
        "l": "1",
        "se": se_val
    }
    
    post_data_parts = []
    for k, v in payload.items():
        if k == "trackingId":
            post_data_parts.append(f"{k}={v}")
        else:
            post_data_parts.append(f"{k}={urllib.parse.quote(v)}")
            
    post_data = "&".join(post_data_parts)
    
    post_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://parcelsapp.com",
        "Referer": get_url
    }
    
    print("POSTing request...")
    r_post = session.post(post_url, data=post_data, headers=post_headers, timeout=15)
    print("POST Status:", r_post.status_code)
    try:
        print("Response JSON:")
        print(r_post.json())
    except Exception as e:
        print("Error parsing JSON:", e)
        print("Response snippet:", r_post.text[:500])

if __name__ == "__main__":
    test()
