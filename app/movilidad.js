/* ENTRENA YOUR LIFE · Movilidad según la sesión.
   13 ejercicios grabados por Miguel (vídeos en videos/movilidad/). Cada día se eligen unos 6
   según lo que pide la sesión: hombro y torácica (H), cadera (C) o rodilla y tobillo (T).
   Las zonas de cada ejercicio y las dosis son criterio práctico (anatomía), no salen de estudios. */
(function () {
  "use strict";
  var V = "videos/movilidad/";
  // orden = orden de la rutina: a cuatro patas → suelo → de rodillas
  var CAT = [
    { id: "gato", n: "Gato-camello", d: "8", v: "gato-camello", z: { G: 1 } },
    { id: "escap", n: "Retracción y protracción escapular", d: "10", v: "retraccion-protraccion-escapular", z: { H: 1 } },
    { id: "perro", n: "Perro de muestra", d: "6 por lado", v: "perro-de-muestra", z: { G: 1, C: 0.3 } },
    { id: "rotor", n: "Rotación torácica", d: "8 por lado", v: "rotacion-toracica", z: { H: 1 } },
    { id: "nino", n: "Niño a cobra", d: "6", v: "nino-cobra", z: { H: 0.8, G: 0.3 } },
    { id: "pbac", n: "Perro boca abajo a cobra", d: "6", v: "perro-boca-abajo-a-cobra", z: { H: 0.6, T: 0.6 } },
    { id: "nn", n: "90/90", d: "6 por lado", v: "90-90", z: { C: 1 } },
    { id: "nnrot", n: "90/90 con rotación", d: "5 por lado", v: "90-90-rotacion", z: { C: 1 } },
    { id: "nninc", n: "90/90 con inclinación", d: "5 por lado", v: "90-90-inclinacion", z: { C: 1 } },
    { id: "estc", n: "Estocada de cadera", d: "30 s por lado", v: "estocada-cadera", z: { C: 1 } },
    { id: "estl", n: "Estocada lateral", d: "8 por lado", v: "estocada-lateral", z: { C: 0.7, T: 0.4 } },
    { id: "estt", n: "Estocada con el tobillo adelante", d: "10 por lado", v: "estocada-tobillo-adelante", z: { T: 1 } },
    { id: "spid", n: "Spiderman con rotación", d: "5 por lado", v: "spiderman-rotacion", z: { C: 0.7, H: 0.5 } }
  ];
  var BY = {}; CAT.forEach(function (m) { BY[m.id] = m; });
  // prioridad dentro de cada zona
  var PRI = {
    H: ["rotor", "escap", "nino", "pbac", "spid"],
    C: ["nn", "estc", "spid", "nnrot", "estl", "nninc"],
    T: ["estt", "pbac", "estl"]
  };
  var TOTAL = 6; // gato-camello + 5 (unos 8 min)

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  // demanda de la sesión por zona, en series
  function demand(list) {
    var D = { H: 0, C: 0, T: 0 }, flags = {};
    (list || []).forEach(function (ex) {
      if (!ex || ex.act) return;
      var k = (ex.series || []).length; if (ex.uni) k = Math.ceil(k / 2); if (!k) return;
      var gs = Array.isArray(ex.g) ? ex.g : (ex.g ? [ex.g] : []), n = norm(ex.n);
      gs.forEach(function (g, i) {
        var w = i ? k * 0.5 : k; // grupo principal entero, los demás a la mitad
        if (/^(Pecho|Espalda|Hombro|Bíceps|Tríceps)$/.test(g)) D.H += w;
        if (g === "Glúteo" || g === "Isquios") D.C += w;
        if (g === "Aductores") { D.C += w; flags.aduc = true; }
        if (g === "Cuádriceps") { D.T += w * 0.6; D.C += w * 0.4; }
        if (g === "Gemelo") D.T += w;
      });
      if (/militar|por encima|overhead|tras nuca|dominada|jalon|pullover|press de hombro|lateral/.test(n)) { D.H += k * 0.5; flags.overhead = true; }
      if (/sentadilla|hack|prensa|zancada|bulgara|estocada|subida|salto|step|pistol|goblet/.test(n)) { D.T += k * 0.5; D.C += k * 0.3; }
      if (/peso muerto|rumano|hip thrust|puente|good morning|abducc|aducc/.test(n)) D.C += k * 0.5;
      if (/aducc|aductor/.test(n)) flags.aduc = true;
    });
    return { D: D, flags: flags };
  }
  // elige los ejercicios del día
  function pick(list) {
    var r = demand(list), D = r.D, tot = D.H + D.C + D.T, slots = TOTAL - 1, n = {};
    if (!tot) { n = { H: 2, C: 2, T: 1 }; }
    else {
      var zs = ["H", "C", "T"], rest = slots;
      zs.forEach(function (z) { n[z] = D[z] / tot >= 0.15 ? 1 : 0; rest -= n[z]; });
      while (rest > 0) { // reparte el resto según la demanda que queda sin cubrir
        var best = null, bv = -1;
        zs.forEach(function (z) { var v = D[z] / (n[z] + 1); if (v > bv && n[z] < PRI[z].length) { bv = v; best = z; } });
        if (!best) break; n[best]++; rest--;
      }
    }
    var chosen = { gato: true }, pri = { H: PRI.H.slice(), C: PRI.C.slice(), T: PRI.T.slice() };
    if (r.flags.aduc) pri.C = ["estl"].concat(pri.C.filter(function (x) { return x !== "estl"; }));
    ["T", "H", "C"].forEach(function (z) {
      var c = 0; pri[z].forEach(function (id) { if (c < n[z] && !chosen[id]) { chosen[id] = true; c++; } });
    });
    var sel = CAT.filter(function (m) { return chosen[m.id]; });
    var foco = [];
    if (D.H && D.H / (tot || 1) >= 0.3) foco.push("hombro y torácica");
    if (D.C && D.C / (tot || 1) >= 0.3) foco.push("cadera");
    if (D.T && D.T / (tot || 1) >= 0.25) foco.push("rodilla y tobillo");
    return { sel: sel, resto: CAT.filter(function (m) { return !chosen[m.id]; }), foco: foco, demanda: D };
  }

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (a) {
      if (a === "text") e.textContent = attrs[a];
      else if (a === "class") e.className = attrs[a];
      else if (a.slice(0, 2) === "on") e.addEventListener(a.slice(2), attrs[a]);
      else if (attrs[a] !== null && attrs[a] !== undefined && attrs[a] !== false) e.setAttribute(a, attrs[a]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function item(m) {
    var box = h("div", { class: "movvid", hidden: true });
    var btn = h("button", { class: "movplay", type: "button", "aria-label": "Ver vídeo de " + m.n, text: "▶ Vídeo" });
    btn.onclick = function () {
      if (box.hidden) {
        if (!box.firstChild) box.appendChild(h("video", { src: V + m.v + ".mp4", muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata" }));
        var vid = box.firstChild; vid.muted = true; box.hidden = false; btn.textContent = "✕ Cerrar"; try { vid.play(); } catch (e) {}
      } else { box.hidden = true; btn.textContent = "▶ Vídeo"; try { box.firstChild.pause(); } catch (e) {} }
    };
    return h("li", null, [h("div", { class: "movrow" }, [h("span", { text: m.n }), h("b", { text: m.d }), btn]), box]);
  }
  // bloque para «Antes de empezar»
  function render(list) {
    var p = pick(list);
    var kids = [
      h("p", { class: "meta", text: p.foco.length ? "Hoy, según tu sesión: " + p.foco.join(", ") + "." : "Movilidad general para hoy." }),
      h("ol", { class: "preplist mov" }, p.sel.map(item))
    ];
    if (p.resto.length) {
      kids.push(h("details", { class: "movmas" }, [h("summary", { text: "Más ejercicios de movilidad (días de descanso)" }), h("ol", { class: "preplist mov" }, p.resto.map(item))]));
    }
    return { nodes: kids, n: p.sel.length };
  }

  window.EYLMov = { CAT: CAT, pick: pick, demand: demand, render: render };
})();
