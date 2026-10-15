#!/usr/bin/env python3
"""
Generatore di mappe in stile Dyson Logos per il Tavolo virtuale.

Legge la descrizione di un dungeon (`dungeon.json`, coordinate in quadretti) e produce,
nella stessa cartella:

  avventura.json        file dell'avventura da importare nel tavolo (coordinate in pixel)
  mappa_giocatori.png   mappa senza segreti, caricata sul tavolo
  segreti/<id>.png      ritagli che compaiono quando il Master scopre la zona collegata
  master/mappa_master.png, .pdf
                        mappa completa con porte segrete "S" e numeri delle stanze;
                        NON viene importata nel tavolo

Uso:  uv run --project strumenti/mappe python strumenti/mappe/genera_mappa.py avventure/<id>

Il formato di `dungeon.json` è descritto in strumenti/mappe/README.md.
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import cairosvg
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polylabel, unary_union

# Modalità di disegno:
#   master     tutto, con "S" sulle porte segrete e numeri delle stanze
#   giocatori  senza le forme segrete (il muro prosegue dove c'è una porta segreta)
#   svelato    con le forme segrete ma senza "S" né numeri: da qui si ritagliano i segreti
MODALITA = ("master", "giocatori", "svelato")


class ErroreDescrizione(Exception):
    pass


# ---------------------------------------------------------------- geometria


def rettangolo(r):
    (x0, y0), (x1, y1) = r["da"], r["a"]
    return box(x0, y0, x1, y1)


class Geometria:
    """Forme del dungeon in quadretti. I numeri casuali usano due generatori con seme
    fisso, così la stessa descrizione produce sempre la stessa mappa."""

    def __init__(self, desc):
        semi = desc.get("semi", {})
        self.casuale = random.Random(semi.get("tratteggio", 7))  # roccia e detriti
        self.rng = random.Random(semi.get("forme", 11))  # grotte, acqua, crepacci, stalattiti
        self.forme = {}
        self.segrete = set()
        self.ordine = []
        for f in desc["forme"]:
            if f["id"] in self.forme:
                raise ErroreDescrizione(f"forma duplicata: {f['id']}")
            self.forme[f["id"]] = self.costruisci(f)
            self.ordine.append(f["id"])
            if f.get("segreta"):
                self.segrete.add(f["id"])

    def forma(self, id_):
        if id_ not in self.forme:
            raise ErroreDescrizione(f"forma inesistente: {id_}")
        return self.forme[id_]

    def costruisci(self, f):
        tipo = f["tipo"]
        if tipo == "rettangolo":
            return rettangolo(f)
        if tipo == "cerchio":
            g = Point(*f["centro"]).buffer(f["raggio"])
            return g.intersection(rettangolo(f["ritaglio"])) if "ritaglio" in f else g
        if tipo == "grotta":
            # unione di cerchi, smussata e resa irregolare
            s = f.get("arrotondamento", 0.6)
            g = unary_union([Point(x, y).buffer(r) for x, y, r in f["cerchi"]]).buffer(s).buffer(-s)
            return self.irregolare(g, f.get("irregolarita", 0.3))
        if tipo == "galleria":
            # percorso con una larghezza; spigoli vivi per i passaggi scavati
            vivi = f.get("spigoli", "arrotondati") == "vivi"
            opzioni = {"cap_style": 2, "join_style": 2} if vivi else {}
            g = LineString(f["punti"]).buffer(f["larghezza"] / 2, **opzioni)
            irr = f.get("irregolarita", 0)
            return self.irregolare(g, irr) if irr else g
        raise ErroreDescrizione(f"tipo di forma sconosciuto: {tipo}")

    def rumore(self, ampiezza, armoniche=(2, 3, 5, 7, 11, 17)):
        fasi = [self.rng.uniform(0, 2 * math.pi) for _ in armoniche]
        amp = [ampiezza * self.rng.uniform(0.5, 1.0) / (1 + 0.35 * i) for i, _ in enumerate(armoniche)]
        return lambda t: sum(a * math.sin(h * 2 * math.pi * t + p) for a, h, p in zip(amp, armoniche, fasi))

    def irregolare(self, poly, ampiezza, passo=0.15):
        anello = poly.exterior
        n = int(anello.length / passo)
        f = self.rumore(ampiezza)
        punti = []
        for i in range(n):
            t = i / n
            p = anello.interpolate(t, normalized=True)
            q = anello.interpolate((t + 0.002) % 1, normalized=True)
            tx, ty = q.x - p.x, q.y - p.y
            m = math.hypot(tx, ty) or 1
            nx, ny = ty / m, -tx / m
            d = f(t) + self.rng.uniform(-0.04, 0.04)
            punti.append((p.x + nx * d, p.y + ny * d))
        g = Polygon(punti).buffer(0)
        return max(g.geoms, key=lambda x: x.area) if g.geom_type != "Polygon" else g

    def crepaccio(self, s, contenitore):
        linea = LineString(s["punti"])
        fs, fd = self.rumore(s.get("irregolarita", 0.28)), self.rumore(s.get("irregolarita", 0.28))
        semi = s.get("larghezza", 1.5) / 2
        sinistra, destra = [], []
        n = 120
        for i in range(n + 1):
            t = i / n
            p = linea.interpolate(t, normalized=True)
            q = linea.interpolate(min(t + 0.01, 1), normalized=True)
            p0 = linea.interpolate(max(t - 0.01, 0), normalized=True)
            tx, ty = q.x - p0.x, q.y - p0.y
            m = math.hypot(tx, ty)
            nx, ny = -ty / m, tx / m
            ls, ld = semi + fs(t), semi + fd(t)
            sinistra.append((p.x + nx * ls, p.y + ny * ls))
            destra.append((p.x - nx * ld, p.y - ny * ld))
        return Polygon(sinistra + destra[::-1]).buffer(0).intersection(contenitore)

    def pozza(self, s, contenitore):
        g = Point(*s["centro"]).buffer(s["raggio"])
        if "ritaglio" in s:
            g = g.intersection(rettangolo(s["ritaglio"]))
        g = self.irregolare(g.buffer(0.25), s.get("irregolarita", 0.18))
        return g.intersection(contenitore.buffer(-0.35))


def area(geo, a, elementi):
    """Area di una zona o di un'esclusione: rettangolo, cerchio, o forme con margine."""
    if "rettangolo" in a:
        return rettangolo(a["rettangolo"])
    if "cerchio" in a:
        return Point(*a["cerchio"]).buffer(a["raggio"])
    if "forme" in a:
        parti = [elementi[i] if i in elementi else geo.forma(i) for i in a["forme"]]
        g = parti[0] if len(parti) == 1 else unary_union(parti)
        m = a.get("margine", 0)
        return g.buffer(m) if m else g
    raise ErroreDescrizione(f"area non valida: {a}")


# ---------------------------------------------------------------- disegno


class Disegno:
    def __init__(self, desc, geo, elementi, modalita):
        g = desc["griglia"]
        self.U = g["px"]
        self.OX, self.OY = g["origine"]
        self.W, self.H = g["larghezza"], g["altezza"]
        self.desc, self.geo, self.elementi, self.modalita = desc, geo, elementi, modalita
        self.svg = []

    def P(self, x, y):
        return ((x + self.OX) * self.U, (y + self.OY) * self.U)

    def A(self, s):
        self.svg.append(s)

    def percorso(self, g):
        d = ""
        for pg in g.geoms if hasattr(g, "geoms") else [g]:
            if pg.is_empty or pg.geom_type != "Polygon":
                continue
            for anello in [pg.exterior] + list(pg.interiors):
                d += "M" + " L".join("%.1f,%.1f" % self.P(x, y) for x, y in anello.coords) + " Z "
        return d

    def genera(self, pavimento, pavimento_visibile, inviluppo, fascia):
        U, W, H, A = self.U, self.W, self.H, self.A
        A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*U}" height="{H*U}" viewBox="0 0 {W*U} {H*U}">')
        A('<defs><clipPath id="env"><path d="%s" clip-rule="evenodd"/></clipPath>' % self.percorso(inviluppo))
        A('<clipPath id="flr"><path d="%s"/></clipPath></defs>' % self.percorso(pavimento_visibile))
        A(f'<rect width="{W*U}" height="{H*U}" fill="#fdfdfb"/>')
        # carta millimetrata
        for i in range(W + 1):
            A(f'<line x1="{i*U}" y1="0" x2="{i*U}" y2="{H*U}" stroke="#b9c3cc" stroke-width="1"/>')
        for j in range(H + 1):
            A(f'<line x1="0" y1="{j*U}" x2="{W*U}" y2="{j*U}" stroke="#b9c3cc" stroke-width="1"/>')
        self.roccia(inviluppo, fascia)
        # pavimento + griglia interna
        A(f'<path d="{self.percorso(pavimento_visibile)}" fill="#ffffff"/>')
        A('<g clip-path="url(#flr)" stroke="#9a9a9a" stroke-width="1.1">')
        for i in range(-self.OX, W - self.OX + 1):
            A('<line x1="%.1f" y1="0" x2="%.1f" y2="%d"/>' % (self.P(i, 0)[0], self.P(i, 0)[0], H * U))
        for j in range(-self.OY, H - self.OY + 1):
            A('<line x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (self.P(0, j)[1], W * U, self.P(0, j)[1]))
        A("</g>")
        # i crepacci sono parte del pavimento: vanno disegnati prima dei muri
        for s in self.desc.get("simboli", []):
            if s["tipo"] == "crepaccio":
                self.disegna_crepaccio(s)
        A(f'<path d="{self.percorso(pavimento_visibile)}" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round"/>')
        for s in self.desc.get("simboli", []):
            if s["tipo"] != "crepaccio":
                getattr(self, "disegna_" + s["tipo"])(s)
        if "scala_grafica" in self.desc:
            self.scala_grafica(self.desc["scala_grafica"])
        if "nord" in self.desc:
            self.nord(self.desc["nord"])
        A("</svg>")
        return "\n".join(self.svg)

    def roccia(self, inviluppo, fascia):
        """Tratteggio della roccia attorno al pavimento (stile Dyson)."""
        A, P, casuale = self.A, self.P, self.geo.casuale
        A(f'<path d="{self.percorso(inviluppo)}" fill="#fdfdfb"/>')
        A('<g clip-path="url(#env)" stroke="#1a1a1a" stroke-width="1.3" stroke-linecap="round">')
        minx, miny, maxx, maxy = inviluppo.bounds
        passo = 0.42
        y = miny
        while y < maxy:
            x = minx
            while x < maxx:
                cx, cy = x + casuale.uniform(-0.12, 0.12), y + casuale.uniform(-0.12, 0.12)
                if fascia.distance(Point(cx, cy)) < 0.3:
                    ang = casuale.uniform(0, math.pi)
                    dx, dy = math.cos(ang), math.sin(ang)
                    nx, ny = -dy, dx
                    k = casuale.randint(3, 5)
                    ln = casuale.uniform(0.32, 0.5)
                    for t in range(k):
                        o = (t - (k - 1) / 2) * 0.09
                        ax, ay = cx + nx * o - dx * ln / 2, cy + ny * o - dy * ln / 2
                        bx, by = cx + nx * o + dx * ln / 2, cy + ny * o + dy * ln / 2
                        A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (*P(ax, ay), *P(bx, by)))
                x += passo
            y += passo
        A("</g>")

    # ---- simboli (legenda: santuario_zebulon_dungeon/legenda.pdf)

    def disegna_crepaccio(self, s):
        """Legenda "Crevasse": vuoto senza griglia, bordo con trattini verso il basso."""
        A, P, rng = self.A, self.P, self.geo.rng
        crepaccio = self.elementi[s["id"]]
        contenitore = self.geo.forma(s["in"])
        A(f'<path d="{self.percorso(crepaccio)}" fill="#fff"/>')
        A(f'<path d="{self.percorso(crepaccio)}" fill="#e9e9e9" fill-opacity="0.6"/>')
        bordo = crepaccio.boundary.difference(contenitore.exterior.buffer(0.08))
        A('<g stroke="#111" stroke-linecap="round">')
        for ln in bordo.geoms if hasattr(bordo, "geoms") else [bordo]:
            A('<path d="M' + " L".join("%.1f,%.1f" % P(x, y) for x, y in ln.coords) + '" fill="none" stroke-width="2.6"/>')
            L = ln.length
            for k in range(int(L / 0.16)):
                d = k * 0.16 + rng.uniform(-0.03, 0.03)
                p, q = ln.interpolate(max(d - 0.05, 0)), ln.interpolate(min(d + 0.05, L))
                tx, ty = q.x - p.x, q.y - p.y
                n = math.hypot(tx, ty) or 1
                nx, ny = -ty / n, tx / n
                m = ln.interpolate(d)
                if not crepaccio.contains(Point(m.x + nx * 0.1, m.y + ny * 0.1)):
                    nx, ny = -nx, -ny
                lt = rng.uniform(0.15, 0.4)
                A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="1.3"/>' % (*P(m.x, m.y), *P(m.x + nx * lt, m.y + ny * lt)))
        A("</g>")
        for _ in range(s.get("sassi", 25)):
            minx, miny, maxx, maxy = crepaccio.bounds
            pt = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
            if crepaccio.buffer(-0.35).contains(pt):
                x, y = P(pt.x, pt.y)
                A(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rng.uniform(1,2.2):.1f}" fill="#111"/>')

    def disegna_apertura(self, s):
        """Varco bianco in un muro (es. la scala che sale all'esterno)."""
        a, b = self.P(*s["da"]), self.P(*s["a"])
        self.A(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#fff" stroke-width="8"/>')

    def disegna_testo(self, s):
        tx, ty = self.P(*s["pos"])
        testo = s["testo"].replace("&", "&amp;").replace("<", "&lt;")
        self.A(f'<text x="{tx}" y="{ty}" font-family="DejaVu Serif" font-style="italic" font-size="17" text-anchor="middle" fill="#111">{testo}</text>')

    def disegna_gradini(self, s):
        """Scala: gradini paralleli all'asse x, dal punto `da` verso `a`."""
        (x0, y0), (x1, y1) = s["da"], s["a"]
        passo = s.get("passo", 0.4)
        segno = 1 if y1 > y0 else -1
        yy = y0
        while (yy - y1) * segno < 0:
            a, b = self.P(x0, yy), self.P(x1, yy)
            self.A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2"/>')
            yy += passo * segno

    def disegna_porta(self, s):
        """Legenda "Doorway"; con `doppia` anche la linea centrale."""
        x, y = s["pos"]
        w = s.get("larghezza", 1.0)
        orizzontale = s["orientamento"] == "orizzontale"
        P, U = self.P, self.U
        if orizzontale:
            x1, y1 = P(x - w * 0.42, y - 0.14)
            ww, hh = w * 0.84 * U, 0.28 * U
        else:
            x1, y1 = P(x - 0.14, y - w * 0.42)
            ww, hh = 0.28 * U, w * 0.84 * U
        self.A(f'<rect x="{x1:.1f}" y="{y1:.1f}" width="{ww:.1f}" height="{hh:.1f}" fill="#fff" stroke="#111" stroke-width="2.5"/>')
        if s.get("doppia"):
            a, b = (P(x, y - 0.14), P(x, y + 0.14)) if orizzontale else (P(x - 0.14, y), P(x + 0.14, y))
            self.A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#111" stroke-width="2.5"/>' % (*a, *b))

    def disegna_porta_segreta(self, s):
        """Legenda "Secret Door": il muro prosegue senza varco; la "S" solo sulla mappa del Master."""
        if self.modalita == "giocatori":
            return
        x, y = s["pos"]
        P = self.P
        if s["orientamento"] == "orizzontale":
            a, b = P(x - 0.3, y), P(x + 0.3, y)
        else:
            a, b = P(x, y - 0.3), P(x, y + 0.3)
        self.A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="5"/>')
        if self.modalita != "master":
            return
        tx, ty = P(x, y)
        for st in ('fill="#fff" stroke="#fff" stroke-width="7"', 'fill="#111"'):
            self.A(f'<text x="{tx:.1f}" y="{ty+8:.1f}" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="{0.58*self.U:.0f}" text-anchor="middle" {st}>S</text>')

    def disegna_colonna(self, s):
        """Legenda "Pillars or Columns"."""
        x, y = self.P(*s["pos"])
        self.A(f'<circle cx="{x}" cy="{y}" r="{s.get("raggio", 0.32)*self.U}" fill="#111"/>')

    def disegna_altare(self, s):
        """Legenda "Altar"."""
        cx, cy = self.P(*s["pos"])
        U = self.U
        self.A(f'<g transform="rotate({s.get("rotazione", 0)} {cx} {cy})"><rect x="{cx-0.3*U}" y="{cy-0.48*U}" width="{0.6*U}" height="{0.96*U}" fill="#fff" stroke="#111" stroke-width="2.5"/>'
               f'<circle cx="{cx}" cy="{cy-0.2*U}" r="2" fill="#111"/><circle cx="{cx}" cy="{cy+0.2*U}" r="2" fill="#111"/></g>')

    def disegna_statua(self, s):
        """Legenda "Statue": cerchio con stella."""
        cx, cy = self.P(*s["pos"])
        r = 0.4 * self.U
        self.A(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="#111" stroke-width="2.5"/>')
        punti = []
        for k in range(10):
            rr = r * 0.72 if k % 2 == 0 else r * 0.3
            a = -math.pi / 2 + k * math.pi / 5
            punti.append("%.1f,%.1f" % (cx + rr * math.cos(a), cy + rr * math.sin(a)))
        self.A(f'<polygon points="{" ".join(punti)}" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/>')

    def disegna_detriti(self, s):
        (x0, y0), (x1, y1) = s["da"], s["a"]
        for _ in range(s.get("quantita", 28)):
            cx, cy = self.geo.casuale.uniform(x0, x1), self.geo.casuale.uniform(y0, y1)
            x, y = self.P(cx, cy)
            r = self.geo.casuale.uniform(1.5, 4.5)
            self.A(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{"#111" if r<2.5 else "#fff"}" stroke="#111" stroke-width="1.3"/>')

    def disegna_cassa(self, s):
        """Legenda "Boxes and Barrels": cassa a doghe; `pos` è l'angolo in alto a sinistra."""
        x0, y0 = self.P(*s["pos"])
        w = s.get("lato", 0.62) * self.U
        self.A(f'<rect x="{x0}" y="{y0}" width="{w}" height="{w}" fill="#fff" stroke="#111" stroke-width="2.2"/>')
        for k in (1, 2):
            self.A(f'<line x1="{x0+w*k/3}" y1="{y0+3}" x2="{x0+w*k/3}" y2="{y0+w-3}" stroke="#111" stroke-width="1.5"/>')

    def disegna_barile(self, s):
        """Legenda "Boxes and Barrels": barile tratteggiato."""
        cx, cy = self.P(*s["pos"])
        R = s.get("raggio", 0.27) * self.U
        self.A(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#fff" stroke="#111" stroke-width="2.2"/>')
        for o in (-0.35, 0.0, 0.35):
            d = R * 0.75
            self.A(f'<line x1="{cx-d*0.7+o*R}" y1="{cy+d*0.7+o*R}" x2="{cx+d*0.7+o*R}" y2="{cy-d*0.7+o*R}" stroke="#111" stroke-width="1.4"/>')

    def disegna_numero(self, s):
        """Numero della stanza: solo sulla mappa del Master."""
        if self.modalita != "master":
            return
        tx, ty = self.P(*s["pos"])
        for st in ('fill="#fff" stroke="#fff" stroke-width="8"', 'fill="#111"'):
            self.A(f'<text x="{tx}" y="{ty+12}" font-family="DejaVu Serif, Georgia" font-weight="bold" font-size="{0.9*self.U:.0f}" text-anchor="middle" {st}>{s["n"]}</text>')

    def disegna_pozza(self, s):
        """Legenda "Lake or Pool": riva irregolare, linee d'acqua orizzontali."""
        A, P, rng = self.A, self.P, self.geo.rng
        pozza = self.elementi[s["id"]]
        A(f'<path d="{self.percorso(pozza)}" fill="#fff" stroke="#111" stroke-width="2.8" stroke-linejoin="round"/>')
        minx, miny, maxx, maxy = pozza.bounds
        yy = miny + 0.2
        A('<g stroke="#111" stroke-width="1.4" stroke-linecap="round">')
        while yy < maxy - 0.1:
            xx = minx + rng.uniform(0, 0.3)
            while xx < maxx:
                ln = rng.uniform(0.25, 0.55)
                if pozza.buffer(-0.12).contains(LineString([(xx, yy), (xx + ln, yy)])):
                    A('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (*P(xx, yy), *P(xx + ln, yy)))
                xx += ln + rng.uniform(0.2, 0.45)
            yy += 0.22
        A("</g>")

    def disegna_stalattiti(self, s):
        """Cerchietti con punto centrale (vista dall'alto), lontani dalle aree in `evita`."""
        rng = self.geo.rng
        contenitore = self.geo.forma(s["in"])
        interno = contenitore.buffer(-0.3)
        # I cerchi si controllano con la distanza esatta, le altre aree con il poligono.
        evita = [
            (lambda pt, c=Point(*a["cerchio"]), r=a["raggio"]: pt.distance(c) < r)
            if "cerchio" in a
            else (lambda pt, g=area(self.geo, a, self.elementi): g.contains(pt))
            for a in s.get("evita", [])
        ]
        piazzate, tentativi = [], 0
        while len(piazzate) < s.get("quantita", 12) and tentativi < 2000:
            tentativi += 1
            minx, miny, maxx, maxy = contenitore.bounds
            pt = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
            if not interno.contains(pt) or any(dentro(pt) for dentro in evita):
                continue
            if any(pt.distance(q) < 0.45 for q in piazzate):
                continue
            piazzate.append(pt)
            cx, cy = self.P(pt.x, pt.y)
            r = rng.uniform(0.12, 0.22) * self.U
            self.A(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#fff" stroke="#111" stroke-width="1.8"/>')
            self.A(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r*0.35:.1f}" fill="#111"/>')

    def disegna_ponte(self, s):
        """Legenda "Rope & Wood Bridge": attraversa in orizzontale l'elemento `su` alla quota `y`."""
        A, P = self.A, self.P
        by = s["y"]
        x_da, x_a = s.get("cerca_tra", [-1e4, 1e4])
        tratto = self.elementi[s["su"]].intersection(LineString([(x_da, by), (x_a, by)]))
        if tratto.is_empty:
            raise ErroreDescrizione(f"il ponte alla quota y={by} non attraversa {s['su']}")
        bx0, bx1 = tratto.bounds[0] - 0.45, tratto.bounds[2] + 0.45
        hw = 0.36
        x0, y0 = P(bx0, by - hw)
        x1, y1 = P(bx1, by + hw)
        A(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="#fff"/>')
        xx = bx0 + 0.08
        while xx < bx1 - 0.05:
            a, b = P(xx, by - hw + 0.04), P(xx, by + hw - 0.04)
            A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2.4"/>')
            xx += 0.13
        for yy in (by - hw, by + hw):
            a, b = P(bx0 - 0.15, yy), P(bx1 + 0.15, yy)
            A(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#111" stroke-width="2"/>')
            for xp in (bx0 - 0.15, bx1 + 0.15):
                cx, cy = P(xp, yy)
                A(f'<circle cx="{cx}" cy="{cy}" r="5" fill="#111"/>')

    def scala_grafica(self, s):
        x0, y0 = self.P(*s["pos"])
        U, g = self.U, self.desc["griglia"]
        self.A('<g font-family="DejaVu Sans, Arial" font-size="15" fill="#111">')
        self.A(f'<rect x="{x0}" y="{y0}" width="{U}" height="8" fill="#111"/><rect x="{x0+U}" y="{y0}" width="{U}" height="8" fill="#fff" stroke="#111" stroke-width="1.5"/>')
        self.A(f'<text x="{x0}" y="{y0+26}">1 quadretto = {g["metri"]} m ({g["piedi"]} ft)</text></g>')

    def nord(self, s):
        nx, ny = self.P(*s["pos"])
        self.A(f'<path d="M{nx},{ny-28} L{nx+12},{ny+12} L{nx},{ny+4} L{nx-12},{ny+12} Z" fill="#111"/>')
        self.A(f'<text x="{nx}" y="{ny+34}" font-family="DejaVu Serif" font-weight="bold" font-size="20" text-anchor="middle">N</text>')


# ---------------------------------------------------------------- generazione


def unione(geo, ids):
    return unary_union([geo.forme[i] for i in ids])


def genera(cartella: Path, salva_svg: bool = False):
    desc = json.loads((cartella / "dungeon.json").read_text(encoding="utf-8"))
    geo = Geometria(desc)

    # Elementi con una geometria propria, costruiti nell'ordine in cui sono descritti.
    elementi = {}
    for s in desc.get("simboli", []):
        if s["tipo"] == "pozza":
            elementi[s["id"]] = geo.pozza(s, geo.forma(s["in"]))
        elif s["tipo"] == "crepaccio":
            elementi[s["id"]] = geo.crepaccio(s, geo.forma(s["in"]))

    pavimento = unione(geo, geo.ordine)
    pavimento_giocatori = unione(geo, [i for i in geo.ordine if i not in geo.segrete])

    # Roccia: calcolata sul pavimento completo, identica in tutte le versioni,
    # così i ritagli dei segreti combaciano con la mappa dei giocatori.
    g = desc["griglia"]
    ox, oy = g["origine"]
    punti = []
    for poligono in pavimento.geoms if hasattr(pavimento, "geoms") else [pavimento]:
        for anello in [poligono.exterior] + list(poligono.interiors):
            L = anello.length
            n = int(L / 0.35)
            for i in range(n):
                p = anello.interpolate(i * L / n)
                punti.append(Point(p.x, p.y).buffer(geo.casuale.uniform(0.9, 1.6)))
    inviluppo = unary_union(punti + [pavimento.buffer(0.7)])
    pagina = box(-ox, -oy, g["larghezza"] - ox, g["altezza"] - oy)
    inviluppo = inviluppo.intersection(pagina)
    for esclusa in desc.get("roccia_esclusa", []):
        inviluppo = inviluppo.difference(rettangolo(esclusa))
    fascia = inviluppo.difference(pavimento)

    # Le tre versioni consumano gli stessi numeri casuali nello stesso ordine:
    # si riparte ogni volta dallo stato dei generatori a questo punto.
    stato = (geo.casuale.getstate(), geo.rng.getstate())
    svg = {}
    for modalita in MODALITA:
        geo.casuale.setstate(stato[0])
        geo.rng.setstate(stato[1])
        visibile = pavimento_giocatori if modalita == "giocatori" else pavimento
        svg[modalita] = Disegno(desc, geo, elementi, modalita).genera(pavimento, visibile, inviluppo, fascia)

    U = g["px"]
    larghezza, altezza = g["larghezza"] * U, g["altezza"] * U
    P = lambda x, y: ((x + ox) * U, (y + oy) * U)  # noqa: E731

    (cartella / "master").mkdir(exist_ok=True)
    (cartella / "segreti").mkdir(exist_ok=True)
    cairosvg.svg2png(bytestring=svg["master"].encode(), write_to=str(cartella / "master" / "mappa_master.png"))
    cairosvg.svg2pdf(bytestring=svg["master"].encode(), write_to=str(cartella / "master" / "mappa_master.pdf"))
    cairosvg.svg2png(bytestring=svg["giocatori"].encode(), write_to=str(cartella / "mappa_giocatori.png"))
    if salva_svg:
        for modalita, testo in svg.items():
            (cartella / "master" / f"_{modalita}.svg").write_text(testo, encoding="utf-8")

    disegno = Disegno(desc, geo, elementi, "giocatori")  # solo per convertire i percorsi
    zone = []
    for z in desc["zone"]:
        forma = area(geo, z["area"], elementi)
        principale = max(forma.geoms, key=lambda x: x.area) if hasattr(forma, "geoms") else forma
        centro = polylabel(principale, tolerance=0.05)
        zone.append({
            "id": z["id"],
            "nome": z["nome"],
            "percorso": disegno.percorso(forma).strip(),
            "centro": [round(v, 1) for v in P(centro.x, centro.y)],
        })

    segreti = []
    for s in desc.get("segreti", []):
        minx, miny, maxx, maxy = area(geo, s["area"], elementi).bounds
        x0, y0 = P(minx, miny)
        x1, y1 = P(maxx, maxy)
        x, y, w, h = round(x0), round(y0), round(x1 - x0), round(y1 - y0)
        # Ritaglio della versione "svelata": stessa roccia e stesso pavimento della mappa
        # dei giocatori, più il passaggio segreto.
        ritaglio = svg["svelato"].replace(
            f'width="{larghezza}" height="{altezza}" viewBox="0 0 {larghezza} {altezza}"',
            f'width="{w}" height="{h}" viewBox="{x} {y} {w} {h}"', 1)
        file = f"segreti/{s['id']}.png"
        cairosvg.svg2png(bytestring=ritaglio.encode(), write_to=str(cartella / file))
        segreti.append({"id": s["id"], "zona": s["zona"], "immagine": file,
                        "x": x, "y": y, "larghezza": w, "altezza": h})

    avventura = {
        "formato": 1,
        "id": desc["id"],
        "titolo": desc["titolo"],
        **({"sottotitolo": desc["sottotitolo"]} if desc.get("sottotitolo") else {}),
        "mappa": {
            "immagine": "mappa_giocatori.png",
            "larghezza": larghezza,
            "altezza": altezza,
            "quadretto": {"px": U, "metri": g["metri"], "piedi": g["piedi"]},
        },
        "zone": zone,
        "zoneIniziali": desc["zone_iniziali"],
        "segreti": segreti,
        "partenze": [[round(v, 1) for v in P(x, y)] for x, y in desc["partenze"]],
        "mostri": desc.get("mostri", []),
    }
    (cartella / "avventura.json").write_text(
        json.dumps(avventura, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return avventura


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("cartella", type=Path, help="cartella dell'avventura con dungeon.json")
    parser.add_argument("--svg", action="store_true", help="salva anche gli SVG intermedi in master/")
    args = parser.parse_args()
    if not (args.cartella / "dungeon.json").is_file():
        sys.exit(f"Manca {args.cartella / 'dungeon.json'}")
    try:
        avventura = genera(args.cartella, args.svg)
    except (ErroreDescrizione, KeyError) as e:
        sys.exit(f"Descrizione non valida: {e}")
    print(f"✔ {avventura['titolo']}: {len(avventura['zone'])} zone, {len(avventura['segreti'])} segreti, "
          f"{len(avventura['partenze'])} posti di partenza → {args.cartella}")


if __name__ == "__main__":
    main()
