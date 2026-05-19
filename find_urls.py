import re
with open('index.js', 'r', encoding='utf-8') as f:
    data = f.read()
urls = set(re.findall(r'\"([a-zA-Z0-9_\-\/]+\.js)\"', data))
urls.update(re.findall(r'\'([a-zA-Z0-9_\-\/]+\.js)\'', data))
for u in sorted(list(urls)):
    print(u)
