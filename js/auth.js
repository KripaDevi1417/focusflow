/* ============================================================
   FocusFlow auth
   Google OAuth + email OTP through Supabase when configured.
   With no keys, a clearly-labelled preview mode shows the code
   on screen so the flow can still be tested end to end.
   ============================================================ */
window.FFAuth = (function () {
  var C = window.FF_CONFIG;
  var SESSION_KEY = "ff.session.v1";
  var DEMO_KEY = "ff.demo.otp.v1";
  var RESEND_SECONDS = 45;
  var clientPromise = null;

  function configured() {
    return !!(C.supabaseUrl && C.supabaseAnonKey);
  }

  function mode() {
    return configured() ? "supabase" : "preview";
  }

  function getClient() {
    if (!configured()) return Promise.resolve(null);
    if (!clientPromise) {
      clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(function (mod) {
          return mod.createClient(C.supabaseUrl, C.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          });
        })
        .catch(function (err) {
          clientPromise = null;
          throw err;
        });
    }
    return clientPromise;
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (e) { return null; }
  }

  function saveSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (e) { /* storage blocked */ }
    return user;
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ }
  }

  function normaliseEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(value));
  }

  function randomCode() {
    try {
      var buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return String(100000 + (buf[0] % 900000));
    } catch (e) {
      return String(100000 + Math.floor(Math.random() * 900000));
    }
  }

  function readDemo() {
    try { return JSON.parse(sessionStorage.getItem(DEMO_KEY) || "null"); }
    catch (e) { return null; }
  }

  function writeDemo(payload) {
    try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(payload)); } catch (e) { /* storage blocked */ }
  }

  function mapUser(su, fallbackName) {
    var meta = su.user_metadata || {};
    var email = normaliseEmail(su.email);
    return saveSession({
      id: su.id,
      email: email,
      username: meta.username || meta.full_name || fallbackName || email.split("@")[0],
      provider: (su.app_metadata && su.app_metadata.provider) || "email",
      createdAt: su.created_at || new Date().toISOString()
    });
  }

  function friendly(error) {
    var msg = (error && error.message) || "";
    if (/rate limit|too many/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
    if (/invalid|expired|token/i.test(msg)) return "That code is not valid or has expired. Request a new one.";
    if (/fetch|network|failed to load/i.test(msg)) return "Network problem reaching the sign-in service. Check your connection.";
    return msg || "Something went wrong. Please try again.";
  }

  async function sendCode(emailInput, usernameInput) {
    var email = normaliseEmail(emailInput);
    var username = String(usernameInput || "").trim();
    if (!validEmail(email)) return { ok: false, error: "Enter a valid email address." };

    if (configured()) {
      try {
        var client = await getClient();
        var res = await client.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: true,
            data: { username: username || email.split("@")[0] },
            emailRedirectTo: C.siteUrl || undefined
          }
        });
        if (res.error) return { ok: false, error: friendly(res.error) };
        return { ok: true, mode: "supabase" };
      } catch (err) {
        return { ok: false, error: friendly(err) };
      }
    }

    var previous = readDemo();
    var now = Date.now();
    if (previous && previous.email === email && now - previous.sentAt < RESEND_SECONDS * 1000) {
      return { ok: false, error: "A code was just sent. Wait " + Math.ceil((RESEND_SECONDS * 1000 - (now - previous.sentAt)) / 1000) + "s before resending." };
    }
    var code = randomCode();
    writeDemo({ email: email, username: username, code: code, sentAt: now, expiresAt: now + 10 * 60 * 1000, attempts: 0 });
    return { ok: true, mode: "preview", demoCode: code };
  }

  async function verifyCode(emailInput, codeInput) {
    var email = normaliseEmail(emailInput);
    var code = String(codeInput || "").replace(/\D/g, "");
    if (code.length !== 6) return { ok: false, error: "Enter all six digits." };

    if (configured()) {
      try {
        var client = await getClient();
        var res = await client.auth.verifyOtp({ email: email, token: code, type: "email" });
        if (res.error) return { ok: false, error: friendly(res.error) };
        if (!res.data || !res.data.user) return { ok: false, error: "Could not verify that code." };
        return { ok: true, user: mapUser(res.data.user) };
      } catch (err) {
        return { ok: false, error: friendly(err) };
      }
    }

    var demo = readDemo();
    if (!demo || demo.email !== email) return { ok: false, error: "Request a code first." };
    if (Date.now() > demo.expiresAt) return { ok: false, error: "That code expired. Request a new one." };
    if (demo.attempts >= 5) return { ok: false, error: "Too many tries. Request a new code." };
    if (demo.code !== code) {
      demo.attempts += 1;
      writeDemo(demo);
      return { ok: false, error: "Incorrect code. " + (5 - demo.attempts) + " tries left." };
    }
    try { sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ }
    return {
      ok: true,
      user: saveSession({
        id: "preview:" + email,
        email: email,
        username: demo.username || email.split("@")[0],
        provider: "email",
        createdAt: new Date().toISOString()
      })
    };
  }

  async function google() {
    if (!configured()) return { ok: false, error: "preview" };
    try {
      var client = await getClient();
      var res = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: C.siteUrl || (location.origin + location.pathname),
          queryParams: { prompt: "select_account" }
        }
      });
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true, redirect: true };
    } catch (err) {
      return { ok: false, error: friendly(err) };
    }
  }

  async function restore() {
    if (configured()) {
      try {
        var client = await getClient();
        var res = await client.auth.getSession();
        var session = res && res.data && res.data.session;
        return session && session.user ? mapUser(session.user) : null;
      } catch (err) {
        return null;
      }
    }
    return readSession();
  }

  async function fetchPlan() {
    if (!configured()) return null;
    try {
      var client = await getClient();
      var session = await client.auth.getSession();
      var active = session && session.data && session.data.session;
      if (!active) return null;
      var row = await client.from("profiles").select("plan").eq("id", active.user.id).maybeSingle();
      if (row.error || !row.data) return null;
      return row.data.plan || null;
    } catch (err) {
      return null;
    }
  }

  async function signOut() {
    if (configured()) {
      try {
        var client = await getClient();
        await client.auth.signOut();
      } catch (err) {
        /* local sign-out still applies */
      }
    }
    clearSession();
  }

  return {
    mode: mode,
    configured: configured,
    sendCode: sendCode,
    verifyCode: verifyCode,
    google: google,
    restore: restore,
    fetchPlan: fetchPlan,
    signOut: signOut,
    readSession: readSession,
    validEmail: validEmail,
    normaliseEmail: normaliseEmail,
    resendSeconds: RESEND_SECONDS
  };
})();
