import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import json

token = "eyJhbGciOiJIUzUxMiJ9.eyJsb2dpbl91c2VyX2tleSI6ImQ1M2ExYmQzLTZiZjQtNDI2Ni05ZGE2LWMyZmUzYjE0YzhkNyJ9.iV6TsWJExhrE-ir26sQ4u7iRKxSUDHBokRl7uhlpbqqyHgVs8OSKg1zzYpcxBbGbjAM8PiIGlWOeww4z_kCr7Q"

def test_endpoint(url, payload=None, method="POST"):
    req = urllib.request.Request(url, method=method)
    if payload is not None:
        req.data = json.dumps(payload).encode("utf-8")
        req.add_header("Content-Type", "application/json;charset=utf-8")
    
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Admin-Token", token)
    req.add_header("lang", "zh")
    req.add_header("user-time-zone", "America/Los_Angeles")
    req.add_header("auth-tag-x", "unauthorized")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Referer", "https://dms.gofoexpress.com/gofo-base/epss/trackManage2/Tracking")
    req.add_header("Origin", "https://dms.gofoexpress.com")
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            with open('data.json', 'w', encoding='utf-8') as f:
                json.dump(res_data, f, ensure_ascii=False, indent=2)
            print("Saved to data.json")
    except Exception as e:
        if hasattr(e, 'code'):
            print(f"{url} -> {e.code}: {e.read().decode('utf-8')[:200]}")
        else:
            print(f"{url} -> Exception: {e}")

test_endpoint("https://dms.gofoexpress.com/prod-api/waybill/track/private/list", {
    "orderNos": ["GFUS01049348346946"],
    "queryType": "1",
    "delStatus": "0"
})
