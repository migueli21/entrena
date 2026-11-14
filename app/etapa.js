/* ENTRENA YOUR LIFE · Tu etapa: embarazo, posparto y menopausia.
   Datos en nutri_cliente.data.etapa = {tipo, fpp, parto, cesarea, lactancia, meno, sint}. Si no hay, se toma la situación de la entrevista.
   Solo pautas generales y alimentos, nunca suplementos. Fuentes en SRC (comprobadas en PubMed). */
(function () {
  "use strict";
  var DAY = 864e5;
  function iso(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  var TODAY = iso(Date.now());
  function diffD(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / DAY); }
  function fmtD(s) { return new Date(s + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  var TIPOS = { embarazo: "Embarazo", posparto: "Posparto", menopausia: "Menopausia" };

  var SRC = {
    can: ["Guía canadiense de actividad física en el embarazo (2019)", "10.1136/bjsports-2018-100056"],
    acog: ["ACOG 804: ejercicio en embarazo y posparto (2020)", "10.1097/AOG.0000000000003772"],
    ioc: ["COI: ejercicio en el posparto (2017)", "10.1136/bjsports-2017-097964"],
    lift: ["LIFTMOR: fuerza pesada e impacto en posmenopausia (2018)", "10.1002/jbmr.3284"],
    bmd: ["Metaanálisis: fuerza e impacto y densidad ósea en la menopausia (2026)", "10.1097/GME.0000000000002839"],
    life: ["Metaanálisis: fuerza en mujeres de todas las edades (2026)", "10.1016/j.jsams.2026.03.002"]
  };

  // ---- estado actual a partir de los datos ----
  function state(et, ent) {
    et = et || {}; ent = ent || {};
    var tipo = et.tipo || (TIPOS[ent.situacion] ? ent.situacion : null);
    if (!tipo || tipo === "no") return null;
    var s = { tipo: tipo, et: et };
    if (tipo === "embarazo" && et.fpp) {
      var dias = 280 - diffD(TODAY, et.fpp); // días de embarazo
      s.sem = Math.max(1, Math.min(42, Math.floor(dias / 7)));
      s.tri = s.sem < 14 ? 1 : s.sem < 28 ? 2 : 3;
      if (diffD(et.fpp, TODAY) > 21) s.pasada = true; // ya debería haber dado a luz
    }
    if (tipo === "posparto" && et.parto) { s.sem = Math.max(0, Math.floor(diffD(et.parto, TODAY) / 7)); s.fase = s.sem < 6 ? 1 : s.sem < 12 ? 2 : 3; }
    if (tipo === "menopausia") s.meno = et.meno || "";
    return s;
  }
  function title(s) {
    if (s.tipo === "embarazo") return s.sem ? "Embarazo · semana " + s.sem + " (" + s.tri + ".º trimestre)" : "Embarazo";
    if (s.tipo === "posparto") return s.sem != null ? "Posparto · semana " + s.sem + (s.et.cesarea ? " · cesárea" : "") : "Posparto";
    return s.meno === "peri" ? "Perimenopausia" : s.meno === "post" ? "Posmenopausia" : "Menopausia";
  }
  function label(et, ent) { var s = state(et, ent); return s ? title(s) : null; }

  // ---- consejo corto para el aviso de Entreno ----
  function today(s) {
    if (s.tipo === "embarazo") {
      if (!s.tri) return "Entrena a un ritmo en el que puedas hablar, deja 2-3 repeticiones en la recámara y no aguantes la respiración.";
      return ["Si hay náuseas o cansancio, baja volumen: algo es mejor que nada. Ritmo en el que puedas hablar.",
        "Si boca arriba te mareas o te notas rara, pasa a banco inclinado o de lado. Suelta el aire al hacer fuerza.",
        "Baja cargas y rango si notas presión en la pelvis. Prioriza piernas, espalda y movilidad."][s.tri - 1];
    }
    if (s.tipo === "posparto") {
      if (!s.fase) return "Vuelve poco a poco: respiración, suelo pélvico y cargas que controles. Si notas pérdidas o pesadez, para y coméntalo.";
      return ["Toca caminar, respirar y suelo pélvico. Nada de cargas pesadas ni abdominales todavía.",
        "Fuerza con cargas ligeras y buena técnica. Sube poco a poco si no hay pérdidas, pesadez ni dolor.",
        "Si no tienes síntomas, puedes ir subiendo cargas y metiendo impacto de forma progresiva."][s.fase - 1];
    }
    return "La fuerza es tu mejor aliada: cargas que cuesten de verdad (deja 1-3 repeticiones), progresando poco a poco.";
  }

  // ---- contenido completo ----
  function content(s) {
    var e = s.et, T = [], P = [], A = [], src = [];
    if (s.tipo === "embarazo") {
      T.push("Si tu médico o matrona no te lo ha desaconsejado, entrenar es seguro y recomendable: al menos 150 minutos a la semana de actividad moderada, repartidos en 3 días o más, mezclando fuerza y cardio.");
      T.push("Intensidad: que puedas hablar mientras entrenas. En fuerza, deja 2-3 repeticiones en la recámara y no bloquees la respiración: suelta el aire al hacer fuerza.");
      T.push("Ejercicios de suelo pélvico a diario: reducen el riesgo de pérdidas de orina.");
      T.push("Evita deportes de contacto o con riesgo de caída o golpe en la tripa, y entrenar con mucho calor. Bebe agua.");
      if (s.tri === 1) T.push("Primer trimestre: si hay náuseas o mucho cansancio, baja series o peso ese día. No hace falta dejarlo.");
      if (s.tri >= 2) T.push("Desde el segundo trimestre: si tumbada boca arriba te mareas o te notas rara, cambia a banco inclinado o de lado.");
      if (s.tri >= 2) T.push("Ve quitando los ejercicios que aprietan la tripa (crunch, planchas largas) si ves que se abomba en el centro.");
      if (s.tri === 3) T.push("Tercer trimestre: reduce cargas y rango si notas presión en la pelvis o dolor en el pubis. Prioriza piernas, espalda y movilidad.");
      P.push(s.tri === 1 ? "No hace falta comer por dos: en el primer trimestre las necesidades casi no cambian." : s.tri === 2 ? "En el segundo trimestre necesitas unas 300-350 kcal más al día: por ejemplo, un yogur, una fruta y un puñado de frutos secos." : s.tri === 3 ? "En el tercer trimestre, unas 450 kcal más al día: añade un tentempié completo (bocadillo pequeño, lácteo y fruta)." : "En el primer trimestre las necesidades casi no cambian; luego suben unas 300-450 kcal al día.");
      P.push("Seguridad: carne y huevos bien hechos, lácteos pasteurizados, frutas y verduras bien lavadas, y evita pez espada, atún rojo, tiburón y lucio por el mercurio.");
      P.push("Legumbres, verduras de hoja verde y cítricos para el folato; carne, pescado o legumbres con algo de vitamina C para el hierro.");
      P.push("Los suplementos (ácido fólico, yodo, hierro…) te los pauta tu matrona o tu médico, no la app.");
      A = ["Sangrado por la vagina", "Pérdida de líquido", "Contracciones regulares y dolorosas", "Mareo o sensación de desmayo", "Dolor en el pecho", "Dolor de cabeza fuerte", "Falta de aire antes de empezar a hacer esfuerzo", "Dolor o hinchazón en la pantorrilla", "Debilidad que te hace perder el equilibrio", "Notas que el bebé se mueve menos"];
      src = [SRC.can, SRC.acog];
    } else if (s.tipo === "posparto") {
      if (!s.fase || s.fase === 1) T.push("Primeras 6 semanas: caminar, respiración y suelo pélvico desde que te encuentres bien" + (e.cesarea ? " y te lo permitan tras la cesárea" : "") + ". Nada de cargas pesadas ni abdominales todavía.");
      if (!s.fase || s.fase === 2) T.push("De la semana 6 a la 12: tras la revisión médica, vuelve a la fuerza con cargas ligeras, técnica y respiración. Lo ideal es una valoración con fisio de suelo pélvico antes de subir intensidad.");
      if (!s.fase || s.fase === 3) T.push("Desde la semana 12: si no tienes síntomas, puedes ir subiendo cargas y metiendo impacto (saltos, correr) de forma progresiva, mejor tras la valoración de suelo pélvico.");
      if (e.cesarea) T.push("Con cesárea, ve más despacio con el abdomen y escucha la cicatriz: si tira o duele al hacer fuerza, baja.");
      T.push("Al hacer fuerza, suelta el aire y activa el suelo pélvico. Si ves que la tripa se abomba en el centro, baja la carga o cambia el ejercicio.");
      T.push("El sueño manda: los días de pocas horas, menos series y más margen. Moverse también ayuda al ánimo.");
      P.push("Sin dietas estrictas: recupera con calma. Si quieres perder peso, como máximo medio kilo a la semana.");
      if (e.lactancia) { P.push("La lactancia gasta energía extra (unas 400-500 kcal al día): no recortes mucho, pon proteína en cada comida y bebe agua cada vez que des el pecho."); P.push("El ejercicio moderado no cambia la cantidad ni la calidad de la leche. Si te resulta más cómodo, da el pecho antes de entrenar."); }
      P.push("Prioriza comida fácil y completa: huevos, yogur, legumbres de bote, pescado, fruta y pan integral.");
      A = ["Pérdidas de orina o gases al hacer esfuerzo, toser o saltar", "Sensación de bulto o pesadez en la vagina", "Dolor en la pelvis, en la zona lumbar o en la cicatriz al entrenar", "La tripa se abomba en el centro al hacer fuerza (posible diástasis)", "El sangrado vuelve a aumentar con el ejercicio", "Tristeza, ansiedad o falta de ganas que no se van (habla con tu médico)"];
      src = [SRC.ioc, SRC.acog];
    } else {
      T.push("La fuerza es tu mejor aliada: 2-3 días por semana con cargas que cuesten de verdad (deja 1-3 repeticiones en la recámara), subiendo poco a poco. Protege el músculo y el hueso.");
      T.push("Para el hueso funcionan las cargas altas y el impacto: sentadilla, peso muerto, press y saltos sencillos, siempre con buena técnica y si tus articulaciones y tu suelo pélvico lo toleran.");
      T.push("Añade equilibrio (apoyo a una pierna) y camina cada día.");
      if (s.meno === "peri") T.push("En la perimenopausia los ciclos y la energía cambian mucho de un mes a otro: ajusta el día a cómo estás, no al calendario.");
      P.push("Proteína en cada comida (unos 25-30 g: huevos, lácteos, carne, pescado o legumbres) para mantener el músculo.");
      P.push("Calcio de lácteos, sardinas en lata con espina, almendras o bebidas vegetales enriquecidas.");
      P.push("Si los sofocos empeoran con alcohol, café o picante, prueba a reducirlos y mira si notas cambio.");
      A = ["Sangrado después de 12 meses sin regla: consúltalo con tu médico", "Dolor en el pecho, palpitaciones o falta de aire con el esfuerzo", "Dolor en un hueso tras un golpe pequeño o sin motivo", "Pérdidas de orina o pesadez en la vagina al entrenar (fisio de suelo pélvico)"];
      src = [SRC.lift, SRC.bmd, SRC.life];
    }
    return { T: T, P: P, A: A, src: src };
  }
  // consejos por síntoma (menopausia)
  var SINT = [["sofocos", "Sofocos"], ["sueno", "Duermo mal"], ["articular", "Dolor articular"], ["animo", "Ánimo bajo"], ["peso", "Gano peso en la tripa"]];
  var SADV = {
    sofocos: "Sofocos: entrena en horas frescas, con ropa por capas y agua a mano.",
    sueno: "Si has dormido mal, baja una serie por ejercicio ese día, pero no lo dejes. Cenar pronto y una rutina fija ayudan.",
    articular: "Dolor articular: calienta más rato y usa rangos sin dolor. El ejercicio de fuerza suele mejorarlo con las semanas.",
    animo: "El ejercicio ayuda al ánimo. Si dura semanas, coméntalo con tu médico.",
    peso: "La grasa tiende a ir a la tripa: fuerza, pasos diarios y proteína son lo que más ayuda."
  };

  // ---- datos ----
  var CACHE = {};
  function load(sb, id) {
    if (CACHE[id]) return Promise.resolve(CACHE[id]);
    return sb.from("nutri_cliente").select("data").eq("cliente_id", id).maybeSingle().then(function (r) {
      var d = r && r.data && r.data.data ? r.data.data : {};
      CACHE[id] = { et: d.etapa || null, ent: (d.entrevistaCli || {}).data || {} }; return CACHE[id];
    });
  }
  function save(sb, id, et) {
    return sb.from("nutri_cliente").select("data").eq("cliente_id", id).maybeSingle().then(function (cur) {
      if (cur.error) throw cur.error;
      var d = Object.assign({}, cur.data ? cur.data.data : {}); d.etapa = et;
      return sb.from("nutri_cliente").upsert({ cliente_id: id, data: d }).then(function (r) {
        if (r.error) throw r.error; CACHE[id] = { et: et, ent: (d.entrevistaCli || {}).data || {} }; return CACHE[id];
      });
    });
  }
  function woman(c) { return c && c.ent && c.ent.sexo === "m"; }

  // ---- aviso en el día de entreno ----
  function banner(o) {
    var box = document.createElement("div"); box.className = "etbanner"; box.hidden = true;
    var id = o.client && o.client.id; if (!id || !o.sb) return box;
    function fill(c) {
      var s = state(c.et, c.ent); box.innerHTML = "";
      if (!s) {
        if (o.coach && woman(c)) { box.hidden = false; box.className = "etbanner mini"; var b0 = btn("+ Marcar embarazo, posparto o menopausia", "btn ghost small"); b0.onclick = function () { open(o, c, fill); }; box.appendChild(b0); }
        else box.hidden = true;
        return;
      }
      box.hidden = false; box.className = "etbanner";
      box.insertAdjacentHTML("beforeend", "<b>" + esc(title(s)) + "</b><span><b>🏋️ Hoy en tu entreno:</b> " + esc(today(s)) + "</span>");
      if (s.tipo === "embarazo" && !s.tri) box.insertAdjacentHTML("beforeend", '<span class="etmiss">Apunta tu fecha prevista de parto para ver consejos por trimestre.</span>');
      if (s.tipo === "posparto" && s.sem == null) box.insertAdjacentHTML("beforeend", '<span class="etmiss">Apunta la fecha del parto para ver consejos según las semanas.</span>');
      if (s.pasada) box.insertAdjacentHTML("beforeend", '<span class="etmiss">¿Ya ha nacido? Cámbialo a «Posparto» en «Mi etapa».</span>');
      var b = btn(o.coach ? "Ver su etapa" : "Mi etapa: entreno y comida", "btn ghost small"); b.onclick = function () { open(o, c, fill); }; box.appendChild(b);
    }
    load(o.sb, id).then(fill, function () {});
    return box;
  }
  function btn(t, cls) { var b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = t; return b; }

  // ---- ventana con todo ----
  function open(o, c, refill) {
    var et = Object.assign({}, c.et || {}), s0 = state(c.et, c.ent);
    if (!et.tipo) et.tipo = s0 ? s0.tipo : "embarazo";
    var ov = document.createElement("div"); ov.className = "etov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Mi etapa");
    var pane = document.createElement("div"); pane.className = "etpane"; ov.appendChild(pane);
    function close() { ov.remove(); document.body.style.overflow = ""; }
    ov.addEventListener("click", function (ev) { if (ev.target === ov) close(); });
    function render() {
      var s = state(et, c.ent);
      var h = '<div class="ethead"><h2>' + esc(s ? title(s) : "Mi etapa") + '</h2><button type="button" class="etx" aria-label="Cerrar">✕</button></div>';
      h += '<div class="etform"><div class="etseg" role="radiogroup" aria-label="Etapa">' + Object.keys(TIPOS).concat(["no"]).map(function (k) {
        return '<button type="button" role="radio" aria-checked="' + (et.tipo === k) + '" class="' + (et.tipo === k ? "on" : "") + '" data-t="' + k + '">' + (k === "no" ? "Ninguna" : TIPOS[k]) + "</button>";
      }).join("") + "</div>";
      if (et.tipo === "embarazo") h += '<label class="etf">Fecha prevista de parto<input type="date" data-k="fpp" value="' + esc(et.fpp || "") + '"></label>';
      if (et.tipo === "posparto") {
        h += '<label class="etf">Fecha del parto<input type="date" data-k="parto" max="' + TODAY + '" value="' + esc(et.parto || "") + '"></label>';
        h += '<div class="etchips">' + [["cesarea", "Fue por cesárea"], ["lactancia", "Doy el pecho"]].map(function (x) { return '<button type="button" aria-pressed="' + !!et[x[0]] + '" class="' + (et[x[0]] ? "on" : "") + '" data-b="' + x[0] + '">' + (et[x[0]] ? "✓ " : "") + x[1] + "</button>"; }).join("") + "</div>";
      }
      if (et.tipo === "menopausia") {
        h += '<div class="etchips">' + [["peri", "Aún tengo alguna regla"], ["post", "Más de 12 meses sin regla"]].map(function (x) { return '<button type="button" aria-pressed="' + (et.meno === x[0]) + '" class="' + (et.meno === x[0] ? "on" : "") + '" data-m="' + x[0] + '">' + (et.meno === x[0] ? "✓ " : "") + x[1] + "</button>"; }).join("") + "</div>";
        h += '<p class="etsub">¿Qué notas últimamente?</p><div class="etchips">' + SINT.map(function (x) { var on = (et.sint || []).indexOf(x[0]) >= 0; return '<button type="button" aria-pressed="' + on + '" class="' + (on ? "on" : "") + '" data-s="' + x[0] + '">' + (on ? "✓ " : "") + x[1] + "</button>"; }).join("") + "</div>";
      }
      h += '<button type="button" class="btn primary wide etsave">Guardar</button></div>';
      if (s) {
        var k = content(s);
        h += '<section class="etsec"><h3>🏋️ En tu entreno</h3><ul>' + k.T.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
        if (s.tipo === "menopausia" && (et.sint || []).length) h += '<section class="etsec"><h3>Por cómo estás</h3><ul>' + et.sint.map(function (x) { return "<li>" + esc(SADV[x]) + "</li>"; }).join("") + "</ul></section>";
        h += '<section class="etsec"><h3>🍽️ En tu plato</h3><ul>' + k.P.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
        h += '<section class="etsec etstop"><h3>🛑 Para y avisa' + (s.tipo === "menopausia" ? "" : " a tu médico o matrona") + " si…</h3><ul>" + k.A.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
        h += '<p class="etsrc">Pautas generales: no sustituyen a tu médico, matrona o fisio. Fuentes: ' + k.src.map(function (x) { return '<a href="https://doi.org/' + x[1] + '" target="_blank" rel="noopener">' + esc(x[0]) + "</a>"; }).join(" · ") + "</p>";
      } else h += '<p class="etsrc">Sin etapa marcada: no se mostrará nada en tu entreno.</p>';
      pane.innerHTML = h;
      pane.querySelector(".etx").onclick = close;
      Array.prototype.forEach.call(pane.querySelectorAll("[data-t]"), function (b) { b.onclick = function () { et.tipo = b.dataset.t; render(); }; });
      Array.prototype.forEach.call(pane.querySelectorAll("[data-k]"), function (i) { i.onchange = function () { et[i.dataset.k] = i.value || null; render(); }; });
      Array.prototype.forEach.call(pane.querySelectorAll("[data-b]"), function (b) { b.onclick = function () { et[b.dataset.b] = !et[b.dataset.b]; render(); }; });
      Array.prototype.forEach.call(pane.querySelectorAll("[data-m]"), function (b) { b.onclick = function () { et.meno = et.meno === b.dataset.m ? null : b.dataset.m; render(); }; });
      Array.prototype.forEach.call(pane.querySelectorAll("[data-s]"), function (b) { b.onclick = function () { var a = (et.sint || []).slice(), i = a.indexOf(b.dataset.s); if (i >= 0) a.splice(i, 1); else a.push(b.dataset.s); et.sint = a; render(); }; });
      var sv = pane.querySelector(".etsave");
      sv.onclick = function () {
        sv.disabled = true; sv.textContent = "Guardando…";
        save(o.sb, o.client.id, Object.assign({}, et, { fecha: TODAY })).then(function (cc) {
          c.et = cc.et; if (o.flash) o.flash("Guardado"); refill(c); close();
        }, function (e) { sv.disabled = false; sv.textContent = "Guardar"; if (o.flash) o.flash(/fetch|network/i.test((e && e.message) || "") ? "Sin conexión: no se ha guardado." : "No se ha guardado: " + ((e && e.message) || "error")); });
      };
    }
    render();
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    var x = pane.querySelector(".etx"); if (x) x.focus();
  }
  window.EYLEtapa = { banner: banner, label: label, state: state, content: content };
})();
