# KK Smart

**One ID, One Campus — Trust: One Identity, Safer Campus.** A working competition prototype for TEF 2026 at the University of Malaya. All identities, permissions and activity are **Demo Data**. This is a concept prototype, not an official UM system or a physical access controller.

Four independent React + TypeScript + Vite apps share a typed package and one Supabase backend. They have separate HTML entry points, dev servers, builds and Vercel projects. There is no combined website or cross-app localStorage dependency.

## Start here: no accounts required

Install Node.js **22.12 or later** and open a terminal inside `kk-smart`:

```powershell
npm ci
npm run dev
```

| Application          | Local URL             | Independent build                           |
| -------------------- | --------------------- | ------------------------------------------- |
| Student Portal       | http://localhost:5173 | `npm run build -w @kk/student-portal`       |
| Gate Scanner         | http://localhost:5174 | `npm run build -w @kk/gate-scanner`         |
| Management Dashboard | http://localhost:5175 | `npm run build -w @kk/management-dashboard` |
| Guard Web            | http://localhost:5176 | `npm run build -w @kk/guard-web`            |

All four default to **Local Demo Mode** without environment files. If Windows asks about network access, localhost is sufficient for a same-laptop demonstration. Stop the servers with Ctrl+C.

**Local mode is standalone per app and browser origin.** The four scenario outcomes and initial seed agree, but gate events do not appear in the separate dashboard, and dashboard edits do not alter a separate gate. The dashboard has its own security scenario, holiday toggle, and permission test so the fallback presentation remains useful. Use connected mode for a truthful cross-device demonstration.

The stack uses React, TypeScript, plain shared CSS, Lucide, Recharts, `qrcode.react`, ZXing, and Supabase. CSS components are deliberately lightweight rather than adding a component-generation pipeline. Fonts have system fallbacks if Google Fonts is unavailable.

## What works

- Mobile student identity, four fictional profile options locally, large QR and circular countdown; automatic unpredictable credential rotation every 15 seconds, including on tab reactivation.
- Gate camera scanning, manual input, six presentation controls, eight gate animation states, success tone and alarm, duplicate camera suppression, and automatic return to scanning.
- Five failures at the same terminal in a rolling two-minute window produce a deduplicated operational alert; each failed attempt is denied immediately.
- Overview, daily/weekly/monthly activity, frequency distribution including zero days, block comparisons, holiday planning, security review, and editable residential records.
- College, block and date filters; all event charts and cards use the same filtered dataset and Malaysian calendar days. CSV export contains daily aggregates only.
- Connected Auth, RLS, trusted QR issuance and verification, permission/audit transactions, alert workflow, Realtime refresh plus 30-second polling fallback.
- Offline simulation with a persistent synthetic queue and separately classified backend telemetry.

## Supabase setup: one project for all four apps

These steps need your Supabase and Vercel accounts. No cloud credentials are included in this repository. Use a **dedicated fictional demonstration project**.

1. Create a Supabase project. Keep the database password private. In its **SQL Editor**, run these files in order (copy each file's full contents and click Run):
   - `supabase/migrations/202610220001_initial.sql`
   - `supabase/migrations/202610220002_demo_issuance.sql`
   - `supabase/migrations/20261022150535_server_demo_configuration.sql`
   - `supabase/migrations/20261022150933_tighten_rls_and_indexes.sql`
   - `supabase/migrations/20261022161910_holiday_periods_and_student_history.sql`
   - `supabase/migrations/20261022175216_security_intelligence_and_duties.sql`
   - `supabase/seed/demo.sql`
2. In Supabase project settings, copy the project URL, public **anon key** (or publishable key), and the **service-role key**. The service-role key is for the operator provisioning script only, never a browser or Vercel variable.
3. Open PowerShell in the repository. Set the following values in that shell. Replace placeholders privately; do not save secrets in the repository:

   ```powershell
   $env:SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co'
   $env:SUPABASE_SERVICE_ROLE_KEY = 'YOUR_PRIVATE_SERVICE_ROLE_KEY'
   $env:DEMO_PASSWORD = 'CHOOSE_A_PRIVATE_PASSWORD_AT_LEAST_12_CHARACTERS'
   npm run provision
   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
   Remove-Item Env:DEMO_PASSWORD
   ```

   Provisioning is repeatable. It preserves existing passwords. To change an existing password, use Supabase Auth's user administration. All created accounts are fictional and email-confirmed by the operator; no email delivery is needed.

   | App        | Email                         | Permission                   |
   | ---------- | ----------------------------- | ---------------------------- |
   | Student    | `alex@kk-smart.example`       | DEMO001, KK3 A               |
   | Student    | `sarah@kk-smart.example`      | DEMO002, KK3 B               |
   | Student    | `daniel@kk-smart.example`     | DEMO003, no allocation       |
   | Student    | `emily@kk-smart.example`      | DEMO004, expired             |
   | Gate       | `gate-a@kk-smart.example`     | Registered terminal, KK3 A   |
   | Management | `management@kk-smart.example` | Management role              |
   | Guard      | `guard-a@kk-smart.example`    | Guard role, KK3 Block A only |

   New accounts use your chosen `DEMO_PASSWORD`. Connected students cannot select another student's identity: sign out and sign in with the other fictional account. The gate's server demo buttons can exercise all four profiles without switching student accounts.

4. Deploy the function using the Supabase CLI (the `npx` form avoids a global installation):

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy kk-api
   npx supabase secrets set DEMO_CONTROLS_ENABLED=true
   ```

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside the function. `verify_jwt=false` in `config.toml` allows current public-key configurations; **the function independently verifies every bearer token with `auth.getUser()` before any database operation**. Anonymous requests are rejected. The demo scenario route also requires an active terminal and the explicit server demo setting. Turn this setting off after the presentation.

5. Copy `.env.example` to `.env.local` in **each of the four app directories**, and set:

   ```dotenv
   VITE_MODE=connected
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

   Restart `npm run dev`. Sign into each app using its respective account. Keep the four browser origins separate; their Supabase Auth sessions are independently stored. Do not place the service-role key in any `VITE_` variable.

6. Optionally restrict CORS by setting `ALLOWED_ORIGINS` in the function's secrets to a comma-separated list of your actual four HTTPS Vercel URLs and any local rehearsal URLs. There must be no spaces inside an origin or trailing slash. When omitted, CORS permits origins but Auth and database roles still enforce access. When set, remember to add new Vercel preview origins before testing them.

The migrations enable Realtime for the relevant tables. Confirm the `supabase_realtime` publication includes them in Database → Replication if Realtime is disabled in your project. Authenticated management subscriptions respect RLS. A periodic refresh provides a fallback; the stale banner appears on network loss or a subscription error.

## Four Vercel deployments

Push the whole `kk-smart` directory as the root of one GitHub repository. Create/import that repository into **four separate Vercel projects**:

| Suggested project name | Root Directory              | Build command   | Output |
| ---------------------- | --------------------------- | --------------- | ------ |
| kk-smart-student       | `apps/student-portal`       | `npm run build` | `dist` |
| kk-smart-gate          | `apps/gate-scanner`         | `npm run build` | `dist` |
| kk-smart-management    | `apps/management-dashboard` | `npm run build` | `dist` |
| kk-smart-guard         | `apps/guard-web`            | `npm run build` | `dist` |

Select Vite, Node.js 22 or newer, and enable **Include source files outside of the Root Directory in the Build Step**, so `packages/shared` and workspace dependencies are available. Use Vercel's automatic npm workspace installation from the root lockfile. If the UI requests an override, install from repository root with `cd ../.. && npm ci`. Each app already has `vercel.json` for its own output and SPA fallback.

Set the three `VITE_` variables above on each Vercel project using the **same Supabase project URL and public key**. Choose `VITE_MODE=local` for fallback deployments without a backend. Redeploy after changing variables; Vite embeds public environment values at build time. Production application code contains no localhost dependency.

Camera access requires **HTTPS** on deployed devices. `http://localhost` is a browser exception on the same computer; a phone visiting a laptop's plain HTTP LAN IP usually cannot access its camera. Displaying the Student Portal's QR does not require a camera. On Vercel, use the laptop/tablet camera to scan the student's phone. Allow camera permission when prompted, use a bright display, and hold the QR steady.

If creating the Git repository yourself:

```powershell
git init
git add .
git commit -m "Build KK Smart competition prototype"
```

Then follow GitHub's instructions to add your repository remote and push. `.env*`, `.vercel`, dependencies, and build artifacts are excluded. Only `.env.example` files are tracked.

## Dynamic QR: exact connected-mode contract

1. An authenticated student's request maps to their linked `auth_user_id`; a client-submitted student ID never chooses the issued identity.
2. PostgreSQL generates 32 random bytes, stores only a SHA-256 hash, and sets `issued_at` and `expires_at = issued_at + 15 seconds` with its own clock. Tokens are opaque, not student IDs. The database retains no plaintext token.
3. The portal calculates its countdown from the response's server time, conservatively subtracting request time. A monotonic timer drives the display and retries on tab activation. The database remains authoritative if the phone's clock is wrong. A slow response may leave less than 15 seconds displayed, never an extended backend lifetime.
4. The terminal is authenticated and bound to its stored block. The browser cannot select a trusted gate block. Verification locks the terminal and credential rows, checks expiry/revocation/replay, consumes the token, checks current permission, and writes the event in **one transaction**. Used tokens cannot open the gate again, including from another terminal.
5. Rotation does not revoke a previous unexpired credential, so a scan already in flight can complete before expiry. Expired credentials are always denied. Denied permissions consume an otherwise valid credential too.

Issuance has a per-student limit of 12 per minute. The camera suppresses duplicate detections and the UI stays busy while the gate cycles. These are convenience protections; atomic backend consumption provides the connected replay protection.

**Rotation reduces the usefulness of copied codes; it does not prevent live sharing or remote relay.** Credential theft within the 15-second window remains possible. This is a demonstration of authorisation, not proof of physical identity.

## Offline behavior and truthful boundaries

| Scenario                              | Behavior                                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone loses connection after issuance | The already displayed credential remains usable only until its original server expiry. No new credential is generated offline. Once expired, the portal hides it and requests reconnection.                                                       |
| Phone reloads offline                 | This prototype has no offline app-shell cache or persistent credential recovery. It may need internet to load.                                                                                                                                    |
| Connected gate loses internet         | Live backend verification fails closed. Explicitly selected offline simulation uses **only** the preloaded fictional seed. A connected `KK1` credential is not falsely accepted by the simulator. Use labelled demo controls for this scenario.   |
| Offline simulator                     | Unsigned `KKDEMO` payloads have random nonces, a 15-second local expiry, and local replay suppression. They are trivially forgeable and are never accepted in connected online verification.                                                      |
| Queued events                         | Synthetic events persist locally. On reconnection, an authenticated terminal can upload them in idempotent batches to `offline_demo_events`, not `access_events`. They never inflate verified-entry analytics or trigger trusted security alerts. |
| Local-mode queue                      | It stays in that app; the sync control explicitly reports that no backend sync exists. Reset clears it.                                                                                                                                           |
| Management outage                     | It retains the last in-memory snapshot, shows a stale indicator, and refreshes when online. A reload requires signing in and fetching again; sensitive snapshots are not persisted to localStorage.                                               |

Genuine secure offline gates would need trusted hardware, protected verification keys, signed capabilities, revocation synchronization, a trustworthy clock and shared replay state. This prototype uses online opaque credentials; it does **not** implement that controller or facial recognition. Emergency exit and physical fire-safety systems are outside the prototype and must remain independently free to use.

## Seed and analytics definitions

Both modes use 200 fictional identities, six blocks across KK3 and KK8, years 1–4, active/expired permissions, 60 Malaysian calendar days of varied activity, holiday declarations and sample alert history. Generation uses deterministic arithmetic; seed dates are anchored to the day it is generated. Reset local apps on the same day for matching initial datasets. Local seed persists until reset. The SQL seed is repeatable and deliberately preserves management edits on re-run.

- Registered residents: students with active current permissions in the selected blocks.
- Access cards/charts: entry events within the selected MYT dates and selected blocks. Unique entrants use distinct successfully verified student IDs. There is no inferred exit/inside count.
- Frequency distribution: distinct entry dates per currently active resident in the selected cohort; residents with no entry events are included. Short ranges truncate categories, and a 31+ category covers a 60-day view.
- Weekly totals use Monday starts; partial weeks/months reflect the selected range only.
- Holiday stays: distinct active residents with a `staying=true` declaration overlapping the selected dates. The percentage denominator is the selected block's active residents. Recent unique entrants uses the selected date range, not the holiday declaration as evidence of occupancy.
- The ordinary security feed omits individual names. Residential records are available to authenticated management. Event snapshots cover the last 60 days and up to 30,000 events; this is ample for the seed, not a production warehouse design.
- Sample historic alerts are labelled seed records, independent of the live five-failure workflow. Live alert cooldown is two minutes per registered terminal, including recently resolved alerts, so repeated scans do not create an unlimited alert flood.

Entry frequency is not nights stayed. Students are never scored or ranked for housing allocation, questioned for late arrival, or subjected to a curfew. Approved visitor access can be represented in `approved_permissions`; the backend checks its time window and revocation. This prototype does not include a visitor approval UI.

## Reset

- **Local:** Student → Reset this app; Gate → Reset this gate demo; Dashboard → Reset dashboard demo. These reset each app independently. Reloading the portal naturally issues a fresh simulated QR.
- **Connected:** Only in the dedicated fictional Supabase project, run `supabase/seed/reset.sql` in SQL Editor, then run `supabase/seed/demo.sql`. This deletes demo activity, permissions, declarations, QR hashes and audit entries, while retaining Auth accounts, student links and terminal registrations. Refresh the apps after reseeding. Never run the reset against real records.

## Verification and limits

```powershell
npm test
npm run build
```

Tests exercise grants/denials, invalid QR, exact expiry, replay, rotation, permissions, alert windows, deduplication and reconciled aggregates. The backend suite runs the actual migrations and PL/pgSQL in embedded PostgreSQL (PGlite), including RLS, role restrictions, revocation, SQL seed, auditing and holiday identity binding. **Only test-engine pgcrypto functions are shimmed**; this does not test cryptographic strength, network concurrency, hosted Auth, Edge deployment, camera hardware or Supabase Realtime transport. Production SQL uses real pgcrypto. Browser smoke checks are recorded in `docs/VERIFICATION.md`.

Before presenting, complete the connected rehearsal in `docs/DEMO.md` on your actual deployed domains. Hosted integration cannot be certified without a configured project. The UI is an access simulation; the system is not hardened for real residential deployment. Production work would include device enrollment/rotation, stronger identity proof, MFA, abuse throttling, retention policies/consent, accessibility review, operational monitoring and an independent fire-safety design.

Implementation references: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth-legacy-jwt), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vite production builds](https://vite.dev/guide/build).

## Adaptive security and duty deployment

See [SECURITY-OPERATIONS.md](docs/SECURITY-OPERATIONS.md) for roles, privacy thresholds, rules, synchronisation, tests and the 90-second demonstration. Management has Adaptive Security Intelligence and Security Duty Schedule sections. Guard Web is a fourth independently deployed application; only scoped published duties and operational alerts are available to guards.
