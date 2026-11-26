/* ============================================================
   FocusFlow local store
   Every account gets its own namespaced record on this device.
   The shape mirrors the Supabase tables in
   supabase/schema.sql, where row-level security isolates users.
   ============================================================ */
window.FFStore = (function () {
  var PREFIX = "ff.data.v1.";
  var state = null;
  var key = "";
  var user = null;
  var listeners = [];

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function dateKey(d) {
    var x = d || new Date();
    return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
  }

  function shiftDays(baseKey, delta) {
    var parts = baseKey.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + delta);
    return dateKey(d);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fresh() {
    return {
      version: 1,
      plan: "free",
      createdAt: new Date().toISOString(),
      tasks: [],
      dumps: [],
      goals: [],
      sessions: [],
      urges: [],
      days: {},
      settings: { theme: "system", dailyGoal: 120, sound: false, notify: false }
    };
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) listeners[i]();
  }

  function save() {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch (e) { /* storage full or blocked */ }
  }

  function commit() {
    save();
    emit();
  }

  function ensureDay(k) {
    if (!state.days[k]) state.days[k] = { focus: 0, sessions: 0, done: [], note: "" };
    return state.days[k];
  }

  function normalise(candidate) {
    var value = candidate && typeof candidate === "object" ? candidate : fresh();
    var base = fresh();
    Object.keys(base).forEach(function (k) {
      if (value[k] === undefined) value[k] = base[k];
    });
    var settings = {};
    ["theme", "dailyGoal", "sound", "notify"].forEach(function (k) {
      if (value.settings && value.settings[k] !== undefined) settings[k] = value.settings[k];
    });
    value.settings = Object.assign({}, base.settings, settings);
    if (["system", "light", "dark", "daylight", "midnight", "funky", "neon"].indexOf(value.settings.theme) === -1) value.settings.theme = "system";
    var goal = Number(value.settings.dailyGoal);
    value.settings.dailyGoal = isFinite(goal) && goal > 0 && goal <= 1440 ? goal : 120;
    value.settings.sound = !!value.settings.sound;
    value.settings.notify = !!value.settings.notify;
    ["tasks", "dumps", "goals", "sessions", "urges"].forEach(function (k) {
      if (!Array.isArray(value[k])) value[k] = [];
      value[k] = value[k].filter(function (item) { return item && typeof item === "object"; });
    });
    if (!value.days || typeof value.days !== "object") value.days = {};
    Object.keys(value.days).forEach(function (k) {
      if (k === "__proto__") { delete value.days[k]; return; }
      var day = value.days[k];
      if (!day || typeof day !== "object") { value.days[k] = { focus: 0, sessions: 0, done: [], note: "" }; return; }
      day.focus = Math.max(0, Number(day.focus) || 0);
      day.sessions = Math.max(0, Number(day.sessions) || 0);
      if (!Array.isArray(day.done)) day.done = [];
      if (typeof day.note !== "string") day.note = "";
    });
    return value;
  }

  function init(profile) {
    user = profile;
    key = PREFIX + profile.id;
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
    if (raw) {
      try { state = JSON.parse(raw); } catch (e) { state = null; }
    }
    state = normalise(state);
    ensureDay(dateKey());
    save();
    return state;
  }

  function addTask(input) {
    var task = {
      id: uid(),
      title: String(input.title || "").trim(),
      minutes: Number(input.minutes) || 25,
      energy: input.energy || "focus",
      status: "planned",
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    if (!task.title) return null;
    state.tasks.unshift(task);
    commit();
    return task;
  }

  function taskById(id) {
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i];
    return null;
  }

  function completeTask(id) {
    var task = taskById(id);
    if (!task || task.status === "done") return null;
    task.status = "done";
    task.completedAt = new Date().toISOString();
    var day = ensureDay(dateKey());
    if (day.done.indexOf(id) === -1) day.done.push(id);
    commit();
    return task;
  }

  function restoreTask(id) {
    var task = taskById(id);
    if (!task) return null;
    task.status = "planned";
    task.completedAt = null;
    var day = ensureDay(dateKey());
    day.done = day.done.filter(function (x) { return x !== id; });
    commit();
    return task;
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    commit();
  }

  function openTasks() {
    return state.tasks.filter(function (t) { return t.status !== "done"; });
  }

  function doneToday() {
    var day = ensureDay(dateKey());
    return state.tasks.filter(function (t) { return day.done.indexOf(t.id) !== -1; });
  }

  function addDump(text) {
    var clean = String(text || "").trim();
    if (!clean) return null;
    var item = { id: uid(), text: clean, at: new Date().toISOString(), promoted: false };
    state.dumps.unshift(item);
    commit();
    return item;
  }

  function removeDump(id) {
    state.dumps = state.dumps.filter(function (d) { return d.id !== id; });
    commit();
  }

  function promoteDump(id) {
    var item = state.dumps.filter(function (d) { return d.id === id; })[0];
    if (!item) return null;
    var task = addTask({ title: item.text, minutes: 25, energy: "focus" });
    item.promoted = true;
    item.taskId = task ? task.id : null;
    commit();
    return task;
  }

  /* ---------- goals ---------- */
  function addGoal(input) {
    var goal = {
      id: uid(),
      title: String(input.title || "").trim(),
      horizon: input.horizon || "weekly",
      why: String(input.why || "").trim(),
      createdAt: new Date().toISOString(),
      done: false
    };
    if (!goal.title) return null;
    state.goals.unshift(goal);
    commit();
    return goal;
  }

  function toggleGoal(id) {
    state.goals.forEach(function (g) { if (g.id === id) g.done = !g.done; });
    commit();
  }

  function removeGoal(id) {
    state.goals = state.goals.filter(function (g) { return g.id !== id; });
    commit();
  }

  /* ---------- sessions and urges ---------- */
  function addSession(input) {
    var at = new Date();
    var session = {
      id: uid(),
      taskId: input.taskId || null,
      minutes: Number(input.minutes) || 25,
      mode: input.mode || "focus",
      at: at.toISOString(),
      date: dateKey(at)
    };
    state.sessions.unshift(session);
    var day = ensureDay(session.date);
    day.focus += session.minutes;
    day.sessions += 1;
    commit();
    return session;
  }

  function addUrge(context) {
    var at = new Date();
    var urge = { id: uid(), at: at.toISOString(), date: dateKey(at), context: context || "" };
    state.urges.unshift(urge);
    commit();
    return urge;
  }

  function setNote(dayKeyValue, text) {
    ensureDay(dayKeyValue).note = String(text || "").slice(0, 280);
    commit();
  }

  function setSetting(name, value) {
    state.settings[name] = value;
    commit();
  }

  function setPlan(id) {
    if (!window.FF_PLANS[id]) return;
    state.plan = id;
    commit();
  }

  function plan() {
    return window.FFPlanOf(state.plan);
  }

  /* ---------- stats ---------- */
  function focusFor(k) {
    var d = state.days[k];
    return d ? Number(d.focus) || 0 : 0;
  }

  function focusToday() {
    return focusFor(dateKey());
  }

  function sessionsOn(k) {
    return state.sessions.filter(function (s) { return s.date === k; }).length;
  }

  function urgesOn(k) {
    return state.urges.filter(function (u) { return u.date === k; }).length;
  }

  function activeOn(k) {
    var d = state.days[k];
    return !!d && (Number(d.focus) > 0 || (d.done && d.done.length > 0));
  }

  function streak() {
    var cursor = dateKey();
    if (!activeOn(cursor)) cursor = shiftDays(cursor, -1);
    var count = 0;
    while (activeOn(cursor)) {
      count += 1;
      cursor = shiftDays(cursor, -1);
      if (count > 3650) break;
    }
    return count;
  }

  function series(n) {
    var labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var out = [];
    var today = dateKey();
    for (var i = n - 1; i >= 0; i--) {
      var k = shiftDays(today, -i);
      var parts = k.split("-");
      var dow = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getDay();
      out.push({
        key: k,
        label: n > 10 ? parts[2] : labels[dow],
        focus: focusFor(k),
        sessions: sessionsOn(k),
        urges: urgesOn(k),
        done: state.days[k] && state.days[k].done ? state.days[k].done.length : 0
      });
    }
    return out;
  }

  function completion(days) {
    var start = shiftDays(dateKey(), -(days - 1));
    var created = state.tasks.filter(function (t) { return String(t.createdAt || "").slice(0, 10) >= start; });
    if (!created.length) return 0;
    var done = created.filter(function (t) { return t.status === "done"; }).length;
    return Math.round((done / created.length) * 100);
  }

  function nextTask() {
    var open = openTasks().slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    return open[0] || null;
  }

  function exportObject() {
    return { user: user, exportedAt: new Date().toISOString(), data: state };
  }

  function importObject(payload) {
    var incoming = payload && payload.data ? payload.data : payload;
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.sessions)) {
      throw new Error("Not a FocusFlow backup");
    }
    incoming.plan = state.plan;
    state = normalise(incoming);
    ensureDay(dateKey());
    commit();
    return state;
  }

  function csvCell(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csv() {
    var rows = [["date", "minutes", "task", "started_at"]];
    state.sessions.forEach(function (s) {
      var task = s.taskId ? taskById(s.taskId) : null;
      rows.push([s.date, s.minutes, task ? task.title : "Focus session", s.at]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n");
  }

  function clearAll() {
    var plan = state && state.plan ? state.plan : "free";
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    state = fresh();
    state.plan = plan;
    ensureDay(dateKey());
    commit();
  }

  return {
    init: init,
    onChange: function (fn) { listeners.push(fn); },
    state: function () { return state; },
    todayKey: dateKey,
    shiftDays: shiftDays,
    addTask: addTask,
    taskById: taskById,
    completeTask: completeTask,
    restoreTask: restoreTask,
    deleteTask: deleteTask,
    openTasks: openTasks,
    doneToday: doneToday,
    nextTask: nextTask,
    addDump: addDump,
    removeDump: removeDump,
    promoteDump: promoteDump,
    addGoal: addGoal,
    toggleGoal: toggleGoal,
    removeGoal: removeGoal,
    addSession: addSession,
    addUrge: addUrge,
    setNote: setNote,
    setSetting: setSetting,
    setPlan: setPlan,
    plan: plan,
    focusToday: focusToday,
    focusFor: focusFor,
    sessionsOn: sessionsOn,
    urgesOn: urgesOn,
    streak: streak,
    series: series,
    completion: completion,
    exportObject: exportObject,
    importObject: importObject,
    csv: csv,
    clearAll: clearAll
  };
})();