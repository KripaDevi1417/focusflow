# FocusFlow

**Make tomorrow easier on yourself.**

FocusFlow is a calm, premium task manager for people whose brains have too many tabs open. Catch the thought, shrink the task to its two-minute version, and protect the next 25 minutes. Every day then leaves a record: what moved, and what is next.

Live (GitHub Pages): <https://kripadevi1417.github.io/focusflow/>

---

## What is in this build

- **Landing page** with positioning, pricing, privacy and FAQ.
- **Two-step sign-in** - Google OAuth, a six-digit email code, or a one-click email link. No passwords.
- **App shell** with Today, Focus, Brain dump, Goals, Journal, Insights and Settings.
- **Focus timer** - 25 / 50 / 90 minute sessions, SVG progress ring, tab-title countdown, fullscreen shield, brown-noise soundscape, spacebar start/pause.
- **Daily record** - minutes, sessions, tasks done and a one-line note per day; yesterday recap and streak.
- **Brain dump** - park a thought, promote it into a task later.
- **Urge log** - name the impulse instead of obeying it.
- **Goals** with horizon and a why.
- **Insights** - 7/30-day bar chart, honest averages, completion rate.
- **Privacy controls** - per-account storage, JSON backup and restore, CSV export (Plus), delete-all.
- **Free / Plus $2 / Pro $3 / Premium $5** tiers, with limits enforced in the app.
- **Plain-language privacy policy and terms** in `privacy.html` and `terms.html`, linked from the footer and sign-in.

## Stack

Vanilla HTML, CSS and JavaScript. No build step, no framework, no npm install. Classic scripts so the page also opens directly from disk.

| File | Purpose |
| --- | --- |
| `index.html` | Landing, auth, app shell, templates |
| `privacy.html` | Privacy policy in plain language |
| `terms.html` | Terms of use |
| `styles.css` | Design system, light/dark themes, responsive layout |
| `favicon.svg` | Brand icon used by every page |
| `js/config.js` | Supabase keys, checkout links, billing portal, plan definitions |
| `js/auth.js` | Google OAuth, email OTP, session restore, preview fallback |
| `js/store.js` | Per-account state, history, stats, export/import |
| `js/timer.js` | Timestamp-based focus timer |
| `js/app.js` | Routing, rendering, gating, modals, wiring |
| `supabase/schema.sql` | Tables, indexes, RLS policies, plan guard |

## Run it locally

```powershell
python -m http.server 5173
# open http://127.0.0.1:5173/
```

Opening `index.html` directly also works for the landing page and preview sign-in. Use a server when you configure Supabase, because OAuth redirects need a real origin.

## Preview mode vs connected mode

With no Supabase keys the app runs in **clearly-labelled preview mode**:

- the six-digit code is shown on screen instead of emailed;
- data is stored only in this browser, namespaced per account;
- plan buttons unlock locally so the paid surfaces can be tested.

This is deliberate. A static page cannot send email or take payments by itself. Add the free Supabase project and checkout links to turn on real auth and billing: **[SETUP.md](SETUP.md)**.

## Pricing

| Plan | Price | Highlights |
| --- | --- | --- |
| Free | $0 | 10 open tasks, 4 sessions/day, 7-day history, 3 goals |
| Plus | $2/mo ($20/yr) | Unlimited tasks and sessions, 30-day history, 10 goals, 90-min sessions, ambient sound, CSV export |
| Pro | $3/mo ($30/yr) | Everything in Plus, 1-year history; AI step-split, calendar export, streak repair and themes are roadmap items |
| Premium | $5/mo ($50/yr) | Everything in Pro, priority support, early access; rooms and weekly review are roadmap items |

See [FEATURES.md](FEATURES.md) for exactly what ships now and what is phased, and for the market research behind the positioning.

## Privacy in one paragraph

Each account gets its own storage namespace (`ff.data.v1.<account id>`). Nothing is pooled, shown to other users, or sent anywhere in preview mode. In connected mode, `supabase/schema.sql` enables row-level security on every table, so a query can only ever return the caller's rows; a trigger blocks users from granting themselves a paid plan. Export, import and delete live in Settings. The plain-language policy is in [`privacy.html`](privacy.html), with terms in [`terms.html`](terms.html).

## Deploy

GitHub Pages serves the repository root. Push these files to `main`, then **Settings -> Pages -> Deploy from a branch -> main / (root)**. For a project site the URL is `https://<user>.github.io/focusflow/`; set that exact URL as `siteUrl` in `js/config.js` and in Supabase Auth redirect settings.

## Status

- Working now: landing, preview auth, app, timer, history, goals, dump, insights, settings, plan gating, export/import, legal pages.
- Needs your keys: email sign-in, Google OAuth, live checkout. Six-digit codes also need custom SMTP; the default Supabase email sends a link.
- Not built yet: cross-device sync. The Postgres schema and RLS policies are included and ready; the client is local-first today.
- Roadmap: sync, AI step-split, calendar feed, accountability rooms, weekly review email, native app blockers.

Built for the person who is trying.