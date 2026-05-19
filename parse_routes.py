import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import json

token = "eyJhbGciOiJIUzUxMiJ9.eyJsb2dpbl91c2VyX2tleSI6ImQ1M2ExYmQzLTZiZjQtNDI2Ni05ZGE2LWMyZmUzYjE0YzhkNyJ9.iV6TsWJExhrE-ir26sQ4u7iRKxSUDHBokRl7uhlpbqqyHgVs8OSKg1zzYpcxBbGbjAM8PiIGlWOeww4z_kCr7Q"

def get_routes():
    req = urllib.request.Request("https://dms.gofoexpress.com/prod-api/getRouters", method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Admin-Token", token)
    req.add_header("lang", "zh")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    def find_track(routes, prefix=""):
        for r in routes:
            path = prefix + "/" + r.get("path", "")
            path = path.replace("//", "/")
            if "track" in path.lower() or "waybill" in path.lower():
                print(f"Path: {path}")
                print(f"Component: {r.get('component')}")
            if "children" in r:
                find_track(r["children"], path)
                
    find_track(data.get("data", []))

get_routes()
