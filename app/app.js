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
      sb: sb,
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
      saveLog: function (cid, w, d, data) { return sb.from("registros").upsert({ cliente_id: cid, semana: w, dia: d, data: data }).then(ok); },
      // panel: avisos de dolor y etapa (si falla, la lista sale igual sin avisos)
      listChecks: function () { return sb.from("seguimiento").select("cliente_id,ck:data->checkins").then(ok); },
      listIntakes: function () { return sb.from("nutri_cliente").select("cliente_id,e:data->entrevistaCli->data,etapa:data->etapa").then(ok); },
      recentLogs: function () { return sb.from("registros").select("cliente_id,data,updated_at").gte("updated_at", new Date(Date.now() - 14 * 864e5).toISOString()).then(ok); }
    };
  }

  // ================= STATE =================
  var ST = {
    me: null, profile: null, mode: null,      // mode: "cliente" | "entrenador"
    clientId: null, client: null, PLAN: null, LOG: {}, readOnly: false, coachWrite: false,
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
    function soft(f) { return f ? f().catch(function () { return []; }) : Promise.resolve([]); }
    Promise.all([api.listClients(), api.lastActivity(), api.listPlans(), soft(api.listChecks), soft(api.listIntakes), soft(api.recentLogs)]).then(function (r) {
      ST.clients = r[0]; ST.activity = {};
      r[1].forEach(function (a) { if (!ST.activity[a.cliente_id]) ST.activity[a.cliente_id] = a.updated_at; });
      ST.plans = {}; r[2].forEach(function (p) { ST.plans[p.cliente_id] = p.data; });
      ST.pain = painInfo(r[3] || [], r[4] || [], r[5] || []);
      ST.stage = {}; (r[4] || []).forEach(function (x) { var t = window.EYLEtapa && window.EYLEtapa.label(x.etapa, x.e); if (t) ST.stage[x.cliente_id] = t; });
      renderCoachHome();
    }).catch(function (x) { shell([topbar(), el("p", { class: "err", text: errMsg(x) })]); });
  }
  // ---- avisos de dolor para la lista de clientes ----
  var ZONA_N = { lumbar: "zona lumbar", rodilla: "rodilla", hombro: "hombro", cervical: "cuello", tobillo: "tobillo", codo: "codo", cadera: "cadera", aquiles: "tendón de Aquiles", otra: "otra zona" };
  // «pinchar» no cuenta: en el gimnasio es no completar la repetición. Se quitan las negaciones («0 molestias», «sin dolor», «no me duele»).
  var PAIN_W = "(?:dolor\\w*|duel[ea]n?|doli[oó]|molest\\w*|lesi[oó]n\\w*|tir[oó]n|contractur\\w*)";
  var PAIN_RE = new RegExp("(?:^|[^\\wáéíóúñ])" + PAIN_W + "(?![\\wáéíóúñ])", "i");
  var PAIN_NEG = new RegExp("(?:^|[^\\wáéíóúñ])(?:0|cero|sin|ning[uú]n[ao]?|nada de|ni una?|no)\\s+(?:(?:me|le|te|ha|he|hay|tengo|tiene|noto|nota|siento|siente|ninguna?|ning[uú]n|mucha?|nada|de|la|el)\\s+){0,3}" + PAIN_W, "gi");
  function painText(t) { return PAIN_RE.test(String(t || "").replace(PAIN_NEG, " ")); }
  function isoMonday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  function painInfo(checks, intakes, logs) {
    var out = {}, now = new Date(), ws = isoMonday(now), wsPrev = isoMonday(new Date(now.getTime() - 7 * 864e5));
    function add(id, lvl, txt) { var o = out[id] || (out[id] = { lvl: "warn", items: [] }); if (lvl === "bad") o.lvl = "bad"; o.items.push({ lvl: lvl, txt: txt }); }
    checks.forEach(function (r) {
      var ck = r.ck || {}, cur = ck[ws], prev = ck[wsPrev];
      [[cur, "esta semana"], [prev, "la semana pasada"]].forEach(function (p, i) {
        var c = p[0]; if (!c || c.dolor == null || +c.dolor < 3) return;
        if (i === 1 && cur && cur.dolor != null) return; // ya cuenta el de esta semana
        add(r.cliente_id, +c.dolor >= 6 ? "bad" : "warn", "Dolor " + c.dolor + "/10 en " + (ZONA_N[c.zona] || "una zona") + " " + p[1]);
      });
      if (cur && prev && cur.zona && cur.zona === prev.zona && +cur.dolor >= 3 && +prev.dolor >= 3) add(r.cliente_id, "warn", "Misma zona dos semanas seguidas");
    });
    intakes.forEach(function (r) {
      var e = r.e || {}; if (e.lesion !== "si") return;
      var lv = parseFloat(e.lesionDolor);
      add(r.cliente_id, lv >= 6 ? "bad" : "warn", "Lesión al empezar: " + ((e.lesionZona || []).join(", ") || "sin zona") + (isFinite(lv) ? " · " + lv + "/10" : ""));
    });
    logs.forEach(function (r) {
      var L = r.data || {}, hits = [];
      if (L.borrado) return;
      Object.keys(L.ej || {}).forEach(function (k) { var E = L.ej[k] || {}; if (E.com) hits.push(E.com); (E.s || []).forEach(function (st) { if (st && st.com) hits.push(st.com); }); });
      (L.extra || []).forEach(function (E) { if (E && E.com) hits.push(E.com); });
      if (L.sesion && L.sesion.com) hits.push(L.sesion.com);
      var fd = L.fecha ? parseDate(L.fecha) : r.updated_at ? new Date(r.updated_at) : null;
      hits.filter(painText).forEach(function (t) {
        var m = t.trim(); m = m.length > 70 ? m.slice(0, 68) + "…" : m;
        add(r.cliente_id, "warn", "Comentario" + (fd ? " del " + fmt(fd) : "") + ": «" + m + "»");
      });
    });
    Object.keys(out).forEach(function (id) { var o = out[id]; o.items.sort(function (a, b) { return (a.lvl === "bad" ? 0 : 1) - (b.lvl === "bad" ? 0 : 1); }); });
    return out;
  }
  function renderCoachHome() {
    var list = el("div", { class: "clients" });
    var painN = ST.clients.filter(function (c) { return ST.pain && ST.pain[c.id]; }).length;
    if (painN) list.appendChild(el("p", { class: "painsum", role: "status", text: "⚠️ " + painN + (painN === 1 ? " cliente con aviso de dolor" : " clientes con aviso de dolor") + " (check-in, entrevista o comentarios de los últimos 14 días)." }));
    if (!ST.clients.length) list.appendChild(el("p", { class: "empty", text: "Aún no tienes clientes. Créalos en Supabase → Authentication → Users → Add user." }));
    ST.clients.forEach(function (c) {
      var last = ST.activity[c.id], plan = ST.plans[c.id];
      var days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
      var pill = !plan ? el("span", { class: "pill warn", text: "Sin plan" })
        : c.must_change_password ? el("span", { class: "pill", text: "No ha entrado" })
        : days == null ? el("span", { class: "pill", text: "Sin registros" })
        : el("span", { class: "pill" + (days <= 3 ? " go" : days > 7 ? " warn" : ""), text: days === 0 ? "Hoy" : "Hace " + days + " d" });
      var pain = ST.pain && ST.pain[c.id], stage = ST.stage && ST.stage[c.id];
      var info = [el("b", { text: c.nombre || c.email }), el("small", { text: c.email + (c.activo ? "" : " · pausado") })];
      if (stage) info.push(el("span", { class: "stagetag", text: stage }));
      if (pain) info.push(el("ul", { class: "painlist" }, pain.items.slice(0, 3).map(function (it) { return el("li", { class: it.lvl, text: it.txt }); })
        .concat(pain.items.length > 3 ? [el("li", { class: "more", text: "+" + (pain.items.length - 3) + " más" })] : [])));
      list.appendChild(el("button", { class: "client" + (pain ? " haspain " + pain.lvl : ""), type: "button", onclick: function () { openClient(c, true); } }, [
        el("div", null, info),
        el("div", { class: "pills" }, (pain ? [el("span", { class: "pill " + (pain.lvl === "bad" ? "bad" : "warn"), text: pain.lvl === "bad" ? "Dolor" : "Molestias" })] : []).concat([pill]))
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
    ST.client = c; ST.clientId = c.id; ST.readOnly = asCoach; ST.coachWrite = false; ST.editing = false; ST.dirty = false;
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
      if (!asCoach && !ST.intakeSkip && window.EYLNutri && api.sb) {
        window.EYLNutri.intakeCheck({ sb: api.sb, client: c }).then(function (need) {
          if (need) intakeScreen(c); else { ST.intakeSkip = true; openClient(c, false); }
        });
        return;
      }
      if (!ST.PLAN) {
        if (asCoach) { noPlanScreen(); }
        else { shell([topbar(), el("header", { class: "top" }, [el("div", { class: "logo", role: "img", "aria-label": "Entrena Your Life" }), el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: "Entrena Your Life" })]), el("h1", { text: c.nombre || "Hola" }), el("p", { class: "goal", text: "Tu entreno está en camino. Mientras, empieza por la nutrición." })]), nutriView()]); }
        return;
      }
      if (UI.w == null || UI.w >= ST.PLAN.semanas.length) UI.w = currentWeek();
      render();
    }).catch(function (x) { shell([topbar(), el("p", { class: "err", text: errMsg(x) })]); });
  }
  function intakeScreen(c) {
    shell([topbar(),
      el("header", { class: "top" }, [el("div", { class: "logo", role: "img", "aria-label": "Entrena Your Life" }), el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: "Entrena Your Life" })]), el("h1", { text: "Hola" })]),
      window.EYLNutri.view({ sb: api.sb, coach: false, client: c, flash: flash, onDone: function () { ST.intakeSkip = true; openClient(c, false); } })]);
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
        el("button", { class: "btn ghost wide", type: "button", text: "Ver su nutrición", onclick: function () {
          shell([topbar(el("button", { class: "backbtn", type: "button", text: "← " + (ST.client.nombre || "Cliente"), onclick: function () { openClient(ST.client, true); } })),
            el("header", { class: "top" }, [el("div", { class: "logo", role: "img", "aria-label": "Entrena Your Life" }), el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: "Nutrición" })]), el("h1", { text: ST.client.nombre || ST.client.email })]),
            nutriView()]);
        } }),
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
  function day() {
    var w = week();
    if (UI.d >= 100) { var X = ST.LOG[UI.w + "-" + UI.d]; if (X && !X.borrado) return { nombre: X.nombre || "Entreno extra", ej: [], libre: true }; UI.d = 0; }
    if (UI.d >= w.dias.length) UI.d = 0; return w.dias[UI.d] || { nombre: "", ej: [] };
  }
  // Lo no pautado va en el registro del cliente, no en el plan: L.extra (ejercicios) y días 100+ (entrenos sueltos)
  function dayEx(d) { var L = ST.LOG[logKey()]; return d.ej.concat((L && L.extra) || []); }
  function extraDays(w) {
    return Object.keys(ST.LOG).map(function (k) { var p = k.split("-"); return { w: +p[0], d: +p[1], L: ST.LOG[k] }; })
      .filter(function (x) { return x.w === w && x.d >= 100 && !x.L.borrado; }).sort(function (a, b) { return a.d - b.d; });
  }
  function todayISO() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function newExtraDay() {
    var n = 100; extraDaysAll().forEach(function (x) { if (x.w === UI.w && x.d >= n) n = x.d + 1; });
    ST.LOG[UI.w + "-" + n] = { fecha: todayISO(), nombre: "Entreno extra", sesion: {}, ej: {}, extra: [] };
    UI.d = n; addOpen = true; persist(); render(); window.scrollTo(0, 0);
  }
  function extraDaysAll() { return Object.keys(ST.LOG).map(function (k) { var p = k.split("-"); return { w: +p[0], d: +p[1], L: ST.LOG[k] }; }).filter(function (x) { return x.d >= 100; }); }
  function logKey() { return UI.w + "-" + UI.d; }
  function dayLog() { var k = logKey(); if (!ST.LOG[k]) ST.LOG[k] = { fecha: "", sesion: {}, ej: {} }; return ST.LOG[k]; }
  function exLog(ex) { var L = dayLog(); if (!L.ej) L.ej = {}; if (!L.ej[ex.id]) L.ej[ex.id] = { com: "", s: [] }; return L.ej[ex.id]; }
  function setLog(ex, i) { var E = exLog(ex); while (E.s.length <= i) E.s.push({}); return E.s[i]; }

  var pending = {}, saveTimer;
  function persist() {
    if (ST.readOnly) return;
    var k = logKey(); ST.LOG[k].editado = Date.now();
    if (ST.coachWrite) ST.LOG[k].porEntrenador = Date.now(); else lsSet(cacheKey(), ST.LOG);
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
      if (ST.dirty && !confirmLeave()) return; if (Object.keys(pending).length) flushSaves(); coachHome();
    } })));
    else kids.push(topbar());
    kids.push(header());
    if (UI.view === "nutri" && !ST.editing) {
      kids.push(nutriView());
    } else if (UI.view === "segui" && !ST.editing) {
      kids.push(seguiView());
    } else if (UI.view === "volumen" && !ST.editing) {
      kids.push(nav(true)); kids.push(volumeView());
    } else if (UI.view === "progresion" && !ST.editing) {
      kids.push(progressionView());
    } else {
      if (ST.editing && UI.d >= 100) UI.d = 0;
      kids.push(nav());
      var d = day(), list = ST.editing ? d.ej : dayEx(d);
      var main = el("main", { class: "day" + (ST.readOnly ? " ro" : "") });
      if (ST.coachWrite && !ST.editing) main.appendChild(el("div", { class: "coachwrite", role: "status" }, [
        el("b", { text: "Estás apuntando por " + (ST.client.nombre || "el cliente") }),
        el("span", { text: "Lo que escribas se guarda en su registro y lo verá en su app." })]));
      if (ST.editing) main.appendChild(editDayHead(d));
      else main.appendChild(dateRow());
      if (d.libre && !ST.editing) main.appendChild(extraHead());
      if (!ST.editing && window.EYLNutri && api.sb) main.appendChild(window.EYLNutri.cycleBanner({ sb: api.sb, client: ST.client, go: ST.mode === "entrenador" ? null : function () { UI.view = "nutri"; render(); window.scrollTo(0, 0); } }));
      if (!ST.editing && window.EYLEtapa && api.sb) main.appendChild(window.EYLEtapa.banner({ sb: api.sb, client: ST.client, coach: ST.mode === "entrenador", flash: flash }));
      if (!ST.editing && list.length && !d.libre && UI.d < 100) main.appendChild(briefCard(d));
      if (!ST.editing && list.length) main.appendChild(prepCard());
      if (!list.length && !ST.editing && !d.libre) main.appendChild(el("p", { class: "empty", text: "Hoy no tienes entreno pautado. Descansa o sal a caminar un rato." }));
      list.forEach(function (ex, i) { main.appendChild(ST.editing ? editCard(ex, i, d) : card(ex, i)); });
      if (!ST.editing && !ST.readOnly && !ST.coachWrite) main.appendChild(addExtraBlock());
      if (ST.editing) {
        main.appendChild(el("button", { class: "btn ghost wide", type: "button", text: "+ Añadir ejercicio", onclick: function () {
          d.ej.push({ id: uid(), n: "Nuevo ejercicio", uni: false, nota: "", g: [], series: [{ r: "8-10", d: "2 min" }] }); ST.dirty = true; render();
        } }));
      } else if (list.length) {
        main.appendChild(sessionBlock());
        main.appendChild(progressBlock());
        if (!ST.readOnly) main.appendChild(finishBlock());
      }
      kids.push(main);
    }
    if (ST.mode === "entrenador" && !((UI.view === "nutri" || UI.view === "segui") && !ST.editing)) kids.push(coachBar());
    shell(kids);
  }
  function nutriView() {
    if (!window.EYLNutri || !api.sb) return el("p", { class: "err", text: "No se pudo cargar la nutrición. Recarga la página." });
    return window.EYLNutri.view({ sb: api.sb, coach: ST.mode === "entrenador", client: ST.client, flash: flash });
  }
  function seguiView() {
    if (!window.EYLSegui || !api.sb) return el("p", { class: "err", text: "No se pudo cargar el control. Recarga la página." });
    return window.EYLSegui.view({ sb: api.sb, coach: ST.mode === "entrenador", client: ST.client, flash: flash });
  }
  var leaveArmed = false;
  function confirmLeave() { if (leaveArmed) { leaveArmed = false; return true; } leaveArmed = true; flash("Tienes cambios sin guardar. Pulsa otra vez para salir sin guardar."); setTimeout(function () { leaveArmed = false; }, 4000); return false; }

  function header() {
    return el("header", { class: "top withseg" }, [
      el("div", { class: "logo", role: "img", "aria-label": "Logo de Entrena Your Life" }),
      el("div", { class: "tophead" }, [
        el("div", { class: "brand" }, [el("span", { class: "mark", text: "EYL" }), el("span", { class: "brandname", text: ST.mode === "entrenador" ? (ST.editing ? "Editando pauta" : ST.coachWrite ? "Apuntando por el cliente" : "Viendo registros") : "Entrena Your Life" })]),
        el("h1", { text: ST.PLAN.cliente || (ST.client && ST.client.nombre) || "Tu entreno" }),
        ST.PLAN.objetivo ? el("p", { class: "goal", text: ST.PLAN.objetivo }) : null
      ]),
      ST.editing ? null : el("div", { class: "seg", role: "tablist", "aria-label": "Vista" }, [
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "entreno"), class: UI.view === "entreno" ? "on" : "", text: "Entreno", onclick: function () { UI.view = "entreno"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "volumen"), class: UI.view === "volumen" ? "on" : "", text: "Volumen", onclick: function () { UI.view = "volumen"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "progresion"), class: UI.view === "progresion" ? "on" : "", text: "Progresión", onclick: function () { UI.view = "progresion"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "nutri"), class: UI.view === "nutri" ? "on" : "", text: "Nutrición", onclick: function () { UI.view = "nutri"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "segui"), class: UI.view === "segui" ? "on" : "", text: "Control", onclick: function () { UI.view = "segui"; render(); } })
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
    if (!ST.editing) extraDays(UI.w).forEach(function (x) {
      days.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(x.d === UI.d), class: "daytab extra" + (x.d === UI.d ? " on" : ""),
        onclick: function () { UI.d = x.d; render(); window.scrollTo(0, 0); } }, [
        el("span", { class: "dnum", text: "Extra" + (x.L.terminado ? " ✓" : "") }),
        el("span", { class: "dname", text: x.L.nombre || "Entreno extra" })
      ]));
    });
    if (!ST.editing && !ST.readOnly && !ST.coachWrite) days.appendChild(el("button", { type: "button", class: "daytab addday", onclick: newExtraDay }, [
      el("span", { class: "dnum", text: "+ Extra" }), el("span", { class: "dname", text: "Entreno no pautado" })]));
    return el("nav", { class: "nav" }, [weeks, days]);
  }
  function dateRow() {
    var L = dayLog();
    var inp = input({ id: "fecha", type: "date", value: L.fecha || "", onchange: function () { L.fecha = inp.value; persist(); } });
    var right = el("div", { style: "display:flex;gap:8px;align-items:center" }, [
      L.terminado ? el("span", { class: "done-badge", text: "Terminado " + fmtDT(L.terminado) }) : null,
      ST.readOnly ? null : el("span", { id: "sync", class: "meta" })
    ]);
    return el("div", { class: "card", style: "padding:10px 14px" }, [el("label", { class: "daterow", for: "fecha" }, [el("span", { text: ST.readOnly ? "Fecha del entreno" : ST.coachWrite ? "Día que entrenó" : "Día que entrenas" }), inp]), right]);
  }

  // Serie de la última vez que se hizo este día (misma posición), para guiar al apuntar
  function prevSet(ex, si) {
    for (var w = UI.w - 1; w >= 0; w--) {
      var dd = ST.PLAN.semanas[w] && ST.PLAN.semanas[w].dias[UI.d]; if (!dd) continue;
      var m = dd.ej.filter(function (e) { return e.id === ex.id; })[0] || dd.ej.filter(function (e) { return e.n === ex.n; })[0];
      var L = ST.LOG[w + "-" + UI.d], E = m && L && L.ej && L.ej[m.id];
      if (!E || !E.s) continue;
      var any = E.s.some(function (S) { return S && parseFloat(S.reps) > 0; });
      if (!any) continue;
      var S = E.s[si];
      return S && parseFloat(S.reps) > 0 ? S : null;
    }
    return null;
  }
  // Ejercicios plegados (por día): se recuerdan en este móvil
  function foldKey() { return "eyl-fold-" + ST.clientId + "-" + logKey(); }
  function isFolded(ex) { return !!lsGet(foldKey(), {})[ex.id]; }
  function setFolded(ex, v) { var f = lsGet(foldKey(), {}); if (v) f[ex.id] = 1; else delete f[ex.id]; lsSet(foldKey(), f); }
  var TEC_CAMPOS = {
    "Drop set": [["tkg", "Kg tras bajar", "decimal"], ["treps", "Reps de la bajada", "numeric"]],
    "Rest-pause": [["tpausa", "Pausa (s)", "numeric"], ["treps", "Reps tras la pausa", "numeric"]],
    "Cluster": [["tpausa", "Pausa entre bloques (s)", "numeric"], ["treps", "Reps por bloque", "numeric"]]
  };
  function tecBlock(S, save) {
    var def = TEC_CAMPOS[S.tec]; if (!def) return null;
    return el("div", { class: "grid2 tecx" }, def.map(function (f) {
      var inp = input({ type: "number", inputmode: f[2], min: "0", step: f[2] === "decimal" ? "0.5" : "1", value: S[f[0]] || "", oninput: function () { S[f[0]] = inp.value; save(); } });
      return field(f[1], inp);
    }));
  }
  function kgTxt(x) { return String(Math.round(parseFloat(x) * 100) / 100).replace(".", ","); }
  function setLabel(ex, si) {
    if (!ex.uni) return "Serie " + (si + 1);
    return "Serie " + (Math.floor(si / 2) + 1) + " · " + (si % 2 ? "2.º lado" : "1.er lado");
  }
  function seriesText(ex) {
    var n = ex.series.length;
    if (ex.uni) { var p = n / 2; return (p % 1 ? num(p) : p) + (p === 1 ? " serie" : " series") + " por lado (" + n + " filas)"; }
    return n + (n === 1 ? " serie" : " series");
  }
  function foldSummary(ex) {
    var st = exStats(UI.w, UI.d, ex), tot = ex.series.length, div = ex.uni ? 2 : 1;
    if (!st.any) return "Sin apuntar";
    return num(st.sets / div) + " de " + num(tot / div) + (ex.uni ? " series por lado" : " series") + (st.kg ? " · máx. " + kgTxt(st.kg) + " kg" : "");
  }

  // ---------- Valoración del ejercicio y «Lo importante de hoy» ----------
  function isDeload(d) { return (d.ej || []).some(function (e) { return /descarga/i.test(e.nota || ""); }); }
  function cap(S) { // fuerza estimada de una serie (Epley con las reps en recámara)
    var r = parseFloat(S.reps), kg = parseFloat(S.kg), rir = parseFloat(S.rir);
    if (!(r > 0)) return 0; var t = r + (rir >= 0 ? Math.min(rir, 5) : 0);
    return kg > 0 ? kg * (1 + t / 30) : t;
  }
  function verdict(ex) {
    var E = exLog(ex), cur = 0, prev = 0, n = 0, dr = 0, dk = 0, sameKg = true, pending = 0;
    ex.series.forEach(function (s, si) {
      var S = E.s[si] || {}, P = prevSet(ex, si);
      if (!(parseFloat(S.reps) > 0)) { pending++; return; }
      if (!P) return;
      n++; cur += cap(S); prev += cap(P);
      dr += parseFloat(S.reps) - parseFloat(P.reps);
      var a = parseFloat(S.kg) || 0, b = parseFloat(P.kg) || 0; dk += a - b; if (a !== b) sameKg = false;
    });
    if (!n || pending) return null;
    var pct = prev ? (cur - prev) / prev : 0, plus = function (x, u) { return (x > 0 ? "+" : "") + kgTxt(x) + u; };
    var det = sameKg ? (dr ? plus(dr, dr === 1 || dr === -1 ? " rep" : " reps") + " con el mismo peso" : "mismas reps y mismo peso")
      : plus(dk / n, " kg de media por serie");
    if (pct > 0.02) return { c: "up", t: "🟢 Mejoras: " + det + "." };
    if (pct < -0.02) return isDeload(day()) ? { c: "eq", t: "🟡 Semana de descarga: toca ir más suave, es lo previsto." }
      : { c: "down", t: "🟠 Baja un poco (" + det + "). Revisa descanso, sueño o fatiga; un día flojo es normal." };
    return { c: "eq", t: "🟡 Te mantienes: mismo rendimiento que la última vez" + (sameKg ? "" : " (" + det + ")") + "." };
  }
  function repRange(r) { var m = String(r || "").match(/(\d+)\s*(?:-|–|a)\s*(\d+)/); if (m) return [+m[1], +m[2]]; m = String(r || "").match(/(\d+)/); return m ? [+m[1], +m[1]] : null; }
  // Subida de peso que exista en el material: si el ejercicio usa pesos de 1,25 en 1,25 (poleas y máquinas: 7,5 · 23,75 · 31,25),
  // la subida se redondea a ese paso; con mancuernas de 10 kg o más, de 2 en 2.
  function stepKg(kg, ex, kgs) {
    var base = kg >= 100 ? 5 : kg >= 20 ? 2.5 : 1;
    var all = (kgs || []).concat([kg]).filter(function (k) { return k > 0; });
    var grid125 = all.some(function (k) { return Math.abs(k - Math.round(k)) > 1e-6; });
    if (grid125) return Math.ceil(base / 1.25 - 1e-9) * 1.25;
    if (/mancuerna/i.test((ex && ex.n) || "") && kg >= 10 && kg < 20 && all.every(function (k) { return k % 2 === 0; })) return 2;
    return base;
  }
  function suggestion(ex) {
    var rows = [], min = Infinity, max = 0;
    ex.series.forEach(function (s, si) { var P = prevSet(ex, si), rg = repRange(s.r); if (P && rg) { rows.push({ P: P, rg: rg }); } });
    if (!rows.length) return null;
    var kg = 0, allTop = true, anyLow = false, kgs = [];
    rows.forEach(function (x) {
      var r = parseFloat(x.P.reps), k = parseFloat(x.P.kg) || 0; if (k > kg) kg = k; kgs.push(k);
      if (r < x.rg[1]) allTop = false; if (r < x.rg[0]) anyLow = true;
      min = Math.min(min, x.rg[0]); max = Math.max(max, x.rg[1]);
    });
    if (allTop && kg) { var nk = kg + stepKg(kg, ex, kgs); return { p: 1, t: "⬆️ " + ex.n + ": sube de " + kgTxt(kg) + " a " + kgTxt(nk) + " kg y vuelve a " + min + " reps." }; }
    if (allTop) return { p: 1, t: "⬆️ " + ex.n + ": llegaste arriba del rango; añade dificultad (más peso o más lento)." };
    if (anyLow) return { p: 3, t: "➡️ " + ex.n + ": mantén " + (kg ? kgTxt(kg) + " kg" : "el peso") + " y busca llegar a " + min + " reps en todas las series." };
    return { p: 2, t: "➕ " + ex.n + ": mismo peso" + (kg ? " (" + kgTxt(kg) + " kg)" : "") + ", intenta 1 rep más por serie (hasta " + max + ")." };
  }
  function briefItems(d) {
    var out = [], rir = null;
    (d.ej || []).forEach(function (ex) { var m = (ex.nota || "").match(/RIR\s*[0-9]+(?:\s*-\s*[0-9]+)?/i); if (!rir && m) rir = m[0].toUpperCase(); });
    if (isDeload(d)) out.push({ k: "plan", t: "🔋 Semana de descarga: menos series y más reps en recámara. No busques récords." });
    else if (rir) out.push({ k: "plan", t: "🎯 Objetivo de esfuerzo esta semana: " + rir + " (reps que te deberían sobrar al acabar cada serie)." });
    var sug = (d.ej || []).map(suggestion).filter(Boolean).sort(function (a, b) { return a.p - b.p; });
    sug.forEach(function (s) { out.push({ k: "ex", t: s.t }); });
    return out;
  }
  function briefList(d, cyc, limit) {
    var items = briefItems(d), lis = [];
    if (cyc) lis.push(el("li", { class: "bcyc" }, [el("b", { text: "🌙 Día " + cyc.dia + " del ciclo · " + cyc.label + ". " }), cyc.entreno]));
    var exs = items.filter(function (x) { return x.k === "ex"; }), plan = items.filter(function (x) { return x.k !== "ex"; });
    plan.forEach(function (x) { lis.push(el("li", { text: x.t })); });
    var shown = limit ? exs.slice(0, limit) : exs;
    shown.forEach(function (x) { lis.push(el("li", { text: x.t })); });
    if (limit && exs.length > limit) lis.push(el("li", { class: "bmore", text: "Y " + (exs.length - limit) + " ejercicio" + (exs.length - limit > 1 ? "s" : "") + " más: lo verás en cada serie." }));
    if (!exs.length && !cyc && !plan.length) return null;
    if (!exs.length) lis.push(el("li", { class: "bmore", text: "Es la primera vez que haces este día: apunta bien reps y kilos y la próxima semana te diré cuándo subir." }));
    return el("ul", { class: "blist" }, lis);
  }
  function cycFetch(cb) {
    if (!window.EYLNutri || !window.EYLNutri.cycleToday || !api.sb) return cb(null);
    window.EYLNutri.cycleToday({ sb: api.sb, client: ST.client }).then(cb, function () { cb(null); });
  }
  function briefCard(d) {
    var box = el("section", { class: "card brief" }, [
      el("h2", { text: "📋 Lo importante de hoy" })]);
    var body = el("div"); box.appendChild(body);
    cycFetch(function (cyc) {
      var l = briefList(d, null, 0);
      if (!l) { box.hidden = true; return; }
      body.appendChild(l);
      maybePopup(d, cyc);
    });
    return box;
  }
  function briefKey() { var t = new Date(); return "eyl-brief-" + ST.clientId + "-" + logKey() + "-" + t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(); }
  function maybePopup(d, cyc) {
    if (ST.readOnly || ST.coachWrite || UI.view !== "entreno" || UI.d >= 100) return;
    var L = ST.LOG[logKey()];
    var started = L && (L.terminado || Object.keys(L.ej || {}).some(function (k) { return (L.ej[k].s || []).some(function (S) { return S && parseFloat(S.reps) > 0; }); }));
    if (started || lsGet(briefKey(), false) || document.querySelector(".brief-ov")) return;
    var l = briefList(d, cyc, 5); if (!l) return;
    lsSet(briefKey(), true);
    var ov;
    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    ov = el("div", { class: "brief-ov", onclick: function (e) { if (e.target === ov) close(); } }, [
      el("div", { class: "brief-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Lo importante de hoy" }, [
        el("p", { class: "bkick", text: (d.nombre || "Tu entreno") + " · antes de empezar" }),
        el("h2", { text: "Lo importante de hoy" }),
        l,
        el("button", { class: "btn primary wide", type: "button", text: "Empezar", onclick: close })
      ])]);
    document.body.appendChild(ov); document.addEventListener("keydown", esc);
    var b = ov.querySelector(".btn"); if (b) b.focus();
  }

  function card(ex, i) {
    var E = exLog(ex);
    var folded = isFolded(ex);
    var c = el("section", { class: "card exc" + (folded ? " folded" : "") });
    function toggle() {
      var v = !c.classList.contains("folded");
      setFolded(ex, v); c.classList.toggle("folded", v);
      sum.textContent = foldSummary(ex); refreshV();
      head.setAttribute("aria-expanded", String(!v));
      if (v) {
        var nav = document.querySelector(".nav"), off = (nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0) + 8;
        var top = c.getBoundingClientRect().top; if (top < off) window.scrollBy(0, top - off);
      }
    }
    var sum = el("p", { class: "foldsum", text: foldSummary(ex) });
    var vd = el("p", { class: "verdict", hidden: true });
    function refreshV() { var v = verdict(ex); vd.className = "verdict" + (v ? " " + v.c : ""); vd.textContent = v ? v.t : ""; vd.hidden = !v; }
    var head = el("div", { class: "cardhead foldable", role: "button", tabindex: "0", "aria-expanded": String(!folded), onclick: toggle,
      onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } } }, [
      el("span", { class: "idx", text: String(i + 1) }),
      el("div", { class: "titles" }, [
        el("h2", { text: ex.n }),
        el("p", { class: "meta", text: (ex.extra ? "No pautado · " : "") + seriesText(ex) + ((ex.g || []).length ? " · " + ex.g.join(", ") : "") + (ex.uni ? " · unilateral: elige brazo o pierna y lado" : "") }),
        sum, vd
      ]),
      el("span", { class: "chev", "aria-hidden": "true", text: "▾" })
    ]);
    c.appendChild(head);
    var body = el("div", { class: "exbody" });
    c.appendChild(body);
    if (ex.nota) body.appendChild(el("p", { class: "note", text: ex.nota }));
    if (ex.link) body.appendChild(el("a", { class: "vid", href: ex.link, target: "_blank", rel: "noopener", text: "Ver vídeo del ejercicio" }));
    ex.series.forEach(function (s, si) {
      var S = setLog(ex, si);
      var row = el("div", { class: "set" + (S.reps ? " filled" : "") });
      function save() { row.classList.toggle("filled", !!S.reps); persist(); sum.textContent = foldSummary(ex); refreshV(); }
      function upd(k) { return function (v) { S[k] = v; save(); }; }
      row.appendChild(el("div", { class: "sethead" }, [
        el("span", { class: "sn", text: setLabel(ex, si) }),
        s.r ? el("span", { class: "obj" }, [el("b", { text: s.r }), " reps"]) : null,
        el("span", { class: "rest", text: s.d ? "Descanso " + s.d : "" })
      ]));
      var P = prevSet(ex, si);
      if (ex.uni) row.appendChild(el("div", { class: "grid2" }, [
        field("Brazo / pierna", select(["Brazo", "Pierna"], S.lim, upd("lim"), "Elige")),
        field("Lado", select(["Izquierdo", "Derecho"], S.lado, upd("lado"), "Elige"))
      ]));
      var reps = input({ type: "number", inputmode: "numeric", min: "0", step: "1", value: S.reps || "", placeholder: P ? String(P.reps) : s.r, oninput: function () { upd("reps")(reps.value); } });
      var kg = input({ type: "number", inputmode: "decimal", min: "0", step: "0.5", value: S.kg || "", placeholder: P && P.kg ? String(P.kg) : "kg", oninput: function () { upd("kg")(kg.value); } });
      if (P) {
        var txt = "Semana pasada: " + P.reps + " reps" + (P.kg ? " × " + kgTxt(P.kg) + " kg" : "") + (P.rir !== undefined && P.rir !== "" ? " · RIR " + P.rir : "") + (ex.uni && P.lado ? " · " + P.lado.toLowerCase() : "");
        if (ST.readOnly) row.appendChild(el("p", { class: "prevhint", text: txt }));
        else row.appendChild(el("button", { type: "button", class: "prevhint", title: "Copiar reps y kilos de la semana pasada", onclick: function () {
          reps.value = P.reps; S.reps = String(P.reps);
          if (P.kg) { kg.value = P.kg; S.kg = String(P.kg); }
          if (ex.uni) { if (P.lim && !S.lim) S.lim = P.lim; if (P.lado && !S.lado) S.lado = P.lado; }
          save(); if (ex.uni) render();
        } }, [el("span", { text: txt }), el("b", { text: "Usar" })]));
      }
      row.appendChild(el("div", { class: "grid4" }, [
        field("Reps", reps), field("Kg", kg),
        field("RIR", select(range(0, 6).map(function (n) { return { v: n, t: n === 6 ? "6+" : String(n) }; }), S.rir, upd("rir"))),
        field("Fatiga", select(range(1, 10), S.fat, upd("fat")))
      ]));
      var com = input({ type: "text", value: S.com || "", placeholder: ST.readOnly ? "" : "Comentario (opcional)", oninput: function () { upd("com")(com.value); } });
      var tecWrap = el("div", { class: "tecwrap" }, [tecBlock(S, save)]);
      row.appendChild(el("div", { class: "grid2 last" }, [field("Técnica", select(TECNICAS, S.tec, function (v) {
        S.tec = v; save(); tecWrap.innerHTML = ""; var b = tecBlock(S, save); if (b) tecWrap.appendChild(b);
      }, "Ninguna")), field("Nota de la serie", com)]));
      row.appendChild(tecWrap);
      body.appendChild(row);
    });
    refreshV();
    var ta = el("textarea", { rows: "2", placeholder: ST.readOnly ? "" : "¿Cómo te ha ido este ejercicio? Molestias, sensaciones…", oninput: function () { E.com = ta.value; persist(); } });
    ta.value = E.com || ""; if (ST.readOnly) ta.disabled = true;
    body.appendChild(field("Comentario del ejercicio", ta, "block"));
    body.appendChild(el("button", { class: "btn ghost foldbtn", type: "button", text: "✓ Plegar ejercicio", onclick: toggle }));
    if (ex.extra && !ST.readOnly) body.appendChild(el("div", { class: "extraacts" }, [
      el("button", { class: "btn ghost", type: "button", text: "+ Añadir serie", onclick: function () { ex.series.push({ r: "", d: "" }); persist(); render(); } }),
      el("button", { class: "btn ghost danger", type: "button", text: "Quitar ejercicio", onclick: function () {
        if (!window.confirm("¿Quitar «" + ex.n + "» y lo que has apuntado en él?")) return;
        var L = dayLog(); L.extra = (L.extra || []).filter(function (e) { return e.id !== ex.id; }); if (L.ej) delete L.ej[ex.id]; persist(); render();
      } })
    ]));
    return c;
  }
  var addOpen = false;
  function extraHead() {
    var L = dayLog();
    var nm = input({ type: "text", value: L.nombre || "", placeholder: "Por ejemplo: Cardio, partido, brazos…", oninput: function () { L.nombre = nm.value; persist(); } });
    return el("section", { class: "card" }, [
      el("h2", { text: "Entreno no pautado" }),
      el("p", { class: "meta", text: ST.readOnly ? "Lo ha añadido el cliente por su cuenta." : (CFG.ENTRENADOR || "Tu entrenador") + " lo verá marcado como extra." }),
      field("Nombre del entreno", nm, "block"),
      ST.readOnly ? null : el("button", { class: "btn ghost danger", type: "button", text: "Quitar este entreno", onclick: function () {
        if (!window.confirm("¿Quitar este entreno y lo que has apuntado en él?")) return;
        L.borrado = true; persist(); UI.d = 0; render(); window.scrollTo(0, 0);
      } })
    ]);
  }
  function addExtraBlock() {
    if (!addOpen) return el("button", { class: "btn ghost wide", type: "button", text: "+ Añadir ejercicio no pautado", onclick: function () { addOpen = true; render(); } });
    var names = {}; ST.PLAN.semanas.forEach(function (w) { w.dias.forEach(function (d) { d.ej.forEach(function (e) { names[e.n] = true; }); }); });
    var dl = el("datalist", { id: "exnames" }, Object.keys(names).sort().map(function (n) { return el("option", { value: n }); }));
    var nm = el("input", { type: "text", list: "exnames", placeholder: "Nombre del ejercicio", autocomplete: "off" });
    var v = { g: "", n: "3", u: "no" };
    var err = el("p", { class: "err" });
    return el("section", { class: "card" }, [
      el("h2", { text: "Añadir ejercicio no pautado" }), dl,
      field("Ejercicio", nm, "block"),
      el("div", { class: "grid3" }, [
        field("Grupo", select(GROUPS, "", function (x) { v.g = x; }, "Sin grupo")),
        field("Series", select(range(1, 8), "3", function (x) { v.n = x; })),
        field("Tipo", select([{ v: "no", t: "Bilateral" }, { v: "si", t: "Unilateral" }], "no", function (x) { v.u = x; }))
      ]),
      err,
      el("div", { class: "extraacts" }, [
        el("button", { class: "btn primary", type: "button", text: "Añadir", onclick: function () {
          var n = nm.value.trim(); if (!n) { err.textContent = "Escribe el nombre del ejercicio."; return; }
          var L = dayLog(); L.extra = L.extra || [];
          L.extra.push({ id: "x" + uid(), n: n, uni: v.u === "si", nota: "", g: v.g ? [v.g] : [], extra: true, series: range(1, +v.n || 3).map(function () { return { r: "", d: "" }; }) });
          addOpen = false; persist(); render();
        } }),
        el("button", { class: "btn ghost", type: "button", text: "Cancelar", onclick: function () { addOpen = false; render(); } })
      ])
    ]);
  }
  // ================= ANTES DE EMPEZAR (movilidad + aproximación) =================
  var MOVILIDAD = [
    ["Gato-camello con respiración", "8"],
    ["Rotación torácica a cuatro patas", "8 por lado"],
    ["90/90 de cadera", "6 por lado"],
    ["Flexor de cadera: rodilla apoyada y brazo arriba", "30 s por lado"],
    ["Tobillo: rodilla a la pared", "10 por lado"],
    ["Dislocaciones de hombro con banda o pica", "10"],
    ["Deslizamientos en la pared (wall slides)", "10"],
    ["Puente de glúteo", "10"]
  ];
  function prepCard() {
    function block(key, title, kids) {
      var stored = lsGet("eyl-prep-" + key, null);
      var det = el("details", { class: "prepblock" }, [el("summary", null, [el("span", { text: title })])].concat(kids));
      det.open = stored == null ? true : !!stored;
      det.addEventListener("toggle", function () { lsSet("eyl-prep-" + key, det.open); });
      return det;
    }
    var mov = el("ol", { class: "preplist" }, MOVILIDAD.map(function (m) { return el("li", null, [el("span", { text: m[0] }), el("b", { text: m[1] })]); }));
    var apr = el("ol", { class: "preplist" }, [
      el("li", null, [el("span", { text: "Serie 1 con el 50 % del peso de trabajo" }), el("b", { text: "× 10" })]),
      el("li", null, [el("span", { text: "Serie 2 con el 70 %" }), el("b", { text: "× 5" })]),
      el("li", null, [el("span", { text: "Serie 3 con el 85 % (solo en los pesados: hip thrust, prensa, press, peso muerto…)" }), el("b", { text: "× 2-3" })])
    ]);
    return el("section", { class: "card prep", "aria-label": "Antes de empezar" }, [
      el("h2", { text: "Antes de empezar" }),
      block("apr", "🔥 Series de aproximación: no empieces en frío", [
        el("p", { class: "prepkey", text: "Sirven para calentar y preparar el movimiento, no para cansarte. Tienen que ser fáciles: si te fatigan, te quitan fuerza para las series buenas." }),
        el("p", { class: "meta", text: "En el primer ejercicio de cada grupo muscular, antes de tus series:" }),
        apr,
        el("p", { class: "meta", text: "En los siguientes ejercicios del mismo grupo, basta con 1 serie ligera. Las aproximaciones no se apuntan: las series de la pauta empiezan después." })
      ]),
      block("mov", "🧘 Movilidad · 8-10 min, en casa o en el gimnasio", [
        el("p", { class: "prepkey", text: "Es parte de tu plan, no un extra. Hazla antes de entrenar o en casa los días de descanso." }),
        mov,
        el("p", { class: "meta", text: "Sin dolor y sin forzar: busca moverte mejor, no llegar más lejos." })
      ])
    ]);
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
      L.terminado = Date.now(); persist(); flushSaves(); flash(ST.coachWrite ? "Entreno guardado en el registro de " + (ST.client.nombre || "tu cliente") + "." : "¡Entreno guardado! " + (CFG.ENTRENADOR || "Tu entrenador") + " ya lo puede ver.");
      render();
    } });
    return el("div", { class: "send" }, [btn, el("p", { class: "sent", text: ST.coachWrite ? "Todo se guarda solo mientras escribes. Al terminar, pulsa el botón para marcar el entreno como hecho." : "Todo se guarda solo mientras escribes. Al terminar, pulsa el botón para avisar de que has acabado." })]);
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
    var rows = dayEx(d).map(function (ex) {
      var now = exStats(UI.w, UI.d, ex), p = findPrev(ex);
      if (p) anyPrev = true;
      function cell(v, pv, unit, f) {
        return el("td", null, [el("b", { text: now.any ? f(v) : "—" }), p ? el("small", { text: "antes " + f(pv) }) : null, now.any && p ? delta(v, pv, unit) : null]);
      }
      var k = function (x) { return x ? num(x) : "—"; }, n = function (x) { return num(x); }, dv = ex.uni ? 2 : 1;
      return el("tr", null, [el("th", { scope: "row", text: ex.n + (ex.uni ? " (por lado)" : "") }), cell(now.sets / dv, p && p.st.sets / dv, "", n),cell(now.reps / dv, p && p.st.reps / dv, "", n), cell(now.kg, p && p.st.kg, "kg", k)]);
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
    var w = UI.w, dias = week().dias, used = {}, plan = {}, done = {}, bodyPlan = [], bodyDone = [];
    dias.forEach(function (d, di) { d.ej.forEach(function (ex) {
      var div = ex.uni ? 2 : 1, st = exStats(w, di, ex);
      bodyPlan.push({ n: ex.n, g: ex.g, sets: ex.series.length / div }); bodyDone.push({ n: ex.n, g: ex.g, sets: st.sets / div });
      groupsOf(ex).forEach(function (g) {
        used[g] = true; plan[g] = plan[g] || []; done[g] = done[g] || [];
        plan[g][di] = (plan[g][di] || 0) + ex.series.length / div;
        done[g][di] = (done[g][di] || 0) + st.sets / div;
      });
    }); });
    var xi = dias.length, hasX = false;
    Object.keys(ST.LOG).forEach(function (k) {
      var p = k.split("-"), L = ST.LOG[k]; if (+p[0] !== w || L.borrado) return;
      (L.extra || []).forEach(function (ex) {
        var div = ex.uni ? 2 : 1, st = exStats(w, +p[1], ex); if (!st.sets) return; hasX = true;
        bodyDone.push({ n: ex.n, g: ex.g, sets: st.sets / div });
        groupsOf(ex).forEach(function (g) { used[g] = true; plan[g] = plan[g] || []; done[g] = done[g] || []; done[g][xi] = (done[g][xi] || 0) + st.sets / div; });
      });
    });
    var groups = GROUPS.concat(["Sin grupo"]).filter(function (g) { return used[g]; });
    var head = [el("th", { text: "Grupo" })];
    dias.forEach(function (d, i) { head.push(el("th", { text: "Día " + (i + 1) })); });
    if (hasX) head.push(el("th", { text: "Extra" }));
    head.push(el("th", { class: "tot", text: "Semana" }));
    var max = 0; groups.forEach(function (g) { max = Math.max(max, sum(plan[g])); });
    var body = groups.map(function (g) {
      var tds = [el("th", { scope: "row", text: g })];
      dias.forEach(function (d, i) {
        var p = (plan[g] || [])[i] || 0, h = (done[g] || [])[i] || 0;
        tds.push(el("td", { class: p ? (h >= p ? "full" : h > 0 ? "part" : "") : "zero" }, p ? [el("b", { text: num(h) }), el("small", { text: "/" + num(p) })] : ["·"]));
      });
      if (hasX) { var hx = (done[g] || [])[xi] || 0; tds.push(el("td", { class: hx ? "full" : "zero" }, hx ? [el("b", { text: num(hx) })] : ["·"])); }
      // la semana compara lo pautado hecho con lo pautado; lo no pautado se suma aparte («+N extra»)
      var tp = sum(plan[g]), th = sum((done[g] || []).slice(0, xi)), tx = (done[g] || [])[xi] || 0;
      tds.push(el("td", { class: "tot" }, [tp ? el("b", { text: num(th) }) : null, tp ? el("small", { text: "/" + num(tp) }) : null,
        tx ? el("small", { class: "xtra", text: (tp ? " +" : "") + num(tx) + " extra" }) : null,
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
      window.EYLCuerpo ? window.EYLCuerpo.card({ done: bodyDone, plan: bodyPlan, title: "Mapa muscular · Semana " + (w + 1) }) : null,
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
          rows.push({ w: w, st: st, planned: ex ? ex.series.length : 0, dv: ex && ex.uni ? 2 : 1 });
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
            el("span", { class: "pstat", text: has ? num(st.sets / r.dv) + "/" + num(r.planned / r.dv) + (r.dv > 1 ? " ser/lado" : " ser") : "—" }),
            el("span", { class: "pstat", text: has ? num(st.reps / r.dv) + (r.dv > 1 ? " reps/lado" : " reps") : "" }),
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
    var xs = [];
    Object.keys(ST.LOG).forEach(function (k) {
      var p = k.split("-"), L = ST.LOG[k]; if (L.borrado) return;
      (L.extra || []).forEach(function (ex) { var st = exStats(+p[0], +p[1], ex); if (st.any) xs.push({ w: +p[0], f: L.fecha || "", ex: ex, st: st, ses: +p[1] >= 100 ? (L.nombre || "Entreno extra") : "Día " + (+p[1] + 1) }); });
    });
    if (xs.length) {
      xs.sort(function (a, b) { return a.w - b.w || (a.f < b.f ? -1 : 1); });
      main.appendChild(el("h3", { class: "dayhead", text: "No pautado" }));
      main.appendChild(el("section", { class: "card" }, [el("div", { class: "tablewrap" }, [el("table", { class: "ptable" }, [
        el("thead", null, [el("tr", null, [el("th", { text: "Ejercicio" }), el("th", { text: "Cuándo" }), el("th", { text: "Series" }), el("th", { text: "Kg máx" })])]),
        el("tbody", null, xs.map(function (x) {
          return el("tr", null, [el("th", { scope: "row", text: x.ex.n }), el("td", { text: "S" + (x.w + 1) + " · " + x.ses }), el("td", { text: String(x.st.sets) }), el("td", { text: x.st.kg ? num(x.st.kg) : "—" })]);
        }))])])]));
    }
    return main;
  }

  // ================= COACH: EDIT PLAN =================
  function coachBar() {
    var bar = el("div", { class: "coachbar" });
    if (!ST.editing && ST.coachWrite) {
      bar.appendChild(el("button", { class: "btn primary", type: "button", text: "Terminar de apuntar", onclick: function () {
        if (Object.keys(pending).length) flushSaves();
        ST.coachWrite = false; ST.readOnly = true; flash("Listo. Vuelves a ver sus registros."); render();
      } }));
    } else if (!ST.editing) {
      bar.appendChild(el("button", { class: "btn dark", type: "button", text: "Editar pauta", onclick: function () { ST.editing = true; UI.view = "entreno"; render(); } }));
      bar.appendChild(el("button", { class: "btn ghost", type: "button", text: "Apuntar por el cliente", onclick: function () {
        var b = this; b.disabled = true; b.textContent = "Cargando…";
        api.getLogs(ST.clientId).then(function (rows) {
          ST.LOG = {}; (rows || []).forEach(function (row) { ST.LOG[row.semana + "-" + row.dia] = row.data; });
          ST.coachWrite = true; ST.readOnly = false; UI.view = "entreno"; render(); window.scrollTo(0, 0);
        }, function (x) { b.disabled = false; b.textContent = "Apuntar por el cliente"; flash(errMsg(x)); });
      } }));
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
