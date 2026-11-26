# FocusFlow - features, plans and build status

FocusFlow is a calm task manager for people whose brains have too many tabs open. The loop is: **capture -> choose -> shrink -> start -> protect -> recover -> review**. Prices are USD; monthly first, yearly in brackets.

## Plan matrix

| Capability | Free $0 | Plus $2 ($20/yr) | Pro $3 ($30/yr) | Premium $5 ($50/yr) |
| --- | --- | --- | --- | --- |
| Open tasks | 10 | Unlimited | Unlimited | Unlimited |
| Focus sessions / day | 4 | Unlimited | Unlimited | Unlimited |
| History | 7 days | 30 days | 1 year | 10 years |
| Goals | 3 | 10 | Unlimited | Unlimited |
| Session lengths | 25, 50 | 25, 50, 90 | 25, 50, 90 + custom | 25, 50, 90 + custom |
| Fullscreen shield + tab countdown | Yes | Yes | Yes | Yes |
| Basic sound (brown noise) | Yes | Yes | Yes | Yes |
| Sound studio + mixer | - | 8 sounds | Full mixer | Adaptive soundscapes |
| Daily ritual + focus quests | - | Yes | Yes | Yes |
| Themes | Daylight, Midnight | + Funky | + Neon | All + custom accents |
| CSV export | - | Yes | Yes | Yes |
| Advanced insights + heatmap | - | 30-day basics | Yes | Yes |
| Recurring tasks + templates | - | - | Yes | Yes |
| Calendar export (.ics) | - | - | Yes | Yes |
| Command palette | - | - | Yes | Yes |
| Generative focus music | - | - | Yes | Yes |
| Streak freeze / repair | - | Freeze | Repair | Repair |
| Smart Plan (AI step-split) | - | - | - | Fair use |
| Cross-device sync | - | - | - | Yes |
| Focus rooms (silent co-work) | - | - | - | Yes |
| Weekly review | - | - | Yes | Yes |
| Priority support / early access | - | - | Priority | Priority + early access |

Limits live in `js/config.js` (`FF_PLANS`). Feature gates live in `js/access.js` (`FFAccess`). Change a level or a feature minimum in one place and the UI, gates and upgrade prompt follow.

## What is live now

- Landing page with scroll reveals, responsive layout and a premium editorial look.
- Google OAuth and email six-digit OTP through Supabase.
- Per-account local data store with JSON backup/import, CSV export (Plus) and delete-all.
- Today: tasks, next-task card, done list, yesterday recap, streak, daily goal meter.
- Focus: timer, SVG ring, pause/resume, fullscreen shield, tab-title countdown, spacebar shortcut, urge log, session history.
- **Focus Studio:** eight synthesized layers (rain, ocean, brown, green, fire, night, wind, caf&eacute;), presets, master volume and a generative chord bed. Brown noise is free; the full studio is Plus; generative music is Pro.
- Brain dump, goals, journal and insights.
- Four real plan levels with monthly/yearly pricing and server-side plan read-back.
- **Theme Studio:** Daylight, Midnight, Funky and Neon. Daylight and Midnight are free; Funky unlocks on Plus; Neon unlocks on Pro. Locked cards open the plan modal instead of pretending to work.
- **Plan-aware theme fallback:** if a paid plan expires, a paid theme falls back to Daylight rather than leaking a paid look.
- Plain-language privacy policy and terms.

## Theme Studio

| Theme | Mood | Plan |
| --- | --- | --- |
| Daylight | Warm paper, ink, soft blue. Editorial calm. | Free |
| Midnight | Gold on charcoal. Low-light deep work. | Free |
| Funky | Cream, hot pink, electric blue, acid lime, chunky black borders and offsets. Gen Z energy without hiding the task. | Plus |
| Neon | Aubergine black, acid lime and pink glow. Late-night focus. | Pro |

Themes are implemented with CSS custom properties on `<html data-theme="...">`. No duplicate layouts, no component forks. `prefers-reduced-motion` is respected, and every theme keeps AA-readable text and controls.

## Focus Studio

| Layer | What it is | Plan |
| --- | --- | --- |
| Brown noise | Warm low-end hush; the free doorway | Free |
| Rain | Soft rain on a window | Plus |
| Ocean | Slow tide and wide horizon | Plus |
| Green noise | Mid-frequency forest air | Plus |
| Fireplace | Low crackle with occasional pops | Plus |
| Night | Crickets and open air | Plus |
| Wind | A long, clean gust | Plus |
| Caf&eacute; | A distant room murmur | Plus |
| Generative bed | Slow chord pad that never repeats a track | Pro |

All nine voices are synthesized with the Web Audio API at run time. There are no audio files, no streaming requests and no per-track licences. The mixer and preset are written into the same local account record as tasks and sessions. Audio never autoplays: it starts from a tap, stops when a session completes, and stops on sign-out or delete-all. Presets and the full mixer are Plus; generative music is Pro. Plan checks are client-side presentation, not a security boundary.

## Data, privacy and security - the honest version

- Each account has its own local data namespace. Other accounts on the same browser do not see it.
- Supabase schema has six tables (`profiles`, `tasks`, `sessions`, `days`, `goals`, `dumps`), row-level security, a signup trigger and a plan guard. Authenticated grants are enabled.
- The client is **local-first today**. Cross-device sync is Premium and is not shipped yet; do not advertise it as live until it is.
- Plan is read from the `profiles` row when signed in. Client-side plan changes are preview-only and are not a payment system.
- Payments are not connected yet. Razorpay requires owner KYC, then a server-side webhook must grant entitlements. Until then, plan changes are explicitly labelled preview.
- No ads, no selling behavioural data, no public profiles, no leaderboards.

## Build order

1. **Visual system + theme studio + access gating** - live.
2. **Focus Studio** - live: 8 synthesized soundscapes, mixer, presets, generative lo-fi pads. Breathing-ring motion remains in step 3 polish.
3. **Daily ritual + quests** - next: morning plan, shutdown review, one small quest, streak freeze.
4. **Recurring tasks + templates + custom lengths** - Pro.
5. **Advanced insights + heatmap + weekly review** - Pro.
6. **Calendar export + command palette + session notes + distraction log** - Pro.
7. **Smart Plan** - Premium, fair use, title-only by default, explicit consent before sending anything.
8. **Real sync + focus rooms** - Premium; sync first, rooms after presence is reliable.
9. **Payments + entitlement webhook** - owner KYC and server-side grant.

## Why this positioning

- Study-planner apps were about **$2.7B in 2025**, projected to **$4.42B by 2034** at **11.2% CAGR**; roughly **64%** of revenue is freemium ([Dataintelo](https://dataintelo.com/report/study-planner-apps-market)).
- About **238 million** post-secondary students worldwide. Password signup loses students; Google + email code is the shortest path in.
- A 2025 meta-analysis of **71,633** university students found elevated odds of depression (OR 1.93) and eye strain (OR 1.96), with risk climbing after **2.5 hours/day** ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13113371/)).
- Competitor pricing leaves a gap: Opal ~$19.99/mo, Sunsama $17-$22/mo, Motion ~$19-$29/mo. FocusFlow starts at **$2**.

## Deliberately not doing

- No streak shaming, red debt counters or "you failed" copy.
- No claim that a web timer blocks other apps. That needs a native build.
- No public social graph, follower counts or comparison leaderboards.
- No silent price changes for existing subscribers.
