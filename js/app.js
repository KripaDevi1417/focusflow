/* ============================================================
   FocusFlow app
   ============================================================ */
(function () {
  "use strict";

  var user = null;
  var timer = null;
  var currentPage = "today";
  var insightRange = 7;
  var activeMinutes = 25;
  var authEmail = "";
  var authUsername = "";
  var resendTimerId = null;
  var confirmCallback = null;
  var ambient = null;
  var shieldOn = false;
  var shieldTimer = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function fmtMin(total) {
    var m = Math.round(Number(total) || 0);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return h + "h" + (rest ? " " + rest + "m" : "");
  }

  function clock(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? "0" + m : String(m)) + ":" + (s < 10 ? "0" + s : String(s));
  }

  function todayKey() { return window.FFStore.todayKey(); }

  function toast(message) {
    var stack = $("#toastStack");
    var node = el("div", "toast", message);
    stack.appendChild(node);
    setTimeout(function () {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      node.style.transition = "opacity .25s, transform .25s";
      setTimeout(function () { node.remove(); }, 260);
    }, 3200);
  }

  var activeModal = null;
  var modalReturnFocus = null;

  function openModal(id) {
    var node = document.getElementById(id);
    if (!node || !node.hidden) return;
    modalReturnFocus = document.activeElement;
    activeModal = node;
    node.hidden = false;
    var first = node.querySelector("button:not([disabled]), [href], input:not([disabled]), select, textarea");
    if (first) setTimeout(function () { first.focus(); }, 40);
  }

  function closeModals() {
    $$(".modal-backdrop").forEach(function (m) { m.hidden = true; });
    if (activeModal && modalReturnFocus && document.contains(modalReturnFocus)) {
      modalReturnFocus.focus();
    }
    activeModal = null;
    modalReturnFocus = null;
  }

  function applyTheme() {
    if (!window.FFStore || !window.FFStore.state()) return;
    var preference = window.FFStore.state().settings.theme || "system";
    var dark = preference === "dark";
    if (preference === "system" && window.matchMedia) {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = el("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- auth screen ---------------- */
  function showAuth() {
    document.title = "Sign in - FocusFlow";
    document.body.setAttribute("data-view", "auth");
    $("#landing").hidden = true;
    $("#app").hidden = true;
    $("#authScreen").hidden = false;
    $("#authStep1").hidden = false;
    $("#authStep2").hidden = true;
    $("#authError1").textContent = "";
    $("#authError2").textContent = "";
    $("#demoCodeBox").hidden = true;
    $("#authModeNote").textContent = window.FFAuth.configured()
      ? "Secured by Supabase - codes are emailed for real."
      : "Preview mode - the code appears on screen. Add Supabase keys in js/config.js to email real codes.";
    setTimeout(function () { $("#authUsername").focus(); }, 60);
  }

  function showLanding() {
    document.title = "FocusFlow - Make tomorrow easier on yourself";
    document.body.setAttribute("data-view", "landing");
    $("#authScreen").hidden = true;
    $("#app").hidden = true;
    $("#landing").hidden = false;
  }

  function setStep(step) {
    $("#authStep1").hidden = step !== 1;
    $("#authStep2").hidden = step !== 2;
    if (step === 2) {
      $("#authEmailLabel").textContent = authEmail;
      $("#otpNote").textContent = window.FFAuth.configured()
        ? "Codes are emailed by the sign-in service and expire on its schedule. Request a fresh one if needed."
        : "Preview mode: codes expire in 10 minutes and allow five tries.";
      var first = $(".otp-digit");
      if (first) setTimeout(function () { first.focus(); }, 60);
    }
  }

  function otpValue() {
    return $$(".otp-digit").map(function (i) { return i.value; }).join("");
  }

  function resetOtp() {
    $$(".otp-digit").forEach(function (i) { i.value = ""; });
  }

  function startResendCountdown() {
    clearInterval(resendTimerId);
    var left = window.FFAuth.resendSeconds;
    var label = $("#resendTimer");
    label.textContent = "in " + left + "s";
    resendTimerId = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(resendTimerId);
        label.textContent = "";
        return;
      }
      label.textContent = "in " + left + "s";
    }, 1000);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.idle = button.textContent;
      button.disabled = true;
      button.textContent = label || "One moment...";
    } else {
      button.disabled = false;
      if (button.dataset.idle) button.textContent = button.dataset.idle;
    }
  }

  function wireOtpInputs() {
    var digits = $$(".otp-digit");
    digits.forEach(function (input, index) {
      input.addEventListener("input", function () {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && index < digits.length - 1) digits[index + 1].focus();
        if (otpValue().length === 6) {
          var form = $("#authForm2");
          if (form && !$("#verifyBtn").disabled) form.requestSubmit();
        }
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Backspace" && !input.value && index > 0) {
          event.preventDefault();
          digits[index - 1].value = "";
          digits[index - 1].focus();
        }
      });
      input.addEventListener("paste", function (event) {
        var text = (event.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        event.preventDefault();
        digits.forEach(function (digit, i) { digit.value = text[i] || ""; });
        if (text.length === 6) $("#authForm2").requestSubmit();
      });
    });
  }

  function wireAuth() {
    $$("[data-open-auth]").forEach(function (button) {
      button.addEventListener("click", function () { showAuth(); });
    });

    $("#authBack").addEventListener("click", function () {
      pendingPlan = null;
      try { sessionStorage.removeItem("ff.pendingPlan.v1"); } catch (err) { /* ignore */ }
      location.hash = "#/welcome";
      showLanding();
    });

    $("#googleBtn").addEventListener("click", async function () {
      var button = this;
      if (button.disabled) return;
      button.disabled = true;
      var result = await window.FFAuth.google();
      button.disabled = false;
      if (result.ok && result.redirect) return;
      if (result.error === "preview") {
        toast("Google sign-in needs Supabase keys - use the email code below to preview.");
        $("#authEmail").focus();
        return;
      }
      toast(result.error || "Google sign-in did not start.");
    });

    $("#authForm1").addEventListener("submit", async function (event) {
      event.preventDefault();
      var username = $("#authUsername").value.trim();
      var email = $("#authEmail").value.trim();
      var error = $("#authError1");
      error.textContent = "";
      if (username.length < 2) { error.textContent = "Pick a username with at least 2 characters."; return; }
      if (!window.FFAuth.validEmail(email)) { error.textContent = "That email address does not look right."; return; }
      authUsername = username;
      authEmail = window.FFAuth.normaliseEmail(email);
      var button = $("#sendCodeBtn");
      if (button.disabled) return;
      setBusy(button, true, "Sending code...");
      var result = await window.FFAuth.sendCode(authEmail, username);
      setBusy(button, false);
      if (!result.ok) { error.textContent = result.error; return; }
      resetOtp();
      setStep(2);
      startResendCountdown();
      var box = $("#demoCodeBox");
      if (result.demoCode) {
        $("#demoCode").textContent = result.demoCode;
        box.hidden = false;
        $("#authError2").textContent = "Preview mode - use the code above. Real emails activate with Supabase.";
      } else {
        box.hidden = true;
        $("#authError2").textContent = "";
      }
    });

    $("#authForm2").addEventListener("submit", async function (event) {
      event.preventDefault();
      var code = otpValue();
      var error = $("#authError2");
      if (code.length !== 6) { error.textContent = "Enter all six digits."; return; }
      var button = $("#verifyBtn");
      if (button.disabled) return;
      setBusy(button, true, "Verifying...");
      var result = await window.FFAuth.verifyCode(authEmail, code);
      setBusy(button, false);
      if (!result.ok) { error.textContent = result.error; return; }
      enterApp(result.user, { welcome: true });
    });

    $("#resendBtn").addEventListener("click", async function () {
      if ($("#resendTimer").textContent || this.dataset.busy) return;
      this.dataset.busy = "1";
      var error = $("#authError2");
      error.textContent = "";
      var result = await window.FFAuth.sendCode(authEmail, authUsername);
      delete this.dataset.busy;
      if (!result.ok) { error.textContent = result.error; return; }
      resetOtp();
      startResendCountdown();
      if (result.demoCode) {
        $("#demoCode").textContent = result.demoCode;
        $("#demoCodeBox").hidden = false;
      }
      toast("A fresh code is on its way.");
      var first = $(".otp-digit");
      if (first) first.focus();
    });

    $("#changeEmail").addEventListener("click", function () {
      clearInterval(resendTimerId);
      $("#resendTimer").textContent = "";
      setStep(1);
    });

    wireOtpInputs();
  }

  /* ---------------- session / shell ---------------- */
  var PAGES = {
    today: { title: "Your day", label: "TODAY" },
    focus: { title: "Focus", label: "SESSION" },
    dump: { title: "Brain dump", label: "INBOX" },
    goals: { title: "Goals", label: "DIRECTION" },
    journal: { title: "Journal", label: "HISTORY" },
    insights: { title: "Insights", label: "EVIDENCE" },
    settings: { title: "Settings", label: "SETTINGS" }
  };

  function pageFromHash() {
    var raw = String(location.hash || "").replace(/^#\/?/, "").split("?")[0];
    if (!raw || raw === "welcome") return "today";
    return PAGES[raw] ? raw : "today";
  }

  function renderChrome() {
    var plan = window.FFStore.plan();
    var initial = (user.username || "U").charAt(0).toUpperCase();
    ["#avatar", "#settingsAvatar"].forEach(function (sel) {
      var node = $(sel);
      if (node) node.textContent = initial;
    });
    $("#profileName").textContent = user.username;
    $("#profilePlan").textContent = plan.name + " plan";
    $("#planCardName").textContent = plan.name;
    $("#planCardCopy").textContent = plan.id === "free"
      ? plan.historyDays + "-day history, " + plan.sessionsPerDay + " sessions a day. Upgrade for depth."
      : plan.tagline;
    $("#settingsName").textContent = user.username;
    $("#settingsEmail").textContent = user.email;
    $("#settingsPlanCopy").textContent = plan.name + " - " + (plan.historyDays >= 3650 ? "10-year history" : plan.historyDays + "-day history");
    $("#upgradeBtn").textContent = plan.id === "free" ? "See plans" : "Manage plan";
    $("#settingsUpgrade").textContent = plan.id === "free" ? "Go Pro" : "Manage plan";
  }

  function enterApp(profile, options) {
    user = profile;
    window.FFStore.init(profile);
    applyTheme();
    $("#landing").hidden = true;
    $("#authScreen").hidden = true;
    $("#app").hidden = false;
    document.body.setAttribute("data-view", "app");
    renderChrome();
    if (window.FFAuth.configured()) {
      window.FFAuth.fetchPlan().then(function (remotePlan) {
        if (!remotePlan || !window.FF_PLANS[remotePlan] || remotePlan === window.FFStore.plan().id) return;
        window.FFStore.setPlan(remotePlan);
        renderChrome();
        renderFor(currentPage);
      }).catch(function () { /* local plan stays */ });
    }
    var target = options && options.welcome ? "today" : pageFromHash();
    if (options && options.welcome) location.hash = "#/today";
    showPage(target);
    if (options && options.welcome) toast("Welcome, " + profile.username + ". One small thing is enough.");
    if (pendingPlan) {
      var chosen = pendingPlan;
      pendingPlan = null;
      try { sessionStorage.removeItem("ff.pendingPlan.v1"); } catch (err) { /* ignore */ }
      setTimeout(function () {
        if (!user) return;
        var checkout = checkoutUrl(window.FF_CONFIG.checkout[chosen] || "");
        if (checkout) { window.location.href = checkout; return; }
        openPlanModal("Checkout for " + window.FFPlanOf(chosen).name + " continues here.");
      }, 600);
    }
  }

  function showPage(page) {
    if (!PAGES[page]) page = "today";
    currentPage = page;
    $$(".page").forEach(function (section) {
      section.hidden = section.getAttribute("data-page") !== page;
    });
    $$(".nav-link[data-page]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-page") === page);
    });
    $("#pageHeading").textContent = PAGES[page].title;
    $("#todayLabel").textContent = PAGES[page].label;
    document.body.classList.remove("nav-open");
    renderFor(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderFor(page) {
    if (page === "today") renderToday();
    if (page === "focus") renderFocus();
    if (page === "dump") renderDump();
    if (page === "goals") renderGoals();
    if (page === "journal") renderJournal();
    if (page === "insights") renderInsights();
    if (page === "settings") renderSettings();
  }

  function route() {
    if (!user) {
      showLanding();
      return;
    }
    if (location.hash === "#/welcome") { location.hash = "#/today"; return; }
    showPage(pageFromHash());
  }

  var pendingFocusTask = null;
  var pendingPlan = null;
  var billing = "monthly";
  var ENERGY = { easy: "Warm-up", focus: "Focus", deep: "Deep work" };

  function taskNode(task, done) {
    var node = document.getElementById(done ? "tplDone" : "tplTask").content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.querySelector(".task-title").textContent = task.title;
    node.querySelector(".task-meta").textContent = task.minutes + " min - " + (ENERGY[task.energy] || "Focus");
    return node;
  }

  function renderToday() {
    var store = window.FFStore;
    var plan = store.plan();
    var focus = store.focusToday();
    var goal = Number(store.state().settings.dailyGoal) || 120;
    $("#statFocus").textContent = fmtMin(focus);
    $("#statFocusSub").textContent = "of " + fmtMin(goal) + " goal";
    $("#statFocusMeter").style.width = Math.min(100, Math.round((focus / goal) * 100)) + "%";

    var tasks = store.openTasks().slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    var done = store.doneToday();
    $("#statTasks").textContent = String(done.length);
    $("#statTasksSub").textContent = tasks.length
      ? tasks.length + " still open"
      : (done.length ? "all clear for today" : "nothing planned yet");
    $("#statStreak").textContent = String(store.streak());
    $("#statStreakSub").textContent = store.streak() ? "days in a row" : "one session starts it";

    var list = $("#todayList");
    list.textContent = "";
    tasks.forEach(function (task) { list.appendChild(taskNode(task, false)); });
    $("#todayEmpty").hidden = tasks.length > 0;
    $("#todayCount").textContent = tasks.length + (tasks.length === 1 ? " task" : " tasks");

    var next = store.nextTask();
    var nextCard = $("#nextTaskCard");
    if (next) {
      nextCard.hidden = false;
      $("#nextTaskTitle").textContent = next.title;
      $("#nextTaskStart").dataset.id = next.id;
    } else {
      nextCard.hidden = true;
    }

    var doneList = $("#doneList");
    doneList.textContent = "";
    done.forEach(function (task) { doneList.appendChild(taskNode(task, true)); });
    $("#doneCount").textContent = String(done.length);
    $("#doneEmpty").hidden = done.length > 0;

    renderRecap();
  }

  function renderRecap() {
    var store = window.FFStore;
    var key = store.shiftDays(todayKey(), -1);
    var day = store.state().days[key];
    var stats = $("#recapStats");
    var title = $("#recapTitle");
    var copy = $("#recapCopy");
    if (day && (day.focus > 0 || (day.done && day.done.length))) {
      title.textContent = "Yesterday you showed up.";
      copy.textContent = day.note
        ? '"' + day.note + '"'
        : "This is the record future-you gets to trust.";
      stats.hidden = false;
      stats.textContent = "";
      [
        [fmtMin(day.focus), "focused"],
        [String(day.done ? day.done.length : 0), "tasks done"],
        [String(day.sessions || 0), "sessions"]
      ].forEach(function (pair) {
        var block = el("div", "recap-stat");
        block.appendChild(el("b", null, pair[0]));
        block.appendChild(el("small", null, pair[1]));
        stats.appendChild(block);
      });
    } else {
      title.textContent = "Your first day starts now.";
      copy.textContent = "Finish one session and tomorrow's recap appears here - what moved, and what is next.";
      stats.hidden = true;
    }
    var next = store.nextTask();
    if (next) {
      copy.textContent += " Next: " + next.title + ".";
    }
  }

  function renderPlanRows() {
    var current = window.FFStore.plan();
    var wrap = $("#miniPlans");
    wrap.textContent = "";
    $$("[data-billing]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.billing === billing);
    });
    ["free", "plus", "pro", "premium"].forEach(function (id) {
      var plan = window.FFPlanOf(id);
      var isCurrent = current.id === id;
      var row = el("button", "mini-plan" + (isCurrent ? " is-current" : ""));
      row.dataset.plan = id;
      row.type = "button";
      var copy = el("div");
      copy.appendChild(el("b", null, plan.name + (isCurrent ? " - current" : "")));
      copy.appendChild(el("small", null, plan.tagline + (plan.id === "free" ? "" : " - " + plan.historyDays + "-day history")));
      row.appendChild(copy);
      var price = plan.price === 0
        ? "$0"
        : (billing === "yearly" ? "$" + plan.yearly + "/yr" : "$" + plan.price + "/mo");
      row.appendChild(el("span", "mini-price", price));
      wrap.appendChild(row);
    });
  }

  function openPlanModal(reason) {
    renderPlanRows();
    $("#checkoutNote").textContent = reason || "Prices in USD. Cancel any time. Pro and Premium features ship in phases.";
    openModal("planModal");
  }

  function startFocusWith(taskId) {
    var task = taskId ? window.FFStore.taskById(taskId) : null;
    pendingFocusTask = task ? task.id : null;
    if (task) {
      var allowed = window.FFStore.plan().minutes;
      activeMinutes = allowed.indexOf(task.minutes) !== -1 ? task.minutes : 25;
    }
    location.hash = "#/focus";
    if (currentPage === "focus") renderFocus();
  }

  function renderFocus() {
    var store = window.FFStore;
    var tasks = store.openTasks();
    var select = $("#focusTaskSelect");
    var keep = pendingFocusTask || select.value;
    select.textContent = "";
    var none = el("option", null, "No task - just focus");
    none.value = "";
    select.appendChild(none);
    tasks.forEach(function (task) {
      var option = el("option", null, task.title);
      option.value = task.id;
      select.appendChild(option);
    });
    if (keep && tasks.some(function (t) { return t.id === keep; })) select.value = keep;
    pendingFocusTask = null;

    var sessions = store.state().sessions.filter(function (s) { return s.date === todayKey(); });
    var list = $("#sessionList");
    list.textContent = "";
    sessions.forEach(function (session) {
      var node = document.getElementById("tplSession").content.firstElementChild.cloneNode(true);
      node.querySelector(".session-min").textContent = fmtMin(session.minutes);
      var task = session.taskId ? store.taskById(session.taskId) : null;
      node.querySelector(".session-what").textContent = task ? task.title : "Focus session";
      node.querySelector(".session-time").textContent = new Date(session.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      list.appendChild(node);
    });
    $("#sessionCount").textContent = String(sessions.length);
    $("#sessionEmpty").hidden = sessions.length > 0;
    $("#urgeNote").textContent = store.urgesOn(todayKey()) + " urges noticed today";

    var minutes = timer ? timer.total() / 60 : activeMinutes;
    if (timer && !timer.isRunning() && Math.round(minutes) !== activeMinutes) {
      timer.setMinutes(activeMinutes);
      minutes = activeMinutes;
    }
    $$(".mode-pill[data-minutes]").forEach(function (pill) {
      pill.classList.toggle("is-active", Number(pill.dataset.minutes) === minutes);
    });
    if (timer) updateTimerDisplay(timer.remaining(), timer.total());
  }

  function updateTimerDisplay(remaining, total) {
    $("#timerDisplay").textContent = clock(remaining);
    var progress = $("#ringProgress");
    var circumference = 829.38;
    var fraction = total > 0 ? remaining / total : 1;
    progress.style.strokeDashoffset = String(circumference * (1 - fraction));
    var running = timer && timer.isRunning();
    $("#timerState").textContent = running
      ? "focus in progress - stay here"
      : (remaining === total ? "ready when you are" : (remaining === 0 ? "session complete" : "paused - the clock is waiting"));
    $("#timerStart").textContent = running ? "Pause" : (remaining === 0 ? "Start again" : (remaining === total ? "Start focus" : "Resume"));
    document.title = running ? clock(remaining) + " - FocusFlow" : "FocusFlow - Make tomorrow easier";
  }

  function toggleTimer() {
    var store = window.FFStore;
    if (timer.isRunning()) { timer.pause(); return; }
    if (timer.remaining() === 0) timer.reset();
    var limit = store.plan().sessionsPerDay;
    if (store.sessionsOn(todayKey()) >= limit) {
      openPlanModal("Free includes " + limit + " sessions a day. Plus removes the limit.");
      return;
    }
    if (!ambient && store.plan().sound && store.state().settings.sound) toggleAmbient();
    timer.start();
  }

  function onSessionComplete() {
    var store = window.FFStore;
    var taskId = $("#focusTaskSelect").value || null;
    store.addSession({ taskId: taskId, minutes: Math.round(timer.total() / 60) });
    if (store.state().settings.notify && "Notification" in window && Notification.permission === "granted") {
      new Notification("Session complete", { body: "That is one rep. Log it and move on with your day." });
    }
    toast("Session logged. That counts.");
    if (shieldOn) exitShield();
    timer.reset();
    renderFocus();
  }

  function enterShield() {
    if (shieldOn) return;
    shieldOn = true;
    location.hash = "#/focus";
    shieldTimer = setTimeout(function () {
      shieldTimer = null;
      if (!shieldOn) return;
      document.body.classList.add("shield-mode");
      var exit = el("button", "shield-exit", "Exit full screen (Esc)");
      exit.id = "shieldExit";
      exit.addEventListener("click", exitShield);
      document.body.appendChild(exit);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    }, 80);
  }

  function exitShield() {
    if (shieldTimer) { clearTimeout(shieldTimer); shieldTimer = null; }
    document.body.classList.remove("shield-mode");
    shieldOn = false;
    var exit = document.getElementById("shieldExit");
    if (exit) exit.remove();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  function toggleAmbient() {
    var store = window.FFStore;
    if (!store.plan().sound) {
      openPlanModal("Ambient soundscapes are part of Plus.");
      return;
    }
    var button = $("#ambientBtn");
    if (ambient) {
      ambient.stop();
      ambient = null;
      button.textContent = "Ambient sound";
      toast("Sound off.");
      return;
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      var buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      var last = 0;
      for (var i = 0; i < data.length; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      var gain = ctx.createGain();
      gain.gain.value = 0.18;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      ambient = { ctx: ctx, source: source, gain: gain, stop: function () { try { source.stop(); ctx.close(); } catch (e) {} } };
      button.textContent = "Stop sound";
    } catch (err) {
      toast("Audio is blocked in this browser - try Chrome or Edge.");
    }
  }

  /* ---------------- dump ---------------- */
  function renderDump() {
    var store = window.FFStore;
    var items = store.state().dumps;
    var list = $("#dumpList");
    list.textContent = "";
    items.forEach(function (item) {
      var node = document.getElementById("tplDump").content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;
      node.querySelector(".dump-text").textContent = item.text;
      if (item.promoted) {
        var move = node.querySelector('[data-act="promote"]');
        move.textContent = "Moved to today";
        move.disabled = true;
      }
      list.appendChild(node);
    });
    $("#dumpTotal").textContent = String(items.length);
    $("#dumpEmpty").hidden = items.length > 0;
    $("#dumpCount").textContent = String(items.length);
  }

  /* ---------------- goals ---------------- */
  var HORIZONS = { daily: "Daily", weekly: "Weekly", "short-term": "Short-term", "long-term": "Long-term" };

  function renderGoals() {
    var store = window.FFStore;
    var goals = store.state().goals;
    var list = $("#goalList");
    list.textContent = "";
    goals.forEach(function (goal) {
      var node = document.getElementById("tplGoal").content.firstElementChild.cloneNode(true);
      node.dataset.id = goal.id;
      if (goal.done) node.classList.add("is-done");
      node.querySelector(".goal-title").textContent = goal.title;
      node.querySelector(".goal-tag").textContent = HORIZONS[goal.horizon] || "Weekly";
      var why = node.querySelector(".goal-why");
      why.textContent = goal.why || "";
      why.hidden = !goal.why;
      var action = node.querySelector(".goal-actions .chip-button");
      action.textContent = goal.done ? "Reopen" : "Mark reached";
      list.appendChild(node);
    });
    $("#goalCount").textContent = String(goals.length);
    $("#goalEmpty").hidden = goals.length > 0;
  }

  /* ---------------- journal ---------------- */
  function renderJournal() {
    var store = window.FFStore;
    var plan = store.plan();
    var state = store.state();
    var cutoff = store.shiftDays(todayKey(), -(plan.historyDays - 1));
    var keys = Object.keys(state.days).filter(function (key) {
      var day = state.days[key];
      return key >= cutoff && key <= todayKey() && (day.focus > 0 || (day.done && day.done.length) || day.note);
    }).sort(function (a, b) { return b.localeCompare(a); });

    $("#journalRange").textContent = plan.historyDays >= 3650 ? "Last 10 years" : "Last " + plan.historyDays + " days";
    var list = $("#journalList");
    list.textContent = "";
    keys.forEach(function (key) {
      var day = state.days[key];
      var node = document.getElementById("tplJournal").content.firstElementChild.cloneNode(true);
      node.dataset.key = key;
      var date = new Date(key + "T00:00:00");
      node.querySelector(".journal-day").textContent = key === todayKey() ? "TODAY" : "DAY";
      node.querySelector(".journal-title").textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      node.querySelector(".journal-focus").textContent = fmtMin(day.focus) + " focused";
      var stats = node.querySelector(".journal-stats");
      [
        [String(day.done ? day.done.length : 0), "tasks done"],
        [String(day.sessions || 0), "sessions"]
      ].forEach(function (pair) {
        var span = el("span");
        span.appendChild(el("b", null, pair[0]));
        span.appendChild(document.createTextNode(" " + pair[1]));
        stats.appendChild(span);
      });
      var note = node.querySelector(".journal-note textarea");
      note.value = day.note || "";
      note.addEventListener("change", function () {
        store.setNote(key, note.value);
        toast("Note saved for " + date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ".");
      });
      list.appendChild(node);
    });
    $("#journalEmpty").hidden = keys.length > 0;
  }

  /* ---------------- insights ---------------- */
  function renderInsights() {
    var store = window.FFStore;
    var plan = store.plan();
    var series = store.series(insightRange);
    var totalFocus = series.reduce(function (sum, day) { return sum + day.focus; }, 0);
    var totalSessions = series.reduce(function (sum, day) { return sum + day.sessions; }, 0);
    var totalUrges = series.reduce(function (sum, day) { return sum + day.urges; }, 0);
    var activeDays = series.filter(function (day) { return day.focus > 0; }).length || 1;
    $("#insAvg").textContent = fmtMin(Math.round(totalFocus / activeDays));
    $("#insSessions").textContent = String(totalSessions);
    $("#insUrges").textContent = String(totalUrges);
    $("#insRate").textContent = store.completion(insightRange) + "%";
    $("#chartTitle").textContent = insightRange === 7 ? "Last 7 days" : "Last 30 days";

    var chart = $("#barChart");
    chart.textContent = "";
    var peak = Math.max.apply(null, series.map(function (day) { return day.focus; }).concat([30]));
    series.forEach(function (day) {
      var col = document.getElementById("tplBar").content.firstElementChild.cloneNode(true);
      var fill = col.querySelector(".bar-fill");
      var height = day.focus > 0 ? Math.max(4, Math.round((day.focus / peak) * 100)) : 0;
      fill.style.height = height + "%";
      if (!day.focus) col.classList.add("is-empty");
      col.querySelector(".bar-label").textContent = day.label;
      col.title = day.focus + " minutes on " + day.key;
      chart.appendChild(col);
    });

    var best = series.slice().sort(function (a, b) { return b.focus - a.focus; })[0];
    $("#chartCaption").textContent = totalFocus
      ? "Best day: " + best.label + " with " + fmtMin(best.focus) + ". " + fmtMin(totalFocus) + " focused across " + insightRange + " days."
      : "No sessions yet. Start one and this becomes a trend.";

    $$(".range-toggle .mode-pill[data-range]").forEach(function (pill) {
      pill.classList.toggle("is-active", Number(pill.dataset.range) === insightRange);
    });
    $("#exportBtn").classList.toggle("is-locked", !plan.export);

    var notes = $("#insightNotes");
    if (notes) {
      notes.textContent = "";
      var lines = [];
      if (best && best.focus > 0) lines.push("Your strongest day was " + best.label + " - protect that slot next week.");
      lines.push("You noticed " + totalUrges + " urges. Noticing is the skill; resisting is the side effect.");
      lines.push(store.streak() + " day streak. A streak is a memory aid, not a debt.");
      lines.forEach(function (text) { notes.appendChild(el("li", null, text)); });
    }
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    var store = window.FFStore;
    var settings = store.state().settings;
    $("#themeSelect").value = settings.theme || "system";
    $("#goalSelect").value = String(settings.dailyGoal || 120);
    $("#soundToggle").checked = !!settings.sound;
    $("#notifyToggle").checked = !!settings.notify;
    $("#settingsPlanCopy").textContent = store.plan().name + " - " + (store.plan().historyDays >= 3650 ? "10-year history" : store.plan().historyDays + "-day history");
  }

  function previewPlan(plan) {
    window.FFStore.setPlan(plan.id);
    renderChrome();
    closeModals();
    toast("Preview unlock: " + plan.name + ". Connect checkout in js/config.js before launch.");
    renderFor(currentPage);
  }

  function checkoutUrl(base) {
    if (!base) return "";
    try {
      var url = new URL(base, location.href);
      if (user && user.id) url.searchParams.set("client_reference_id", user.id);
      if (user && user.email) url.searchParams.set("prefilled_email", user.email);
      return url.href;
    } catch (err) {
      return base;
    }
  }

  function choosePlan(id) {
    var plan = window.FFPlanOf(id);
    if (window.FFStore.plan().id === id) { toast("You are already on " + plan.name + "."); return; }
    if (plan.price === 0) {
      if (!window.FFAuth.configured()) { previewPlan(plan); return; }
      toast("Cancel your paid plan from the billing portal at the end of the period. Your data stays.");
      return;
    }
    var key = id + (billing === "yearly" ? "Yearly" : "");
    var url = checkoutUrl(window.FF_CONFIG.checkout[key] || "");
    if (url) { window.location.href = url; return; }
    if (!window.FFAuth.configured()) { previewPlan(plan); return; }
    toast(billing === "yearly"
      ? "Yearly checkout is not connected yet. Add " + key + " in js/config.js, or choose monthly."
      : "Checkout for " + plan.name + " is not connected yet - see SETUP.md.");
  }

  function managePlan() {
    var plan = window.FFStore.plan();
    if (plan.id !== "free" && window.FF_CONFIG.billingPortal) {
      window.location.href = window.FF_CONFIG.billingPortal;
      return;
    }
    openPlanModal(plan.id === "free"
      ? ""
      : "Manage or cancel through your billing portal. Add billingPortal in js/config.js to link it here.");
  }

  function confirmAction(title, copy, label, callback) {
    $("#confirmTitle").textContent = title;
    $("#confirmCopy").textContent = copy;
    $("#confirmBtn").textContent = label;
    confirmCallback = callback;
    openModal("confirmModal");
  }

  function exportJson() {
    var payload = window.FFStore.exportObject();
    download("focusflow-backup-" + todayKey() + ".json", JSON.stringify(payload, null, 2), "application/json");
    toast("Backup downloaded. It is yours.");
  }

  function exportCsv() {
    if (!window.FFStore.plan().export) {
      openPlanModal("CSV export is part of Plus.");
      return;
    }
    download("focusflow-sessions-" + todayKey() + ".csv", window.FFStore.csv(), "text/csv");
    toast("Sessions exported.");
  }

  /* ---------------- wiring ---------------- */
  function wireApp() {
    $("#menuBtn").addEventListener("click", function () { document.body.classList.add("nav-open"); });
    $("#sidebarClose").addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    $("#profileBtn").addEventListener("click", function () { location.hash = "#/settings"; });
    $("#topStartBtn").addEventListener("click", function () { startFocusWith(null); });
    $("#topShieldBtn").addEventListener("click", enterShield);
    $("#startFocusCard").addEventListener("click", function () { startFocusWith(null); });
    $("#upgradeBtn").addEventListener("click", managePlan);
    $("#settingsUpgrade").addEventListener("click", managePlan);
    $("#settingsSignOut").addEventListener("click", signOut);
    $("#sidebarSignOut").addEventListener("click", signOut);

    $("#taskForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var title = $("#taskInput").value.trim();
      if (!title) return;
      if (window.FFStore.openTasks().length >= window.FFStore.plan().openTasks) {
        openPlanModal("Free is capped at " + window.FFStore.plan().openTasks + " open tasks. Plus removes the cap.");
        return;
      }
      window.FFStore.addTask({
        title: title,
        minutes: 25,
        energy: $("#energyChip").value || "focus"
      });
      $("#taskInput").value = "";
      renderToday();
      toast("Added. One small first step beats a perfect plan.");
    });

    $("#todayList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-act]");
      if (!button) return;
      var id = button.closest(".task-item").dataset.id;
      var act = button.dataset.act;
      if (act === "done") {
        window.FFStore.completeTask(id);
        renderToday();
        renderChrome();
        toast("Done. That is the evidence.");
      }
      if (act === "focus") startFocusWith(id);
      if (act === "delete") {
        window.FFStore.deleteTask(id);
        renderToday();
      }
    });

    $("#doneList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-act]");
      if (!button) return;
      var id = button.closest(".task-item").dataset.id;
      window.FFStore.restoreTask(id);
      renderToday();
      toast("Back on your list.");
    });

    $("#nextTaskStart").addEventListener("click", function () {
      startFocusWith(this.dataset.id);
    });

    /* focus */
    $("#timerStart").addEventListener("click", toggleTimer);
    $("#timerReset").addEventListener("click", function () {
      timer.reset();
      renderFocus();
    });
    $("#shieldBtn").addEventListener("click", enterShield);
    $("#ambientBtn").addEventListener("click", toggleAmbient);
    $("#urgeBtn").addEventListener("click", function () {
      window.FFStore.addUrge("focus session");
      renderFocus();
      toast("Logged. You stayed.");
    });
    $$(".mode-pill[data-minutes]").forEach(function (pill) {
      pill.addEventListener("click", function () {
        var minutes = Number(pill.dataset.minutes);
        if (window.FFStore.plan().minutes.indexOf(minutes) === -1) {
          openPlanModal(minutes + "-minute sessions are part of Plus.");
          return;
        }
        activeMinutes = minutes;
        timer.setMinutes(minutes);
        renderFocus();
      });
    });

    $$(".range-toggle .mode-pill[data-range]").forEach(function (pill) {
      pill.addEventListener("click", function () {
        var range = Number(pill.dataset.range);
        if (range === 30 && window.FFStore.plan().historyDays < 30) {
          openPlanModal("30-day insights are part of Plus.");
          return;
        }
        insightRange = range;
        renderInsights();
      });
    });

    /* dump */
    $("#dumpForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = $("#dumpInput");
      var item = window.FFStore.addDump(input.value);
      if (!item) return;
      input.value = "";
      renderDump();
      toast("Out of your head, into the inbox.");
    });

    $("#dumpList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-act]");
      if (!button) return;
      var id = button.closest(".dump-item").dataset.id;
      if (button.dataset.act === "promote") {
        window.FFStore.promoteDump(id);
        renderDump();
        toast("Promoted to today's list.");
      }
      if (button.dataset.act === "remove") {
        window.FFStore.removeDump(id);
        renderDump();
      }
    });

    /* goals */
    $("#goalForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var title = $("#goalTitle").value.trim();
      if (!title) return;
      var goalPlan = window.FFStore.plan();
      if (window.FFStore.state().goals.length >= goalPlan.goals) {
        openPlanModal(goalPlan.id === "free"
          ? "Free holds 3 goals. Plus holds 10, Pro is unlimited."
          : "Plus holds " + goalPlan.goals + " goals. Pro is unlimited.");
        return;
      }
      window.FFStore.addGoal({
        title: title,
        horizon: $("#goalHorizon").value,
        why: $("#goalWhy").value.trim()
      });
      $("#goalTitle").value = "";
      $("#goalWhy").value = "";
      renderGoals();
      toast("Goal saved. Direction beats speed.");
    });

    $("#goalList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-act]");
      if (!button) return;
      var id = button.closest(".goal-item").dataset.id;
      if (button.dataset.act === "toggle") {
        window.FFStore.toggleGoal(id);
        renderGoals();
      }
      if (button.dataset.act === "remove") {
        window.FFStore.removeGoal(id);
        renderGoals();
      }
    });

    /* settings */
    $("#themeSelect").addEventListener("change", function () {
      window.FFStore.setSetting("theme", this.value);
      applyTheme();
    });
    $("#goalSelect").addEventListener("change", function () {
      window.FFStore.setSetting("dailyGoal", Number(this.value));
      renderToday();
      toast("Daily goal updated.");
    });
    $("#soundToggle").addEventListener("change", function () {
      window.FFStore.setSetting("sound", this.checked);
    });
    $("#notifyToggle").addEventListener("change", function () {
      var input = this;
      if (!input.checked) { window.FFStore.setSetting("notify", false); return; }
      if (!("Notification" in window)) {
        input.checked = false;
        toast("This browser has no notification support.");
        return;
      }
      Notification.requestPermission().then(function (permission) {
        var allowed = permission === "granted";
        input.checked = allowed;
        window.FFStore.setSetting("notify", allowed);
        if (!allowed) toast("Notifications stay off until you allow them in the browser.");
      });
    });
    $("#exportJson").addEventListener("click", exportJson);
    $("#exportCsv").addEventListener("click", exportCsv);
    $("#importBtn").addEventListener("click", function () { $("#importFile").click(); });
    $("#importFile").addEventListener("change", function () {
      var input = this;
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast("That file is larger than 4 MB. Export a fresh backup and try again."); return; }
      var reader = new FileReader();
      reader.onerror = function () { toast("Could not read that file."); };
      reader.onload = function () {
        var payload;
        try { payload = JSON.parse(String(reader.result)); } catch (err) { toast("That file is not valid JSON."); return; }
        var data = payload && payload.data ? payload.data : payload;
        if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) {
          toast("That does not look like a FocusFlow backup.");
          return;
        }
        var plan = window.FFStore.plan();
        confirmAction("Replace this account's data?", "Current tasks, sessions, notes and goals will be replaced by the backup. The backup's plan is ignored - you stay on " + plan.name + ".", "Import", function () {
          try {
            timer.reset();
            window.FFStore.importObject(payload);
            applyTheme();
            renderChrome();
            renderFor(currentPage);
            toast("Backup restored. Check Today and Insights.");
          } catch (err) {
            toast("That backup could not be imported.");
          }
        });
      };
      reader.readAsText(file);
    });
    $("#exportBtn").addEventListener("click", exportCsv);
    $("#deleteData").addEventListener("click", function () {
      confirmAction("Delete this account's data?", "Tasks, sessions, notes and goals stored on this device are erased. Export a backup first if you want a copy.", "Delete data", function () {
        timer.reset();
        if (ambient) { ambient.stop(); ambient = null; $("#ambientBtn").textContent = "Ambient sound"; }
        window.FFStore.clearAll();
        applyTheme();
        renderFor(currentPage);
        renderChrome();
        toast("Local data deleted.");
      });
    });

    /* plans and modals */
    $("#miniPlans").addEventListener("click", function (event) {
      var row = event.target.closest("[data-plan]");
      if (!row) return;
      choosePlan(row.dataset.plan);
    });
    $$("[data-billing]").forEach(function (button) {
      button.addEventListener("click", function () {
        billing = button.dataset.billing === "yearly" ? "yearly" : "monthly";
        renderPlanRows();
      });
    });
    $$("[data-checkout]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!user) {
          pendingPlan = button.dataset.checkout;
          try { sessionStorage.setItem("ff.pendingPlan.v1", pendingPlan); } catch (err) { /* storage blocked */ }
          showAuth();
          return;
        }
        choosePlan(button.dataset.checkout);
      });
    });
    $$("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", closeModals);
    });
    $$(".modal-backdrop").forEach(function (backdrop) {
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) closeModals();
      });
    });
    $("#confirmBtn").addEventListener("click", function () {
      var callback = confirmCallback;
      closeModals();
      confirmCallback = null;
      if (callback) callback();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Tab" && activeModal && !activeModal.hidden) {
        var focusable = activeModal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])");
        if (focusable.length) {
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
      if (event.key === "Escape") {
        if (shieldOn) exitShield();
        closeModals();
        document.body.classList.remove("nav-open");
      }
      if (event.code === "Space" && currentPage === "focus" && user && !document.querySelector(".modal-backdrop:not([hidden])")) {
        var tag = document.activeElement ? document.activeElement.tagName : "";
        if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].indexOf(tag) === -1) {
          event.preventDefault();
          toggleTimer();
        }
      }
    });

    document.addEventListener("click", function (event) {
      if (!document.body.classList.contains("nav-open")) return;
      if (event.target.closest(".sidebar") || event.target.closest("#menuBtn")) return;
      document.body.classList.remove("nav-open");
    });

    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && shieldOn) exitShield();
    });

    window.addEventListener("hashchange", route);
  }

  async function signOut() {
    await window.FFAuth.signOut();
    user = null;
    timer.reset();
    if (ambient) { ambient.stop(); ambient = null; $("#ambientBtn").textContent = "Ambient sound"; }
    exitShield();
    closeModals();
    document.body.classList.remove("nav-open");
    document.title = "FocusFlow - Make tomorrow easier";
    location.hash = "#/welcome";
    showLanding();
  }

  function boot() {
    try { pendingPlan = sessionStorage.getItem("ff.pendingPlan.v1") || null; } catch (err) { pendingPlan = null; }
    wireAuth();
    wireApp();
    timer = new window.FFTimer({
      minutes: 25,
      onTick: updateTimerDisplay,
      onComplete: onSessionComplete
    });
    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    if (window.matchMedia) {
      var media = window.matchMedia("(prefers-color-scheme: dark)");
      if (media.addEventListener) media.addEventListener("change", applyTheme);
    }
    window.FFAuth.restore().then(function (profile) {
      if (profile && profile.email) enterApp(profile);
      else showLanding();
    }).catch(function () { showLanding(); });
  }

  boot();
})();