import os
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
OUT = "web/assets/items/_cand"
os.makedirs(OUT, exist_ok=True)

items = {
    "tee_black": "https://static.vecteezy.com/system/resources/previews/066/080/127/non_2x/a-black-t-shirt-on-a-white-background-free-photo.jpg",
    "short_olive": "https://static.vecteezy.com/system/resources/previews/075/210/846/non_2x/olive-green-cotton-shorts-laid-flat-photo.jpg",
    "jogger_gray": "https://static.vecteezy.com/system/resources/previews/048/156/725/non_2x/gray-sweatpants-on-a-white-background-free-photo.jpg",
    "dress_gray": "https://static.vecteezy.com/system/resources/previews/002/295/172/non_2x/dress-on-white-background-free-photo.jpg",
    "shoes_heel": "https://static.vecteezy.com/system/resources/previews/019/621/981/non_2x/leather-beige-high-heel-shoes-on-a-white-background-photo.jpg",
    "jogger_red_a": "https://i1.adis.ws/i/truworths/prod3196905_1.jpeg",
    "jogger_red_b": "https://www.redvanly.com/cdn/shop/products/HALLIDAY_MAROON_0007_edit.jpg",
    "jogger_red_c": "https://static.vecteezy.com/system/resources/previews/072/886/864/large_2x/jogger-pants-sweatpants-in-grey-burgundy-black-jogger-mockup-photo.jpg",
}

for k, u in items.items():
    try:
        req = urllib.request.Request(u, headers=UA)
        data = urllib.request.urlopen(req, timeout=30).read()
        ext = ".png" if u.lower().endswith(".png") else ".jpg"
        fn = os.path.join(OUT, k + ext)
        open(fn, "wb").write(data)
        print(f"[{k}] OK {len(data)} -> {fn}")
    except Exception as e:
        print(f"[{k}] ERR {type(e).__name__} {e}")
