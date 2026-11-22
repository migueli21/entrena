/* ENTRENA YOUR LIFE · Aviso del entrenador al cliente.
   El entrenador escribe un aviso en la ficha del cliente (planes.data.aviso = {id, texto, fecha}).
   Al cliente le sale arriba en Entreno hasta que lo marca como leído o contesta;
   su respuesta va en nutri_cliente.data.avisos[id] = {leido, resp, fecha} (leyendo y combinando, sin pisar otros datos). */
(function () {
  "use strict";
  function iso() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function fmt(s) { try { return new Date(s + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" }); } catch (e) { return s; } }
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
  function readNC(sb, id) {
    return sb.from("nutri_cliente").select("data").eq("cliente_id", id).maybeSingle().then(function (r) {
      if (r.error) throw r.error; return r.data && r.data.data ? r.data.data : {};
    });
  }
  function saveResp(sb, id, avId, resp) {
    return readNC(sb, id).then(function (d) {
      d = Object.assign({}, d); var av = Object.assign({}, d.avisos || {});
      av[avId] = { leido: iso(), resp: resp || "", fecha: new Date().toISOString() }; d.avisos = av;
      return sb.from("nutri_cliente").upsert({ cliente_id: id, data: d }).then(function (r) { if (r.error) throw r.error; });
    });
  }

  // ---- cliente: tarjeta arriba de Entreno ----
  function clientCard(o) {
    var av = o.plan && o.plan.aviso, box = h("section", { class: "card aviso", hidden: true });
    if (!av || !av.texto || !o.sb || !o.client) return box;
    readNC(o.sb, o.client.id).then(function (d) {
      if (d.avisos && d.avisos[av.id]) return; // ya lo leyó o contestó
      var ta = h("textarea", { rows: "2", placeholder: "Tu respuesta (opcional)" });
      var send = h("button", { class: "btn primary", type: "button", text: "Enviar respuesta" });
      var read = h("button", { class: "btn ghost", type: "button", text: "Leído" });
      function done(resp, b) {
        b.disabled = true; var t = b.textContent; b.textContent = "Guardando…";
        saveResp(o.sb, o.client.id, av.id, resp).then(function () {
          box.hidden = true; if (o.flash) o.flash(resp ? "Respuesta enviada" : "Marcado como leído");
        }, function () { b.disabled = false; b.textContent = t; if (o.flash) o.flash("No se ha guardado. Revisa la conexión."); });
      }
      send.onclick = function () { if (!ta.value.trim()) { ta.focus(); return; } done(ta.value.trim(), send); };
      read.onclick = function () { done("", read); };
      box.appendChild(h("p", { class: "tkick", text: "📩 Mensaje de " + (o.coachName || "tu entrenador") + (av.fecha ? " · " + fmt(av.fecha) : "") }));
      box.appendChild(h("p", { class: "avisotxt", text: av.texto }));
      box.appendChild(ta);
      box.appendChild(h("div", { class: "avisobtns" }, [send, read]));
      box.hidden = false;
    }, function () {});
    return box;
  }

  // ---- entrenador: escribir el aviso y ver la respuesta ----
  function coachCard(o) {
    var box = h("section", { class: "card aviso coach" }), av = o.plan.aviso;
    box.appendChild(h("p", { class: "tkick", text: "📩 Aviso para " + (o.client.nombre || "el cliente") }));
    if (av && av.texto) {
      var st = h("p", { class: "meta", text: "Enviado el " + fmt(av.fecha) + " · comprobando si lo ha leído…" });
      box.appendChild(h("p", { class: "avisotxt", text: av.texto }));
      box.appendChild(st);
      readNC(o.sb, o.client.id).then(function (d) {
        var r = d.avisos && d.avisos[av.id];
        st.textContent = "Enviado el " + fmt(av.fecha) + (r ? " · leído el " + fmt(r.leido) : " · todavía sin leer");
        if (r && r.resp) box.insertBefore(h("p", { class: "avisoresp", text: "Su respuesta: «" + r.resp + "»" }), st.nextSibling);
      }, function () { st.textContent = "Enviado el " + fmt(av.fecha); });
    } else box.appendChild(h("p", { class: "meta", text: "Le saldrá arriba en Entreno hasta que lo marque como leído o conteste." }));
    var ta = h("textarea", { rows: "3", placeholder: av && av.texto ? "Escribe un aviso nuevo (sustituye al anterior)" : "Escribe el aviso" });
    var send = h("button", { class: "btn primary", type: "button", text: av && av.texto ? "Enviar aviso nuevo" : "Enviar aviso" });
    send.onclick = function () {
      var t = ta.value.trim(); if (!t) { ta.focus(); return; }
      o.plan.aviso = { id: Date.now().toString(36), texto: t, fecha: iso() };
      send.disabled = true; send.textContent = "Enviando…";
      o.save().then(function () { if (o.flash) o.flash("Aviso enviado"); o.rerender(); },
        function () { send.disabled = false; send.textContent = "Enviar aviso"; if (o.flash) o.flash("No se ha enviado. Revisa la conexión."); });
    };
    var kids = [send];
    if (av && av.texto) {
      var del = h("button", { class: "btn ghost", type: "button", text: "Quitar aviso" });
      del.onclick = function () { delete o.plan.aviso; o.save().then(function () { if (o.flash) o.flash("Aviso quitado"); o.rerender(); }, function () { if (o.flash) o.flash("No se ha guardado."); }); };
      kids.push(del);
    }
    box.appendChild(ta);
    box.appendChild(h("div", { class: "avisobtns" }, kids));
    return box;
  }

  window.EYLAviso = { clientCard: clientCard, coachCard: coachCard };
})();
