#!/usr/bin/env python3
"""Regenera el banner de reseñas y los contadores de index.html desde data/resenas.json."""
import html, json, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "data/resenas.json").read_text(encoding="utf-8"))
p = root / "index.html"
s = p.read_text(encoding="utf-8")
def item(r, hidden=False):
    h = ' aria-hidden="true"' if hidden else ""
    return (f'<li{h}><span class="st" aria-hidden="true">★★★★★</span>'
            f'“{html.escape(r["texto"])}” <b>{html.escape(r["autor"])}</b></li>')
items = "".join(item(r) for r in d["banner"])
dup = "".join(item(r, True) for r in d["banner"])
ticker = (f'<a class="rt" href="#resenas" aria-label="{d["calificacion"]} estrellas en Google. Ver lo que dicen los participantes">'
          f'<span class="rt-badge"><b>★ {d["calificacion"]}</b> en Google</span>'
          f'<span class="rt-belt"><ul class="rt-row">{items}{dup}</ul></span>'
          f'<span class="rt-go">Leer reseñas ↓</span></a>')
s = re.sub(r"<!-- RESENAS:BANNER -->.*?<!-- /RESENAS:BANNER -->",
           f"<!-- RESENAS:BANNER -->{ticker}<!-- /RESENAS:BANNER -->", s, flags=re.S)
s = re.sub(r"<!-- RESENAS:SCORE -->.*?<!-- /RESENAS:SCORE -->",
           f'<!-- RESENAS:SCORE -->{d["calificacion"]}<!-- /RESENAS:SCORE -->', s, flags=re.S)
s = re.sub(r"<!-- RESENAS:META -->.*?<!-- /RESENAS:META -->",
           '<!-- RESENAS:META -->Calificación en Google<!-- /RESENAS:META -->', s, flags=re.S)
p.write_text(s, encoding="utf-8")
print("ok", d["total"], d["calificacion"], len(d["banner"]))
