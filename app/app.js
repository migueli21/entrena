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
      ST.follow = followInfo(r[3] || [], r[5] || []);
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
  // ---- notas que faltan: entrenos de los últimos 14 días sin nota y semana anterior sin cerrar ----
  function followInfo(checks, logs) {
    var out = {}, cur = isoMonday(new Date()), pd = new Date(); pd.setDate(pd.getDate() - 7);
    var prev = isoMonday(pd), prevEnd = cur, ck = {};
    checks.forEach(function (r) { ck[r.cliente_id] = r.ck || {}; });
    logs.forEach(function (r) {
      var L = r.data || {}; if (L.borrado) return;
      var sets = Object.keys(L.ej || {}).some(function (k) { return ((L.ej[k] || {}).s || []).some(function (S) { return S && parseFloat(S.reps) > 0; }); });
      if (!sets && !L.terminado) return;
      var o = out[r.cliente_id] || (out[r.cliente_id] = { sinNota: 0, prevTrained: false });
      if (!(L.sesion && L.sesion.sen)) o.sinNota++;
      var f = L.fecha || (r.updated_at || "").slice(0, 10);
      if (f >= prev && f < prevEnd) o.prevTrained = true;
    });
    Object.keys(out).forEach(function (id) {
      var c = ck[id] || {}, nx = c[cur];
      out[id].ciPend = out[id].prevTrained && !c[prev] && !(nx && !nx.sem);
    });
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
      var pain = ST.pain && ST.pain[c.id], stage = ST.stage && ST.stage[c.id], fw = ST.follow && ST.follow[c.id];
      var info = [el("b", { text: c.nombre || c.email }), el("small", { text: c.email + (c.activo ? "" : " · pausado") })];
      if (stage) info.push(el("span", { class: "stagetag", text: stage }));
      if (pain) info.push(el("ul", { class: "painlist" }, pain.items.slice(0, 3).map(function (it) { return el("li", { class: it.lvl, text: it.txt }); })
        .concat(pain.items.length > 3 ? [el("li", { class: "more", text: "+" + (pain.items.length - 3) + " más" })] : [])));
      list.appendChild(el("button", { class: "client" + (pain ? " haspain " + pain.lvl : ""), type: "button", onclick: function () { openClient(c, true); } }, [
        el("div", null, info),
        el("div", { class: "pills" }, (pain ? [el("span", { class: "pill " + (pain.lvl === "bad" ? "bad" : "warn"), text: pain.lvl === "bad" ? "Dolor" : "Molestias" })] : []).concat([pill])
          .concat(fw && fw.sinNota ? [el("span", { class: "pill warn", text: fw.sinNota + (fw.sinNota === 1 ? " entreno" : " entrenos") + " sin nota" })] : [])
          .concat(fw && fw.ciPend ? [el("span", { class: "pill warn", text: "Semana sin cerrar" })] : []))
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
    if (!asCoach && /^(mas|nutri|segui|ciclo)$/.test(UI.view)) UI.view = "entreno"; // el cliente siempre entra por su entreno
    ST.cicloTab = asCoach ? null : lsGet("eyl-ciclotab-" + c.id, null); // pestaña «Mi ciclo» solo para mujeres (se confirma al leer sus datos)
    if (!asCoach) checkCicloTab(c);
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
      if (!asCoach) loadSG();
      render();
    }).catch(function (x) { shell([topbar(), el("p", { class: "err", text: errMsg(x) })]); });
  }
  function checkCicloTab(c) {
    if (!window.EYLNutri || !window.EYLNutri.isWoman || !api.sb) return;
    window.EYLNutri.isWoman({ sb: api.sb, client: c }).then(function (t) {
      if (t === null || ST.clientId !== c.id || ST.mode === "entrenador") return;
      t = t || null; lsSet("eyl-ciclotab-" + c.id, t);
      if (t !== ST.cicloTab) { ST.cicloTab = t; if (ST.PLAN && document.querySelector("header.top.withseg")) render(); }
    });
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
  function dayEx(d) { var L = ST.LOG[logKey()]; return d.ej.filter(function (e) { return !e.act; }).concat((L && L.extra) || []); } // la activación va en «Antes de empezar»
  function dayAct(d) { return (d.ej || []).filter(function (e) { return e.act; }); }
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
    persistKey(logKey());
    refreshProgress();
  }
  function persistKey(k) {
    if (ST.readOnly || !ST.LOG[k]) return;
    ST.LOG[k].editado = Date.now();
    if (ST.coachWrite) ST.LOG[k].porEntrenador = Date.now(); else lsSet(cacheKey(), ST.LOG);
    queueSave(k);
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
    if (UI.view === "ciclo" && ST.cicloTab && !ST.editing) {
      kids.push(cicloView());
    } else if (UI.view === "mas" && !ST.editing) {
      kids.push(masView());
    } else if (UI.view === "nutri" && !ST.editing) {
      if (ST.mode !== "entrenador") kids.push(backToMas());
      kids.push(nutriView());
    } else if (UI.view === "segui" && !ST.editing) {
      if (ST.mode !== "entrenador") kids.push(backToMas());
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
      if (!ST.editing && ST.mode !== "entrenador" && !ST.readOnly) { var wr = weekReminder(), nr = noteReminder(); if (wr) main.appendChild(wr); if (nr) main.appendChild(nr); }
      if (!ST.editing && ST.readOnly && !ST.coachWrite) { var cn = coachNoteCard(); if (cn) main.appendChild(cn); }
      if (d.libre && !ST.editing) main.appendChild(extraHead());
      if (!ST.editing && window.EYLNutri && api.sb) main.appendChild(window.EYLNutri.cycleBanner({ sb: api.sb, client: ST.client, go: ST.mode === "entrenador" ? null : function () { UI.view = ST.cicloTab ? "ciclo" : "nutri"; render(); window.scrollTo(0, 0); } }));
      if (!ST.editing && window.EYLEtapa && api.sb) main.appendChild(window.EYLEtapa.banner({ sb: api.sb, client: ST.client, coach: ST.mode === "entrenador", flash: flash }));
      if (!ST.editing && window.EYLAviso && api.sb) { // aviso del entrenador: el cliente lo lee arriba; el entrenador lo escribe aquí
        if (ST.mode === "entrenador" && !ST.coachWrite) main.appendChild(window.EYLAviso.coachCard({ sb: api.sb, client: ST.client, plan: ST.PLAN, flash: flash,
          save: function () { return api.savePlan(ST.clientId, ST.PLAN); }, rerender: render }));
        else if (ST.mode !== "entrenador") main.appendChild(window.EYLAviso.clientCard({ sb: api.sb, client: ST.client, plan: ST.PLAN, flash: flash, coachName: CFG.ENTRENADOR }));
      }
      if (!ST.editing && list.length && !d.libre && UI.d < 100) { var gc = goalCard(d); if (gc) main.appendChild(gc); main.appendChild(briefCard(d)); }
      if (!ST.editing && ST.mode !== "entrenador" && !ST.readOnly && window.EYLHoy && api.sb) main.appendChild(window.EYLHoy.card({ sb: api.sb, client: ST.client, flash: flash,
        go: function (view, k) { UI.view = view; UI.sgTab = k === "checkin" ? "checkin" : null; render(); window.scrollTo(0, 0); } }));
      if (!ST.editing && (list.length || dayAct(d).length)) main.appendChild(prepCard(d));
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
    var tab = UI.sgTab; UI.sgTab = null;
    return window.EYLSegui.view({ sb: api.sb, coach: ST.mode === "entrenador", client: ST.client, flash: flash, tab: tab });
  }
  // Clienta: «Mi ciclo» reúne la cuenta atrás, las fases y su etapa (menopausia, embarazo o posparto).
  function cicloView() {
    var main = el("main", { class: "day ciclo" });
    if (window.EYLNutri && window.EYLNutri.cycleView && api.sb) main.appendChild(window.EYLNutri.cycleView({ sb: api.sb, client: ST.client, flash: flash }));
    if (window.EYLEtapa && window.EYLEtapa.page && api.sb) main.appendChild(window.EYLEtapa.page({ sb: api.sb, client: ST.client, flash: flash, onChange: function () { checkCicloTab(ST.client); if (UI.view === "ciclo") render(); } }));
    return main;
  }
  // Cliente: Nutrición y Control quedan dentro de «Más» para que el inicio sea solo el entreno.
  function masView() {
    function item(icon, t, s, view) {
      return el("button", { type: "button", class: "masitem", onclick: function () { UI.view = view; render(); window.scrollTo(0, 0); } }, [
        el("span", { class: "masi", "aria-hidden": "true", text: icon }),
        el("span", { class: "mast" }, [el("b", { text: t }), el("small", { text: s })]),
        el("span", { class: "chev", "aria-hidden": "true", text: "›" })]);
    }
    return el("main", { class: "day mas" }, [
      el("p", { class: "maslead", text: "Lo importante está en Entreno. Aquí tienes lo demás, para cuando lo necesites." }),
      item("🍽️", "Nutrición", "Tu plan de comidas, peso, medidas y fotos", "nutri"),
      item("📋", "Control", "Check-in semanal, tests y qué hacer si algo duele", "segui")
    ]);
  }
  function backToMas() {
    return el("div", { class: "masback" }, [el("button", { type: "button", class: "btn ghost", text: "‹ Más", onclick: function () { UI.view = "mas"; render(); window.scrollTo(0, 0); } })]);
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
      ].concat(ST.mode === "entrenador" ? [
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "nutri"), class: UI.view === "nutri" ? "on" : "", text: "Nutrición", onclick: function () { UI.view = "nutri"; render(); } }),
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "segui"), class: UI.view === "segui" ? "on" : "", text: "Control", onclick: function () { UI.view = "segui"; render(); } })
      ] : (ST.cicloTab ? [
        el("button", { type: "button", role: "tab", "aria-selected": String(UI.view === "ciclo"), class: UI.view === "ciclo" ? "on" : "", text: ST.cicloTab, onclick: function () { UI.view = "ciclo"; render(); window.scrollTo(0, 0); } })
      ] : []).concat([
        el("button", { type: "button", role: "tab", "aria-selected": String(/^(mas|nutri|segui)$/.test(UI.view)), class: /^(mas|nutri|segui)$/.test(UI.view) ? "on" : "", text: "Más", onclick: function () { UI.view = "mas"; render(); } })
      ])))
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
    var tq = E.tq, late = isLate(ex, true), sh = orderShift(ex);
    if (pct > 0.02) return { c: "up", t: "🟢 Mejoras: " + det + (tq === "mejor" ? " y con mejor técnica" : "") + "." };
    if (tq === "mejor" && pct >= -0.05) return { c: "up", t: "🟢 Mejoras en técnica" + (pct < -0.02 ? ", aunque bajas un poco (" + det + ")" : ", con el mismo rendimiento") + ". También es progresar." };
    var tqBad = tq === "peor" ? " Técnica peor que la última vez: mejor algo menos de peso y hacerlo bien." : "";
    if (pct < -0.02) {
      if (isDeload(day())) return { c: "eq", t: "🟡 Semana de descarga: toca ir más suave, es lo previsto." };
      var stLate = starEx(day()) && starEx(day()).id === ex.id && sh >= 1 ? " Es tu ejercicio estrella: hazlo al principio, en fresco." : "";
      if (late && pct >= -0.05) return { c: "eq", t: "🟡 Baja un poco (" + det + "): " + (sh >= 2 ? "hoy lo hiciste " + sh + " puestos más tarde que la última vez, con más fatiga acumulada." : "normal al final de la sesión, con la fatiga acumulada.") + stLate + tqBad };
      return { c: "down", t: "🟠 Baja un poco (" + det + ")." + (sh >= 2 ? " Hoy lo hiciste " + sh + " puestos más tarde que la última vez: llegar más cansado resta fuerza." : late ? " Va al final de la sesión: la fatiga acumulada cuenta." : " Revisa descanso, sueño o fatiga; un día flojo es normal.") + stLate + tqBad };
    }
    if (late) return { c: "up", t: "🟢 Mantener aquí está bien: va al final de la sesión, con fatiga acumulada" + (sameKg ? "" : " (" + det + ")") + "." + tqBad };
    return { c: "eq", t: "🟡 Te mantienes: mismo rendimiento que la última vez" + (sameKg ? "" : " (" + det + ")") + "." + tqBad };
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
    // s = el objetivo en corto (sale dentro del ejercicio); t = con el nombre (sale en «Lo importante de hoy»)
    function out(p, ico, s) { return { p: p, ico: ico, s: s, t: ico + " " + ex.n + ": " + s }; }
    if (allTop && kg) { var nk = kg + stepKg(kg, ex, kgs); return out(1, "⬆️", "sube de " + kgTxt(kg) + " a " + kgTxt(nk) + " kg y vuelve a " + min + " reps."); }
    if (allTop) return out(1, "⬆️", "llegaste arriba del rango; añade dificultad (más peso o más lento).");
    if (anyLow) return out(3, "➡️", "mantén " + (kg ? kgTxt(kg) + " kg" : "el peso") + " y busca llegar a " + min + " reps en todas las series.");
    if (isLate(ex)) return out(2, "➕", "mismo peso" + (kg ? " (" + kgTxt(kg) + " kg)" : "") + ": mejor técnica o 1 rep más. Va al final, con fatiga: mantener ya está bien.");
    return out(2, "➕", "mismo peso" + (kg ? " (" + kgTxt(kg) + " kg)" : "") + ", intenta 1 rep más por serie (hasta " + max + ").");
  }
  function briefItems(d) {
    var out = [], rir = null, st = starEx(d);
    if (d.obj) out.push({ k: "goal", t: "🎯 Objetivo de la sesión: " + d.obj });
    if (st) out.push({ k: "goal", t: "⭐ Ejercicio estrella: " + st.n + ". Es la prioridad de hoy: dale tu mejor esfuerzo y tu mejor técnica." });
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
    var exs = items.filter(function (x) { return x.k === "ex"; }), plan = items.filter(function (x) { return x.k === "plan" || (x.k === "goal" && limit); }); // en la tarjeta del día, objetivo y estrella ya van arriba
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
    var isStar = !ex.extra && starEx(day()) && starEx(day()).id === ex.id;
    var c = el("section", { class: "card exc" + (folded ? " folded" : "") + (isStar ? " star" : "") });
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
    var goal = null; // objetivo de hoy en el propio ejercicio (el mismo que en «Lo importante de hoy»)
    if (!ex.extra && !ex.simple) {
      var dd0 = day(), gtxt = null;
      if (isDeload(dd0)) gtxt = "🔋 Semana de descarga: mismo peso o algo menos y más reps en recámara.";
      else { var sg = suggestion(ex); if (sg) gtxt = sg.ico + " Hoy: " + sg.s;
        else { var rg0 = ex.series[0] && repRange(ex.series[0].r); if (rg0) gtxt = "🆕 Hoy: elige un peso con el que hagas " + (rg0[0] === rg0[1] ? rg0[0] : rg0[0] + "-" + rg0[1]) + " reps con el RIR de la nota."; } }
      if (gtxt) goal = el("p", { class: "exgoal", text: gtxt });
    }
    var ordTag = null; // orden real en que lo hizo el cliente (solo lo ve el entrenador)
    if (ST.readOnly && !ST.coachWrite) {
      var oi = orderInfo(UI.w, UI.d), rp = oi && oi.pos[ex.id], pp = oi && oi.planPos[ex.id];
      if (rp) ordTag = el("p", { class: "ordtag" + (pp && rp !== pp ? " moved" : ""), text: "🔢 Hecho " + rp + ".º" + (pp ? (rp !== pp ? " · en el plan va " + pp + ".º" : " · como en el plan") : "") + (oi.fiable ? "" : " · orden poco fiable") });
    }
    function refreshV() { var v = verdict(ex); vd.className = "verdict" + (v ? " " + v.c : ""); vd.textContent = v ? v.t : ""; vd.hidden = !v; }
    var head = el("div", { class: "cardhead foldable", role: "button", tabindex: "0", "aria-expanded": String(!folded), onclick: toggle,
      onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } } }, [
      el("span", { class: "idx", text: String(i + 1) }),
      el("div", { class: "titles" }, [
        isStar ? el("span", { class: "startag", text: "⭐ Ejercicio estrella" }) : null,
        el("h2", { text: ex.n }),
        el("p", { class: "meta", text: (ex.extra ? "No pautado · " : "") + seriesText(ex) + ((ex.g || []).length ? " · " + ex.g.join(", ") : "") + (ex.uni ? " · unilateral: elige brazo o pierna y lado" : "") }),
        ordTag, goal, sum, vd
      ]),
      el("span", { class: "chev", "aria-hidden": "true", text: "▾" })
    ]);
    c.appendChild(head);
    var body = el("div", { class: "exbody" });
    c.appendChild(body);
    if (ex.nota) body.appendChild(el("p", { class: "note", text: ex.nota }));
    if (window.EYLHoy) { var como = window.EYLHoy.block(ex, ST.clientId); if (como) body.appendChild(como); }
    if (ex.link) body.appendChild(el("a", { class: "vid", href: ex.link, target: "_blank", rel: "noopener", text: "Ver vídeo del ejercicio" }));
    ex.series.forEach(function (s, si) {
      var S = setLog(ex, si);
      var row = el("div", { class: "set" + (S.reps ? " filled" : "") });
      function save() { if (S.reps) stamp(E); row.classList.toggle("filled", !!S.reps); persist(); sum.textContent = foldSummary(ex); refreshV(); }
      function upd(k) { return function (v) { S[k] = v; save(); }; }
      row.appendChild(el("div", { class: "sethead" }, [
        el("span", { class: "sn", text: setLabel(ex, si) }),
        s.r ? el("span", { class: "obj" }, [el("b", { text: s.r }), /^[\d\s\-–]+$/.test(String(s.r)) ? " reps" : ""]) : null, // «20 s» o «4 × 20 s» no son reps
        el("span", { class: "rest", text: s.d && !ex.simple ? "Descanso " + s.d : "" })
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
      if (ex.simple) { // potencia, saltos, circuito: solo reps y kilos (sin RIR, fatiga, técnica ni descanso por serie)
        row.appendChild(el("div", { class: "grid2 last" }, [field("Reps", reps), field("Kg", kg)]));
        body.appendChild(row); return;
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
    if (!ex.simple) body.appendChild(el("div", { class: "nq tq" }, [el("span", { class: "nql", text: "Técnica hoy frente a la última vez (opcional)" }),
      taps([["peor", "👎", "Peor"], ["igual", "➖", "Igual"], ["mejor", "👍", "Mejor"]], E.tq, function (v) { E.tq = v; persist(); refreshV(); }, "aj", "Técnica hoy", ST.readOnly)]));
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
  function prepCard(d) {
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
    var acts = d ? dayAct(d) : [];
    function dosis(ex) {
      var k = (ex.series || []).length, r = ex.series && ex.series[0] ? ex.series[0].r : "";
      if (ex.uni) k = Math.ceil(k / 2);
      return (k > 1 ? k + " × " : "") + (r || "") + (ex.uni && !/lado/.test(r) ? " por lado" : "");
    }
    var actBlock = acts.length ? block("act", "🎯 Activación · antes de entrenar", [
      el("p", { class: "prepkey", text: "Prepara el cuerpo para lo de hoy. Suave y con control: no se apunta." }),
      el("ol", { class: "preplist act" }, acts.map(function (ex) {
        var nm = String(ex.n || "").replace(/^activaci[oó]n:\s*/i, "");
        return el("li", null, [el("span", null, [el("span", { text: nm }), ex.nota ? el("small", { class: "actnota", text: ex.nota.replace(/^(RIR[^.]*\.|Descarga[^.]*\.)\s*/i, "") }) : null]), el("b", { text: dosis(ex) })]);
      }))
    ]) : null;
    return el("section", { class: "card prep", "aria-label": "Antes de empezar" }, [
      el("h2", { text: "Antes de empezar" }),
      actBlock,
      block("apr", "🔥 Series de aproximación: no empieces en frío", [
        el("p", { class: "prepkey", text: "Sirven para calentar y preparar el movimiento, no para cansarte. Tienen que ser fáciles: si te fatigan, te quitan fuerza para las series buenas." }),
        el("p", { class: "meta", text: "En el primer ejercicio de cada grupo muscular, antes de tus series:" }),
        apr,
        el("p", { class: "meta", text: "En los siguientes ejercicios del mismo grupo, basta con 1 serie ligera. Las aproximaciones no se apuntan: las series de la pauta empiezan después." })
      ]),
      (function () {
        var R = window.EYLMov && d ? window.EYLMov.render(d.ej || [], ST.PLAN && ST.PLAN.movNo) : null;
        return block("mov", R ? "🧘 Movilidad · " + R.n + " ejercicios, unos 8 min" : "🧘 Movilidad · 8-10 min, en casa o en el gimnasio", [
          el("p", { class: "prepkey", text: "Es parte de tu plan, no un extra. Hazla antes de entrenar o en casa los días de descanso." })
        ].concat(R ? R.nodes : [mov]).concat([
          el("p", { class: "meta", text: "Sin dolor y sin forzar: busca moverte mejor, no llegar más lejos." })
        ]));
      })()
    ]);
  }
  // ================= ORDEN REAL, NOTA DEL ENTRENO Y CIERRE DE SEMANA =================
  // Orden real: hora de la primera serie apuntada de cada ejercicio (E.t1). Si lo apunta el entrenador (E.tc) o se apunta
  // todo de golpe (3 o más ejercicios en menos de 3 min), el orden se marca como poco fiable.
  function stamp(E) {
    if (ST.readOnly) return;
    var now = Date.now();
    if (!E.t1) { E.t1 = now; if (ST.coachWrite) E.tc = 1; }
    E.tN = now;
  }
  function orderInfo(w, d) {
    var L = ST.LOG[w + "-" + d]; if (!L || !L.ej || L.borrado) return null;
    var dd = ST.PLAN.semanas[w] && ST.PLAN.semanas[w].dias[d];
    var plan = (dd && d < 100 ? dd.ej.filter(function (e) { return !e.act; }) : []).concat(L.extra || []);
    var planPos = {}; plan.forEach(function (e, i) { planPos[e.id] = i + 1; });
    var done = Object.keys(L.ej).filter(function (k) { return L.ej[k] && L.ej[k].t1; })
      .map(function (k) { return { id: k, t: L.ej[k].t1, tc: L.ej[k].tc }; }).sort(function (a, b) { return a.t - b.t; });
    if (!done.length) return null;
    var pos = {}; done.forEach(function (x, i) { pos[x.id] = i + 1; });
    var span = done[done.length - 1].t - done[0].t;
    return { pos: pos, planPos: planPos, ids: done.map(function (x) { return x.id; }), span: span,
      fiable: !done.some(function (x) { return x.tc; }) && !(done.length >= 3 && span < 3 * 6e4) };
  }
  function orderShift(ex) { // >0: hoy lo hizo más tarde que la última vez que hizo este día
    var oi = orderInfo(UI.w, UI.d); if (!oi || !oi.fiable || !oi.pos[ex.id]) return 0;
    for (var w = UI.w - 1; w >= 0; w--) {
      var dd = ST.PLAN.semanas[w] && ST.PLAN.semanas[w].dias[UI.d]; if (!dd) continue;
      var m = dd.ej.filter(function (e) { return e.id === ex.id; })[0] || dd.ej.filter(function (e) { return e.n === ex.n; })[0];
      var L = ST.LOG[w + "-" + UI.d], E = m && L && L.ej && L.ej[m.id];
      if (!E || !(E.s || []).some(function (S) { return S && parseFloat(S.reps) > 0; })) continue;
      var po = orderInfo(w, UI.d); if (!po || !po.fiable || !po.pos[m.id]) return 0;
      return oi.pos[ex.id] - po.pos[m.id];
    }
    return 0;
  }
  // ¿Va en la segunda mitad de la sesión? Con el orden real si es fiable (real=true), si no con el del plan. Con menos de 3 ejercicios, nunca.
  function isLate(ex, real) {
    var list = dayEx(day()).filter(function (e) { return !e.act; }), n = list.length; if (n < 3) return false;
    var pos = null, oi = real ? orderInfo(UI.w, UI.d) : null;
    if (oi && oi.fiable && oi.pos[ex.id]) { pos = oi.pos[ex.id]; n = Math.max(n, oi.ids.length); }
    else list.forEach(function (e, i) { if (e.id === ex.id) pos = i + 1; });
    return pos != null && pos > Math.ceil(n / 2);
  }
  function starEx(d) { return d && d.star ? (d.ej || []).filter(function (e) { return e.id === d.star && !e.act; })[0] || null : null; }
  function goalCard(d) { // objetivo de la sesión y ejercicio estrella (los pone el entrenador en «Editar pauta»)
    var st = starEx(d); if (!d.obj && !st) return null;
    return el("section", { class: "card sgoal" }, [
      d.obj ? el("p", { class: "sgobj" }, [el("b", { text: "🎯 Objetivo de hoy" }), el("span", { text: d.obj })]) : null,
      st ? el("p", { class: "sgstar" }, [el("b", { text: "⭐ Ejercicio estrella" }), el("span", { text: st.n })]) : null
    ]);
  }
  function exName(w, d, id) {
    var dd = ST.PLAN.semanas[w] && ST.PLAN.semanas[w].dias[d], L = ST.LOG[w + "-" + d];
    var e = ((dd && d < 100 ? dd.ej : []).concat((L && L.extra) || [])).filter(function (x) { return x.id === id; })[0];
    return e ? e.n : "Ejercicio";
  }

  // Nota del entreno: sensaciones (sen 1-5) y «la próxima vez» (ajuste) obligatorias; esfuerzo de la sesión (esf 1-10,
  // RPE de sesión), duración y comentario, opcionales.
  var SEN = [[1, "😫", "Muy mal"], [2, "😕", "Mal"], [3, "😐", "Normal"], [4, "🙂", "Bien"], [5, "💪", "Genial"]];
  var AJ = [["mas", "⬆️", "Puedo apretar más"], ["igual", "👌", "Así está bien"], ["menos", "⬇️", "Necesito aflojar"]];
  var AJ_SEM = [["mas", "⬆️", "Apretar más"], ["igual", "👌", "Igual"], ["menos", "⬇️", "Aflojar"]];
  function senTxt(v) { var x = SEN.filter(function (s) { return s[0] === +v; })[0]; return x ? x[1] + " " + x[2] : ""; }
  function ajTxt(v, list) { var x = (list || AJ).filter(function (s) { return s[0] === v; })[0]; return x ? x[1] + " " + x[2] : ""; }
  function noteDone(L) { var S = L && L.sesion; return !!(S && S.sen && S.ajuste); }
  function hasSets(L) { return !!(L && Object.keys(L.ej || {}).some(function (k) { return ((L.ej[k] || {}).s || []).some(function (S) { return S && parseFloat(S.reps) > 0; }); })); }
  function taps(opts, val, onpick, cls, label, ro) {
    var box = el("div", { class: "taps " + (cls || ""), role: "group", "aria-label": label });
    opts.forEach(function (o) {
      var v = o[0], b = el("button", { type: "button", class: "tap", "aria-pressed": String(val != null && String(val) === String(v)), disabled: ro || null,
        onclick: function () { Array.prototype.forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); onpick(v); } },
        o.length > 2 ? [el("span", { class: "tico", text: o[1] }), el("small", { text: o[2] })] : [String(o[1])]);
      box.appendChild(b);
    });
    return box;
  }
  function autoDur(L) { // minutos entre la primera y la última serie apuntadas (solo si el orden es fiable)
    var ts = Object.keys(L.ej || {}).map(function (k) { return L.ej[k]; }).filter(function (E) { return E && E.t1 && !E.tc; });
    if (ts.length < 2) return null;
    var a = Math.min.apply(null, ts.map(function (E) { return E.t1; })), b = Math.max.apply(null, ts.map(function (E) { return E.tN || E.t1; }));
    var m = Math.round((b - a) / 6e4); return m >= 10 && m <= 240 ? m : null;
  }
  function noteFields(L, onChange) {
    if (!L.sesion) L.sesion = {}; var S = L.sesion, ro = ST.readOnly;
    function upd(k) { return function (v) { S[k] = v; onChange(); why(); }; }
    if (!S.dur && !ro) { var ad = autoDur(L); if (ad) S.dur = String(ad); }
    var dur = el("input", { type: "number", inputmode: "numeric", min: "0", value: S.dur || "", placeholder: "min", disabled: ro || null, oninput: function () { S.dur = dur.value; onChange(); } });
    var whyLbl = el("span", { text: "Comentario breve (opcional)" });
    var ta = el("textarea", { rows: "2", disabled: ro || null, placeholder: ro ? "" : "Una frase: qué te ha costado, si has dormido mal, si algo ha molestado…", oninput: function () { S.com = ta.value; onChange(); } });
    ta.value = S.com || "";
    function why() {
      var need = (S.ajuste && S.ajuste !== "igual") || (S.sen && +S.sen <= 2);
      whyLbl.textContent = need ? (S.ajuste === "mas" ? "¿Qué te ha resultado fácil? (una frase)" : "¿Por qué? Cuéntaselo a " + (CFG.ENTRENADOR || "tu entrenador") + " en una frase") : "Comentario breve (opcional)";
      whyLbl.parentNode && whyLbl.parentNode.classList.toggle("ask", !!need);
    }
    var node = el("div", { class: "notef" }, [
      el("div", { class: "nq" }, [el("span", { class: "nql", text: "¿Cómo te has sentido?" }), taps(SEN, S.sen, function (v) { upd("sen")(String(v)); }, "sen", "Sensaciones", ro)]),
      el("div", { class: "nq" }, [el("span", { class: "nql", text: "La próxima vez…" }), taps(AJ, S.ajuste, upd("ajuste"), "aj", "La próxima vez", ro)]),
      el("div", { class: "nq" }, [el("span", { class: "nql", text: "Esfuerzo de toda la sesión (1 = muy suave, 10 = máximo)" }), taps(range(1, 10).map(function (n) { return [n, n]; }), S.esf, function (v) { upd("esf")(String(v)); }, "esf", "Esfuerzo de la sesión", ro)]),
      el("div", { class: "grid2" }, [field("Duración (min)", dur), el("span")]),
      el("label", { class: "field block" }, [whyLbl, ta])
    ]);
    why();
    return node;
  }
  function sessionBlock() {
    var L = dayLog();
    return el("section", { class: "card session" }, [
      el("h2", { text: ST.readOnly ? "Nota del cliente" : "Tu nota del entreno" }),
      ST.readOnly ? null : el("p", { class: "meta", text: "Dos toques: cómo te has sentido y si podrías apretar más o menos. Así " + (CFG.ENTRENADOR || "tu entrenador") + " sabe cómo ajustar." }),
      noteFields(L, persist)
    ]);
  }
  function finishBlock() {
    var L = dayLog(), k = logKey();
    var btn = el("button", { class: "btn primary wide", type: "button", text: L.terminado ? "Actualizar entreno" : "Terminar entreno", onclick: function () {
      L.terminado = L.terminado || Date.now(); persist(); flushSaves();
      if (ST.coachWrite) { render(); flash("Entreno guardado en el registro de " + (ST.client.nombre || "tu cliente") + "."); return; }
      if (noteDone(L)) { render(); flash("¡Entreno guardado! " + (CFG.ENTRENADOR || "Tu entrenador") + " ya lo puede ver."); weekAfter(k); return; }
      render(); openNoteSheet(k, function () { weekAfter(k); });
    } });
    return el("div", { class: "send" }, [btn, el("p", { class: "sent", text: ST.coachWrite ? "Todo se guarda solo mientras escribes. Al terminar, pulsa el botón para marcar el entreno como hecho." : "Tus series ya están guardadas. Al terminar, pulsa el botón y deja tu nota del entreno." })]);
  }
  function overlay(label, kids) {
    var ov;
    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    ov = el("div", { class: "brief-ov" }, [el("div", { class: "brief-sheet", role: "dialog", "aria-modal": "true", "aria-label": label }, kids(close))]);
    document.body.appendChild(ov); document.addEventListener("keydown", esc);
    return close;
  }
  function logWhen(k) { var L = ST.LOG[k] || {}; var d = L.fecha ? parseDate(L.fecha) : L.terminado ? new Date(L.terminado) : L.editado ? new Date(L.editado) : null; return d; }
  function logTitle(k) {
    var p = k.split("-"), w = +p[0], d = +p[1], L = ST.LOG[k] || {};
    var nm = d >= 100 ? (L.nombre || "Entreno extra") : ((ST.PLAN.semanas[w] && ST.PLAN.semanas[w].dias[d] && ST.PLAN.semanas[w].dias[d].nombre) || "Día " + (d + 1));
    var dt = logWhen(k); return nm + (dt ? " · " + fmt(dt) : "");
  }
  function openNoteSheet(k, after) {
    if (document.querySelector(".brief-ov")) return;
    var L = ST.LOG[k]; if (!L) return;
    var saveBtn = el("button", { class: "btn primary wide", type: "button", text: "Guardar nota" });
    var err = el("p", { class: "err" });
    function chk() { saveBtn.classList.toggle("off", !noteDone(L)); }
    var fields = noteFields(L, function () { persistKey(k); chk(); err.textContent = ""; });
    chk();
    var close = overlay("Nota del entreno", function (close) {
      saveBtn.onclick = function () {
        if (!noteDone(L)) { err.textContent = "Marca cómo te has sentido y qué hacemos la próxima vez."; return; }
        L.sesion.nota = Date.now(); if (!L.terminado) L.terminado = Date.now();
        persistKey(k); flushSaves(); close();
        render(); flash("¡Gracias! " + (CFG.ENTRENADOR || "Tu entrenador") + " ya tiene tu nota.");
        if (after) after();
      };
      return [
        el("p", { class: "bkick", text: logTitle(k) }),
        el("h2", { text: "¿Qué tal el entreno?" }),
        el("p", { class: "meta", text: "Tus series ya están guardadas. Esto es para saber si podemos apretar más o menos." }),
        fields, err, saveBtn,
        el("button", { class: "btn ghost wide", type: "button", text: "Ahora no", onclick: function () { close(); render(); } })
      ];
    });
  }
  function pendingNote() { // entreno con series de los últimos 3 días sin nota (o el de hoy, si ya pulsó «Terminar»)
    var today = parseDate(todayISO()), best = null;
    Object.keys(ST.LOG).forEach(function (k) {
      var L = ST.LOG[k]; if (!L || L.borrado || noteDone(L) || !(L.terminado || hasSets(L))) return;
      var d = logWhen(k); if (!d) return;
      var age = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
      if (age < 0 || age > 3 || (age === 0 && !L.terminado)) return;
      if (!best || d > best.d) best = { k: k, d: d };
    });
    return best && best.k;
  }
  function noteReminder() {
    var k = pendingNote(); if (!k) return null;
    return el("section", { class: "card remind" }, [
      el("h2", { text: "📝 Te falta la nota del entreno" }),
      el("p", { class: "meta", text: logTitle(k) + ". Dos toques: cómo te sentiste y si puedes apretar más o menos." }),
      el("button", { class: "btn primary wide", type: "button", text: "Dejar nota", onclick: function () { openNoteSheet(k); } })
    ]);
  }
  function coachNoteCard() { // arriba del día, en el panel: nota del cliente y orden real
    var L = ST.LOG[logKey()]; if (!L || L.borrado || !(L.terminado || hasSets(L))) return null;
    var S = L.sesion || {}, kids = [el("h2", { text: "📝 Nota del cliente" })];
    if (S.sen || S.ajuste) kids.push(el("p", { class: "cnote", text: [S.sen ? senTxt(S.sen) : null, S.ajuste ? ajTxt(S.ajuste) : null, S.esf ? "Esfuerzo " + S.esf + "/10" : null, S.dur ? S.dur + " min" : null].filter(Boolean).join(" · ") }));
    else kids.push(el("p", { class: "cnote none", text: "Sin nota: no ha dicho cómo se sintió ni si puede apretar más." }));
    if (S.com) kids.push(el("p", { class: "note", text: S.com }));
    var oi = orderInfo(UI.w, UI.d);
    if (oi) {
      var moved = oi.ids.filter(function (id) { return oi.planPos[id] && oi.planPos[id] !== oi.pos[id]; }).length;
      kids.push(el("p", { class: "meta", text: "🔢 Orden real" + (oi.fiable ? "" : " (poco fiable: " + (Object.keys(L.ej).some(function (x) { return L.ej[x].tc; }) ? "lo apuntaste tú" : "lo apuntó todo de golpe") + ")") + (moved ? " · " + moved + " fuera del orden del plan" : " · igual que el plan") + ":" }));
      kids.push(el("ol", { class: "ordlist" }, oi.ids.map(function (id) {
        var pp = oi.planPos[id], rp = oi.pos[id];
        return el("li", { class: pp && pp !== rp ? "moved" : "" }, [exName(UI.w, UI.d, id), pp && pp !== rp ? el("small", { text: " (plan: " + pp + ".º)" }) : null]);
      })));
    } else if (hasSets(L)) kids.push(el("p", { class: "meta", text: "🔢 Orden real: sin dato (apuntado antes del 28 nov)." }));
    return el("section", { class: "card cnotecard" }, kids);
  }

  // ---- Cierre de semana: el check-in semanal de Control, pedido al acabar la semana del plan o al empezar la siguiente.
  // Se guarda en seguimiento.data.checkins[lunes de la semana que cierra] con sem = ese lunes (los antiguos no llevan sem).
  window.EYL_CIERRE = true;
  function isoD(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return isoD(d); }
  function loadSG() {
    if (!api.sb || ST.mode === "entrenador" || ST.SGfor === ST.clientId) return;
    ST.SGfor = ST.clientId; ST.SG = null;
    api.sb.from("seguimiento").select("data").eq("cliente_id", ST.clientId).maybeSingle().then(function (r) {
      if (r.error) return; ST.SG = (r.data && r.data.data) || { checkins: {}, tests: [] };
      if (UI.view === "entreno" && !ST.editing) render();
    }, function () {});
  }
  function sessionsIn(mon) {
    var end = addDays(mon, 6), n = 0;
    Object.keys(ST.LOG).forEach(function (k) {
      var L = ST.LOG[k]; if (!L || L.borrado || !(L.terminado || hasSets(L))) return;
      var d = logWhen(k); if (!d) return; var s = isoD(d); if (s >= mon && s <= end) n++;
    });
    return n;
  }
  function weekClosed(mon) {
    var ck = (ST.SG && ST.SG.checkins) || {}, next = ck[addDays(mon, 7)];
    return !!(ck[mon] || (next && !next.sem)); // un check-in antiguo hecho la semana siguiente también la cierra
  }
  function planWeekDone(w) {
    var wk = ST.PLAN.semanas[w]; if (!wk) return false;
    var dias = wk.dias.map(function (d, i) { return i; }).filter(function (i) { return wk.dias[i].ej.some(function (e) { return !e.act; }); });
    return dias.length > 0 && dias.every(function (i) { var L = ST.LOG[w + "-" + i]; return L && !L.borrado && (L.terminado || noteDone(L)); });
  }
  function pendingWeek() {
    if (!ST.SG || ST.mode === "entrenador") return null;
    var cur = isoMonday(new Date()), prev = addDays(cur, -7);
    if (sessionsIn(prev) && !weekClosed(prev)) return prev;
    if (sessionsIn(cur) && !weekClosed(cur) && planWeekDone(currentWeek())) return cur;
    return null;
  }
  function weekAfter(k) { // tras la nota: si era la última sesión de la semana del plan, se pide cerrar la semana
    if (!ST.SG) return;
    var w = +k.split("-")[0]; if (!planWeekDone(w)) return;
    var d = logWhen(k) || new Date(), mon = isoMonday(d);
    if (!weekClosed(mon)) setTimeout(function () { openWeekSheet(mon, true); }, 350);
  }
  function weekLabel(mon) { var a = parseDate(mon), b = parseDate(addDays(mon, 6)); return fmt(a) + " – " + fmt(b); }
  function openWeekSheet(mon, fin) {
    if (document.querySelector(".brief-ov") || !api.sb) return;
    var v = { sesiones: sessionsIn(mon) }, zonas = (window.EYLSegui && window.EYLSegui.zonas) || [];
    var RECUP = [[1, "😫", "Muy mal"], [2, "😕", "Mal"], [3, "😐", "Normal"], [4, "🙂", "Bien"], [5, "💪", "Genial"]];
    var zsel = select(zonas.map(function (z) { return { v: z.k, t: z.n }; }).concat([{ v: "otra", t: "Otra" }]), "", function (x) { v.zona = x; }, "Elige la zona");
    var zwrap = field("¿Dónde?", zsel, "block"); zwrap.hidden = true;
    var pasos = el("input", { type: "number", inputmode: "numeric", min: "0", max: "60000", step: "100", placeholder: "p. ej. 7000" });
    var ses = el("input", { type: "number", inputmode: "numeric", min: "0", max: "14", value: String(v.sesiones) });
    var nota = el("textarea", { rows: "2", placeholder: "Cómo ha ido la semana: cansancio, trabajo, viajes, molestias…" });
    var err = el("p", { class: "err" });
    var btn = el("button", { class: "btn primary wide", type: "button", text: "Cerrar la semana" });
    var close = overlay("Cierra tu semana", function (close) {
      btn.onclick = function () {
        if (v.dolor == null || v.recup == null || !v.prox) { err.textContent = "Marca el dolor, la recuperación y qué hacemos la semana que viene."; return; }
        var ci = { dolor: v.dolor, recup: v.recup, prox: v.prox, fecha: todayISO(), sem: mon };
        if (v.dolor > 0 && v.zona) ci.zona = v.zona;
        if (pasos.value !== "") ci.pasos = Math.round(+pasos.value);
        if (ses.value !== "") ci.sesiones = +ses.value;
        if (nota.value.trim()) ci.nota = nota.value.trim();
        btn.disabled = true; btn.textContent = "Guardando…";
        var sb = api.sb, id = ST.clientId;
        sb.from("seguimiento").select("data").eq("cliente_id", id).maybeSingle().then(function (r) { // se lee lo último para no pisar nada
          if (r.error) throw r.error;
          var d = (r.data && r.data.data) || { checkins: {}, tests: [] }; d.checkins = d.checkins || {}; d.checkins[mon] = ci;
          return sb.from("seguimiento").upsert({ cliente_id: id, data: d }).then(function (u) { if (u.error) throw u.error; ST.SG = d; });
        }).then(function () {
          close(); render(); flash(ci.dolor >= 3 && ci.zona && ci.zona !== "otra" ? "Semana cerrada. Tienes el protocolo de esa zona en Más › Control › Dolor." : "¡Semana cerrada! Gracias.");
        }, function (x) { btn.disabled = false; btn.textContent = "Cerrar la semana"; err.textContent = /fetch|network/i.test((x && x.message) || "") ? "Sin conexión: no se ha guardado. Prueba otra vez." : "No se ha guardado. Prueba otra vez."; });
      };
      return [
        el("p", { class: "bkick", text: "Semana del " + weekLabel(mon) + " · 1 minuto" }),
        el("h2", { text: fin ? "¡Semana terminada! Ciérrala" : "Cierra tu semana" }),
        el("div", { class: "nq" }, [el("span", { class: "nql", text: "Dolor máximo esta semana (0 = nada, 10 = el peor)" }),
          taps(range(0, 10).map(function (n) { return [n, n]; }), null, function (x) { v.dolor = +x; zwrap.hidden = !(+x > 0); }, "esf pain", "Dolor de 0 a 10")]),
        zwrap,
        el("div", { class: "nq" }, [el("span", { class: "nql", text: "¿Cómo te has recuperado?" }), taps(RECUP, null, function (x) { v.recup = +x; }, "sen", "Recuperación")]),
        el("div", { class: "nq" }, [el("span", { class: "nql", text: "La semana que viene…" }), taps(AJ_SEM, null, function (x) { v.prox = x; }, "aj", "La semana que viene")]),
        el("div", { class: "grid2" }, [field("Pasos medios al día", pasos), field("Entrenos hechos", ses)]),
        field("Nota de la semana (opcional)", nota, "block"),
        err, btn,
        el("button", { class: "btn ghost wide", type: "button", text: "Luego", onclick: function () { lsSet("eyl-cierre-luego-" + ST.clientId, todayISO()); close(); render(); } })
      ];
    });
  }
  function tryWeekPop(mon, n) { // si está abierta otra ventana («Lo importante de hoy»), espera a que se cierre
    setTimeout(function () {
      if (document.querySelector(".brief-ov")) { if (n < 60) tryWeekPop(mon, n + 1); return; }
      if (UI.view === "entreno" && !ST.editing && pendingWeek() === mon) openWeekSheet(mon, false);
    }, n ? 1500 : 500);
  }
  function weekReminder() {
    var mon = pendingWeek(); if (!mon) return null;
    if (!ST.weekPopped && lsGet("eyl-cierre-luego-" + ST.clientId, "") !== todayISO()) { // una vez al entrar, salvo que haya dicho «Luego» hoy
      ST.weekPopped = true; tryWeekPop(mon, 0);
    }
    return el("section", { class: "card remind" }, [
      el("h2", { text: "🗓️ Cierra tu semana del " + weekLabel(mon) }),
      el("p", { class: "meta", text: "Dolor, recuperación y si apretamos más o menos la semana que viene. 1 minuto." }),
      el("button", { class: "btn primary wide", type: "button", text: "Cerrar la semana", onclick: function () { openWeekSheet(mon, false); } })
    ]);
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
    var base = ST.PLAN.semanas[0], coachV = ST.mode === "entrenador";
    if (coachV) main.appendChild(el("p", { class: "meta", text: "🔢 «hecho N.º»: puesto en que lo hizo el cliente esa semana (naranja si no es el del plan; «?» si lo apuntó todo de golpe o lo apuntaste tú). Hacer un ejercicio más tarde resta fuerza en ese ejercicio." }));
    base.dias.forEach(function (d0, di) {
      main.appendChild(el("h3", { class: "dayhead", text: "Día " + (di + 1) + (d0.nombre ? " · " + d0.nombre : "") }));
      if (coachV) { // nota del cliente de cada semana en este día
        var ns = [];
        for (var wn = 0; wn < nW; wn++) { var Ln = ST.LOG[wn + "-" + di]; if (!Ln || Ln.borrado || !(Ln.terminado || hasSets(Ln))) continue;
          var Sn = Ln.sesion || {}; ns.push(el("li", { class: Sn.sen || Sn.ajuste ? "" : "none" }, [el("b", { text: "S" + (wn + 1) + " " }), Sn.sen || Sn.ajuste ? [Sn.sen ? senTxt(Sn.sen) : "", Sn.ajuste ? ajTxt(Sn.ajuste) : "", Sn.esf ? "esf. " + Sn.esf : ""].filter(Boolean).join(" · ") + (Sn.com ? " · «" + (Sn.com.length > 60 ? Sn.com.slice(0, 58) + "…" : Sn.com) + "»" : "") : "sin nota"])); }
        if (ns.length) main.appendChild(el("ul", { class: "daynotes" }, ns));
      }
      d0.ej.forEach(function (ex0) {
        if (ex0.act) return; // la activación no se apunta
        var rows = [], tons = [];
        for (var w = 0; w < nW; w++) {
          var dd = ST.PLAN.semanas[w].dias[di];
          var ex = dd && (dd.ej.filter(function (e) { return e.id === ex0.id; })[0] || dd.ej.filter(function (e) { return e.n === ex0.n; })[0]);
          var st = ex ? exStats(w, di, ex) : null;
          tons.push(st && st.any ? st.ton : null);
          var oi = ex && coachV ? orderInfo(w, di) : null;
          var Lw = ST.LOG[w + "-" + di], tqw = ex && Lw && Lw.ej && Lw.ej[ex.id] && Lw.ej[ex.id].tq;
          rows.push({ w: w, st: st, planned: ex ? ex.series.length : 0, dv: ex && ex.uni ? 2 : 1, pos: oi && oi.pos[ex.id], pp: oi && oi.planPos[ex.id], fi: oi && oi.fiable, tq: tqw });
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
            el("span", { class: "pstat", text: has && st.kg ? num(st.kg) + " kg máx" : "" }),
            has && r.tq && r.tq !== "igual" ? el("span", { class: "pstat ptq " + r.tq, text: r.tq === "mejor" ? "técnica 👍" : "técnica 👎" }) : null,
            coachV ? el("span", { class: "pstat pord" + (has && r.pos && r.pp && r.pos !== r.pp ? " moved" : ""), title: r.pp ? "En el plan va " + r.pp + ".º" : null,
              text: has ? (r.pos ? "hecho " + r.pos + ".º" + (r.fi ? "" : "?") : "orden —") : "" }) : null
          ]);
          if (has) prev = st;
          return col;
        });
        main.appendChild(el("section", { class: "card prog" }, [
          el("div", { class: "proghead" }, [
            el("div", { class: "titles" }, [el("h2", { text: (d0.star === ex0.id ? "⭐ " : "") + ex0.n }), el("p", { class: "meta", text: (ex0.g || []).join(", ") + ((ex0.g || []).length ? " · " : "") + "kg movidos por semana" })]),
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
      field("Objetivo de la sesión (lo ve el cliente arriba del día)", txt(d.obj, function (v) { if (v) d.obj = v; else delete d.obj; }, { placeholder: "p. ej. Fuerza en sentadilla y volumen de glúteo" }), "block"),
      field("Ejercicio estrella", (function () { // select() se desactiva en solo lectura y el panel edita con readOnly
        var sel = el("select", { onchange: function () { if (sel.value) d.star = sel.value; else delete d.star; ST.dirty = true; render(); } }, [el("option", { value: "", text: "Ninguno" })]
          .concat(d.ej.filter(function (e) { return !e.act; }).map(function (e) { var o = el("option", { value: e.id, text: e.n }); if (e.id === d.star) o.selected = true; return o; })));
        return sel; })(), "block"),
      el("button", { class: "btn ghost", type: "button", text: "Copiar objetivo y estrella a todas las semanas", onclick: function () {
        var stx = starEx(d), n = 0;
        ST.PLAN.semanas.forEach(function (w) { var o = w.dias[UI.d]; if (!o || o === d) return;
          if (d.obj) o.obj = d.obj; else delete o.obj;
          var m = stx && (o.ej.filter(function (e) { return e.id === stx.id; })[0] || o.ej.filter(function (e) { return e.n === stx.n; })[0]);
          if (m) o.star = m.id; else delete o.star; n++; });
        ST.dirty = true; flash("Copiado al día " + (UI.d + 1) + " de " + n + " semanas más");
      } }),
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
    var notaTa = el("textarea", { rows: "3", placeholder: "Notas técnicas" }); notaTa.value = ex.nota || ""; // textarea: conserva los saltos de línea (listas como la del circuito)
    notaTa.addEventListener("input", function () { ex.nota = notaTa.value; ST.dirty = true; });
    c.appendChild(field("Notas técnicas", notaTa, "block"));
    c.appendChild(field("Enlace a vídeo", txt(ex.link, function (v) { ex.link = v; }, "https://… (opcional)", "url"), "block"));
    var uni = el("input", { type: "checkbox", onchange: function () { ex.uni = uni.checked; ST.dirty = true; } }); uni.checked = !!ex.uni;
    c.appendChild(el("label", { class: "check" }, [uni, el("span", { text: "Unilateral (el cliente elige brazo/pierna y lado)" })]));
    var act = el("input", { type: "checkbox", onchange: function () { ex.act = act.checked; ST.dirty = true; } }); act.checked = !!ex.act;
    c.appendChild(el("label", { class: "check" }, [act, el("span", { text: "Activación (sale en «Antes de empezar» y no se apunta)" })]));
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
