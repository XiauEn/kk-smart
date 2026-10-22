# Deployment progress

## Confirmed on 22 October 2026

- Clean installation with `npm ci` completed.
- All 27 automated tests passed, including the embedded PostgreSQL migrations, seed and RLS checks.
- All three production builds passed.
- Created the dedicated **private** GitHub repository `XiauEn/kk-smart` with the user's authorisation. No unrelated repository was modified.
- Corrected offline QR display to retain an issued credential only until its original expiry; reconnecting resumes issuance without extending that credential.
- Corrected connected offline simulation to retain its synthetic failure history across scans.
- Added `npm run verify:connected` for an operator-run hosted API rehearsal once Supabase is provisioned. It checks student issuance, gate verification, shared management events, replay/expiry, denial scenarios, permission changes with restoration, and alerts. It never prints credentials.

## Pending account access

Supabase and Vercel are not yet authorised for this chat. No hosted database migration, seed, demo-account provisioning, Edge Function deployment, Vercel deployment, or deployed cross-device workflow is claimed as complete.

The next step is to authorise the Supabase and Vercel integrations. A new dedicated fictional Supabase project and three separate Vercel projects should be used. Never run the reset against another database or upload private service-role keys into a browser build.

## Connected verification command

The engineering operator supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `DEMO_PASSWORD` through the process environment, then runs:

```text
npm run verify:connected
```

The check creates fictional access events and may create an operational alert. It restores Alex's original permission in a `finally` block after its permission-change test. It does not claim to exercise a physical camera, browser rendering, or Realtime transport. Those are checked separately on the three deployed URLs.
