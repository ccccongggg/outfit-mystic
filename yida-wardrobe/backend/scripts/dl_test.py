import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
urls = [
    ("vecteezy", "https://static.vecteezy.com/system/resources/previews/066/080/127/non_2x/a-black-t-shirt-on-a-white-background-free-photo.jpg"),
    ("freepik", "https://img.freepik.com/premium-photo/black-t-shirt-with-white-background_1059430-104640.jpg"),
    ("alamy", "https://c8.alamy.com/comp/2C9XYB3/black-t-shirt-isolated-on-white-background-2C9XYB3.jpg"),
    ("dreamstime", "https://thumbs.dreamstime.com/b/simple-isolated-black-t-shirt-displayed-against-bright-white-background-product-shots-clean-backdrop-perfect-377750811.jpg"),
]
for name, u in urls:
    try:
        req = urllib.request.Request(u, headers=UA)
        data = urllib.request.urlopen(req, timeout=25).read()
        fn = f"scripts/_dl_{name}.jpg"
        open(fn, "wb").write(data)
        print(f"[{name}] OK {len(data)} bytes -> {fn}")
    except Exception as e:
        print(f"[{name}] ERR {type(e).__name__} {e}")
