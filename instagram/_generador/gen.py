import json, sys, os, re
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
DATA = json.load(open(sys.argv[2], encoding="utf-8"))

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px}
body{font-family:'Inter',sans-serif;position:relative;overflow:hidden}
.dark{background:#050a07;color:#fff}
.dark:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 45% at 100% 100%, rgba(30,140,70,.35), rgba(5,10,7,0) 70%)}
.cream{background:#f4efe4;color:#0a0f0c}
.wrap{position:absolute;inset:0;padding:0 76px}
.head{position:absolute;top:86px;left:76px;display:flex;align-items:center;gap:26px}
.logo{font-family:'Inter';font-weight:800;font-style:italic;font-size:62px;letter-spacing:-1px;line-height:1}
.dark .logo{color:#2fe36f}.cream .logo{color:#12aa52}
.sep{width:2px;height:62px;background:currentColor;opacity:.35}
.brand{font-weight:700;font-size:21px;letter-spacing:6px;line-height:1.45}
.brand .y{display:block}.dark .brand .y{color:#2fe36f}.cream .brand .y{color:#12aa52}
.foot{position:absolute;bottom:84px;left:76px;right:76px;display:flex;justify-content:space-between;align-items:flex-end}
.tag{font-weight:700;font-size:23px;letter-spacing:4.5px;line-height:1.7}
.dark .tag{color:#fff}
.page{font-weight:700;font-size:28px}
.dark .page{color:#2fe36f}.cream .page{color:#12aa52}
.main{position:absolute;left:76px;right:76px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding-top:40px;padding-bottom:60px}
.label{font-weight:700;font-size:25px;letter-spacing:5.5px;margin-bottom:30px}
.dark .label{color:#2fe36f}.cream .label{color:#12aa52}
h1{font-weight:800;text-transform:uppercase;line-height:1.08;letter-spacing:-.5px}
.dark h1{font-size:84px}.cream h1{font-size:72px}
h1 .g{color:#12aa52}.dark h1 .g{color:#2fe36f}
.sub{font-size:38px;line-height:1.45;margin-top:34px;color:#3c443f}
.dark .sub{color:#c9d1cb}
.bar{width:80px;height:5px;margin-top:46px}
.dark .bar{background:#2fe36f}.cream .bar{background:#12aa52}
.save{display:inline-block;align-self:flex-start;background:#12aa52;color:#fff;font-weight:800;font-size:22px;letter-spacing:4px;padding:12px 22px;border-radius:8px;margin-bottom:26px}
.checks{margin-top:44px;display:flex;flex-direction:column;gap:30px}
.ck{display:flex;align-items:center;gap:26px;font-weight:700;font-size:36px;line-height:1.3}
.ck i{flex:none;width:58px;height:58px;border-radius:50%;background:#12aa52;display:flex;align-items:center;justify-content:center}
.ck i.n{color:#fff;font-style:normal;font-weight:800;font-size:30px}
.diag{margin-top:40px;display:flex;flex-direction:column;gap:22px}
.dg{background:#fff;border-radius:18px;padding:24px 30px;border-left:8px solid #12aa52}
.dg b{display:block;font-size:33px;font-weight:700;line-height:1.3}
.dg span{display:block;font-size:30px;color:#12aa52;font-weight:700;margin-top:6px}
table{margin-top:40px;border-collapse:separate;border-spacing:0 14px;width:100%}
td{font-size:36px;font-weight:700;padding:22px 28px;background:#fff}
td:first-child{border-radius:16px 0 0 16px;color:#3c443f;font-weight:600}
td:last-child{border-radius:0 16px 16px 0;text-align:right}
tr.hi td{background:#12aa52;color:#fff}
.teaser{margin-top:48px;background:#0a0f0c;color:#fff;border-radius:20px;padding:34px 36px}.teaser em{display:inline-block;font-style:normal;background:#2fe36f;color:#0a0f0c;font-weight:800;font-size:22px;letter-spacing:4px;padding:8px 16px;border-radius:6px;margin-bottom:18px}.teaser p{font-size:33px;font-weight:600;line-height:1.4}.teaser p+p{color:#2fe36f;margin-top:12px}
.shot{margin-top:36px;align-self:center;background:#0f1110;border:10px solid #1d211e;border-radius:44px;padding:34px 26px 26px;box-shadow:0 30px 60px rgba(10,15,12,.25);position:relative}.shot:before{content:"";position:absolute;top:12px;left:50%;width:90px;height:8px;margin-left:-45px;border-radius:4px;background:#2a2f2b}.shot img{display:block;width:430px;border-radius:12px}.hint{text-align:center;font-size:29px;font-weight:600;color:#3c443f;margin-top:24px;font-style:italic}
.note{font-size:31px;line-height:1.45;color:#3c443f;margin-top:26px}
.small{font-size:26px;color:#6b726d;margin-top:22px;line-height:1.4}
.cols{display:flex;gap:28px;margin-top:40px}
.col{flex:1;background:#fff;border-radius:20px;padding:30px}
.col h3{font-size:30px;font-weight:800;color:#12aa52;letter-spacing:3px;margin-bottom:18px}
.col p{font-size:31px;font-weight:600;line-height:1.35;padding:12px 0;border-top:2px solid #ece6d8}
.cal{margin-top:40px;display:flex;flex-direction:column;gap:18px}
.wk{display:flex;align-items:center;gap:12px}
.wk em{font-style:normal;width:150px;font-size:26px;font-weight:700;color:#3c443f}
.d{flex:1;text-align:center}
.d small{display:block;font-size:22px;color:#6b726d;font-weight:700;margin-bottom:8px}
.d div{height:84px;border-radius:14px;background:#e7e1d3;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#fff}
.d div.on{background:#12aa52}
.big{font-weight:800;font-style:italic;font-size:300px;letter-spacing:-8px;color:#2fe36f;line-height:1;text-align:center}
.bigsub{text-align:center;font-weight:700;font-size:34px;letter-spacing:11px;margin-top:22px}
.bigsub span{color:#2fe36f}
.cbar{width:80px;height:5px;background:#2fe36f;margin:56px auto 0}
.cmain{text-align:center;font-weight:700;font-size:46px;margin-top:56px;line-height:1.3}
.cnext{text-align:center;font-weight:600;font-size:33px;color:#2fe36f;margin-top:30px;line-height:1.4}
.cnote{text-align:center;font-size:28px;color:#c9d1cb;margin-top:30px}
"""

def hl(t):
    # [palabras] -> verde
    return re.sub(r"\[(.+?)\]", r'<span class="g">\1</span>', t)

CHECK = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def body(s, label, n, total):
    t = s["type"]
    theme = "dark" if t in ("cover", "close") else "cream"
    h = []
    if t == "close":
        h.append(f'<div class="big">EYL</div><div class="bigsub">ENTRENA <span>YOUR LIFE</span></div><div class="cbar"></div>')
        h.append(f'<div class="cmain">{s["main"]}</div><div class="cnext">{s["next"]}</div>')
        if s.get("note"): h.append(f'<div class="cnote">{s["note"]}</div>')
    else:
        if s.get("save"): h.append('<div class="save">GUÁRDALO</div>')
        h.append(f'<div class="label">{label}</div><h1>{hl(s["h"])}</h1>')
        if s.get("sub"): h.append(f'<div class="sub">{s["sub"]}</div>')
        if t == "checks" or t == "steps":
            items = "".join(f'<div class="ck"><i class="{"n" if t=="steps" else ""}">{(i+1) if t=="steps" else CHECK}</i><div>{x}</div></div>' for i, x in enumerate(s["items"]))
            h.append(f'<div class="checks">{items}</div>')
        if t == "diag":
            h.append('<div class="diag">' + "".join(f'<div class="dg"><b>{a}</b><span>→ {b}</span></div>' for a, b in s["items"]) + '</div>')
        if t == "table":
            rows = "".join(f'<tr class="{"hi" if r[-1]=="*" else ""}"><td>{r[0]}</td><td>{r[1]}</td><td>{r[2].rstrip("*")}</td></tr>' for r in s["rows"])
            h.append(f'<table>{rows}</table>')
        if t == "cols":
            h.append('<div class="cols">' + "".join(f'<div class="col"><h3>{c["t"]}</h3>' + "".join(f"<p>{x}</p>" for x in c["items"]) + '</div>' for c in s["cols"]) + '</div>')
        if t == "cal":
            days = ["L", "M", "X", "J", "V", "S", "D"]
            out = '<div class="cal">'
            for name, pat in s["weeks"]:
                out += f'<div class="wk"><em>{name}</em>' + "".join(f'<div class="d"><small>{d}</small><div class="{"on" if p!="-" else ""}">{p if p!="-" else ""}</div></div>' for d, p in zip(days, pat)) + '</div>'
            h.append(out + '</div>')
        if s.get("note"): h.append(f'<div class="note">{s["note"]}</div>')
        if s.get("shot"): h.append(f'<div class="shot"><img style="width:{s.get('shotw',430)}px" src="data:image/png;base64,{__import__('base64').b64encode(open(s['shot'],'rb').read()).decode()}"></div>')
        if s.get("hint"): h.append(f'<div class="hint">{s["hint"]}</div>')
        if s.get("teaser"): h.append('<div class="teaser"><em>PRÓXIMAMENTE</em>' + ''.join(f'<p>{x}</p>' for x in s['teaser']) + '</div>')
        if s.get("small"): h.append(f'<div class="small">{s["small"]}</div>')
        if t in ("cover", "text") and not s.get("teaser") and not s.get("shot"): h.append('<div class="bar"></div>')
    arrow = " →" if n < total else ""
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body class="{theme}"><div class="head"><div class="logo">EYL</div><div class="sep"></div><div class="brand">ENTRENA<span class="y">YOUR LIFE</span></div></div>
<div class="main">{"".join(h)}</div>
<div class="foot"><div class="tag">ENTRENO INTELIGENTE.<br>RESULTADOS REALES.</div><div class="page">{n}/{total}{arrow}</div></div></body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1080, "height": 1350})
    for post in DATA:
        d = os.path.join(OUT, post["slug"]); os.makedirs(d, exist_ok=True)
        tot = len(post["slides"])
        for i, s in enumerate(post["slides"], 1):
            pg.set_content(body(s, post["label"], i, tot)); pg.wait_for_timeout(150)
            ov = pg.evaluate("document.querySelector('.main').scrollHeight > 1350 || document.querySelector('.main').getBoundingClientRect().top<0")
            pg.screenshot(path=os.path.join(d, f"{i:02d}.png"))
            if ov: print("OVERFLOW", post["slug"], i)
    b.close()
print("done")
