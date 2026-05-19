import requests
import urllib.parse

def encode_tracking_id(tracking_id: str) -> str:
    encoded = []
    for c in tracking_id:
        val = (ord(c) - 50) % 126
        encoded.append(chr(val))
    # URL encode but keep ! raw if needed, or just let quote do it.
    # The intercepted one had '!' raw and the rest percent-encoded.
    enc_str = "".join(encoded)
    
    # We can encode it carefully:
    res = ""
    for c in enc_str:
        if c == '!':
            res += '!'
        else:
            # URL encode the single char with uppercase hex
            res += f"%{ord(c):02X}"
    return res

def test():
    tracking = "SPXMCO115400412373"
    enc_tracking = encode_tracking_id(tracking)
    print("Encoded Tracking:", enc_tracking)
    
    url = "https://parcelsapp.com/api/v2/parcels"
    
    # Let's use the exact payload from the request
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
    
    # Convert payload to urlencoded string
    # We must construct the post data string directly because requests' data dict might escape it differently
    post_data_parts = []
    for k, v in payload.items():
        if k == "trackingId":
            # Already encoded
            post_data_parts.append(f"{k}={v}")
        else:
            post_data_parts.append(f"{k}={urllib.parse.quote(v)}")
            
    post_data = "&".join(post_data_parts)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://parcelsapp.com",
        "Referer": f"https://parcelsapp.com/en/tracking/{tracking}"
    }
    
    print("POST to", url)
    r = requests.post(url, data=post_data, headers=headers, timeout=15)
    print("Status:", r.status_code)
    try:
        res_json = r.json()
        print("Success! Response JSON keys:", list(res_json.keys()))
        # Print a snippet of the parsed tracking data
        print("States / Status:")
        if "states" in res_json:
            for s in res_json["states"]:
                print(" - State:", s)
        if "status" in res_json:
            print("Status attribute:", res_json["status"])
    except Exception as e:
        print("Failed to parse JSON. Error:", e)
        print("Response snippet:", r.text[:500])

if __name__ == "__main__":
    test()
