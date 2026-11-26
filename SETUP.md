# FocusFlow setup

This guide turns the preview build into a real product: emailed codes, Google sign-in and working checkout. Budget about 20 minutes for the core, plus payment setup. App data stays local to each account until the sync phase; the database schema below is already in place for it.

You need: a [Supabase](https://supabase.com) account, a [Google Cloud](https://console.cloud.google.com) project, and optionally [Stripe](https://stripe.com) or [Razorpay](https://razorpay.com).

---

## 1. Create the Supabase project

1. New project -> pick a region close to your users -> set a strong database password.
2. Wait for provisioning, then open **Project Settings -> API**.
3. Copy **Project URL** and the **anon public** key. Never copy the `service_role` key into the website.

## 2. Run the schema

1. Open **SQL Editor -> New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Check **Table Editor**: `profiles`, `tasks`, `sessions`, `days`, `goals`, `dumps` exist, each with RLS enabled.

The schema also installs:

- `handle_new_user` - creates a profile row on signup.
- `guard_plan` - stops a signed-in user from upgrading their own plan through the API. Only the service role can change `plan`.

## 3. Turn on email codes

1. **Authentication -> Providers -> Email**: enable it, keep "Confirm email" on.
2. **Authentication -> URL Configuration**:
   - Site URL: `https://<user>.github.io/focusflow/`
   - Redirect URLs: add the same URL and `http://127.0.0.1:5173/` for local work.
3. **Authentication -> Email Templates**: update **both** templates:
   - **Magic Link** (existing users signing in)
   - **Confirm signup** (new users; otherwise they get a confirmation link with no code)

   Use this body for both:

```html
<h2>Your FocusFlow sign-in code</h2>
<p>Enter this six-digit code to sign in:</p>
<p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>
```

Set both subjects to `Your FocusFlow sign-in code`. Without `{{ .Token }}` the email arrives with a link and the in-app code field cannot work.

On the **free plan with the default email provider**, Supabase locks template editing. The email will contain a sign-in link instead of a code; the app accepts that link as a fallback. To get the six-digit code, configure custom SMTP (below) or upgrade the Supabase plan.

### Email limits

The built-in sender is for testing only and is heavily rate-limited. For real users, connect **custom SMTP** (Authentication -> Emails -> SMTP):

- [Resend](https://resend.com): free tier ~3,000 emails/month, verify your domain.
- [Brevo](https://brevo.com): free tier 300 emails/day; verify a sender address, then use host `smtp-relay.brevo.com`, port `587`, your Brevo login, and an SMTP key.
- **Gmail (fastest, no new account):** enable 2-Step Verification, create an App Password, then use host `smtp.gmail.com`, port `465`, your full Gmail address, and the App Password. Gmail limits sending to roughly 500 recipients/day.
- Any SMTP provider works: host, port 587, username, password, sender address.

After SMTP is saved, the Magic Link template can be edited. Set its subject to `Your FocusFlow sign-in code` and body to the `{{ .Token }}` snippet above.

## 4. Google sign-in

1. In Google Cloud, create an OAuth client of type **Web application**.
2. Authorised JavaScript origins: `https://<user>.github.io` and `http://127.0.0.1:5173`.
3. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copy the client ID and secret into **Supabase -> Authentication -> Providers -> Google**, enable it, save.
5. In Supabase, copy the callback URL shown there and confirm it matches Google exactly.

Google will not redirect back to a `file://` page. Use the local server or the deployed URL.

## 5. Connect the front end

Edit `js/config.js`:

```js
window.FF_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
  siteUrl: "https://<user>.github.io/focusflow/",
  checkout: { plus: "", pro: "", premium: "", plusYearly: "", proYearly: "", premiumYearly: "" },
  billingPortal: "",
  supportEmail: "you@yourdomain.com"
};
```

`siteUrl` must match the deployed URL (trailing slash included). The anon key is designed to be public - it is protected by RLS, not secrecy.

Reload the site. The auth panel now says "Secured by Supabase - codes are emailed for real." An email should arrive within a few seconds.

Note: connecting Supabase turns on **authentication** in this build. App data still lives in per-account localStorage; the included schema is ready for the sync phase, but the client does not write to those tables yet. Do not tell users their data syncs across devices until that ships.

## 6. Payments

Create one product per paid tier, monthly and yearly:

| Tier | Monthly | Yearly |
| --- | --- | --- |
| Plus | $2 | $20 |
| Pro | $3 | $30 |
| Premium | $5 | $50 |

**Stripe**: create Payment Links for each price. Paste monthly links into `plus`, `pro`, `premium` and yearly links into `plusYearly`, `proYearly`, `premiumYearly`. The plan modal has a Monthly / Yearly switch that reads the matching key. The app appends `client_reference_id=<user id>` and `prefilled_email` to the link, so the webhook can match the payment to an account. Confirm the exact parameter names in your payment provider; if it ignores them, match on email instead.

**Razorpay** (better for India/UPI): create Payment Pages or Subscriptions, paste those URLs instead. Razorpay supports cards, UPI and netbanking.

Set a customer-portal URL in `billingPortal` so a paid user can manage or cancel without emailing you. If it is empty, the plan modal explains where to manage instead of pretending a portal exists.

### Granting the plan safely

1. Deploy a small webhook - Supabase Edge Function, Cloudflare Worker, or Vercel function.
2. Verify the payment signature.
3. Update the row with the `service_role` key:

```sql
update public.profiles set plan = 'plus' where id = '<user-id>';
```

The `guard_plan` trigger ignores this only for the service role, so a user cannot call the API and upgrade themselves. Never expose the service key in `js/config.js`.

The app reads `profiles.plan` after sign-in, so a paid plan unlocks on the next load once the row is updated. Until a webhook is wired, checkout links will open but the plan will not change; in preview mode the local unlock is labelled as a preview, not a purchase.

## 7. Privacy and security checklist

- [ ] RLS enabled on all six tables (the schema does this).
- [ ] `guard_plan` trigger present.
- [ ] Service role key exists only in server-side webhook code.
- [ ] Supabase redirect URLs contain only your real domains + localhost.
- [ ] Custom SMTP with a verified sending domain (SPF/DKIM).
- [ ] Export/delete tested with a second account - neither can see the other.
- [ ] Auth email rate limits reviewed in Supabase (the preview fallback uses a 10-minute expiry, 45-second resend and 5 tries; Supabase applies its own limits).

## 8. Troubleshooting

**No email arrives.** Check spam, check Supabase Auth logs, confirm the Magic Link template contains `{{ .Token }}`, and that SMTP is configured if you are past the built-in limit.

**Code is rejected.** Codes expire and request a fresh one. In preview mode the code is valid for 10 minutes with five tries; with Supabase, check Auth logs and your project rate limits. Make sure the email is typed exactly as the one that requested it.

**Google says redirect_uri_mismatch.** The URI in Google must be exactly `https://<project-ref>.supabase.co/auth/v1/callback`, not your site URL.

**Signed in but no data.** Open DevTools -> Application -> Local Storage. Keys look like `ff.data.v1.<uuid>`. If the key is missing, `FFStore.init` did not run - check the console for a script error.

**OAuth returns to the wrong page.** Set `siteUrl` in `config.js` and the Site URL in Supabase to the same deployed URL.

**Local login fails but production works.** Use `http://127.0.0.1:5173/` in both places; `localhost` and `127.0.0.1` are different origins.

## 9. Costs

- Supabase free tier: 50,000 monthly active users, 500 MB database, 1 GB file storage. Enough for the first cohort.
- Custom SMTP: free tiers cover hundreds to thousands of sign-in emails per month.
- GitHub Pages: free for public repositories.
- Stripe: 2.9% + $0.30 per charge (varies by country). Razorpay: ~2% for domestic cards/UPI.

## Before you launch

- Set `supportEmail` in `js/config.js`; the privacy page and terms page read it, and so should your support replies.
- Read `privacy.html` and `terms.html` with someone qualified in your jurisdiction. Replace the operator description, add a business address if required, and confirm the age limit and refund wording. They are written to be accurate for this build, not to be legal advice.
- If you move to a custom domain, update `siteUrl`, the Open Graph URL in `index.html`, Supabase redirect URLs and Google OAuth origins.
- Test one full cycle with a second account: sign in, add a task, run a session, export, import, delete. Confirm neither account can see the other.
- Only announce cross-device sync after it actually ships; today the app is local-first per account.

## 10. Shipping a change

```powershell
git add .
git commit -m "Premium redesign + private accounts"
git push origin main
```

GitHub Pages rebuilds in under a minute. Hard-refresh once, because CSS and JS are cached by the browser.