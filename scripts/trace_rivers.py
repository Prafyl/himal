"""Trace downstream flow paths from glacial lakes using OSM waterway directionality."""
import json, math, sys, time, urllib.parse, urllib.request, os

OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo-out"))
os.makedirs(OUT, exist_ok=True)

def overpass(q):
    data = urllib.parse.urlencode({"data": q}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=data,
                                         headers={"User-Agent": "himal-hackathon/1.0", "Accept": "application/json"})
            return json.load(urllib.request.urlopen(req, timeout=240))
        except Exception as e:
            print("retry", attempt, e, file=sys.stderr); time.sleep(10 + attempt * 10)
    raise SystemExit("overpass failed")

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

LAKES = {
    # id: (lake osm selector, bbox s,w,n,e, max km)
    "tsho-rolpa": ("way(284549316)", (27.45, 86.0, 27.92, 86.52), 70),
    "imja-tsho": ("relation(13249992)", (27.55, 86.6, 27.93, 86.95), 45),
    "lower-barun": ("way(263355394)", (27.35, 87.0, 27.85, 87.35), 55),
    "thulagi": ("way(243513476)", (28.2, 84.3, 28.52, 84.55), 45),
    "thyanbo": ("way(948727578)", (27.7, 86.55, 27.9, 86.75), 25),
}

def main():
  only = sys.argv[1:] or list(LAKES)
  for key in only:
      sel, (s, w, n, e), maxkm = LAKES[key]
      q = f"""[out:json][timeout:200];
  ({sel};)->.lake; .lake out geom;
  way["waterway"~"^(river|stream)$"]({s},{w},{n},{e}); out geom;"""
      d = overpass(q)
      lake = None; ways = []
      for el in d["elements"]:
          if el.get("tags", {}).get("natural") == "water":
              lake = el
          elif "waterway" in el.get("tags", {}):
              ways.append(el)
      # lake ring
      if lake["type"] == "way":
          ring = [(p["lon"], p["lat"]) for p in lake["geometry"]]
      else:
          ring = []
          for m in lake["members"]:
              if m.get("role") == "outer": ring += [(p["lon"], p["lat"]) for p in m["geometry"]]
      geoms = [[(p["lon"], p["lat"]) for p in w_["geometry"]] for w_ in ways]
      names = [w_["tags"].get("name:en") or w_["tags"].get("name") for w_ in ways]
      # start: way whose start point is closest to the lake ring (outflow)
      best = None
      for i, g in enumerate(geoms):
          dmin = min(hav(g[0], r) for r in ring[::max(1, len(ring)//60)])
          if best is None or dmin < best[0]: best = (dmin, i)
      print(key, "start way dist km", round(best[0], 3), names[best[1]], file=sys.stderr)
      path = list(geoms[best[1]]); used = {best[1]}; seq = [names[best[1]]]
      total = sum(hav(path[k], path[k+1]) for k in range(len(path)-1))
      while total < maxkm:
          end = path[-1]; nxt = None
          for i, g in enumerate(geoms):
              if i in used: continue
              dd = hav(g[0], end)
              if dd < 0.03 and (nxt is None or (ways[i]["tags"]["waterway"] == "river")):
                  nxt = i
          if nxt is None:
              # joins mid-way into a larger river: find nearest vertex on another way and continue from there
              cand = None
              for i, g in enumerate(geoms):
                  if i in used: continue
                  for k, p in enumerate(g):
                      dd = hav(p, end)
                      if dd < 1.2 and (cand is None or dd < cand[0]): cand = (dd, i, k)
              if cand is None: break
              _, i, k = cand; used.add(i); seg = geoms[i][k:]; seq.append(names[i])
          else:
              used.add(nxt); seg = geoms[nxt]; seq.append(names[nxt])
          total += sum(hav(seg[k], seg[k+1]) for k in range(len(seg)-1)) + hav(path[-1], seg[0])
          path += seg[1:]
      print(key, "length km", round(total, 1), "rivers", [x for x in dict.fromkeys(seq)], file=sys.stderr)
      json.dump({"lake": ring, "river": path}, open(os.path.join(OUT, f"{key}.json"), "w"))
      time.sleep(3)

if __name__ == '__main__':
    main()