"""Bake one static 3D scene (a lake valley, or all of Nepal): a height grid + a satellite texture.

Output (into the app's public/scene/):
  height.bin   Uint16 little-endian, metres, row-major, north row first  (GW x GH)
  sat.jpg      Sentinel-2 cloudless mosaic, same extent (TW x TH)
  scene.json   extent, grid size, min/max elevation
"""
import io, json, math, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

OUT = sys.argv[1]
W, S, E, N = map(float, sys.argv[2:6])
os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tilecache")
os.makedirs(CACHE, exist_ok=True)

DEM_Z, SAT_Z = int(os.environ.get("DEM_Z", 13)), int(os.environ.get("SAT_Z", 14))
YEAR = 2023

lat0 = math.radians((S + N) / 2)
aspect = ((N - S) * 111.32) / ((E - W) * 111.32 * math.cos(lat0))  # height / width
GRID, TEX = int(os.environ.get("GRID", 800)), 4096  # longest side of the height grid (vertices) and of the texture (px)
if aspect <= 1:
    GW, GH = GRID, round(GRID * aspect)
    TW, TH = TEX, round(TEX * aspect / 16) * 16
else:
    GW, GH = round(GRID / aspect), GRID
    TW, TH = round(TEX / aspect / 16) * 16, TEX

def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def fetch(url, path):
    if os.path.exists(path): return open(path, "rb").read()
    for a in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "himal-hackathon/1.0"})
            b = urllib.request.urlopen(req, timeout=60).read()
            open(path, "wb").write(b); return b
        except Exception as e:
            time.sleep(2 + a * 3)
    raise RuntimeError(url)

def mosaic(z, url_fmt, kind, tile=256):
    x0, y0 = tile_xy(W, N, z); x1, y1 = tile_xy(E, S, z)
    tx = range(int(x0), int(x1) + 1); ty = range(int(y0), int(y1) + 1)
    jobs = [(x, y) for y in ty for x in tx]
    def get(xy):
        x, y = xy
        return xy, fetch(url_fmt.format(z=z, x=x, y=y), os.path.join(CACHE, f"{kind}_{z}_{x}_{y}"))
    img = Image.new("RGB", (len(tx) * tile, len(ty) * tile))
    with ThreadPoolExecutor(8) as ex:
        for (x, y), b in ex.map(get, jobs):
            img.paste(Image.open(io.BytesIO(b)).convert("RGB"), ((x - tx[0]) * tile, (y - ty[0]) * tile))
    print(kind, len(jobs), "tiles", img.size)
    return np.asarray(img), tx[0], ty[0]

def resample(arr, z, ox, oy, w, h, tile=256):
    """sample the mercator mosaic on a regular lon/lat grid (bilinear)"""
    lons = W + (np.arange(w) + 0.5) / w * (E - W)
    lats = N - (np.arange(h) + 0.5) / h * (N - S)
    n = 2 ** z
    px = ((lons + 180) / 360 * n - ox) * tile - 0.5
    py = ((1 - np.arcsinh(np.tan(np.radians(lats))) / np.pi) / 2 * n - oy) * tile - 0.5
    X, Y = np.meshgrid(px, py)
    x0 = np.floor(X).astype(int); y0 = np.floor(Y).astype(int)
    fx = (X - x0)[..., None]; fy = (Y - y0)[..., None]
    a = arr.astype(np.float32)
    if a.ndim == 2: a = a[..., None]
    g = lambda yy, xx: a[np.clip(yy, 0, a.shape[0] - 1), np.clip(xx, 0, a.shape[1] - 1)]
    out = (g(y0, x0) * (1 - fx) * (1 - fy) + g(y0, x0 + 1) * fx * (1 - fy) + g(y0 + 1, x0) * (1 - fx) * fy + g(y0 + 1, x0 + 1) * fx * fy)
    return out

# --- elevation (AWS terrarium) ---
dem, ox, oy = mosaic(DEM_Z, "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", "dem")
d = dem.astype(np.float64)
elev = d[..., 0] * 256 + d[..., 1] + d[..., 2] / 256 - 32768
H = resample(elev, DEM_Z, ox, oy, GW, GH)[..., 0]
H = np.clip(H, 0, 9000)
H.round().astype("<u2").tofile(os.path.join(OUT, "height.bin"))
print("height grid", GW, GH, "range", H.min(), H.max())

# --- imagery (Sentinel-2 cloudless by EOX) ---
sat, ox, oy = mosaic(SAT_Z, f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{YEAR}_3857/default/g/{{z}}/{{y}}/{{x}}.jpg", f"s2{YEAR}")
T = resample(sat, SAT_Z, ox, oy, TW, TH)
im = Image.fromarray(np.clip(T, 0, 255).astype(np.uint8))
im.save(os.path.join(OUT, "sat.jpg"), quality=86, optimize=True, progressive=True)
print("texture", im.size, os.path.getsize(os.path.join(OUT, "sat.jpg")) // 1024, "KB")

json.dump({"west": W, "south": S, "east": E, "north": N, "gw": GW, "gh": GH, "tw": TW, "th": TH,
           "minEle": float(H.min()), "maxEle": float(H.max()),
           "widthKm": (E - W) * 111.32 * math.cos(lat0), "heightKm": (N - S) * 111.32,
           "imagery": f"Sentinel-2 cloudless {YEAR} by EOX IT Services GmbH (contains modified Copernicus Sentinel data {YEAR})"},
          open(os.path.join(OUT, "scene.json"), "w"), indent=1)
