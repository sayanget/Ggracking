import urllib.request
import json
import ssl

target_url = "https://dms.gofoexpress.com/prod-api/waybill/track/private/list"
token = "eyJhbGciOiJIUzUxMiJ9.eyJsb2dpbl91c2VyX2tleSI6ImQ1M2ExYmQzLTZiZjQtNDI2Ni05ZGE2LWMyZmUzYjE0YzhkNyJ9.iV6TsWJExhrE-ir26sQ4u7iRKxSUDHBokRl7uhlpbqqyHgVs8OSKg1zzYpcxBbGbjAM8PiIGlWOeww4z_kCr7Q"
cookie = "username=6265587634; rememberMe=true; password=IZbd8kDFB/PjwWG9BQMAjS3KX2IO95Or1o9hOr0RoZfX3KEOiksDQ8JE+mUt0Ce1u5WBjDrSO7meQBqmgCa1kA==; DATETIME_FORMAT={\"value\":\"MM/DD/YYYY HH:mm:ss\",\"expire\":1779217576038}; JSESSIONID=A4B9FB5BE5BAF0C75E0A0119E3200FE8"

body = json.dumps({"waybillNoList": ["123"], "isHistory": False}).encode("utf-8")

req = urllib.request.Request(target_url, data=body, method="POST")

req.add_header("Content-Type", "application/json;charset=utf-8")
req.add_header("Accept", "application/json, text/plain, */*")
req.add_header("Authorization", f"Bearer {token}")
req.add_header("Admin-Token", token)
req.add_header("Cookie", cookie)
req.add_header("lang", "zh")
req.add_header("source", "WEB")
req.add_header("tenant-id", "us")
req.add_header("app-code", "gofo-base")
req.add_header("auth-tag-x", "unauthorized")
req.add_header("X-Requested-With", "XMLHttpRequest")

try:
    with urllib.request.urlopen(req, timeout=15) as response:
        with open("out.json", "w", encoding="utf-8") as f:
            f.write(response.read().decode("utf-8"))
        print("Done")
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        with open("out.json", "w", encoding="utf-8") as f:
            f.write(e.read().decode("utf-8"))
        print("Done (Error)")
