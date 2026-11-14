/* ENTRENA YOUR LIFE · Mapa muscular: figura de frente y de espaldas con las series de la semana por zona concreta de cada músculo.
   Reparto aproximado según el ejercicio: 1 serie a la zona que más trabaja y 0,5 a las que ayudan. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  // ---- zonas: id → [nombre, grupo, vista] ----
  var R = {
    pec_sup: ["Pectoral superior (porción clavicular)", "Pecho", "f"],
    pec_med: ["Pectoral medio e inferior (porción esternal)", "Pecho", "f"],
    del_ant: ["Deltoides anterior", "Hombro", "f"],
    del_lat: ["Deltoides lateral", "Hombro", "fb"],
    del_post: ["Deltoides posterior", "Hombro", "b"],
    trap_sup: ["Trapecio superior", "Espalda", "fb"],
    trap_med: ["Trapecio medio e inferior y romboides", "Espalda", "b"],
    dorsal: ["Dorsal ancho", "Espalda", "b"],
    lumbar: ["Erectores de la columna (lumbar)", "Espalda", "b"],
    bic_larga: ["Bíceps · cabeza larga (por fuera)", "Bíceps", "f"],
    bic_corta: ["Bíceps · cabeza corta (por dentro)", "Bíceps", "f"],
    braquial: ["Braquial y braquiorradial", "Bíceps", "f"],
    tri_larga: ["Tríceps · cabeza larga (por dentro)", "Tríceps", "b"],
    tri_lat: ["Tríceps · cabezas lateral y medial", "Tríceps", "b"],
    recto_abd: ["Recto abdominal", "Core", "f"],
    oblicuos: ["Oblicuos", "Core", "f"],
    recto_fem: ["Cuádriceps · recto femoral (centro)", "Cuádriceps", "f"],
    vastos: ["Cuádriceps · vastos lateral y medial", "Cuádriceps", "f"],
    aductores: ["Aductores", "Aductores", "f"],
    glu_may: ["Glúteo mayor", "Glúteo", "b"],
    glu_med: ["Glúteo medio y menor", "Glúteo", "b"],
    bf: ["Isquios · bíceps femoral (por fuera)", "Isquios", "b"],
    semis: ["Isquios · semitendinoso y semimembranoso (por dentro)", "Isquios", "b"],
    gastro: ["Gemelo (gastrocnemio)", "Gemelo", "b"],
    soleo: ["Sóleo", "Gemelo", "b"]
  };

  // ---- zonas cuyo reparto tiene estudios de crecimiento muscular (resonancia o ecografía); el resto, solo anatomía ----
  var EV = { pec_sup: 1, pec_med: 1, tri_larga: 1, tri_lat: 1, recto_fem: 1, vastos: 1, aductores: 1, glu_may: 1, bf: 1, semis: 1 };
  var SRC = [
    ["Maeo 2022 · tríceps con el brazo por encima de la cabeza", "10.1080/17461391.2022.2100279"],
    ["Kinoshita 2026 · extensión de cuádriceps frente a prensa", "10.1249/MSS.0000000000003957"],
    ["Kassiano 2026 · sentadilla frente a extensión de cuádriceps", "10.1519/JSC.0000000000005338"],
    ["Plotkin 2023 · hip thrust frente a sentadilla", "10.3389/fphys.2023.1279170"],
    ["Maeo 2021 · curl femoral sentado frente a tumbado", "10.1249/MSS.0000000000002523"],
    ["Bourne 2017 · extensión de cadera frente a nórdico", "10.1136/bjsports-2016-096130"],
    ["Chaves 2020 · press inclinado frente a plano", "10.70252/FDNB1158"]
  ];
  function nm(k) { return R[k][0] + (EV[k] ? "" : " *"); }

  // ---- reparto por defecto de cada grupo (si el nombre no dice más) ----
  var DEF = {
    "Pecho": { pec_med: 1, pec_sup: 0.5 }, "Espalda": { dorsal: 1, trap_med: 0.5 }, "Hombro": { del_ant: 0.5, del_lat: 1, del_post: 0.5 },
    "Bíceps": { bic_larga: 1, bic_corta: 1, braquial: 0.5 }, "Tríceps": { tri_larga: 1, tri_lat: 1 }, "Cuádriceps": { vastos: 1, recto_fem: 0.25 },
    "Isquios": { bf: 1, semis: 1 }, "Glúteo": { glu_may: 1 }, "Aductores": { aductores: 1 }, "Gemelo": { gastro: 1, soleo: 0.5 },
    "Core": { recto_abd: 1, oblicuos: 0.5 }
  };
  // ayuda de otro grupo: la mitad de su reparto
  function half(g) { var o = {}, d = DEF[g] || {}; Object.keys(d).forEach(function (k) { o[k] = d[k] / 2; }); return o; }
  function mix() { var o = {}; Array.prototype.forEach.call(arguments, function (x) { Object.keys(x).forEach(function (k) { o[k] = Math.max(o[k] || 0, x[k]); }); }); return o; }

  // ---- reglas por nombre (en orden: la primera que encaja manda) ----
  var RULES = [
    [/femoral|curl.*(pierna|isquio)|nordic|nordico/, { semis: 1, bf: 0.5 }],
    // Bourne 2017: la extensión de cadera hace crecer más el bíceps femoral; el semitendinoso crece igual con cadera y con rodilla
    [/rumano|peso muerto|stiff|buenos dias|good morning/, { bf: 1, semis: 1, glu_may: 0.5, lumbar: 0.5 }],
    [/hiperextension.*gluteo|hiperextension 45/, { glu_may: 1, bf: 0.5, lumbar: 0.5 }],
    [/lumbar|hiperextension|superman/, { lumbar: 1, glu_may: 0.5 }],
    // Plotkin 2023: hip thrust y sentadilla, glúteo mayor parecido; isquios y glúteo medio casi no crecen
    [/hip thrust|puente|patada|kickback|gluteo en polea/, { glu_may: 1 }],
    [/abduc/, { glu_med: 1, glu_may: 0.5 }],
    [/aduc/, { aductores: 1 }],
    [/gemelo.*sentad|soleo/, { soleo: 1, gastro: 0.5 }],
    [/gemelo|pantorrilla|calf/, { gastro: 1, soleo: 0.5 }],
    [/extension.*(cuadriceps|rodilla|pierna)|extension a 1 pierna|sissy/, { recto_fem: 1, vastos: 1 }],
    [/zancada|bulgara|lunge|split|step ?up|subida al cajon/, { vastos: 1, glu_may: 1, aductores: 0.5 }],
    // Kinoshita 2026: la prensa hace crecer vastos, glúteo mayor (+15 %) y aductor mayor, y casi nada el recto femoral (+1 %)
    [/prensa|pendular/, { vastos: 1, glu_may: 1, aductores: 0.5 }],
    // Kassiano 2026 y Plotkin 2023: la sentadilla, poco recto femoral; glúteo como el hip thrust; también aductores
    [/sentadilla|squat|hack/, { vastos: 1, glu_may: 1, aductores: 0.5, recto_fem: 0.25 }],
    // Maeo 2022: con el brazo por encima de la cabeza crece 1,5 veces más la cabeza larga y 1,4 veces más la lateral y medial que con el brazo pegado
    [/(triceps|press frances|frances|skull).*(overhead|encima|nuca|copa|frances|tumbad|katana)|press frances/, { tri_larga: 1, tri_lat: 1 }],
    [/triceps|fondos en banco|patada de triceps|press cerrado/, { tri_larga: 0.7, tri_lat: 0.7 }],
    [/curl.*(inclinad|bayes)|bayes/, { bic_larga: 1, bic_corta: 0.5, braquial: 0.25 }],
    [/predicador|scott|arana|spider|concentrad/, { bic_corta: 1, bic_larga: 0.5, braquial: 0.5 }],
    [/martillo|hammer|curl inverso|agarre neutro.*curl/, { braquial: 1, bic_larga: 0.5 }],
    [/curl|biceps/, { bic_larga: 1, bic_corta: 1, braquial: 0.5 }],
    [/landmine/, { pec_sup: 1, del_ant: 1, tri_lat: 0.5 }],
    [/inclinad.*(press|apertura|cruce)|(press|apertura|cruce).*inclinad|press alto/, { pec_sup: 1, pec_med: 0.5, del_ant: 0.5, tri_lat: 0.5 }],
    [/apertura|cruce|pec ?deck|contractor/, { pec_med: 1, pec_sup: 0.5 }],
    [/press (de )?banca|press (de )?pecho|press pecho|flexion|fondos|chest press|convergente/, { pec_med: 1, pec_sup: 0.5, del_ant: 0.5, tri_lat: 0.5 }],
    [/elevacion(es)? lateral|lateral raise/, { del_lat: 1 }],
    [/y en banco|activacion: y|y-raise/, { trap_med: 1, del_post: 0.5 }],
    [/posterior|pajaro|face ?pull|reverse|aperturas inversas|deltoides post/, { del_post: 1, trap_med: 0.5 }],
    [/remo vertical|upright/, { del_lat: 1, trap_sup: 0.5 }],
    [/encogimiento|shrug/, { trap_sup: 1 }],
    [/press (militar|de hombro|hombro)|arnold|militar|press por encima/, { del_ant: 1, del_lat: 0.5, tri_lat: 0.5 }],
    [/elevacion frontal|frontal/, { del_ant: 1 }],
    [/pullover|pull ?over/, { dorsal: 1, tri_larga: 0.25 }],
    [/jalon|dominada|pull ?down|pull ?up|chin/, { dorsal: 1, trap_med: 0.5, bic_larga: 0.5, bic_corta: 0.5 }],
    [/remo.*(unilateral|1 brazo|un brazo)|high row|remo con mancuerna/, { dorsal: 1, trap_med: 0.5, del_post: 0.25, bic_larga: 0.25, bic_corta: 0.25 }],
    [/remo|low row|row/, { trap_med: 1, dorsal: 0.5, del_post: 0.5, bic_larga: 0.25, bic_corta: 0.25 }],
    [/pallof|oblicuo|giro|rotacion|lenador|woodchop|plancha lateral|antirrotacion/, { oblicuos: 1, recto_abd: 0.5 }],
    [/crunch|abdominal|plancha|rueda|elevacion de piernas|elevando piernas|dead bug|hollow/, { recto_abd: 1, oblicuos: 0.5 }]
  ];
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  // qué zonas trabaja un ejercicio (pesos 0-1). Sin grupo = no cuenta (calentamiento, movilidad, cardio).
  function split(ex) {
    var g = ex.g && ex.g.length ? ex.g : []; if (!g.length) return null;
    var n = norm(ex.n), w = null;
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(n)) { w = RULES[i][1]; break; }
    if (!w) { w = DEF[g[0]] ? mix(DEF[g[0]]) : {}; g.slice(1).forEach(function (x) { w = mix(w, half(x)); }); return w; }
    // grupos marcados que la regla no cubre: suman como ayuda
    var cov = {}; Object.keys(w).forEach(function (k) { cov[R[k][1]] = true; });
    g.forEach(function (x) { if (!cov[x] && DEF[x]) w = mix(w, half(x)); });
    return w;
  }
  // items: [{n, g, sets}] → {zona: {v, src:{nombre: series}}}
  function tally(items) {
    var out = {};
    items.forEach(function (it) {
      if (!it.sets) return; var w = split(it); if (!w) return;
      Object.keys(w).forEach(function (k) {
        var o = out[k] || (out[k] = { v: 0, src: {} }), add = it.sets * w[k];
        o.v += add; o.src[it.n] = (o.src[it.n] || 0) + add;
      });
    });
    return out;
  }

  // ---- dibujo: media figura (lado izquierdo de la imagen), se refleja en x=100 ----
  // cada zona: lista de trazos. "base" = silueta sin músculo contado.
  var FRONT = {
    base: ["M100 12c-11 0-18 9-18 21 0 13 8 24 18 24s18-11 18-24c0-12-7-21-18-21z", "M92 54h8v14h-8z",
      "M44 200c-3 4-4 10-2 15 3 4 8 4 10 0l2-14z", "M66 186c6-4 20-6 34-4v26H70z",
      "M74 304c-2 6-2 10 0 14 6 2 12 2 16 0l2-14z", "M76 318c-6 24-4 50 2 76h10c4-26 6-52 2-76z", "M76 394c-6 4-10 9-8 13h22v-13z"],
    trap_sup: ["M93 58c-5 7-13 12-23 15l23-2z"],
    del_lat: ["M70 73c-12 1-20 9-22 23l1 11 6-4c1-13 7-22 17-26z"],
    del_ant: ["M72 77c-10 4-16 13-17 26l7 0c3-10 9-17 17-22z"],
    pec_sup: ["M100 72l-21 2c-7 3-12 9-15 17l36-6z"],
    pec_med: ["M100 85l-36 6c-1 11 4 21 14 26 7 3 15 3 22 1z"],
    bic_larga: ["M55 105c-7 12-9 27-7 42l7 1c-1-15 0-28 3-41z"],
    bic_corta: ["M58 107c-3 13-4 26-3 41l7-2c2-13 2-27-1-40z"],
    braquial: ["M48 149c-5 16-7 32-6 50l9 1c3-17 7-34 11-53z"],
    recto_abd: ["M100 120l-14 0c-1 21 0 42 4 62l10 2z", "M86 140h14", "M86 160h14"],
    oblicuos: ["M86 120l-15-5c-5 18-4 39 2 58l17 9c-4-20-5-41-4-62z"],
    vastos: ["M66 206c-6 26-5 62 6 96l8 0c-4-32-5-64-2-92z", "M90 262c5 12 5 28-2 40l-6 0c3-12 4-26 4-38z"],
    recto_fem: ["M78 210c-3 28-2 60 4 92l0 0c3-30 6-60 8-90z"],
    aductores: ["M90 212l9-3c0 22-3 42-8 56-2-17-2-35-1-53z"]
  };
  var BACK = {
    base: ["M100 12c-11 0-18 9-18 21 0 13 8 24 18 24s18-11 18-24c0-12-7-21-18-21z", "M92 54h8v8h-8z",
      "M46 150c-5 16-7 32-6 50l9 1c3-17 7-34 11-53z", "M44 200c-3 4-4 10-2 15 3 4 8 4 10 0l2-14z",
      "M72 166c8 8 18 12 28 12v18H70z", "M74 304c-2 6-2 10 0 14 6 2 12 2 16 0l2-14z", "M76 394c-6 4-10 9-8 13h22v-13z"],
    trap_sup: ["M93 56c-5 8-13 13-24 17l31 6v-23z"],
    trap_med: ["M100 79l-28-5 10 14 18 44z"],
    del_lat: ["M68 74c-10 2-17 9-20 20l1 10 5-3c1-11 6-20 14-24z"],
    del_post: ["M70 78c-9 4-15 12-16 24l7 1c3-9 9-16 17-20z"],
    dorsal: ["M80 90l20 44v34c-12-2-22-9-28-20-4-18-1-38 8-58z"],
    lumbar: ["M100 140l-8-2c-2 14-2 28 0 40l8 4z"],
    tri_lat: ["M53 106c-7 12-9 27-7 43l6 0c0-15 1-29 4-42z"],
    tri_larga: ["M56 107c-3 13-4 27-3 42l8-2c2-13 2-28-1-42z"],
    glu_med: ["M71 178c-6 8-8 20-6 34 5-9 13-15 25-18l-4-14z"],
    glu_may: ["M100 194l-16 2c-11 4-18 12-19 24 2 10 14 18 35 16z"],
    bf: ["M66 230c-4 26-1 52 8 72l8 0c-3-22-4-46-2-70z"],
    semis: ["M80 234c-2 24-1 48 2 68l8 0c4-22 7-46 8-68z"],
    gastro: ["M74 318c-7 14-8 30-2 44l8 2c0-15 1-30 2-46z", "M84 318c5 15 6 31 2 46l-6 0c0-15 1-31 4-46z"],
    soleo: ["M72 364c0 12 2 22 6 30h10c2-10 2-20-2-30z"]
  };

  function lvl(v) { return !v ? 0 : v < 3 ? 1 : v < 6 ? 2 : v < 10 ? 3 : 4; }
  function svgEl(t, a) { var e = document.createElementNS(NS, t); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
  function figure(def, data, label, onPick) {
    var svg = svgEl("svg", { viewBox: "28 6 144 406", class: "bodyfig", role: "img", "aria-label": label });
    function draw(d, cls, key) {
      [null, "matrix(-1 0 0 1 200 0)"].forEach(function (tr) {
        var p = svgEl("path", { d: d, class: cls }); if (tr) p.setAttribute("transform", tr);
        if (key) { p.setAttribute("data-r", key); p.addEventListener("click", function () { onPick(key); }); }
        svg.appendChild(p);
      });
    }
    def.base.forEach(function (d) { draw(d, "bz base"); });
    Object.keys(def).forEach(function (k) {
      if (k === "base") return; var v = data[k] ? data[k].v : 0;
      def[k].forEach(function (d) { draw(d, (/^M\d+ \d+h\d+$/.test(d) ? "bz line" : "bz m l" + lvl(v)), k); });
    });
    var t = svgEl("text", { x: "100", y: "410", class: "bodycap", "text-anchor": "middle" }); t.textContent = label; svg.appendChild(t);
    return svg;
  }
  function f1(v) { return (Math.round(v * 10) / 10).toString().replace(".", ","); }
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // o: {done: items, plan: items, title}
  function card(o) {
    var sec = h("section", "card bodycard");
    var mode = o.done.some(function (x) { return x.sets; }) ? "done" : "plan", picked = null;
    sec.appendChild(h("h2", null, o.title || "Mapa muscular"));
    var tabs = h("div", "bodytabs"); tabs.setAttribute("role", "tablist");
    var body = h("div", "bodywrap"), info = h("div", "bodyinfo"), rank = h("div", "bodyrank");
    [["done", "Hechas"], ["plan", "Pautadas"]].forEach(function (m) {
      var b = h("button", "chip", m[1]); b.type = "button"; b.setAttribute("role", "tab");
      b.onclick = function () { mode = m[0]; paint(); }; b.dataset.m = m[0]; tabs.appendChild(b);
    });
    sec.appendChild(tabs); sec.appendChild(body); sec.appendChild(info);
    var leg = h("div", "bodyleg");
    [["l0", "0"], ["l1", "<3"], ["l2", "3-6"], ["l3", "6-10"], ["l4", "10+"]].forEach(function (x) { var s = h("span", null, x[1]); var i = h("i", "sw " + x[0]); s.prepend(i); leg.appendChild(s); });
    leg.appendChild(h("small", null, "series/semana"));
    sec.appendChild(leg); sec.appendChild(rank);
    sec.appendChild(h("p", "meta", "Reparto aproximado según el ejercicio: cuenta 1 serie para la zona que más trabaja y menos para las que ayudan (por eso la suma es mayor que en la tabla). Las zonas con * se basan en anatomía; el resto, en estudios que midieron el crecimiento de cada zona. Toca un músculo para ver de dónde salen sus series. No cuentan calentamientos ni ejercicios sin grupo."));
    var det = h("details", "bodysrc"); det.appendChild(h("summary", null, "Fuentes del reparto"));
    var sl = h("ul"); SRC.forEach(function (x) { var li = h("li"), a = h("a", null, x[0]); a.href = "https://doi.org/" + x[1]; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); sl.appendChild(li); });
    det.appendChild(sl); sec.appendChild(det);
    function pick(k) { picked = picked === k ? null : k; paint(); }
    function paint() {
      var data = tally(mode === "done" ? o.done : o.plan);
      Array.prototype.forEach.call(tabs.children, function (b) { var on = b.dataset.m === mode; b.className = "chip" + (on ? " on" : ""); b.setAttribute("aria-selected", String(on)); });
      body.innerHTML = "";
      body.appendChild(figure(FRONT, data, "Frente", pick));
      body.appendChild(figure(BACK, data, "Espalda", pick));
      Array.prototype.forEach.call(body.querySelectorAll("[data-r]"), function (p) { if (p.getAttribute("data-r") === picked) p.classList.add("sel"); });
      info.innerHTML = "";
      if (picked) {
        var d = data[picked], r = R[picked];
        info.appendChild(h("b", null, r[0]));
        info.appendChild(h("span", "bodyv", (d ? f1(d.v) : "0") + " series " + (mode === "done" ? "hechas" : "pautadas") + " · " + r[1]));
        info.appendChild(h("span", "bodyev" + (EV[picked] ? " ok" : ""), EV[picked] ? "Reparto basado en estudios de crecimiento muscular." : "* Reparto basado en anatomía: no hay estudios que midan el crecimiento de esta zona por separado."));
        if (d) { var ul = h("ul"); Object.keys(d.src).sort(function (a, b) { return d.src[b] - d.src[a]; }).forEach(function (n) { ul.appendChild(h("li", null, n + ": " + f1(d.src[n]))); }); info.appendChild(ul); }
        else info.appendChild(h("span", "meta", "Esta semana no hay ejercicios que la trabajen."));
      } else info.appendChild(h("span", "meta", "Toca un músculo de la figura."));
      rank.innerHTML = "";
      var keys = Object.keys(R).filter(function (k) { return data[k] && data[k].v > 0; }).sort(function (a, b) { return data[b].v - data[a].v; });
      if (!keys.length) { rank.appendChild(h("p", "meta", mode === "done" ? "Aún no hay series apuntadas esta semana. Mira las pautadas." : "Esta semana no hay series pautadas.")); return; }
      rank.appendChild(h("h3", null, "Lo que más trabajas"));
      var ol = h("ol", "rank");
      var max = data[keys[0]].v;
      keys.slice(0, 6).forEach(function (k) {
        var li = h("li"); li.onclick = function () { pick(k); };
        var top = h("div", "rt"); top.appendChild(h("span", null, nm(k))); top.appendChild(h("b", null, f1(data[k].v)));
        var bar = h("div", "rb"); var i = h("i"); i.style.width = (data[k].v / max * 100) + "%"; bar.appendChild(i);
        li.appendChild(top); li.appendChild(bar); ol.appendChild(li);
      });
      rank.appendChild(ol);
      var used = {}; (mode === "done" ? o.done : o.plan).forEach(function (x) { (x.g || []).forEach(function (g) { used[g] = true; }); });
      var low = Object.keys(R).filter(function (k) { return used[R[k][1]] && (!data[k] || data[k].v < 1); });
      if (low.length) rank.appendChild(h("p", "meta lowz", "Casi sin trabajo, dentro de los grupos que entrenas: " + low.map(function (k) { return R[k][0].replace(/ \(.*\)/, ""); }).join(", ") + "."));
    }
    paint();
    return sec;
  }
  window.EYLCuerpo = { card: card, split: split, tally: tally, zonas: R };
})();
