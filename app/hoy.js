/* ENTRENA YOUR LIFE · «Cómo se hace» de cada ejercicio y la tarea rápida del día.
   El catálogo sale de «Lista de ejercicios para grabar.md» (claves propuestas por Claude, a revisar por Miguel).
   Lo específico de cada cliente (rangos, molestias) va en la nota de su plan, no aquí. */
(function () {
  "use strict";
  // [clave, título, [pasos], patrón sobre el nombre normalizado (sin tildes, minúsculas), vídeo (opcional)]
  // El orden importa: los patrones más concretos van antes que los generales.
  var CAT = [
    ["y-banco", "Y en banco inclinado boca abajo", ["Brazos en Y con los pulgares hacia arriba.", "Sube con la parte baja de las escápulas.", "Sin encoger los hombros."], /\by en banco/],
    ["pushup-plus", "Push-up plus (empuje de serrato)", ["En plancha con los brazos rectos.", "Separa las escápulas empujando el suelo.", "Vuelve despacio sin doblar los codos."], /push-up plus|serrato/],
    ["liberacion-subclavicular", "Liberación de la zona subclavicular", ["Pelota bajo la clavícula, contra la pared.", "60-90 s por lado.", "Presión suave: nunca debe doler."], /liberacion/],
    ["pectoral-menor", "Estiramiento de pectoral menor en puerta", ["Antebrazo en el marco, a la altura del hombro.", "Avanza el pecho hasta notar estiramiento.", "2 × 30 s, respirando tranquilo."], /pectoral menor/],

    ["femoral-tumbado", "Femoral tumbado", ["Cadera pegada al banco.", "Lleva los talones al glúteo.", "Baja en 2-3 s."], /femoral.*tumbad/],
    ["femoral-pie", "Femoral de pie a 1 pierna", ["Tronco quieto y apoyado en la máquina.", "Lleva el talón hacia el glúteo.", "Baja despacio, sin soltar."], /femoral de pie/],
    ["femoral-sentado", "Femoral sentado", ["Rodilla a la altura del eje y rodillo sobre los tobillos.", "Cadera bien atrás y pecho alto.", "Baja despacio hasta estirar."], /femoral sentad/],
    ["extension-cuadriceps", "Extensión de cuádriceps", ["Espalda apoyada y rodilla a la altura del eje.", "Estira sin dar golpe.", "Baja despacio."], /extension (de cuadriceps|de rodillas|a 1 pierna)/],
    ["abduccion-pie", "Abducción de pie", ["Tronco recto, sin inclinarte hacia el lado.", "Abre la pierna con el glúteo.", "Vuelve despacio."], /abduc.* de pie/],
    ["abduccion-sentada", "Abducción sentada en máquina", ["Abre empujando con la parte de fuera de las piernas.", "Sin balancear el tronco.", "Vuelve despacio sin soltar."], /abduc|abductores/],
    ["aduccion", "Aducción en máquina", ["Cierra sin golpear.", "Abre controlando hasta notar estiramiento en la cara interna del muslo."], /aduc/],
    ["prensa-pendular", "Prensa pendular", ["Espalda pegada al respaldo.", "Baja hasta donde controles.", "Empuja con todo el pie."], /prensa pendular/],
    ["prensa-tumbada", "Prensa tumbada", ["Zona lumbar pegada al respaldo.", "Baja controlando.", "No bloquees las rodillas arriba."], /prensa tumbada/],
    ["prensa", "Prensa 45º", ["Toda la planta del pie apoyada.", "Baja hasta donde la zona lumbar no se despega del respaldo.", "No bloquees las rodillas arriba."], /prensa/],
    ["hack", "Sentadilla hack", ["Espalda pegada al respaldo.", "Baja controlando.", "Sube empujando con todo el pie."], /hack/],
    ["belt-squat", "Belt squat", ["Tronco recto y peso en todo el pie.", "Baja controlando.", "Sube sin rebotar."], /belt squat/],
    ["sentadilla-goblet", "Sentadilla goblet a cajón", ["Mancuerna pegada al pecho.", "Siéntate en el cajón sin dejarte caer.", "Levántate empujando con todo el pie."], /goblet/],
    ["sentadilla-multipower", "Sentadilla en multipower", ["Pies un poco adelantados y tronco firme.", "Baja controlando.", "Sube empujando con todo el pie."], /sentadilla/],
    ["zancada", "Zancada caminando con mancuernas", ["Paso largo y tronco recto.", "La rodilla de atrás baja cerca del suelo.", "Empuja con la pierna de delante para avanzar."], /zancada/],
    ["hip-thrust-maquina", "Hip thrust en máquina", ["Barbilla hacia el pecho y costillas abajo.", "Sube hasta alinear tronco y muslos.", "Aprieta el glúteo 1 s arriba."], /hip thrust en maquina/],
    ["hip-thrust", "Hip thrust", ["Espalda alta apoyada en el banco y barbilla al pecho.", "Sube hasta alinear tronco y muslos.", "Aprieta el glúteo 1 s arriba."], /hip thrust/],
    ["rumano-mancuernas", "Peso muerto rumano con mancuernas", ["Rodillas un poco dobladas, cadera atrás y espalda recta.", "Mancuernas pegadas a las piernas.", "Baja hasta notar estiramiento detrás del muslo."], /rumano con mancuernas/],
    ["rumano", "Peso muerto rumano", ["Rodillas casi fijas y cadera atrás.", "Peso pegado a las piernas y espalda recta.", "Baja hasta notar estiramiento detrás del muslo."], /rumano/],
    ["peso-muerto-maquina", "Peso muerto en máquina", ["Espalda recta y cadera atrás.", "Sube empujando el suelo.", "Baja controlando."], /peso muerto en maquina/],
    ["hiperextension-gluteo", "Hiperextensión 45° para glúteo", ["Espalda algo redondeada y mirada abajo.", "Sube con el glúteo.", "Sin arquear la zona lumbar."], /hiperextension/],
    ["lumbares", "Lumbares (banco de hiperextensión)", ["Baja controlando.", "Sube hasta alinear el cuerpo.", "Sin pasarte hacia atrás."], /lumbares/],
    ["patada-gluteo", "Patada de glúteo unilateral", ["Tronco fijo y abdomen firme.", "Lleva la pierna atrás con el glúteo.", "Sin arquear la zona lumbar."], /patada/],
    ["gemelo-sentado", "Gemelo sentado", ["Sube todo lo que puedas y aguanta 1 s.", "Baja hasta estirar del todo."], /gemelo sentado/],
    ["gemelo-pie", "Gemelo de pie", ["Sube todo lo que puedas sobre la punta y aguanta 1 s.", "Baja hasta estirar del todo."], /gemelo/],

    ["press-inclinado-maquina", "Press inclinado en máquina", ["Espalda apoyada y escápulas atrás.", "Empuja sin despegarte del respaldo.", "Baja controlando."], /press inclinado en maquina/],
    ["press-inclinado-mancuernas", "Press inclinado con mancuernas", ["Banco a unos 30°.", "Baja las mancuernas a los lados del pecho.", "Codos a unos 45° del cuerpo."], /press inclinado/],
    ["press-mancuernas-plano", "Press de pecho con mancuernas en banco plano", ["Baja a los lados del pecho con los codos a unos 45°.", "Sube sin chocar las mancuernas."], /mancuernas en banco plano/],
    ["press-multipower", "Press banca en multipower", ["Escápulas juntas y pies firmes.", "Baja la barra a la parte baja del pecho.", "Empuja sin despegar la espalda."], /press banca en (multipower|smith)/],
    ["press-banca-barra", "Press banca con barra", ["Escápulas juntas y pies firmes.", "Barra a la parte baja del pecho.", "Empuja sin despegar la espalda."], /press banca horizontal|press banca con barra/],
    ["press-pecho-maquina", "Press de pecho en máquina", ["Escápulas atrás y abajo, agarre a la altura del pecho.", "Empuja sin despegar la espalda del respaldo.", "Vuelve despacio."], /press (de pecho|banca)/],
    ["aperturas", "Aperturas en máquina", ["Codos un poco doblados y fijos.", "Abre hasta notar estiramiento en el pecho.", "Cierra sin golpear."], /aperturas/],
    ["landmine", "Press landmine unilateral medio arrodillado", ["Glúteo de la pierna de atrás apretado.", "Empuja hacia arriba y adelante.", "Sin girar el tronco."], /landmine/],
    ["press-militar-sentada", "Press militar sentada", ["Espalda apoyada y abdomen firme.", "Sube por encima de la cabeza.", "Sin arquear la zona lumbar."], /press militar sentad/],
    ["press-hombro-maquina", "Press de hombro en máquina", ["Espalda apoyada y sin arquear la zona lumbar.", "Baja hasta la altura de las orejas.", "Sube sin bloquear los codos."], /press (de hombro|militar) en maquina/],
    ["elevacion-lateral-maquina", "Elevación lateral en máquina", ["Hombro a la altura del eje.", "Sube hasta la horizontal.", "Sin encoger los hombros."], /elevacion lateral en maquina/],
    ["elevacion-lateral-polea", "Elevación lateral en polea", ["Cable por delante del cuerpo.", "Sube hasta la altura del hombro.", "Sin inclinarte hacia el lado."], /elevaci.*lateral.* en polea/],
    ["elevacion-lateral", "Elevación lateral con mancuernas", ["Codos un poco doblados.", "Sube hasta la altura de los hombros.", "Sin encoger los hombros."], /elevaci.*lateral/],
    ["deltoides-posterior", "Deltoides posterior en polea", ["Brazo casi recto.", "Abre hacia atrás a la altura del hombro.", "Sin girar el tronco."], /deltoides posterior/],
    ["remo-vertical", "Remo vertical", ["Codos por encima de las manos.", "Sube solo hasta donde no moleste.", "Baja despacio."], /remo vertical/],

    ["jalon-unilateral", "Jalón unilateral arrodillado", ["Tronco quieto.", "Lleva el codo hacia la cadera.", "Estira bien arriba."], /jalon unilateral/],
    ["jalon-neutro", "Jalón al pecho, agarre neutro", ["Pecho alto.", "Tira llevando los codos hacia las costillas.", "Sube despacio hasta estirar."], /jalon al pecho/],
    ["jalon-maquina", "Jalón en máquina", ["Pecho alto y muslos sujetos.", "Tira con los codos hacia abajo.", "Sube estirando del todo."], /jalon/],
    ["dominada-asistida", "Dominada asistida", ["Escápulas abajo al empezar.", "Sube hasta que la barbilla pase la barra.", "Baja despacio."], /dominada.*asistida/],
    ["dominada-lastrada", "Dominada lastrada", ["Escápulas abajo al empezar y sin balanceo.", "Sube hasta que la barbilla pase la barra.", "Baja hasta estirar los brazos."], /dominada/],
    ["remo-apoyo-pecho", "Remo con apoyo de pecho", ["Pecho pegado al apoyo.", "Lleva los codos atrás.", "Junta las escápulas al final."], /apoyo de pecho|pecho apoyado/],
    ["remo-t", "Remo en T", ["Tronco fijo y espalda recta.", "Tira hacia el abdomen.", "Junta las escápulas al final."], /remo (en )?t$/],
    ["remo-unilateral-polea", "Remo unilateral en polea", ["Tronco quieto, sin girar.", "Lleva el codo atrás, hacia la cadera.", "Estira del todo al volver."], /remo unilateral/],
    ["remo-sentado", "Remo sentado en polea", ["Pecho alto y sin balancear el tronco.", "Lleva los codos atrás pegados al cuerpo.", "Estira sin perder la postura."], /remo sentado|remo horizontal/],
    ["low-row", "Low row (máquina)", ["Pecho alto.", "Codos atrás pegados al cuerpo.", "Estira sin perder la postura."], /low row/],
    ["high-row", "High row unilateral (máquina)", ["Tronco quieto.", "Tira del codo hacia abajo y atrás.", "Sube controlando."], /high row/],
    ["pullover", "Pullover en polea", ["Brazos casi rectos.", "Lleva la barra o la cuerda hasta los muslos.", "Tira con la espalda, no con los brazos."], /pullover/],

    ["curl-bayesian", "Curl bayesian (polea por detrás)", ["El brazo empieza por detrás del cuerpo.", "El codo no se mueve.", "Sube sin adelantar el hombro."], /bayesian/],
    ["curl-inclinado", "Curl de bíceps en banco inclinado", ["Brazos colgando por detrás del cuerpo.", "Sube sin adelantar los codos.", "Baja hasta estirar del todo."], /curl.*banco inclinado/],
    ["curl-martillo", "Curl martillo", ["Palmas mirándose.", "Codos quietos.", "Sube sin balancearte."], /martillo/],
    ["curl-polea", "Curl de bíceps en polea", ["Codos pegados y quietos.", "Sube sin balancearte.", "Baja hasta estirar del todo."], /biceps en polea/],
    ["curl-mancuernas", "Curl de bíceps", ["Codos pegados y quietos.", "Gira la palma hacia arriba al subir.", "Baja hasta estirar del todo."], /curl de biceps/],
    ["triceps-overhead", "Tríceps por encima de la cabeza en polea", ["De espaldas a la polea, codos junto a la cabeza.", "Estira del todo hacia delante.", "Vuelve despacio sin mover los codos."], /triceps.*overhead/],
    ["triceps-tumbado-polea", "Tríceps tumbado en polea", ["Codos apuntando al techo y quietos.", "Estira del todo.", "Vuelve despacio."], /triceps tumbado/],
    ["triceps-cuerda", "Tríceps en polea con cuerda", ["Codos pegados y quietos.", "Abre la cuerda al final.", "Vuelve controlando."], /triceps.*cuerda/],
    ["triceps-polea", "Tríceps en polea", ["Codos pegados al cuerpo y quietos.", "Estira del todo abajo.", "Sube hasta 90° sin mover los hombros."], /triceps en polea/],
    ["frances-mancuernas", "Press francés con mancuernas", ["Codos quietos apuntando al techo.", "Baja las mancuernas junto a la cabeza.", "Estira del todo."], /frances con mancuernas/],
    ["frances-barra", "Press francés tumbado en banco", ["Codos quietos.", "Baja la barra hacia la frente.", "Estira del todo."], /frances/],

    ["pallof", "Pallof press", ["De lado a la polea.", "Empuja al frente.", "Sin dejar que el tronco gire."], /pallof/],
    ["crunch", "Crunch abdominal", ["Enrolla el tronco despegando los hombros.", "Sin tirar del cuello.", "Baja despacio."], /crunch/],
    ["elevacion-piernas", "Abdominal elevando piernas", ["Zona lumbar pegada.", "Sube las piernas sin balanceo.", "Baja despacio."], /elevando piernas/]
  ];

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/^activacion:\s*/, "").replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  }
  var cache = {};
  function find(name) {
    var k = norm(name);
    if (k in cache) return cache[k];
    var hit = null;
    for (var i = 0; i < CAT.length; i++) if (CAT[i][3].test(k)) { hit = { id: CAT[i][0], t: CAT[i][1], p: CAT[i][2], v: CAT[i][4] || null }; break; }
    return (cache[k] = hit);
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
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* Bloque «Cómo se hace»: abierto la primera vez que el cliente ve ese ejercicio; después, plegado. */
  function block(ex, who) {
    var c = find(ex && ex.n);
    if (!c) return null;
    var seenK = "eyl-como-" + (who || "x"), seen = lsGet(seenK, {});
    var det = h("details", { class: "como" }, [
      h("summary", {}, [h("span", { class: "comoi", "aria-hidden": "true", text: "ℹ️" }), h("span", { text: "Cómo se hace" })]),
      h("ol", { class: "comolist" }, c.p.map(function (t) { return h("li", { text: t }); })),
      c.v ? h("video", { class: "comovid", src: c.v, muted: "", loop: "", playsinline: "", autoplay: "", preload: "none" }) : null
    ]);
    if (!seen[c.id]) { det.open = true; seen[c.id] = 1; lsSet(seenK, seen); }
    return det;
  }

  /* Tarea rápida: una sola, la más útil. Peso de la semana > check-in semanal > medidas del mes. */
  var DAY = 864e5;
  function iso(t) { var d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function days(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / DAY); }
  function weekStart(s) { var d = new Date(s + "T12:00:00"); return iso(d.getTime() - ((d.getDay() + 6) % 7) * DAY); }

  function pick(nd, sg) {
    var T = iso(Date.now());
    var pesos = (nd && nd.pesos) || [], last = pesos.length ? pesos.map(function (p) { return p[0]; }).sort().pop() : null;
    if (!last || days(last, T) >= 7) return { k: "peso", t: "Apunta tu peso de hoy", s: "Mejor en ayunas, después de ir al baño. 10 segundos." };
    var ci = sg && sg.checkins && sg.checkins[weekStart(T)];
    if (!ci) return { k: "checkin", t: "Check-in de la semana", s: "Dolor, recuperación y pasos. 1 minuto.", go: "segui" };
    var per = (nd && nd.perim) || [], lp = per.length ? per.map(function (p) { return p.fecha; }).sort().pop() : null;
    if (!lp || days(lp, T) >= 30) return { k: "perim", t: "Medidas del mes", s: "Cintura, cadera y poco más con una cinta. 2 minutos.", go: "nutri" };
    return null;
  }

  function card(o) {
    var box = h("section", { class: "card tarea", hidden: "" });
    var id = o.client && o.client.id;
    if (!o.sb || !id) return box;
    Promise.all([
      o.sb.from("nutri_cliente").select("data").eq("cliente_id", id).maybeSingle(),
      o.sb.from("seguimiento").select("data").eq("cliente_id", id).maybeSingle()
    ]).then(function (r) {
      if (r[0].error || r[1].error) return;
      var nd = r[0].data ? r[0].data.data : {}, sg = r[1].data ? r[1].data.data : {};
      var t = pick(nd, sg); if (!t) return;
      box.hidden = false;
      box.appendChild(h("p", { class: "tkick", text: "✅ Tarea rápida" }));
      box.appendChild(h("h2", { text: t.t }));
      box.appendChild(h("p", { class: "tsub", text: t.s }));
      if (t.k === "peso") {
        var inp = h("input", { type: "number", inputmode: "decimal", step: "0.1", min: "20", max: "300", placeholder: "kg", "aria-label": "Peso en kg" });
        var btn = h("button", { class: "btn primary", type: "button", text: "Guardar", onclick: function () {
          var w = parseFloat(String(inp.value).replace(",", "."));
          if (!(w >= 20 && w <= 300)) { inp.focus(); return; }
          btn.disabled = true; btn.textContent = "Guardando…";
          var T = iso(Date.now());
          o.sb.from("nutri_cliente").select("data").eq("cliente_id", id).maybeSingle().then(function (cur) {
            if (cur.error) throw cur.error;
            var d = Object.assign({}, cur.data ? cur.data.data : {});
            d.pesos = (d.pesos || []).filter(function (p) { return p[0] !== T; }).concat([[T, w]]);
            d.pesos.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
            return o.sb.from("nutri_cliente").upsert({ cliente_id: id, data: d });
          }).then(function (res) {
            if (res && res.error) throw res.error;
            box.innerHTML = ""; box.classList.add("done");
            box.appendChild(h("p", { class: "tdone", text: "✓ Peso guardado: " + String(w).replace(".", ",") + " kg. ¡Gracias!" }));
            if (o.flash) o.flash("Peso guardado");
          }).catch(function () { btn.disabled = false; btn.textContent = "Guardar"; if (o.flash) o.flash("No se pudo guardar. Revisa la conexión."); });
        } });
        box.appendChild(h("div", { class: "trow" }, [inp, btn]));
      } else {
        box.appendChild(h("button", { class: "btn primary wide", type: "button", text: t.k === "checkin" ? "Hacer el check-in" : "Apuntar medidas", onclick: function () { if (o.go) o.go(t.go, t.k); } }));
      }
    }, function () {});
    return box;
  }

  window.EYLHoy = { find: find, block: block, card: card, pick: pick, norm: norm };
})();
