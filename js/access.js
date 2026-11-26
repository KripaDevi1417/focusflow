/* ============================================================
   FocusFlow access rules
   One source of truth for what each plan can open.
   UI gates call FFAccess.can(); the store still owns the data.
   ============================================================ */
window.FFAccess = (function () {
  "use strict";

  var FEATURES = {
    "theme.daylight":    { min: 0, label: "Daylight" },
    "theme.midnight":    { min: 0, label: "Midnight" },
    "theme.funky":       { min: 1, label: "Funky" },
    "theme.neon":        { min: 2, label: "Neon" },
    "ambient.basic":     { min: 0, label: "Brown noise" },
    "ambient.studio":    { min: 1, label: "Sound studio" },
    "ambient.generative":{ min: 2, label: "Generative music" },
    "ritual.daily":      { min: 1, label: "Daily ritual" },
    "insights.advanced": { min: 2, label: "Advanced insights" },
    "tasks.recurring":   { min: 2, label: "Recurring tasks" },
    "tasks.templates":   { min: 2, label: "Task templates" },
    "calendar.export":   { min: 2, label: "Calendar export" },
    "command.palette":   { min: 2, label: "Command palette" },
    "smart.plan":        { min: 3, label: "Smart Plan" },
    "sync.devices":      { min: 3, label: "Device sync" },
    "rooms.focus":       { min: 3, label: "Focus rooms" }
  };

  function planId() {
    try {
      if (window.FFStore && window.FFStore.state()) return window.FFStore.state().plan || "free";
    } catch (err) { /* store not ready */ }
    return "free";
  }

  function plan() {
    return window.FFPlanOf ? window.FFPlanOf(planId()) : { id: "free", name: "Free", level: 0 };
  }

  function level() {
    var p = plan();
    return typeof p.level === "number" ? p.level : 0;
  }

  function feature(name) {
    return FEATURES[name] || { min: 3, label: "Premium" };
  }

  function can(name) {
    if (Array.isArray(name)) {
      return name.every(function (item) { return can(item); });
    }
    return level() >= feature(name).min;
  }

  function planFor(name) {
    var min = feature(name).min;
    var ids = ["free", "plus", "pro", "premium"];
    for (var i = 0; i < ids.length; i++) {
      if (window.FF_PLANS && window.FF_PLANS[ids[i]] && window.FF_PLANS[ids[i]].level === min) return window.FF_PLANS[ids[i]];
    }
    return window.FF_PLANS ? window.FF_PLANS.premium : { name: "Premium" };
  }

  function requireLabel(name) {
    return planFor(name).name;
  }

  function themeAllowed(name) {
    return can("theme." + name);
  }

  return {
    features: FEATURES,
    planId: planId,
    plan: plan,
    level: level,
    can: can,
    feature: feature,
    requiredPlan: planFor,
    requireLabel: requireLabel,
    themeAllowed: themeAllowed
  };
})();