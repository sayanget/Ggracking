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
    return res

def test():
    tracking = "SPXMCO115400412373"
    enc_tracking = encode_tracking_id(tracking)
    
    url = "https://parcelsapp.com/api/v2/parcels"
    
    # Wait, in the intercepted request, the trackingId value has double percent-encoding for the encrypted bytes!
    # Let's check:
    # Intercepted value: trackingId=!%251E%2526%251B%2511%251D%257D%257D%2503%2502%257C%257C%2502%257D%2500%2501%2505%2501
    # Notice '%251E'! %25 is the percent encoding of '%'.
    # This means the string was double-encoded:
    # 1. First, the string was constructed as: "!%1E%26%1B..."
    # 2. Then, when serialized in the form post data (x-www-form-urlencoded), the '%' characters got URL encoded to '%25'!
    # Let's verify:
    # If we double-encode it, yes! '!' remains '!', and '%1E' becomes '%251E'.
    # So we should send:
    # trackingId=!%251E%2526%251B%2511%251D%257D%257D%2503%2502%257C%257C%2502%257D%2500%2501%2505%2501
    
    # Wait, what if we use the exact raw string:
    double_enc_tracking = "!%251E%2526%251B%2511%251D%257D%257D%2503%2502%257C%257C%2502%257D%2500%2501%2505%2501"
    
    se_val = "1280x720,1280x720,1280x720,no,Win32,Gecko,Mozilla,Netscape,Google Inc.,true,no,Google Inc. (Google),ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver),true,true,cGFyY2Vsc2FwcC5jb20=,Error: DOWN\n    at C (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:18412)\n    at Object.QozGm (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:22425)\n    at HTMLDocument.querySelector (https://dvow0vltefbxy.cloudfront.net/packs/js/application-1cc1f13a002322ada94f.js:1:24343)\n    at Fi (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:86674)\n    at Ri.e.mount (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:86392)\n    at HTMLDocument.<anonymous> (https://dvow0vltefbxy.cloudfront.net/packs/js/recent-tracking-b9c47e442a8eeb4fe8ca.js:1:143685),1156,18,3326705770"
    
    payload = {
        "trackingId": double_enc_tracking,
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
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://parcelsapp.com",
        "Referer": f"https://parcelsapp.com/en/tracking/{tracking}"
    }
    
    r = requests.post(url, data=post_data, headers=headers, timeout=15)
    print("Response JSON:")
    print(r.json())

if __name__ == "__main__":
    test()
