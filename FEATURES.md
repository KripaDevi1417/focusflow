# FocusFlow features and plans

What ships today, what needs your keys, and what is deliberately phased. Prices are USD; monthly first, yearly in brackets.

## Plan matrix

| Capability | Free | Plus $2 ($20) | Pro $3 ($30) | Premium $5 ($50) |
| --- | --- | --- | --- | --- |
| Open tasks | 10 | Unlimited | Unlimited | Unlimited |
| Focus sessions per day | 4 | Unlimited | Unlimited | Unlimited |
| History | 7 days | 30 days | 1 year | 10 years |
| Goals | 3 | 10 | Unlimited | Unlimited |
| Session lengths | 25, 50 | 25, 50, 90 | 25, 50, 90 | 25, 50, 90 |
| Fullscreen shield + tab countdown | Yes | Yes | Yes | Yes |
| Streak | Yes | Yes | Yes; repair in Phase 2 | Yes; repair in Phase 2 |
| Ambient soundscape | - | Yes | Yes | Yes |
| CSV export | - | Yes | Yes | Yes |
| 30-day insights | - | Yes | Yes | Yes |
| Smart step-split (AI) | - | - | Phase 2 | Phase 2 |
| Calendar export | - | - | Phase 2 | Phase 2 |
| Custom themes | - | - | Phase 2 | Phase 2 |
| Accountability rooms | - | - | - | Phase 2 |
| Weekly review email | - | - | - | Phase 2 |
| Priority support / early access | - | - | - | Yes |

Limits are enforced in `js/app.js` and defined once in `js/config.js` (`FF_PLANS`). Change a number there and the UI, the gates and the plan modal follow.

## Working now

- Landing page, responsive layout, light and dark themes.
- Two-step auth: Google OAuth and email sign-in through Supabase when configured; six-digit codes require custom SMTP, while the default free-tier email sends a link the app also accepts. On-screen codes remain the preview fallback.
- Per-account local storage with JSON export and import, CSV export (Plus) and delete.
- Today: tasks, next-task card, done list, yesterday recap, streak, daily goal meter.
- Focus: 25/50/90 timer, SVG ring, pause/resume, fullscreen shield, tab-title countdown, spacebar shortcut, ambient brown noise, urge log, session history.
- Brain dump with promote-to-task.
- Goals with horizon and why.
- Journal: one card per active day, minutes, sessions, tasks, a one-line note.
- Insights: 7/30-day chart, average, completion rate, observations.
- Settings: theme, goal, sound preference, notifications, export/import, plan, sign out, delete data.
- Four plans with real gating, monthly/yearly checkout links, server-side plan sync and a billing-portal option.
- Plain-language privacy policy and terms.

## Needs your configuration

- Real email delivery (Supabase + SMTP).
- Google sign-in (Google Cloud + Supabase provider).
- Live payments (Stripe or Razorpay links plus a plan-granting webhook).

Not built yet: cross-device sync. The schema and RLS policies are ready, but the client remains local-first; do not advertise sync until it ships.

## Phase 2 - the honest roadmap

1. **Sync layer**: replace `FFStore` internals with Supabase queries, keep the same API so the UI does not change. Conflict rule: last write wins per row, day rows are merged.
2. **AI step-split**: send only the task title to a small model, return three concrete first steps. Gate at Pro. Never send history or journal notes.
3. **Calendar export**: generate an `.ics` with focus blocks and deadlines. Pro.
4. **Accountability rooms**: 2-5 person silent co-working sessions with start/stop presence. Premium. No chat by default.
5. **Weekly review email**: Sunday summary of minutes, tasks, urges and the next task. Premium, opt-in, one click unsubscribe.
6. **App blocking**: native only. A web app cannot block other apps; be explicit about that instead of pretending a timer is a blocker.

## Why this positioning

The market is real and growing:

- Study-planner apps were about **$2.7B in 2025**, projected to **$4.42B by 2034** at an **11.2% CAGR**; roughly **64%** of revenue is freemium and North America holds about **35%** ([Dataintelo](https://dataintelo.com/report/study-planner-apps-market)).
- About **238 million** post-secondary students worldwide; the barrier is rarely demand, it is activation. Industry commentary argues password-based signup loses a large share of student users, which is why Google + email code is the only auth here ([Microniche Browser](https://www.micronichebrowser.com/blog/student-productivity-tools-untapped-saas-market)).
- Screen time is not a moral panic: a 2025 meta-analysis of **71,633 university students** found elevated odds of depression (OR 1.93, 95% CI 1.75-2.12) and eye strain (OR 1.96), with risk climbing sharply after **2.5 hours a day** and about **15% per additional hour** ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13113371/)).

Competitor pricing leaves a clear gap:

- **Opal**: free with 3 rules; Pro around **$8.33/mo** billed yearly, **$19.99/mo** monthly, **$399** lifetime ([pricing](https://opalapp.com/pricing)).
- **Freedom**: free basic blocking; Premium about **$3.33/mo** yearly, **$8.99/mo** monthly, lifetime around **$99** ([pricing](https://freedom.to/premium)).
- **Sunsama**: **$17/mo** yearly, **$22/mo** monthly, 14-day trial ([pricing](https://www.sunsama.com/pricing)).

The gap FocusFlow fills: a calm, anti-guilt system for students at **$2-$5 a month** that covers capture, starting, protecting, recovering and reflecting - not just blocking, and not a $17 project-management suite.

## What FocusFlow deliberately does not do

- No public profiles, followers, leaderboards or comparison.
- No ads and no selling behavioural data.
- No streak shaming, red debt counters or "you failed" copy.
- No claim that a web timer blocks other apps. That needs a native build, and the copy says so.

## Pricing rules

- Prices may rise as the audience grows; existing subscribers keep the price they signed up at.
- Regional and student pricing is applied at checkout, not by silently changing the listed price.
- Yearly is roughly ten months for twelve: $20 / $30 / $50.
- Cancel any time; access runs to the end of the paid period; export stays free.