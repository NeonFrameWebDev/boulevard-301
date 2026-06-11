#!/usr/bin/env python3
"""
Boulevard 301 responsive-image pipeline.
Scans the HTML + CSS for referenced assets, generates LANCZOS-downscaled WebP
variants (and a JPG fallback for any PNG-referenced source), and writes a
manifest the HTML rewrite can read.

Pure Pillow (no imagemagick). Never upscales. Originals are left untouched
(webp variants are new files; jpg fallbacks reuse the existing jpg sibling).
"""
import json, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
LADDER = [400, 640, 960, 1280, 1600]   # rungs; max output capped at min(src, 1600)
CAP = 1600
Q = 80

def scan_refs():
    refs = set()
    pat = re.compile(r'assets/([A-Za-z0-9_]+\.(?:png|jpe?g))')
    for fn in os.listdir(ROOT):
        if fn.endswith(".html"):
            with open(os.path.join(ROOT, fn), encoding="utf-8") as f:
                refs.update(pat.findall(f.read()))
    css = os.path.join(ROOT, "css", "style.css")
    if os.path.exists(css):
        with open(css, encoding="utf-8") as f:
            refs.update(pat.findall(f.read()))
    return sorted(refs)

def widths_for(src_w):
    target = min(src_w, CAP)
    ws = [w for w in LADDER if w < target] + [target]
    return sorted(set(ws))

def best_source(stem):
    """Read pixels from the highest-fidelity sibling (prefer a sane-sized jpg
    over a bloated screenshot png of identical dimensions)."""
    jpg = os.path.join(ASSETS, stem + ".jpg")
    png = os.path.join(ASSETS, stem + ".png")
    cand = [p for p in (jpg, png) if os.path.exists(p)]
    # pick the one with the largest pixel area (ties -> jpg, listed first)
    best, best_area = None, -1
    for p in cand:
        try:
            with Image.open(p) as im:
                a = im.size[0] * im.size[1]
        except Exception:
            continue
        if a > best_area:
            best, best_area = p, a
    return best

def main():
    refs = scan_refs()
    manifest = {}
    total_in = total_out = 0
    for ref in refs:
        stem = os.path.splitext(ref)[0]
        if stem == "logo":           # 200x200 8K, used tiny; leave as-is
            continue
        src = best_source(stem)
        if not src:
            print("  ! missing source for", ref); continue
        im = Image.open(src)
        im = ImageOps.exif_transpose(im).convert("RGB")
        sw, sh = im.size
        ws = widths_for(sw)
        variants = []
        for w in ws:
            h = round(sh * w / sw)
            out = os.path.join(ASSETS, f"{stem}-{w}.webp")
            im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=Q, method=6)
            total_out += os.path.getsize(out)
            variants.append({"w": w, "file": f"assets/{stem}-{w}.webp"})
        # fallback jpg: prefer existing jpg sibling; else transcode png->jpg
        jpg_sib = os.path.join(ASSETS, stem + ".jpg")
        if os.path.exists(jpg_sib):
            fallback = f"assets/{stem}.jpg"
        else:
            fw = min(sw, CAP); fh = round(sh * fw / sw)
            fout = os.path.join(ASSETS, f"{stem}.jpg")
            im.resize((fw, fh), Image.LANCZOS).save(fout, "JPEG", quality=82, optimize=True, progressive=True)
            fallback = f"assets/{stem}.jpg"
        total_in += os.path.getsize(src)
        manifest[ref] = {
            "stem": stem, "intrinsic": [sw, sh],
            "fallback": fallback,
            "widths": [v["w"] for v in variants],
            "srcset": ", ".join(f'{v["file"]} {v["w"]}w' for v in variants),
            "max": f"assets/{stem}-{ws[-1]}.webp",
        }
        print(f"  {ref:32s} {sw}x{sh}  -> webp {ws}")
    with open(os.path.join(ROOT, "tools", "img_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n{len(manifest)} images processed.")
    print(f"webp bytes generated: {total_out/1024:.0f} KB")

if __name__ == "__main__":
    main()
