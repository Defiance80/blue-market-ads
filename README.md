# Blue Market Ads

The agency console for Google Ads and Local Services Ads. Pick a manager account, then any client under it, and get:

- **Overview**: spend, conversions, cost per conversion, conversion rate, CTR and CPC compared with the previous period, a daily trend, where the money went, conversions by campaign, spend by channel, Local Services leads, and every campaign in one table.
- **Strategist**: an AI agent that reads the account, scans the client's website, pulls Keyword Planner data, and proposes changes such as negatives, keywords, bids, budgets, bid strategies, new ads, callouts, sitelinks, snippets and schedules. **Nothing changes until someone clicks Apply.**
- **Automations**: runs the four n8n workflows (Daily Optimizer, Budget Guard, Conversion Audit, Offline Revenue Upload) for the selected account.
- **Change history**: every applied change, who applied it and the result.
- **Account settings**: the strategy profile the agent follows for each client (what they sell, target CPA, budget, service area, offers, rules).

With no credentials set, the app runs in **demo mode** with four sample client accounts, so you can deploy it and click around first.

---

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repository, and click **Deploy**. No build settings need changing.
3. Open the site. It's in demo mode: sign in with the demo login shown on the sign-in page.
4. Add the environment variables below in **Project → Settings → Environment Variables**, then **Redeploy**.

### Environment variables

| Variable | What it is | Where to get it |
|---|---|---|
| `AUTH_SECRET` | Signs login sessions | Any long random string: `openssl rand -base64 32` |
| `TEAM_USERS` | Team logins as JSON | See "Team logins" below |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Identifies this app to Google | Manager account → Tools → API Center (needs **Basic access** for real accounts) |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth client | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Enable the Google Ads API first. |
| `GOOGLE_ADS_REFRESH_TOKEN` | Long-lived permission to act as your Google login | See "Refresh token" below |
| `GOOGLE_ADS_API_VERSION` | API version | `v25` (bump when Google retires it; each version lives about a year) |
| `ADS_VALIDATE_ONLY` | `true` = Google checks every change but applies nothing | Keep `true` until you trust it, then `false` |
| `ANTHROPIC_API_KEY` | Powers the Strategist | console.anthropic.com |
| `ANTHROPIC_MODEL` | Which Claude model | `claude-opus-5-5` (default) |
| `N8N_WEBHOOK_BASE` | Where your n8n webhooks live | e.g. `https://n8n.yourdomain.com/webhook` |
| `N8N_WEBHOOK_SECRET` | Shared secret with n8n | Any random string; the same value goes in each n8n Config node |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Saves profiles and history | Vercel → Storage / Marketplace → Upstash Redis. Vercel fills these in. |

**Once Google Ads is connected, the demo login stops working.** `TEAM_USERS` is then required.

### Team logins

Passwords are never stored. Only a one-way hash is kept. Make a hash for each person:

```bash
npm install
npm run hash-password -- "a long password"
```

Then set `TEAM_USERS` (one line):

```json
[{"email":"robert@bluemarketads.com","name":"Robert","passwordHash":"$2b$12$..."},{"email":"edgar@bluemarketads.com","name":"Edgar","passwordHash":"$2b$12$..."}]
```

### Refresh token

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon, tick **Use your own OAuth credentials**, and paste your client ID and secret. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI on that OAuth client in Google Cloud.
3. In step 1, enter the scope `https://www.googleapis.com/auth/adwords` and authorize with the Google login that has access to your manager account.
4. In step 2, click **Exchange authorization code for tokens** and copy the **refresh token**.

---

## Connect n8n

The four workflow files in the n8n package now have a second trigger, **Started from App** (a webhook). To connect them:

1. Re-import the updated workflow files (or add the webhook node and the new Config section to your existing ones).
2. In each workflow's **Config** node, set `webhook_secret` to the same value as `N8N_WEBHOOK_SECRET`.
3. Activate the workflows. Their webhook URLs are `<N8N_WEBHOOK_BASE>/blue-market-optimizer`, `/blue-market-budget-guard`, `/blue-market-conversion-audit` and `/blue-market-revenue-upload`.
4. In Vercel, set `N8N_WEBHOOK_BASE` and `N8N_WEBHOOK_SECRET`, then redeploy.

When the app starts a run, it sends the selected account's ID, and that run works on that account instead of the one in Config. The scheduled runs keep using Config.

---

## How it's built, and why

```
app/
  login/              Sign-in page
  (app)/              Everything behind login: overview, strategist, automations, history, settings
  api/                Server routes the pages call (the browser never talks to Google directly)
lib/
  ads/                Google Ads: client.ts (auth + requests), live.ts (reports), apply.ts (changes),
                      changes.ts (the change menu + validation), demo.ts (sample data), index.ts (one entry point)
  agent/              playbook.ts (the agent's strategy knowledge), tools.ts (what it can do)
  auth.ts, session.ts Login and session cookies
  scan.ts             Website scanner
  n8n.ts              Starts n8n workflows
  store.ts            Strategy profiles + change history (Upstash Redis)
proxy.ts              Checks the session before every page and API call
```

- **Next.js on Vercel.** Pages and API routes live in one project, so a single deploy carries both the interface and the secure server code. API keys stay on the server; the browser only ever sees results.
- **The agent can't change accounts by itself.** It can only call `propose_changes`, which picks from a fixed menu of change types. Each change is validated against Google's limits (30-character headlines, 25-character callouts, real IDs, sane bid ranges) before you even see it. The same validation runs again when you click Apply. A malformed change is sent back to the agent with the reason, so it fixes its own mistakes.
- **One Google request per Apply.** Changes go to `googleAds:mutate` with `partialFailure` (one bad change doesn't block the rest) and, in test mode, `validateOnly` (Google checks everything and changes nothing).
- **Manager accounts.** The first dropdown lists accounts your login can open (usually your MCC). Picking a manager loads every active client under it at any depth into the second dropdown. Requests for a client are sent *through* the manager using the `login-customer-id` header, which is how Google Ads authorizes agency access.
- **The playbook is the agent's brain.** `lib/agent/playbook.ts` is plain English: bid-strategy thresholds, keyword and negative-keyword methods, ad-writing rules, LSA levers, healthcare policy limits. Edit it to change how the agent thinks. It's sent with prompt caching, so it costs little to keep it detailed.
- **Strategy profiles make it account-specific.** The agent reads the client's profile before every conversation and follows its rules over the defaults. When you tell it "never bid on competitor names," it saves that to the profile.

## Run it on your computer

```bash
npm install
npm run dev
# open http://localhost:3000 and sign in with the demo login
```

Copy `.env.example` to `.env.local` to try it with real credentials locally.

## Limits to know

- **Local Services Ads**: leads and LSA campaign results are reported. Many LSA settings (service types, hours, disputes) are still managed in the LSA dashboard, so the agent gives exact steps for those instead of a proposal. As Google moves LSA into the main Ads API, new change types can be added to `lib/ads/changes.ts`.
- **Meta and other social ads** aren't connected yet. The channel types and dashboard are built so a new data source can be added beside `lib/ads/`.
- **The login rate limit** lives in memory, so it resets on each new server instance. For stronger protection, add a Vercel Firewall rule on `/api/auth/login`.
