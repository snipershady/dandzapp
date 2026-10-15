import random, math
from shapely.geometry import box, LineString, Point, Polygon, MultiPolygon
from shapely.ops import unary_union
import cairosvg, sys, json
MODE = sys.argv[1] if len(sys.argv) > 1 else "master"  # master | base | passage

random.seed(7)
U = 40            # px per quadretto (3 m / 10 ft)
OX, OY = 4, 3     # offset in quadretti
W, H = 37, 27     # dimensioni pagina in quadretti

def P(x, y): return ((x + OX) * U, (y + OY) * U)

# ---------- pianta (unita = quadretti) ----------
room3 = box(3, 0, 10, 5)           # Sacrario (nord)
room1 = box(4, 8, 12, 14)          # Sala d'ingresso
room2 = box(16, 4, 22, 12)         # Sala delle colonne (est)
stairs = box(7, 14, 9, 20.5)       # scala d'ingresso (dal basso)
corr13 = box(6, 5, 7, 8)
corr12 = box(12, 10, 16, 11)
secret = LineString([(9.9, 2), (19, 2), (19, 4.1)]).buffer(0.25, cap_style=2, join_style=2)

apse = Point(6.5, 0).buffer(1.4).intersection(box(4, -2, 9, 0.1))          # abside per l'altare
niche3 = Point(3, 2.5).buffer(0.62).intersection(box(2, 1, 3.1, 4))           # nicchia statua sala 3
niche2 = Point(22, 8).buffer(0.62).intersection(box(21.9, 7, 23, 9))          # nicchia statua sala 2
# --- grotta naturale (stanza 4) ---
rng = random.Random(11)
def smooth_noise(n, amp, harmonics=(2, 3, 5, 7, 11, 17)):
    ph = [rng.uniform(0, 2 * math.pi) for _ in harmonics]
    am = [amp * rng.uniform(0.5, 1.0) / (1 + 0.35 * i) for i, _ in enumerate(harmonics)]
    return lambda t: sum(a * math.sin(h * 2 * math.pi * t + p) for a, h, p in zip(am, harmonics, ph))

def roughen(poly, amp=0.35, step=0.15):
    ring = poly.exterior; L = ring.length; n = int(L / step)
    f = smooth_noise(n, amp)
    pts = []
    for i in range(n):
        t = i / n
        p = ring.interpolate(t, normalized=True); q = ring.interpolate((t + 0.002) % 1, normalized=True)
        tx, ty = q.x - p.x, q.y - p.y; m = math.hypot(tx, ty) or 1
        nx, ny = ty / m, -tx / m
        d = f(t) + rng.uniform(-0.04, 0.04)
        pts.append((p.x + nx * d, p.y + ny * d))
    g = Polygon(pts).buffer(0)
    return max(g.geoms, key=lambda x: x.area) if g.geom_type != "Polygon" else g

blobs = [Point(x, y).buffer(r) for x, y, r in [(18, 16.2, 1.6), (16.9, 18.3, 1.7), (18.6, 20.0, 1.6),
         (21.3, 18.0, 2.1), (23.5, 17.0, 1.6), (23.8, 19.6, 1.6), (21.5, 20.6, 1.5), (19.6, 17.8, 1.6)]]
cave = unary_union(blobs).buffer(0.6).buffer(-0.6)
cave = roughen(cave, 0.32)
corr24 = box(17.5, 12, 18.5, 15.0)                                   # da sala 2 alla grotta
tunnel = roughen(LineString([(24.6, 19.0), (25.6, 18.6), (26.6, 19.0), (28.0, 18.7)]).buffer(0.6), 0.12)
# --- stanza 5: caverna finale con pozza e stalattiti ---
room5 = unary_union([Point(x, y).buffer(r) for x, y, r in [(29.2, 17.6, 1.7), (30.8, 19.2, 1.9), (28.8, 20.1, 1.5), (30.4, 16.3, 1.3)]]).buffer(0.5).buffer(-0.5)
room5 = roughen(room5, 0.28)
pool = roughen(Point(30.9, 19.7).buffer(1.0).intersection(box(29, 18, 33, 21.5)).buffer(0.25), 0.18)
pool = pool.intersection(room5.buffer(-0.35))
# crepaccio che taglia la grotta da nord a sud, bordi irregolari
cl = LineString([(21.3, 13.5), (21.8, 15.8), (21.0, 18.0), (21.7, 20.2), (21.2, 23.5)])
fl, fr = smooth_noise(0, 0.28), smooth_noise(0, 0.28)
left, right = [], []
N = 120
for i in range(N + 1):
    t = i / N
    p = cl.interpolate(t, normalized=True); q = cl.interpolate(min(t + 0.01, 1), normalized=True); p0 = cl.interpolate(max(t - 0.01, 0), normalized=True)
    tx, ty = q.x - p0.x, q.y - p0.y; m = math.hypot(tx, ty)
    nx, ny = -ty / m, tx / m
    wl, wr = 0.75 + fl(t), 0.75 + fr(t)
    left.append((p.x + nx * wl, p.y + ny * wl)); right.append((p.x - nx * wr, p.y - ny * wr))
chasm = Polygon(left + right[::-1]).buffer(0).intersection(cave)
floor = unary_union([room1, room2, room3, stairs, corr13, corr12, secret, apse, niche3, niche2, cave, corr24, tunnel, room5])
floor_draw = floor if MODE != 'base' else unary_union([room1, room2, room3, stairs, corr13, corr12, apse, niche3, niche2, cave, corr24, tunnel, room5])

# ---------- tratteggio della roccia (stile Dyson) ----------
pts = []
for geom in [floor.exterior] + list(floor.interiors):
    L = geom.length
    n = int(L / 0.35)
    for i in range(n):
        p = geom.interpolate(i * L / n)
        pts.append(Point(p.x, p.y).buffer(random.uniform(0.9, 1.6)))
envelope = unary_union(pts + [floor.buffer(0.7)])
band = envelope.difference(floor)
page = box(-OX, -OY, W - OX, H - OY)
envelope = envelope.intersection(page).difference(box(6.2, 20.5, 9.8, 24))
band = envelope.difference(floor)

def poly_path(g):
    polys = g.geoms if hasattr(g, "geoms") else [g]
    d = ""
    for pg in polys:
        if pg.is_empty or pg.geom_type != "Polygon":
            continue
        for ring in [pg.exterior] + list(pg.interiors):
            c = list(ring.coords)
            d += "M" + " L".join("%.1f,%.1f" % P(x, y) for x, y in c) + " Z "
    return d

svg = []
A = svg.append
A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*U}" height="{H*U}" viewBox="0 0 {W*U} {H*U}">')
A('<defs><clipPath id="env"><path d="%s" clip-rule="evenodd"/></clipPath>' % poly_path(envelope))
A('<clipPath id="flr"><path d="%s"/></clipPath></defs>' % poly_path(floor_draw))
A(f'<rect width="{W*U}" height="{H*U}" fill="#fdfdfb"/>')
# carta millimetrata
for i in range(W + 1):
    A(f'<line x1="{i*U}" y1="0" x2="{i*U}" y2="{H*U}" stroke="#b9c3cc" stroke-width="1"/>')
for j in range(H + 1):
    A(f'<line x1="0" y1="{j*U}" x2="{W*U}" y2="{j*U}" stroke="#b9c3cc" stroke-width="1"/>')

# fondo bianco sotto il tratteggio
A(f'<path d="{poly_path(envelope)}" fill="#fdfdfb"/>')
A('<g clip-path="url(#env)" stroke="#1a1a1a" stroke-width="1.3" stroke-linecap="round">')
minx, miny, maxx, maxy = envelope.bounds
step = 0.42
y = miny
while y < maxy:
    x = minx
    while x < maxx:
        cx, cy = x + random.uniform(-0.12, 0.12), y + random.uniform(-0.12, 0.12)
        if band.distance(Point(cx, cy)) < 0.3:
            ang = random.uniform(0, math.pi)
            dx, dy = math.cos(ang), math.sin(ang)
            nx, ny = -dy, dx
            k = random.randint(3, 5)
            ln = random.uniform(0.32, 0.5)
            for t in range(k):
                o = (t - (k - 1) / 2) * 0.09
                ax, ay = cx + nx * o - dx * ln / 2, cy + ny * o - dy * ln / 2
                bx, by = cx + nx * o + dx * ln / 2, cy + ny * o + dy * ln / 2
                A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (*P(ax, ay), *P(bx, by)))
        x += step
    y += step
A('</g>')

# pavimento + griglia interna
A(f'<path d="{poly_path(floor_draw)}" fill="#ffffff"/>')
A('<g clip-path="url(#flr)" stroke="#9a9a9a" stroke-width="1.1">')
for i in range(-OX, W - OX + 1):
    A('<line x1="%.1f" y1="0" x2="%.1f" y2="%d"/>' % (P(i, 0)[0], P(i, 0)[0], H * U))
for j in range(-OY, H - OY + 1):
    A('<line x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (P(0, j)[1], W * U, P(0, j)[1]))
A('</g>')

# crepaccio (legenda "Crevasse"): vuoto senza griglia, bordo con trattini verso il basso
A(f'<path d="{poly_path(chasm)}" fill="#fff"/>')
A(f'<path d="{poly_path(chasm)}" fill="#e9e9e9" fill-opacity="0.6"/>')
edge = chasm.boundary.difference(cave.exterior.buffer(0.08))
lines = edge.geoms if hasattr(edge, "geoms") else [edge]
A('<g stroke="#111" stroke-linecap="round">')
for ln in lines:
    A('<path d="M' + " L".join("%.1f,%.1f" % P(x, y) for x, y in ln.coords) + '" fill="none" stroke-width="2.6"/>')
    L = ln.length
    for k in range(int(L / 0.16)):
        d = k * 0.16 + rng.uniform(-0.03, 0.03)
        p, q = ln.interpolate(max(d - 0.05, 0)), ln.interpolate(min(d + 0.05, L))
        tx, ty = q.x - p.x, q.y - p.y; n = math.hypot(tx, ty) or 1
        nx, ny = -ty / n, tx / n
        m = ln.interpolate(d)
        if not chasm.contains(Point(m.x + nx * 0.1, m.y + ny * 0.1)):
            nx, ny = -nx, -ny
        l = rng.uniform(0.15, 0.4)
        A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="1.3"/>' % (*P(m.x, m.y), *P(m.x + nx * l, m.y + ny * l)))
A('</g>')
for _ in range(25):
    minx_, miny_, maxx_, maxy_ = chasm.bounds
    pt = Point(rng.uniform(minx_, maxx_), rng.uniform(miny_, maxy_))
    if chasm.buffer(-0.35).contains(pt):
        x, y = P(pt.x, pt.y)
        A(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rng.uniform(1,2.2):.1f}" fill="#111"/>')

# muri
A(f'<path d="{poly_path(floor_draw)}" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round"/>')

a, b = P(7.06, 20.5), P(8.94, 20.5)
A(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#fff" stroke-width="8"/>')
tx, ty = P(8, 21.2)
A(f'<text x="{tx}" y="{ty}" font-family="DejaVu Serif" font-style="italic" font-size="17" text-anchor="middle" fill="#111">dall\'esterno</text>')
# ---------- simboli ----------
def door(x, y, horiz, w=1.0):
    # porta: rettangolo nel varco del muro (legenda "Doorway")
    if horiz:
        x1, y1 = P(x - w * 0.42, y - 0.14); ww, hh = w * 0.84 * U, 0.28 * U
    else:
        x1, y1 = P(x - 0.14, y - w * 0.42); ww, hh = 0.28 * U, w * 0.84 * U
    A(f'<rect x="{x1:.1f}" y="{y1:.1f}" width="{ww:.1f}" height="{hh:.1f}" fill="#fff" stroke="#111" stroke-width="2.5"/>')

def secret_door(x, y, horiz):
    # legenda "Secret Door": il muro prosegue senza varco, marcato da una S sul muro
    if horiz:
        a, b = P(x - 0.3, y), P(x + 0.3, y)
    else:
        a, b = P(x, y - 0.3), P(x, y + 0.3)
    A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="5"/>')
    if MODE != 'master':
        return
    tx, ty = P(x, y)
    for st in ('fill="#fff" stroke="#fff" stroke-width="7"', 'fill="#111"'):
        A(f'<text x="{tx:.1f}" y="{ty+8:.1f}" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="{0.58*U:.0f}" text-anchor="middle" {st}>S</text>')

# scala d'ingresso: gradini che scendono verso la sala 1
yy = 20.1
while yy > 14.3:
    a, b = P(7, yy), P(9, yy)
    A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2"/>')
    yy -= 0.4
door(8, 14, True, 2.0)       # fondo scala -> sala 1 (doppia porta)
A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#111" stroke-width="2.5"/>' % (*P(8, 13.86), *P(8, 14.14)))
door(6.5, 8, True)           # sala 1 -> corridoio nord
door(6.5, 5, True)           # corridoio -> sala 3
door(16, 10.5, False)        # corridoio -> sala 2
if MODE != 'base':
    secret_door(10, 2, False)   # sala 3, muro est
    secret_door(19, 4, True)    # sala 2, muro nord

# Sala 2: colonne (legenda "Pillars or Columns")
for (cx, cy) in [(17.5, 6), (20.5, 6), (17.5, 10), (20.5, 10)]:
    x, y = P(cx, cy)
    A(f'<circle cx="{x}" cy="{y}" r="{0.32*U}" fill="#111"/>')

# Sala 3: altare nell'abside (legenda "Altar")
cx, cy = P(6.5, -0.55)
A(f'<g transform="rotate(-14 {cx} {cy})"><rect x="{cx-0.3*U}" y="{cy-0.48*U}" width="{0.6*U}" height="{0.96*U}" fill="#fff" stroke="#111" stroke-width="2.5"/>'
  f'<circle cx="{cx}" cy="{cy-0.2*U}" r="2" fill="#111"/><circle cx="{cx}" cy="{cy+0.2*U}" r="2" fill="#111"/></g>')

# statue nelle nicchie (legenda "Statue": cerchio con stella)
def statue(x, y):
    cx, cy = P(x, y); r = 0.4 * U
    A(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="#111" stroke-width="2.5"/>')
    pts = []
    for k in range(10):
        rr = r * 0.72 if k % 2 == 0 else r * 0.3
        a = -math.pi / 2 + k * math.pi / 5
        pts.append("%.1f,%.1f" % (cx + rr * math.cos(a), cy + rr * math.sin(a)))
    A(f'<polygon points="{" ".join(pts)}" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/>')
statue(3.12, 2.5)
statue(21.88, 8)

# Sala 1: detriti
for _ in range(28):
    cx, cy = random.uniform(9.6, 11.8), random.uniform(8.2, 10.4)
    x, y = P(cx, cy)
    r = random.uniform(1.5, 4.5)
    A(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{"#111" if r<2.5 else "#fff"}" stroke="#111" stroke-width="1.3"/>')
# casse e barili (legenda "Boxes and Barrels"): cassa a doghe, barili tratteggiati
def crate(x, y, sz=0.62):
    x0, y0 = P(x, y); w = sz * U
    A(f'<rect x="{x0}" y="{y0}" width="{w}" height="{w}" fill="#fff" stroke="#111" stroke-width="2.2"/>')
    for k in (1, 2):
        A(f'<line x1="{x0+w*k/3}" y1="{y0+3}" x2="{x0+w*k/3}" y2="{y0+w-3}" stroke="#111" stroke-width="1.5"/>')
def barrel(x, y, r=0.27):
    cx, cy = P(x, y); R = r * U
    A(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#fff" stroke="#111" stroke-width="2.2"/>')
    for o in (-0.35, 0.0, 0.35):
        d = R * 0.75
        A(f'<line x1="{cx-d*0.7+o*R}" y1="{cy+d*0.7+o*R}" x2="{cx+d*0.7+o*R}" y2="{cy-d*0.7+o*R}" stroke="#111" stroke-width="1.4"/>')
crate(4.2, 12.5); crate(4.2, 11.75)
barrel(5.25, 13.5); barrel(5.2, 12.85); barrel(5.85, 13.55)

# numeri stanze
def num(n, x, y):
    if MODE != 'master':
        return
    tx, ty = P(x, y)
    for st in ('fill="#fff" stroke="#fff" stroke-width="8"', 'fill="#111"'):
        A(f'<text x="{tx}" y="{ty+12}" font-family="DejaVu Serif, Georgia" font-weight="bold" font-size="{0.9*U:.0f}" text-anchor="middle" {st}>{n}</text>')
num(1, 7, 11)
num(2, 19, 8)
num(3, 6.5, 2.7)
num(4, 18.2, 18.4)
num(5, 29.0, 18.2)

# pozza (legenda "Lake or Pool"): riva irregolare, linee d'acqua orizzontali
A(f'<path d="{poly_path(pool)}" fill="#fff" stroke="#111" stroke-width="2.8" stroke-linejoin="round"/>')
pminx, pminy, pmaxx, pmaxy = pool.bounds
yy = pminy + 0.2
A('<g stroke="#111" stroke-width="1.4" stroke-linecap="round">')
while yy < pmaxy - 0.1:
    xx = pminx + rng.uniform(0, 0.3)
    while xx < pmaxx:
        ln = rng.uniform(0.25, 0.55)
        seg = LineString([(xx, yy), (xx + ln, yy)])
        if pool.buffer(-0.12).contains(seg):
            A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (*P(xx, yy), *P(xx + ln, yy)))
        xx += ln + rng.uniform(0.2, 0.45)
    yy += 0.22
A('</g>')

# stalattiti: cerchietti con punto centrale (vista dall'alto)
placed = []
inner = room5.buffer(-0.3)
tries = 0
while len(placed) < 13 and tries < 2000:
    tries += 1
    minx5, miny5, maxx5, maxy5 = room5.bounds
    pt = Point(rng.uniform(minx5, maxx5), rng.uniform(miny5, maxy5))
    if not inner.contains(pt) or pool.buffer(0.25).contains(pt) or pt.distance(Point(29.0, 18.0)) < 0.8 or pt.x < 28.3 and abs(pt.y - 18.7) < 0.9:
        continue
    if any(pt.distance(q) < 0.45 for q in placed):
        continue
    placed.append(pt)
    cx, cy = P(pt.x, pt.y); r = rng.uniform(0.12, 0.22) * U
    A(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#fff" stroke="#111" stroke-width="1.8"/>')
    A(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r*0.35:.1f}" fill="#111"/>')

# ponte di corda e legno (legenda "Rope & Wood Bridge")
by = 18.0
xs = [x for x, y in chasm.intersection(LineString([(15, by), (26, by)])).coords] if chasm.intersection(LineString([(15, by), (26, by)])).geom_type == "LineString" else None
seg = chasm.intersection(LineString([(15, by), (26, by)]))
bx0, bx1 = seg.bounds[0] - 0.45, seg.bounds[2] + 0.45
hw = 0.36
x0, y0 = P(bx0, by - hw); x1, y1 = P(bx1, by + hw)
A(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="#fff"/>')
xx = bx0 + 0.08
while xx < bx1 - 0.05:
    a, b = P(xx, by - hw + 0.04), P(xx, by + hw - 0.04)
    A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2.4"/>')
    xx += 0.13
for yy_ in (by - hw, by + hw):
    a, b = P(bx0 - 0.15, yy_), P(bx1 + 0.15, yy_)
    A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2"/>')
    for xp in (bx0 - 0.15, bx1 + 0.15):
        cx, cy = P(xp, yy_)
        A(f'<circle cx="{cx}" cy="{cy}" r="5" fill="#111"/>')

# porta sala 2 -> grotta e uscita
door(18, 12, True)


# scala grafica + nord
x0, y0 = P(-3, 21.2)
A(f'<g font-family="DejaVu Sans, Arial" font-size="15" fill="#111">')
A(f'<rect x="{x0}" y="{y0}" width="{U}" height="8" fill="#111"/><rect x="{x0+U}" y="{y0}" width="{U}" height="8" fill="#fff" stroke="#111" stroke-width="1.5"/>')
A(f'<text x="{x0}" y="{y0+26}">1 quadretto = 3 m (10 ft)</text></g>')
nx, ny = P(24.5, -1.5)
A(f'<path d="M{nx},{ny-28} L{nx+12},{ny+12} L{nx},{ny+4} L{nx-12},{ny+12} Z" fill="#111"/>')
A(f'<text x="{nx}" y="{ny+34}" font-family="DejaVu Serif" font-weight="bold" font-size="20" text-anchor="middle">N</text>')

A('</svg>')
if MODE == "master":
    open("/tmp/claude-0/s/mappa_tre_stanze.svg", "w").write("\n".join(svg))
    cairosvg.svg2png(url="/tmp/claude-0/s/mappa_tre_stanze.svg", write_to="/tmp/claude-0/s/mappa_tre_stanze.png")
    cairosvg.svg2pdf(url="/tmp/claude-0/s/mappa_tre_stanze.svg", write_to="/tmp/claude-0/s/mappa_tre_stanze.pdf")
else:
    import os
    os.makedirs("/tmp/claude-0/s/tavolo", exist_ok=True)
    fn = "/tmp/claude-0/s/tavolo/_" + MODE + ".svg"
    open(fn, "w").write("\n".join(svg))
    cairosvg.svg2png(url=fn, write_to=fn.replace(".svg", ".png"))
    if MODE == "base":
        zones = [
            ("ingresso", "Scala d'ingresso", box(6.5, 14.0, 9.5, 21.6)),
            ("sala1", "1 · Sala d'ingresso", box(3.5, 7.5, 12.5, 14.5)),
            ("corr_est", "Corridoio est (porta ostruita)", box(12.0, 9.5, 16.3, 11.5)),
            ("corr_nord", "Corridoio nord", box(5.5, 5.0, 7.5, 8.0)),
            ("sala3", "3 · Sacrario del falco", box(1.8, -1.9, 10.3, 5.5)),
            ("passaggio", "Passaggio segreto", secret.buffer(0.45)),
            ("sala2", "2 · Sala delle colonne", box(15.6, 3.6, 23.0, 12.4)),
            ("corr_sud", "Corridoio sud", box(17.0, 12.0, 19.0, 15.0)),
            ("grotta4", "4 · Grotta del crepaccio", cave.buffer(0.45)),
            ("cunicolo", "Cunicolo est", tunnel.buffer(0.4)),
            ("sala5", "5 · Caverna della pozza", room5.buffer(0.45)),
        ]
        out = [{"id": z, "name": n, "d": poly_path(g).strip()} for z, n, g in zones]
        bx = secret.buffer(0.45).bounds
        x0, y0 = P(bx[0], bx[1]); x1, y1 = P(bx[2], bx[3])
        meta = {"w": W * U, "h": H * U, "zones": out,
                "overlay": [round(x0), round(y0), round(x1 - x0), round(y1 - y0)],
                "tokens": {k: P(*v) for k, v in {"Shania": (7.5, 19.0), "Duronin": (8.5, 19.0), "Dworgin": (7.5, 18.0),
                                                   "Gilmares": (8.5, 18.0), "Meriadoc": (7.5, 17.0), "Annevar": (8.5, 17.0)}.items()}}
        json.dump(meta, open("/tmp/claude-0/s/tavolo/meta.json", "w"))
print("ok")
