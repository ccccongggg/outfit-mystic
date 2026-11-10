import json, urllib.parse, urllib.request

UA = {"User-Agent": "outfit-mystic-demo/1.0 (hackathon; contact: local)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")


print("=== OPENVERSE ===")
try:
    u = "https://api.openverse.org/v1/images/?q=" + urllib.parse.quote("black t-shirt") + "&page_size=3"
    j = json.loads(get(u))
    for it in j.get("results", []):
        print("-", (it.get("title") or "")[:40], "|", it.get("license"), "|", it.get("url"))
except Exception as e:
    print("ERR", type(e).__name__, e)

print("=== WIKIMEDIA COMMONS ===")
try:
    u = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search"
         "&gsrsearch=" + urllib.parse.quote("t-shirt") + "&gsrlimit=3&gsrnamespace=6"
         "&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json")
    j = json.loads(get(u))
    for p in (j.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        print("-", (p.get("title") or "")[:50], "|", ii.get("thumburl") or ii.get("url"))
except Exception as e:
    print("ERR", type(e).__name__, e)

print("=== DUCKDUCKGO (vqd probe) ===")
try:
    import re
    html = get("https://duckduckgo.com/?q=" + urllib.parse.quote("black t-shirt product") + "&iax=images&ia=images")
    m = re.search(r'vqd="([\d-]+)"', html) or re.search(r"vqd=([\d-]+)&", html)
    print("vqd found:", bool(m), m.group(1) if m else "")
except Exception as e:
    print("ERR", type(e).__name__, e)
