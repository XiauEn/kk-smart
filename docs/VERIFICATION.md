# Verification record

Verified on 22 October 2026 using Node.js 26, npm 11, TypeScript, Vite, Vitest and an in-app Chromium browser on Windows.

## Automated verification

- `npm test`: **27 tests pass**, across the shared simulator/analytics and embedded PostgreSQL backend suites.
- `npm run build`: TypeScript check and all **three independent production builds pass**.
- SQL tests execute both migrations and the deterministic seed, not a reimplementation of the access function. They verify grants, wrong-block/non-resident/expired denials, replay rejection, server expiry, terminal revocation, account roles, RLS, audit writes, management updates and student-bound declarations.
- The Edge Function's TypeScript syntax was checked with the TypeScript compiler. Its Deno runtime and hosted network integration require deployment and rehearsal.
- PGlite uses test-only replacements for pgcrypto. Real cryptographic primitives and genuinely parallel database sessions are not exercised by this local suite.

## Browser smoke checks

- Loaded all three applications at their own localhost ports.
- Inspected the rendered management dashboard, student identity and gate interfaces.
- Observed the student QR's rendered SVG change automatically across refresh periods without manual refresh.
- Clicked valid-resident and wrong-block/non-resident/expired-resident scans; observed ACCESS GRANTED / ACCESS DENIED and the corresponding names/reasons.
- Submitted a fictional short-lived token through the manual input and observed a successful entry. Replay rejection is covered by both automated suites.
- Submitted five failed attempts and observed SECURITY ALERT, red denial state, and five recent denied results.
- Enabled connection-loss simulation, granted a fictional resident locally, observed OFFLINE MODE and an incremented pending synthetic queue.
- Changed Alex's assigned block in Residential Records, saved, and used the dashboard's local permission test to observe the changed denial outcome.
- Opened Holiday Planning and inspected block comparisons, declared stays and recent unique entrants.
- Exercised reset controls to restore initial demo data.
- A hot-reload issue discovered during editing was fixed by separating each app's exported main component from its React root entry.

The browser viewport override did not change the effective viewport on this host. Desktop layouts were visually reviewed; phone-sized layout testing remains part of the actual-device rehearsal. Responsive CSS is included. No actual camera device scan or audible sound output was certified in this environment.

## Requires your configured accounts

No Supabase project credentials or Vercel account were supplied. The repository includes the connected implementation and deployment files, but **no hosted deployment, cross-device QR scan, Supabase Auth/Re​altime transport, or genuine offline controller is claimed as verified**. Follow the connected acceptance checklist in `DEMO.md` after setup. Local-mode events remain within each application.

See `screenshots/management.png` for the reviewed dashboard preview. All pictured data is fictional.
