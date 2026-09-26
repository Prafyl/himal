"""Find settlements along each traced flow path, their chainage, and OSM buildings in the flood corridor."""
import json, math, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace_rivers import overpass, hav  # noqa: E402

OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo-out"))
os.makedirs(OUT, exist_ok=True)
CORRIDOR_KM = 0.25

def chain(path):
    c = [0.0]
    for i in range(1, len(path)): c.append(c[-1] + hav(path[i-1], path[i]))
    return c

def nearest(path, ch, p):
    best = (1e9, 0)
    for i, q in enumerate(path):
        d = hav(p, q)
        if d < best[0]: best = (d, i)
    return best[0], ch[best[1]]

for key in sys.argv[1:]:
    d = json.load(open(os.path.join(OUT, f"{key}.json")))
    path = d["river"]; ch = chain(path)
    lons = [p[0] for p in path]; lats = [p[1] for p in path]
    s, w, n, e = min(lats) - .02, min(lons) - .02, max(lats) + .02, max(lons) + .02
    q = f"""[out:json][timeout:200];
(node["place"~"^(village|town|hamlet|locality)$"]({s},{w},{n},{e}););out;
(way["building"]({s},{w},{n},{e}););out center;"""
    r = overpass(q)
    places, blds = [], []
    for el in r["elements"]:
        if el["type"] == "node" and "place" in el.get("tags", {}):
            places.append(el)
        elif el["type"] == "way":
            blds.append((el["center"]["lon"], el["center"]["lat"]))
    # buildings in corridor with chainage
    bch = []
    for b in blds:
        dd, c = nearest(path[::2], ch[::2], b)
        if dd < CORRIDOR_KM: bch.append(c)
    vs = []
    for p in places:
        t = p["tags"]; name = t.get("name:en") or t.get("name")
        if not name: continue
        pt = (p["lon"], p["lat"])
        dd, c = nearest(path, ch, pt)
        if dd > 1.0: continue
        near = sum(1 for x in bch if abs(x - c) < 1.5)
        vs.append({"name": name, "ne": t.get("name:ne") or t.get("name"), "lon": round(pt[0], 5), "lat": round(pt[1], 5),
                   "km": round(c, 1), "off": round(dd, 2), "place": t["place"], "buildings": near, "ele": t.get("ele"), "pop": t.get("population")})
    vs.sort(key=lambda v: v["km"])
    d["bkm"] = sorted(round(x, 1) for x in bch); d["villages"] = vs; d["corridorBuildings"] = len(bch); d["lengthKm"] = round(ch[-1], 1)
    json.dump(d, open(os.path.join(OUT, f"{key}.json"), "w"))
    print(f"== {key}: {len(bch)} buildings in {CORRIDOR_KM*1000:.0f} m corridor over {ch[-1]:.1f} km")
    for v in []: print(f"  {v['km']:5.1f} km  {v['name']:<22} {v['place']:<9} off {v['off']} km  bld {v['buildings']}  ele {v['ele']} pop {v['pop']}")
    time.sleep(5)
