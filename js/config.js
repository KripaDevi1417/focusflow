/* ============================================================
   FocusFlow configuration
   ------------------------------------------------------------
   1) Create a free Supabase project and paste the URL + anon key
      below to enable real Google sign-in and email OTP.
   2) Paste Stripe or Razorpay payment links to enable checkout.
   With no keys the app runs in clearly-labelled preview mode.
   ============================================================ */
window.FF_CONFIG = {
  supabaseUrl: "https://bkysbyronqpqyrtgifzz.supabase.co",
  supabaseAnonKey: "sb_publishable_a9WuKENxiwyhr9HYYtgL3w_t-F4Ve4v",
  siteUrl: "https://kripadevi1417.github.io/focusflow/",
  checkout: {
    plus: "",
    pro: "",
    premium: "",
    plusYearly: "",
    proYearly: "",
    premiumYearly: ""
  },
  billingPortal: "",
  supportEmail: "hello@focusflow.app"
};

window.FF_PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    yearly: 0,
    tagline: "The core loop, forever",
    historyDays: 7,
    openTasks: 10,
    sessionsPerDay: 4,
    goals: 3,
    minutes: [25, 50],
    sound: false,
    export: false,
    ai: false,
    calendar: false,
    streakRepair: false,
    themes: false,
    rooms: false,
    weeklyReview: false,
    support: false
  },
  plus: {
    id: "plus",
    name: "Plus",
    price: 2,
    yearly: 20,
    tagline: "Unlimited focus, 30-day history",
    historyDays: 30,
    openTasks: Infinity,
    sessionsPerDay: Infinity,
    goals: 10,
    minutes: [25, 50, 90],
    sound: true,
    export: true,
    ai: false,
    calendar: false,
    streakRepair: false,
    themes: false,
    rooms: false,
    weeklyReview: false,
    support: false
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 3,
    yearly: 30,
    tagline: "Deep work and a year of evidence",
    historyDays: 365,
    openTasks: Infinity,
    sessionsPerDay: Infinity,
    goals: Infinity,
    minutes: [25, 50, 90],
    sound: true,
    export: true,
    ai: true,
    calendar: true,
    streakRepair: true,
    themes: true,
    rooms: false,
    weeklyReview: false,
    support: false
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 5,
    yearly: 50,
    tagline: "Accountability and priority support",
    historyDays: 3650,
    openTasks: Infinity,
    sessionsPerDay: Infinity,
    goals: Infinity,
    minutes: [25, 50, 90],
    sound: true,
    export: true,
    ai: true,
    calendar: true,
    streakRepair: true,
    themes: true,
    rooms: true,
    weeklyReview: true,
    support: true
  }
};

window.FFPlanOf = function (id) {
  return window.FF_PLANS[id] || window.FF_PLANS.free;
};