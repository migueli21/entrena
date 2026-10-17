/* ENTRENA YOUR LIFE · App de clientes (Supabase) */
(function () {
  "use strict";
  var CFG = window.EYL_CONFIG || {};
  var TECNICAS = ["Drop set", "Rest-pause", "Cluster"];
  var GROUPS = ["Pecho", "Espalda", "Hombro", "Bíceps", "Tríceps", "Cuádriceps", "Isquios", "Glúteo", "Aductores", "Gemelo", "Core"];
  var app = document.getElementById("app");

  // ================= DATA LAYER =================
  var api = window.EYL_API_OVERRIDE || makeSupabaseApi();
  function makeSupabaseApi() {
    if (!window.supabase || !CFG.SUPABASE_URL || CFG.SUPABASE_URL.indexOf("http") !== 0) return null;
    var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    function ok(r) { if (r.error) throw r.error; return r.data; }
    return {
      onRecovery: function (cb) { sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") cb(); }); },
      session: function () { return sb.auth.getSession().then(function (r) { return r.data.session; }); },
      signIn: function (email, pw) { return sb.auth.signInWithPassword({ email: email, password: pw }).then(ok); },
      signOut: function () { return sb.auth.signOut(); },
      resetPassword: function (email) { return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(ok); },
      updatePassword: function (pw) { return sb.auth.updateUser({ password: pw }).then(ok); },
      profile: function (id) { return sb.from("profiles").select("*").eq("id", id).single().then(ok); },
      markPasswordChanged: function (id) { return sb.from("profiles").update({ must_change_password: false }).eq("id", id).then(ok); },
      listClients: function () { return sb.from("profiles").select("*").eq("rol", "cliente").order("nombre").then(ok); },
      lastActivity: function () { return sb.from("registros").select("cliente_id,updated_at").order("updated_at", { ascending: false }).limit(500).then(ok); },
      updateClient: function (id, patch) { return sb.from("profiles").update(patch).eq("id", id).then(ok); },
      getPlan: function (cid) { return sb.from("planes").select("data").eq("cliente_id", cid).maybeSingle().then(function (r) { return ok(r) ? r.data.data : null; }); },
      listPlans: function () { return sb.from("planes").select("cliente_id,data").then(ok); },
      savePlan: function (cid, data) { return sb.from("planes").upsert({ cliente_id: cid, data: data }).then(ok); },
      getLogs: function (cid) { return sb.from("registros").select("semana,dia,data").eq("cliente_id", cid).then(ok); },
      saveLog: function (cid, w, d, data) { return sb.from("registros").upsert({ cliente_id: cid, semana: w, dia: d, data: data }).then(ok); }
    };
  }

  // ================= STATE =================
  var ST = {
    me: null, profile: null, mode: null,      // mode: "cliente" | "entrenador"
    clientId: null, client: null, PLAN: null, LOG: {}, readOnly: false,
    editing: false, dirty: false, clients: [], activity: {}
  };
  var UI = { w: 0, d: 0, view: "entreno" };
  function cacheKey() { return "eyl-cache-" + ST.clientId; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ================= HELPERS =================
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") e.textContent = v;
      else if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function uid() { return "e" + Math.random().toString(36).slice(2, 8); }
  function parseDate(s) { var p = (s || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function fmt(d) { return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function fmtDT(t) { var d = new Date(t); return fmt(d) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  function sum(a) { return (a || []).reduce(function (x, y) { return x + (y || 0); }, 0); }
  function num(x) { return (Math.round(x * 10) / 10).toString().replace(".", ","); }
  var flashTimer;
  function flash(msg) {
    var t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(flashTimer); flashTimer = setTimeout(function () { t.hidden = true; }, 1800);
  }
  function errMsg(e) {
    var m = (e && (e.message || e.error_description)) || "";
    if (/Invalid login/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/Email not confirmed/i.test(m)) return "Tu cuenta aún no está confirmada. Avisa a tu entrenador.";
    if (/should be different/i.test(m)) return "La nueva contraseña tiene que ser distinta de la anterior.";
    if (/rate|too many/i.test(m)) return "Demasiados intentos. Espera un minuto y prueba otra vez.";
    if (/fetch|network/i.test(m)) return "No hay conexión. Revisa tu internet.";
    return m || "Algo ha fallado. Prueba de nuevo.";
  }
  function shell(kids) {
    app.innerHTML = "";
    kids.forEach(function (k) { if (k) app.appendChild(k); });
    app.appendChild(el("div", { id: "toast", class: "toast", hidden: true, role: "status" }));
  }
  function field(label, input, cls) { return el("label", { class: "field " + (cls || "") }, [el("span", { text: label }), input]); }
  function select(opts, val, onchange, placeholder) {
    var s = el("select", { onchange: function () { onchange(s.value); } });
    s.appendChild(el("option", { value: "", text: placeholder || "—" }));
    opts.forEach(function (o) {
      var v = typeof o === "object" ? o.v : o, t = typeof o === "object" ? o.t : o;
      var op = el("option", { value: String(v), text: t });
      if (val != null && String(val) === String(v)) op.selected = true;
      s.appendChild(op);
    });
    if (ST.readOnly) s.disabled = true;
    return s;
  }
  function input(attrs) { var i = el("input", attrs); if (ST.readOnly) i.disabled = true; return i; }

  // ================= AUTH SCREENS =================
  function loginScreen(msg) {
    var email = el("input", { id: "email", type: "email", autocomplete: "username", inputmode: "email", required: true, placeholder: "tu@correo.com" });
    var pw = el("input", { id: "pw", type: "password", autocomplete: "current-password", required: true });
    var err = el("p", { class: "err", text: msg || "" });
    var btn = el("button", { class: "btn primary wide", type: "submit", text: "Entrar" });
    var form = el("form", { onsubmit: function (e) {
      e.preventDefault(); err.textContent = ""; btn.disabled = true; btn.textContent = "Entrando…";
      api.signIn(email.value.trim(), pw.value).then(function () { boot(); }, function (x) {
        err.textContent = errMsg(x); btn.disabled = false; btn.textContent = "Entrar";
      });
    } }, [field("Correo", email), field("Contraseña", pw), btn, err]);
    shell([el("main", { class: "auth" }, [
      el("div", { class: "logo big", role: "img", "aria-label": "Entrena Your Life" }),
      el("p", { class: "slogan", text: "Entreno inteligente. Resultados reales." }),
      el("h1", { text: "Tu entreno" }),
      el("p", { text: "Entra con el correo y la contraseña que te ha dado tu entrenador." }),
      form,
      el("button", { class: "link", type: "button", text: "¿Has olvidado tu contraseña?", onclick: function () { resetScreen(email.value.trim()); } })
    ])]);
  }
  function resetScreen(prefill) {
    var email = el("input", { id: "remail", type: "email", inputmode: "email", required: true, value: prefill || "" });
    var info = el("p", { class: "err" });
    var btn = el("button", { class: "btn primary wide", type: "submit", text: "Enviarme el enlace" });
    shell([el("main", { class: "auth" }, [
      el("div", { class: "logo big", role: "img", "aria-label": "Entrena Your Life" }),
      el("h1", { text: "Recuperar contraseña" }),
      el("p", { text: "Te mandamos un correo con un enlace para crear una contraseña nueva." }),
      el("form", { onsubmit: function (e) {
        e.preventDefault(); btn.disabled = true;
        api.resetPassword(email.value.trim()).then(function () {
          info.className = "ok"; info.textContent = "Listo. Revisa tu correo (y la carpeta de spam).";
        }, function (x) { info.className = "err"; info.textContent = errMsg(x); btn.disabled = false; });
      } }, [field("Correo", email), btn, info]),
      el("button", { class: "link", type: "button", text: "Volver a entrar", onclick: function () { loginScreen(); } })
    ])]);
  }
  function newPasswordScreen(firstTime) {
    var p1 = el("input", { id: "np1", type: "password", autocomplete: "new-password", required: true, minlength: "8" });
    var p2 = el("input", { id: "np2", type: "password", autocomplete: "new-password", required: true, minlength: "8" });
    var err = el("p", { class: "err" });
    var btn = el("button", { class: "btn primary wide", type: "submit", text: "Guardar contraseña" });
    shell([el("main", { class: "auth" }, [
      el("div", { class: "logo big", role: "img", "aria-label": "Entrena Your Life" }),
      el("h1", { text: firstTime ? "Crea tu contraseña" : "Nueva contraseña" }),
      el("p", { text: firstTime ? "Es tu primera vez. Cambia la contraseña que te dimos por una tuya (mínimo 8 caracteres)." : "Escribe tu nueva contraseña (mínimo 8 caracteres)." }),
      el("form", { onsubmit: function (e) {
        e.preventDefault(); err.textContent = "";
        if (p1.value.length < 8) { err.textContent = "Tiene que tener al menos 8 caracteres."; return; }
        if (p1.value !== p2.value) { err.textContent = "Las dos contraseñas no coinciden."; return; }
        btn.disabled = true; btn.textContent = "Guardando…";
        api.updatePassword(p1.value).then(function () {
          return api.markPasswordChanged(ST.me.id);
        }).then(function () { flash("Contraseña guardada"); boot(); }, function (x) {
          err.textContent = errMsg(x); btn.disabled = false; btn.textContent = "Guardar contraseña";
        });
      } }, [field("Nueva contraseña", p1), field("Repite la contraseña", p2), btn, err])
    ])]);
  }
  function loading(t) { shell([el("p", { class: "spinner", text: t || "Cargando…" })]); }

  // ================= BOOT =================
  function boot() {
    if (!api) { shell([el("main", { class: "auth" }, [el("h1", { text: "Falta configurar" }), el("p", { text: "Rellena config.js con la URL y la clave de Supabase." })])]); return; }
    loading();
    api.session().then(function (s) {
      if (!s) { loginScreen(); return; }
      ST.me = s.user;
      return api.profile(s.user.id).then(function (p) {
        ST.profile = p;
        if (!p.activo) { api.signOut(); loginScreen("Tu acceso está pausado. Habla con tu entrenador."); return; }
        if (p.must_change_password) { newPasswordScreen(true); return; }
        if (p.rol === "entrenador") { ST.mode = "entrenador"; coachHome(); }
        else { ST.mode = "cliente"; openClient(p, false); }
      });
    }).catch(function (x) { loginScreen(errMsg(x)); });
  }
  function logout() { api.signOut().then(function () { ST = { LOG: {}, clients: [], activity: {} }; loginScreen(); }); }

  function topbar(extra) {
    return el("div", { class: "topbar" }, [
      extra || el("span", { class: "who", text: ST.me ? ST.me.email : "" }),
      el("button", { class: "link", type: "button", text: "Salir", onclick: logout })
    ]);
  }

  // ================= COACH HOME =================
  function coachHome() {
    loading("Cargando clientes…");
    Promise.all([api.listClients(), api.lastActivity(), api.listPlans()]).then(function (r) {
      ST.clients = r[0]; ST.activity = {};
      r[1].forEach(function (a) { if (!ST.activity[a.cliente_id]) ST.activity[a.cliente_id] = a.updated_at; });
      ST.plans = {}; r[2].forEach(function (p) { ST.plans[p.cliente_id] = p.data; });
      renderCoachHome();
    }).catch(function (x) { shell([topbar(), el("p", { class: "err", text: errMsg(x) })]); });
  }
  function renderCoachHome() {
    var list = el("div", { class: "clients" });
    if (!ST.clients.length) list.appendChild(el("p", { class: "empty", text: "Aún no tienes clientes. Créalos en Supabase → Authentication → Users → Add user." }));
    ST.clients.forEach(function (c) {
      var last = ST.activity[c.id], plan = ST.plans[c.id];
      var days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
      var pill = !plan ? el("span", { class: "pill warn", text: "Sin plan" })
        : c.must_change_password ? el("span", { class: "pill", text: "No ha entrado" })
        : days == null ? el("span", { class: "pill", text: "Sin registros" })
        : el("span", { class: "pill" + (days <= 3 ? " go" : days > 7 ? " warn" : ""), text: days === 0 ? "Hoy" : "Hace " + days + " d" });
      list.appendChild(el("button", { class: "client", type: "button", onclick: function () { openClient(c, true); } }, [
        el("div", null, [el("b", { text: c.nombre || c.email }), el("small", { text: c.email + (c.activo ? "" : " · pausado") })]),
        pill
      ]));
    });
    shell([topbar(), el("header", { class: "top" }, [
      el("div", { class: "logo", role: "img", "aria-label": "Entrena Your Life" }),
      el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: "Panel del entrenador" })]),
      el("h1", { text: "Clientes" })
    ]), list,
    el("p", { class: "meta", style: "margin-top:16px", text: "Para dar de alta un cliente: Supabase → Authentication → Users → Add user (correo + contraseña inicial, marca Auto Confirm). Aparecerá aquí y le creas el plan." })]);
  }

  // ================= OPEN CLIENT =================
  function openClient(c, asCoach) {
    ST.client = c; ST.clientId = c.id; ST.readOnly = asCoach; ST.editing = false; ST.dirty = false;
    UI = lsGet("eyl-ui-" + c.id, { w: null, d: 0, view: "entreno" });
    loading();
    Promise.all([api.getPlan(c.id), api.getLogs(c.id)]).then(function (r) {
      ST.PLAN = r[0];
      ST.LOG = {};
      (r[1] || []).forEach(function (row) { ST.LOG[row.semana + "-" + row.dia] = row.data; });
      if (!asCoach) {
        // merge unsynced local edits (offline)
        var cache = lsGet(cacheKey(), {});
        Object.keys(cache).forEach(function (k) {
          var loc = cache[k], rem = ST.LOG[k];
          if (loc && (!rem || (loc.editado || 0) > (rem.editado || 0))) { ST.LOG[k] = loc; queueSave(k); }
        });
      }
      if (!ST.PLAN) { if (asCoach) { noPlanScreen(); } else { shell([topbar(), el("main", { class: "auth" }, [el("div", { class: "logo big" }), el("h1", { text: "Tu plan está en camino" }), el("p", { text: (CFG.ENTRENADOR || "Tu entrenador") + " aún no ha subido tu entreno. Vuelve a entrar en un rato." })])]); } return; }
      if (UI.w == null || UI.w >= ST.PLAN.semanas.length) UI.w = currentWeek();
      render();
    }).catch(function (x) { shell([topbar(), el("p", { class: "err", text: errMsg(x) })]); });
  }
  function noPlanScreen() {
    var others = ST.clients.filter(function (c) { return c.id !== ST.clientId && ST.plans[c.id]; });
    var sel = el("select", { id: "copyfrom" });
    sel.appendChild(el("option", { value: "", text: "Plan en blanco (3 días)" }));
    others.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: "Copiar plan de " + (c.nombre || c.email) })); });
    shell([topbar(el("button", { class: "backbtn", type: "button", text: "← Clientes", onclick: coachHome })),
      el("main", { class: "auth" }, [
        el("h1", { text: ST.client.nombre || ST.client.email }),
        el("p", { text: "Este cliente aún no tiene plan. Crea uno para empezar." }),
        field("Empezar desde", sel),
        el("button", { class: "btn primary wide", type: "button", text: "Crear plan", onclick: function () {
          var base;
          if (sel.value) { base = JSON.parse(JSON.stringify(ST.plans[sel.value])); }
          else {
            var dias = [1, 2, 3].map(function (i) { return { nombre: "Día " + i, ej: [] }; });
            base = { semanas: [0, 1, 2, 3].map(function () { return { dias: JSON.parse(JSON.stringify(dias)) }; }) };
          }
          base.cliente = ST.client.nombre || ""; base.objetivo = sel.value ? base.objetivo || "" : ""; base.inicio = nextMonday();
          ST.PLAN = base; UI = { w: 0, d: 0, view: "entreno" }; ST.editing = true; ST.dirty = true; render();
        } })
      ])]);
  }
  function nextMonday() { var d = new Date(); var add = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); }

  // ================= PLAN / LOG HELPERS =================
  function currentWeek() {
    var s = parseDate(ST.PLAN.inicio); if (!s) return 0;
    var n = Math.floor((new Date() - s) / 864e5 / 7);
    return Math.max(0, Math.min(ST.PLAN.semanas.length - 1, n));
  }
  function weekDates(w) {
    var s = parseDate(ST.PLAN.inicio); if (!s) return "";
    var a = new Date(s); a.setDate(a.getDate() + 7 * w);
    var b = new Date(a); b.setDate(b.getDate() + 6);
    return fmt(a) + " – " + fmt(b);
  }
  function week() { return ST.PLAN.semanas[UI.w]; }
  function day() { var w = week(); if (UI.d >= w.dias.length) UI.d = 0; return w.dias[UI.d] || { nombre: "", ej: [] }; }
  function logKey() { return UI.w + "-" + UI.d; }
  function dayLog() { var k = logKey(); if (!ST.LOG[k]) ST.LOG[k] = { fecha: "", sesion: {}, ej: {} }; return ST.LOG[k]; }
  function exLog(ex) { var L = dayLog(); if (!L.ej) L.ej = {}; if (!L.ej[ex.id]) L.ej[ex.id] = { com: "", s: [] }; return L.ej[ex.id]; }
  function setLog(ex, i) { var E = exLog(ex); while (E.s.length <= i) E.s.push({}); return E.s[i]; }

  var pending = {}, saveTimer;
  function persist() {
    if (ST.readOnly) return;
    var k = logKey(); ST.LOG[k].editado = Date.now();
    lsSet(cacheKey(), ST.LOG);
    queueSave(k);
    refreshProgress();
  }
  function queueSave(k) {
    pending[k] = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSaves, 900);
  }
  function flushSaves() {
    var keys = Object.keys(pending); pending = {};
    keys.forEach(function (k) {
      var p = k.split("-");
      api.saveLog(ST.clientId, +p[0], +p[1], ST.LOG[k]).then(function () { setSync("Guardado ✓"); },
        function () { pending[k] = true; setSync("Sin conexión: se guardará al volver"); clearTimeout(saveTimer); saveTimer = setTimeout(flushSaves, 8000); });
    });
  }
  function setSync(t) { var s = document.getElementById("sync"); if (s) s.textContent = t; }
  window.addEventListener("online", function () { if (Object.keys(pending).length) flushSaves(); });

  // ================= MAIN RENDER =================
  function render() {
    lsSet("eyl-ui-" + ST.clientId, UI);
    var kids = [];
    if (ST.mode === "entrenador") kids.push(topbar(el("button", { class: "backbtn", type: "button", text: "← Clientes", onclick: function () {
      if (ST.dirty && !confirmLeave()) return; coachHome();
    } })));
    else kids.push(topbar());
    kids.push(header());
    if (UI.view === "volumen" && !ST.editing) {
      kids.push(nav(true)); kids.push(volumeView());
    } else if (UI.view === "progresion" && !ST.editing) {
      kids.push(progressionView());
    } else {
      kids.push(nav());
      var d = day();
      var main = el("main", { class: "day" + (ST.readOnly ? " ro" : "") });
      if (ST.editing) main.appendChild(editDayHead(d));
      else main.appendChild(dateRow());
      if (!d.ej.length && !ST.editing) main.appendChild(el("p", { class: "empty", text: "Hoy no tienes entreno pautado. Descansa o sal a caminar un rato." }));
      d.ej.forEach(function (ex, i) { main.appendChild(ST.editing ? editCard(ex, i, d) : card(ex, i)); });
      if (ST.editing) {
        main.appendChild(el("button", { class: "btn ghost wide", type: "button", text: "+ Añadir ejercicio", onclick: function () {
          d.ej.push({ id: uid(), n: "Nuevo ejercicio", uni: false, nota: "", g: [], series: [{ r: "8-10", d: "2 min" }] }); ST.dirty = true; render();
        } }));
      } else if (d.ej.length) {
        main.appendChild(sessionBlock());
        main.appendChild(progressBlock());
        if (!ST.readOnly) main.appendChild(finishBlock());
      }
      kids.push(main);
    }
    if (ST.mode === "entrenador") kids.push(coachBar());
    shell(kids);
  }
  var leaveArmed = false;
  function confirmLeave() { if (leaveArmed) { leaveArmed = false; return true; } leaveArmed = true; flash("Tienes cambios sin guardar. Pulsa otra vez para salir sin guardar."); setTimeout(function () { leaveArmed = false; }, 4000); return false; }

  function header() {
    return el("header", { class: "top" }, [
      el("div", { class: "logo", role: "img", "aria-label": "Logo de Entrena Your Life" }),
      el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: ST.mode === "entrenador" ? (ST.readOnly && !ST.editing ? "Viendo registros" : "Editando pauta") : "Entrena Your Life" })]),
      el("h1", { text: ST.PLAN.cliente || (ST.client && ST.client.nombre) || "Tu entreno" }),
      ST.PLAN.objetivo ? el("p", { class: "goal", text: ST.PLAN.objetivo }) : null,
      ST.editing ? null : el("div", { class: "seg", role: "tablist", "aria-label": "Vista" }, [
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "entreno"), class: UI.view === "entreno" ? "on" : "", text: "Entreno", onclick: function () { UI.view = "entreno"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "volumen"), class: UI.view === "volumen" ? "on" : "", text: "Volumen", onclick: function () { UI.view = "volumen"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "progresion"), class: UI.view === "progresion" ? "on" : "", text: "Progresión", onclick: function () { UI.view = "progresion"; render(); } })
      ])
    ]);
  }
  function nav(weeksOnly) {
    var weeks = el("div", { class: "chips", role: "tablist", "aria-label": "Semana" });
    ST.PLAN.semanas.forEach(function (w, i) {
      weeks.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(i === UI.w), class: "chip" + (i === UI.w ? " on" : ""),
        onclick: function () { UI.w = i; render(); } }, [el("b", { text: "S" + (i + 1) }), el("small", { text: weekDates(i) })]));
    });
    if (weeksOnly) return el("nav", { class: "nav" }, [weeks]);
    var days = el("div", { class: "days", role: "tablist", "aria-label": "Día" });
    week().dias.forEach(function (d, i) {
      var L = ST.LOG[UI.w + "-" + i];
      days.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(i === UI.d), class: "daytab" + (i === UI.d ? " on" : ""),
        onclick: function () { UI.d = i; render(); window.scrollTo(0, 0); } }, [
        el("span", { class: "dnum", text: "Día " + (i + 1) + (L && L.terminado ? " ✓" : "") }),
        el("span", { class: "dname", text: d.nombre || "" })
      ]));
    });
    return el("nav", { class: "nav" }, [weeks, days]);
  }
  function dateRow() {
    var L = dayLog();
    var inp = input({ id: "fecha", type: "date", value: L.fecha || "", onchange: function () { L.fecha = inp.value; persist(); } });
    var right = el("div", { style: "display:flex;gap:8px;align-items:center" }, [
      L.terminado ? el("span", { class: "done-badge", text: "Terminado " + fmtDT(L.terminado) }) : null,
      ST.readOnly ? null : el("span", { id: "sync", class: "meta" })
    ]);
    return el("div", { class: "card", style: "padding:10px 14px" }, [el("label", { class: "daterow", for: "fecha" }, [el("span", { text: ST.readOnly ? "Fecha del entreno" : "Día que entrenas" }), inp]), right]);
  }

  function card(ex, i) {
    var E = exLog(ex);
    var c = el("section", { class: "card" });
    c.appendChild(el("div", { class: "cardhead" }, [
      el("span", { class: "idx", text: String(i + 1) }),
      el("div", { class: "titles" }, [
        el("h2", { text: ex.n }),
        el("p", { class: "meta", text: ex.series.length + " series" + ((ex.g || []).length ? " · " + ex.g.join(", ") : "") + (ex.uni ? " · unilateral: elige brazo o pierna y lado" : "") })
      ])
    ]));
    if (ex.nota) c.appendChild(el("p", { class: "note", text: ex.nota }));
    if (ex.link) c.appendChild(el("a", { class: "vid", href: ex.link, target: "_blank", rel: "noopener", text: "Ver vídeo del ejercicio" }));
    ex.series.forEach(function (s, si) {
      var S = setLog(ex, si);
      var row = el("div", { class: "set" + (S.reps ? " filled" : "") });
      function upd(k) { return function (v) { S[k] = v; row.classList.toggle("filled", !!S.reps); persist(); }; }
      row.appendChild(el("div", { class: "sethead" }, [
        el("span", { class: "sn", text: "Serie " + (si + 1) }),
        el("span", { class: "obj" }, [el("b", { text: s.r }), " reps"]),
        el("span", { class: "rest", text: s.d ? "Descanso " + s.d : "" })
      ]));
      if (ex.uni) row.appendChild(el("div", { class: "grid2" }, [
        field("Brazo / pierna", select(["Brazo", "Pierna"], S.lim, upd("lim"), "Elige")),
        field("Lado", select(["Izquierdo", "Derecho"], S.lado, upd("lado"), "Elige"))
      ]));
      var reps = input({ type: "number", inputmode: "numeric", min: "0", step: "1", value: S.reps || "", placeholder: s.r, oninput: function () { upd("reps")(reps.value); } });
      var kg = input({ type: "number", inputmode: "decimal", min: "0", step: "0.5", value: S.kg || "", placeholder: "kg", oninput: function () { upd("kg")(kg.value); } });
      row.appendChild(el("div", { class: "grid4" }, [
        field("Reps", reps), field("Kg", kg),
        field("RIR", select(range(0, 6).map(function (n) { return { v: n, t: n === 6 ? "6+" : String(n) }; }), S.rir, upd("rir"))),
        field("Fatiga", select(range(1, 10), S.fat, upd("fat")))
      ]));
      var com = input({ type: "text", value: S.com || "", placeholder: ST.readOnly ? "" : "Comentario (opcional)", oninput: function () { upd("com")(com.value); } });
      row.appendChild(el("div", { class: "grid2 last" }, [field("Técnica", select(TECNICAS, S.tec, upd("tec"), "Ninguna")), field("Nota de la serie", com)]));
      c.appendChild(row);
    });
    var ta = el("textarea", { rows: "2", placeholder: ST.readOnly ? "" : "¿Cómo te ha ido este ejercicio? Molestias, sensaciones…", oninput: function () { E.com = ta.value; persist(); } });
    ta.value = E.com || ""; if (ST.readOnly) ta.disabled = true;
    c.appendChild(field("Comentario del ejercicio", ta, "block"));
    return c;
  }
  function sessionBlock() {
    var L = dayLog(); if (!L.sesion) L.sesion = {}; var S = L.sesion;
    function upd(k) { return function (v) { S[k] = v; persist(); }; }
    var dur = input({ type: "number", inputmode: "numeric", min: "0", value: S.dur || "", placeholder: "min", oninput: function () { upd("dur")(dur.value); } });
    var ta = el("textarea", { rows: "3", placeholder: ST.readOnly ? "" : "Cómo te has sentido, si has dormido mal, si algo ha molestado…", oninput: function () { upd("com")(ta.value); } });
    ta.value = S.com || ""; if (ST.readOnly) ta.disabled = true;
    return el("section", { class: "card session" }, [
      el("h2", { text: "Al terminar la sesión" }),
      el("div", { class: "grid3" }, [field("Esfuerzo (1-10)", select(range(1, 10), S.esf, upd("esf"))), field("Duración", dur), field("Sensaciones (1-5)", select(range(1, 5), S.sen, upd("sen")))]),
      field("Comentario general", ta, "block")
    ]);
  }
  function finishBlock() {
    var L = dayLog();
    var btn = el("button", { class: "btn primary wide", type: "button", text: L.terminado ? "Actualizar entreno" : "Terminar entreno", onclick: function () {
      L.terminado = Date.now(); persist(); flushSaves(); flash("¡Entreno guardado! " + (CFG.ENTRENADOR || "Tu entrenador") + " ya lo puede ver.");
      render();
    } });
    return el("div", { class: "send" }, [btn, el("p", { class: "sent", text: "Todo se guarda solo mientras escribes. Al terminar, pulsa el botón para avisar de que has acabado." })]);
  }

  // ================= STATS / PROGRESS / VOLUME =================
  function exStats(w, d, ex) {
    var L = ST.LOG[w + "-" + d], E = L && L.ej && L.ej[ex.id];
    var r = { sets: 0, reps: 0, kg: 0, ton: 0, any: false };
    if (!E) return r;
    (E.s || []).forEach(function (S, i) {
      if (i >= ex.series.length || !S) return;
      var reps = parseFloat(S.reps), kg = parseFloat(S.kg);
      if (reps > 0) { r.sets++; r.reps += reps; r.any = true; }
      if (kg > 0 && kg > r.kg) r.kg = kg;
      if (reps > 0 && kg > 0) r.ton += reps * kg;
    });
    return r;
  }
  function findPrev(ex) {
    for (var w = UI.w - 1; w >= 0; w--) {
      var dd = ST.PLAN.semanas[w].dias[UI.d]; if (!dd) continue;
      var m = dd.ej.filter(function (e) { return e.id === ex.id; })[0] || dd.ej.filter(function (e) { return e.n === ex.n; })[0];
      if (m) { var st = exStats(w, UI.d, m); if (st.any) return { w: w, st: st }; }
    }
    return null;
  }
  function delta(now, prev, unit) {
    var dlt = Math.round((now - prev) * 10) / 10;
    var cls = dlt > 0 ? "up" : dlt < 0 ? "down" : "eq";
    var txt = dlt > 0 ? "▲ +" + num(dlt) : dlt < 0 ? "▼ " + num(dlt) : "= igual";
    return el("span", { class: "dl " + cls, text: txt + (dlt !== 0 && unit ? " " + unit : "") });
  }
  function progressBlock() {
    var d = day(), anyPrev = false;
    var rows = d.ej.map(function (ex) {
      var now = exStats(UI.w, UI.d, ex), p = findPrev(ex);
      if (p) anyPrev = true;
      function cell(v, pv, unit, f) {
        return el("td", null, [el("b", { text: now.any ? f(v) : "—" }), p ? el("small", { text: "antes " + f(pv) }) : null, now.any && p ? delta(v, pv, unit) : null]);
      }
      var k = function (x) { return x ? num(x) : "—"; }, n = function (x) { return String(x); };
      return el("tr", null, [el("th", { scope: "row", text: ex.n }), cell(now.sets, p && p.st.sets, "", n), cell(now.reps, p && p.st.reps, "", n), cell(now.kg, p && p.st.kg, "kg", k)]);
    });
    return el("section", { class: "card progress", id: "progress" }, [
      el("h2", { text: ST.readOnly ? "Progreso" : "Tu progreso" }),
      el("p", { class: "meta", text: anyPrev ? "Esta sesión frente a la última vez que se hizo este día." : "Desde la próxima semana verás aquí la comparación con la anterior." }),
      el("div", { class: "tablewrap" }, [el("table", { class: "ptable" }, [
        el("thead", null, [el("tr", null, [el("th", { text: "Ejercicio" }), el("th", { text: "Series" }), el("th", { text: "Reps totales" }), el("th", { text: "Kg máx" })])]),
        el("tbody", null, rows)])])
    ]);
  }
  function refreshProgress() { var old = document.getElementById("progress"); if (old && UI.view === "entreno" && !ST.editing) old.replaceWith(progressBlock()); }
  function groupsOf(ex) { return ex.g && ex.g.length ? ex.g : ["Sin grupo"]; }
  function volumeView() {
    var w = UI.w, dias = week().dias, used = {}, plan = {}, done = {};
    dias.forEach(function (d, di) { d.ej.forEach(function (ex) {
      var div = ex.uni ? 2 : 1, st = exStats(w, di, ex);
      groupsOf(ex).forEach(function (g) {
        used[g] = true; plan[g] = plan[g] || []; done[g] = done[g] || [];
        plan[g][di] = (plan[g][di] || 0) + ex.series.length / div;
        done[g][di] = (done[g][di] || 0) + st.sets / div;
      });
    }); });
    var groups = GROUPS.concat(["Sin grupo"]).filter(function (g) { return used[g]; });
    var head = [el("th", { text: "Grupo" })];
    dias.forEach(function (d, i) { head.push(el("th", { text: "Día " + (i + 1) })); });
    head.push(el("th", { class: "tot", text: "Semana" }));
    var max = 0; groups.forEach(function (g) { max = Math.max(max, sum(plan[g])); });
    var body = groups.map(function (g) {
      var tds = [el("th", { scope: "row", text: g })];
      dias.forEach(function (d, i) {
        var p = (plan[g] || [])[i] || 0, h = (done[g] || [])[i] || 0;
        tds.push(el("td", { class: p ? (h >= p ? "full" : h > 0 ? "part" : "") : "zero" }, p ? [el("b", { text: num(h) }), el("small", { text: "/" + num(p) })] : ["·"]));
      });
      var tp = sum(plan[g]), th = sum(done[g]);
      tds.push(el("td", { class: "tot" }, [el("b", { text: num(th) }), el("small", { text: "/" + num(tp) }),
        el("div", { class: "bar" }, [el("i", { style: "width:" + (max ? tp / max * 100 : 0) + "%" }, [el("u", { style: "width:" + (tp ? Math.min(100, th / tp * 100) : 0) + "%" })])])]));
      return el("tr", null, tds);
    });
    var allG = {};
    ST.PLAN.semanas.forEach(function (wk) { wk.dias.forEach(function (d) { d.ej.forEach(function (ex) { groupsOf(ex).forEach(function (g) { allG[g] = true; }); }); }); });
    var eh = [el("th", { text: "Grupo" })];
    ST.PLAN.semanas.forEach(function (_, i) { eh.push(el("th", { class: i === w ? "cur" : "", text: "S" + (i + 1) })); });
    var eb = GROUPS.concat(["Sin grupo"]).filter(function (g) { return allG[g]; }).map(function (g) {
      var tds = [el("th", { scope: "row", text: g })];
      ST.PLAN.semanas.forEach(function (wk, wi) {
        var h = 0, p = 0;
        wk.dias.forEach(function (d, di) { d.ej.forEach(function (ex) {
          if (groupsOf(ex).indexOf(g) < 0) return; var div = ex.uni ? 2 : 1; p += ex.series.length / div; h += exStats(wi, di, ex).sets / div;
        }); });
        tds.push(el("td", { class: wi === w ? "cur" : "" }, [el("b", { text: h ? num(h) : "—" }), el("small", { text: "/" + num(p) })]));
      });
      return el("tr", null, tds);
    });
    return el("main", { class: "day" }, [
      el("section", { class: "card" }, [el("h2", { text: "Volumen · Semana " + (w + 1) }),
        el("p", { class: "meta", text: "Series por grupo muscular: hechas / pautadas. En unilaterales cuenta 1 serie por cada pareja izquierda-derecha." }),
        el("div", { class: "tablewrap" }, [el("table", { class: "vtable" }, [el("thead", null, [el("tr", null, head)]), el("tbody", null, body)])])]),
      el("section", { class: "card" }, [el("h2", { text: "Series hechas por semana" }),
        el("p", { class: "meta", text: "Para ver si el volumen de cada grupo sube, se mantiene o baja." }),
        el("div", { class: "tablewrap" }, [el("table", { class: "vtable" }, [el("thead", null, [el("tr", null, eh)]), el("tbody", null, eb)])])])
    ]);
  }

  // ================= PROGRESSION (week by week) =================
  function trend(vals) {
    // vals: tonnage per week (null = no data). Compare the last two weeks with data.
    var idx = []; vals.forEach(function (v, i) { if (v != null && v > 0) idx.push(i); });
    if (idx.length < 2) return { cls: "", txt: idx.length ? "Falta otra semana" : "Sin datos" };
    var a = vals[idx[idx.length - 2]], b = vals[idx[idx.length - 1]];
    var pct = (b - a) / a * 100;
    var flat = 0;
    for (var k = idx.length - 1; k > 0; k--) { var p = (vals[idx[k]] - vals[idx[k - 1]]) / vals[idx[k - 1]] * 100; if (p < 2) flat++; else break; }
    if (pct >= 2) return { cls: "go", txt: "Progresa +" + num(pct) + "%" };
    if (pct <= -5) return { cls: "bad", txt: "Baja " + num(pct) + "%" };
    return { cls: "warn", txt: flat >= 2 ? "Estancado " + (flat + 1) + " sem" : "Estancado" };
  }
  function spark(vals) {
    var w = 120, h = 32, pad = 3, pts = [];
    var max = Math.max.apply(null, vals.map(function (v) { return v || 0; }));
    if (!max) return null;
    var n = vals.length;
    vals.forEach(function (v, i) { if (v != null && v > 0) pts.push([pad + (n > 1 ? i * (w - 2 * pad) / (n - 1) : 0), h - pad - (v / max) * (h - 2 * pad)]); });
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + w + " " + h); svg.setAttribute("class", "spark"); svg.setAttribute("aria-hidden", "true");
    if (pts.length > 1) { var pl = document.createElementNS(NS, "polyline"); pl.setAttribute("points", pts.map(function (p) { return p.join(","); }).join(" ")); pl.setAttribute("fill", "none"); pl.setAttribute("class", "spark-line"); svg.appendChild(pl); }
    pts.forEach(function (p, i) { var c = document.createElementNS(NS, "circle"); c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", i === pts.length - 1 ? 3 : 2); c.setAttribute("class", "spark-dot"); svg.appendChild(c); });
    return svg;
  }
  function progressionView() {
    var nW = ST.PLAN.semanas.length;
    var main = el("main", { class: "day" });
    main.appendChild(el("section", { class: "card" }, [
      el("h2", { text: "Progresión semana a semana" }),
      el("p", { class: "meta", text: "Cada barra son los kilos movidos esa semana (reps × kg de todas las series). Debajo: series hechas, repeticiones totales y kilo máximo. Verde: sube · Naranja: se mantiene · Rojo: baja respecto a la semana anterior." })
    ]));
    var base = ST.PLAN.semanas[0];
    base.dias.forEach(function (d0, di) {
      main.appendChild(el("h3", { class: "dayhead", text: "Día " + (di + 1) + (d0.nombre ? " · " + d0.nombre : "") }));
      d0.ej.forEach(function (ex0) {
        var rows = [], tons = [];
        for (var w = 0; w < nW; w++) {
          var dd = ST.PLAN.semanas[w].dias[di];
          var ex = dd && (dd.ej.filter(function (e) { return e.id === ex0.id; })[0] || dd.ej.filter(function (e) { return e.n === ex0.n; })[0]);
          var st = ex ? exStats(w, di, ex) : null;
          tons.push(st && st.any ? st.ton : null);
          rows.push({ w: w, st: st, planned: ex ? ex.series.length : 0 });
        }
        var t = trend(tons);
        var max = Math.max.apply(null, tons.map(function (v) { return v || 0; }));
        var prev = null;
        var cols = rows.map(function (r) {
          var st = r.st, has = st && st.any, ton = has ? st.ton : 0;
          var h = max ? Math.max(ton ? 6 : 0, Math.round(ton / max * 100)) : 0;
          var cls = "pbar";
          if (has && prev && prev.ton) cls += ton > prev.ton * 1.02 ? " up" : ton < prev.ton * 0.95 ? " down" : " eq";
          var col = el("div", { class: "pcol" + (r.w === UI.w ? " cur" : "") }, [
            el("span", { class: "pval", text: has && ton ? num(ton) : "" }),
            el("div", { class: "ptrack" }, [el("div", { class: cls + (has ? "" : " empty"), style: "height:" + h + "%" })]),
            el("span", { class: "pwk", text: "S" + (r.w + 1) }),
            el("span", { class: "pstat", text: has ? st.sets + "/" + r.planned + " ser" : "—" }),
            el("span", { class: "pstat", text: has ? st.reps + " reps" : "" }),
            el("span", { class: "pstat", text: has && st.kg ? num(st.kg) + " kg máx" : "" })
          ]);
          if (has) prev = st;
          return col;
        });
        main.appendChild(el("section", { class: "card prog" }, [
          el("div", { class: "proghead" }, [
            el("div", { class: "titles" }, [el("h2", { text: ex0.n }), el("p", { class: "meta", text: (ex0.g || []).join(", ") + ((ex0.g || []).length ? " · " : "") + "kg movidos por semana" })]),
            el("span", { class: "pill " + t.cls, text: t.txt })
          ]),
          el("div", { class: "pchart", role: "img", "aria-label": "Kilos movidos por semana: " + tons.map(function (v, i) { return "S" + (i + 1) + " " + (v ? num(v) : "sin datos"); }).join(", ") }, cols)
        ]));
      });
    });
    return main;
  }

  // ================= COACH: EDIT PLAN =================
  function coachBar() {
    var bar = el("div", { class: "coachbar" });
    if (!ST.editing) {
      bar.appendChild(el("button", { class: "btn dark", type: "button", text: "Editar pauta", onclick: function () { ST.editing = true; UI.view = "entreno"; render(); } }));
      bar.appendChild(el("button", { class: "btn ghost", type: "button", text: ST.client.activo ? "Pausar acceso" : "Reactivar acceso", onclick: function () {
        var v = !ST.client.activo; api.updateClient(ST.clientId, { activo: v }).then(function () { ST.client.activo = v; flash(v ? "Acceso reactivado" : "Acceso pausado"); render(); }, function (x) { flash(errMsg(x)); });
      } }));
    } else {
      bar.appendChild(el("button", { class: "btn ghost", type: "button", text: "Copiar día a semanas siguientes", onclick: function () {
        var src = JSON.stringify(day());
        for (var w = UI.w + 1; w < ST.PLAN.semanas.length; w++) ST.PLAN.semanas[w].dias[UI.d] = JSON.parse(src);
        ST.dirty = true; flash("Copiado a las semanas " + (UI.w + 2) + "–" + ST.PLAN.semanas.length);
      } }));
      bar.appendChild(el("button", { class: "btn primary", type: "button", text: "Guardar pauta", onclick: function () {
        var b = this; b.disabled = true; b.textContent = "Guardando…";
        api.savePlan(ST.clientId, ST.PLAN).then(function () {
          ST.dirty = false; ST.editing = false; if (ST.plans) ST.plans[ST.clientId] = ST.PLAN; flash("Pauta guardada. El cliente ya la ve."); render();
        }, function (x) { b.disabled = false; b.textContent = "Guardar pauta"; flash(errMsg(x)); });
      } }));
      bar.appendChild(el("button", { class: "btn ghost", type: "button", text: "Cancelar", onclick: function () {
        if (ST.dirty && !confirmLeave()) return; openClient(ST.client, true);
      } }));
    }
    return bar;
  }
  function editDayHead(d) {
    function txt(v, on, attrs) { var i = el("input", Object.assign({ type: "text", value: v || "" }, attrs || {})); i.addEventListener("input", function () { on(i.value); ST.dirty = true; }); return i; }
    var wrap = el("section", { class: "card edit" }, [
      el("h2", { text: "Editando · Semana " + (UI.w + 1) + " · Día " + (UI.d + 1) }),
      field("Nombre del día", txt(d.nombre, function (v) { d.nombre = v; }), "block"),
      el("div", { class: "grid2" }, [field("Nombre que ve el cliente", txt(ST.PLAN.cliente, function (v) { ST.PLAN.cliente = v; })),
        field("Inicio (lunes S1)", txt(ST.PLAN.inicio, function (v) { ST.PLAN.inicio = v; }, { type: "date" }))]),
      field("Objetivo", txt(ST.PLAN.objetivo, function (v) { ST.PLAN.objetivo = v; }), "block"),
      el("div", { class: "row" }, [
        el("button", { class: "btn ghost", type: "button", text: "+ Añadir día", onclick: function () {
          ST.PLAN.semanas.forEach(function (w) { w.dias.push({ nombre: "Nuevo día", ej: [] }); }); UI.d = week().dias.length - 1; ST.dirty = true; render();
        } }),
        el("button", { class: "btn ghost", type: "button", text: "+ Añadir semana", onclick: function () {
          ST.PLAN.semanas.push(JSON.parse(JSON.stringify(ST.PLAN.semanas[ST.PLAN.semanas.length - 1]))); UI.w = ST.PLAN.semanas.length - 1; ST.dirty = true; render();
        } }),
        week().dias.length > 1 ? el("button", { class: "btn ghost danger", type: "button", text: "Quitar este día", onclick: function () {
          ST.PLAN.semanas.forEach(function (w) { w.dias.splice(UI.d, 1); }); UI.d = 0; ST.dirty = true; render();
        } }) : null
      ])
    ]);
    return wrap;
  }
  function editCard(ex, i, d) {
    function txt(v, on, ph, type) { var e = el("input", { type: type || "text", value: v || "", placeholder: ph || "" }); e.addEventListener("input", function () { on(e.value); ST.dirty = true; }); return e; }
    var c = el("section", { class: "card edit" });
    c.appendChild(el("div", { class: "cardhead" }, [el("span", { class: "idx", text: String(i + 1) }), field("Ejercicio", txt(ex.n, function (v) { ex.n = v; }), "grow")]));
    c.appendChild(field("Notas técnicas", txt(ex.nota, function (v) { ex.nota = v; }, "Notas técnicas"), "block"));
    c.appendChild(field("Enlace a vídeo", txt(ex.link, function (v) { ex.link = v; }, "https://… (opcional)", "url"), "block"));
    var uni = el("input", { type: "checkbox", onchange: function () { ex.uni = uni.checked; ST.dirty = true; } }); uni.checked = !!ex.uni;
    c.appendChild(el("label", { class: "check" }, [uni, el("span", { text: "Unilateral (el cliente elige brazo/pierna y lado)" })]));
    var gwrap = el("div", { class: "gchips", role: "group", "aria-label": "Grupo muscular" });
    GROUPS.forEach(function (g) {
      var on = (ex.g || []).indexOf(g) >= 0;
      gwrap.appendChild(el("button", { type: "button", class: "gchip" + (on ? " on" : ""), "aria-pressed": String(on), text: g, onclick: function () {
        ex.g = ex.g || []; var k = ex.g.indexOf(g); if (k >= 0) ex.g.splice(k, 1); else ex.g.push(g);
        ST.dirty = true; this.classList.toggle("on"); this.setAttribute("aria-pressed", String(k < 0));
      } }));
    });
    c.appendChild(el("div", { class: "field block" }, [el("span", { text: "Grupo muscular (cuenta para el volumen)" }), gwrap]));
    var list = el("div", { class: "editsets" });
    ex.series.forEach(function (s, si) {
      list.appendChild(el("div", { class: "editset" }, [
        el("span", { class: "sn", text: "S" + (si + 1) }),
        field("Reps", txt(s.r, function (v) { s.r = v; })), field("Descanso", txt(s.d, function (v) { s.d = v; })),
        el("button", { class: "icon", type: "button", "aria-label": "Quitar serie", text: "×", onclick: function () { ex.series.splice(si, 1); ST.dirty = true; render(); } })
      ]));
    });
    c.appendChild(list);
    c.appendChild(el("div", { class: "row" }, [
      el("button", { class: "btn ghost", type: "button", text: "+ Serie", onclick: function () { var l = ex.series[ex.series.length - 1] || { r: "8-10", d: "2 min" }; ex.series.push({ r: l.r, d: l.d }); ST.dirty = true; render(); } }),
      i > 0 ? el("button", { class: "btn ghost", type: "button", text: "↑ Subir", onclick: function () { d.ej.splice(i - 1, 0, d.ej.splice(i, 1)[0]); ST.dirty = true; render(); } }) : null,
      el("button", { class: "btn ghost danger", type: "button", text: "Quitar ejercicio", onclick: function () { d.ej.splice(i, 1); ST.dirty = true; render(); } })
    ]));
    return c;
  }

  // ================= START =================
  if (api && api.onRecovery) api.onRecovery(function () { ST.me = ST.me || {}; api.session().then(function (s) { if (s) ST.me = s.user; newPasswordScreen(false); }); });
  boot();
})();
