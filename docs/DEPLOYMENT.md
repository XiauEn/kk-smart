# Deployment verification — 22 October 2026

The dedicated private repository is https://github.com/XiauEn/kk-smart. The dedicated Supabase project is `yzqggrnkkynwpjomqopn` in TEF Case Study, Singapore. Only fictional data is used.

All four migrations are applied. The database contains 200 students and six blocks, deterministic activity and holiday declarations. Six fictional Auth accounts are provisioned. `kk-api` is active; the one-time provisioning endpoint has been retired and verified to return HTTP 410. Demo controls are enabled server-side for authorised gate terminals.

Hosted API verification passed: all six account logins, short-lived issuance, correct-block grant, wrong-block/nonresident/expired denial, atomic replay rejection, server expiry, permission change with restoration, event visibility and alert deduplication. A separate authenticated Realtime check received the exact committed gate event at management.

The private, ignored `.env.operator.local` contains the shared fictional demo password. Do not commit or distribute that file publicly. No service-role key is in the browser configuration. Browser variables use only the public publishable key.

The database security advisor's remaining deny-all RLS notices are intentional for service-only tables. Leaked password protection is disabled in the account settings; demo passwords are randomly generated. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection for that optional Auth setting.

Camera hardware must still be rehearsed on the actual presentation device. Camera use requires HTTPS and browser permission; manual QR input and clearly labelled synthetic demo controls provide fallback paths.

## Verified production URLs

- Student: https://kk-smart-student.vercel.app
- Gate: https://kk-smart-gate.vercel.app
- Management: https://kk-smart-management.vercel.app

All three production deployments reached READY and loaded over HTTPS. Browser sign-in succeeded at each URL. The actual rendered Student QR was decoded from screen pixels and submitted through the deployed Gate's manual QR fallback: ACCESS GRANTED for Alex. Reusing that exact credential returned QR credential already used. The separate management total advanced from 2,519 to 2,520 without reloading. Five distinct failed attempts created an additional alert, increasing the active indicator from two to three.

The deployed dashboard's holiday charts and residential records loaded. Expiring Alex through its permission editor caused the next terminal verification to deny entry; Alex was then restored to active Block A. Offline simulation queued one synthetic event and reconnection/sync returned the pending count to zero. Physical camera capture and speaker output remain device rehearsal checks.

29 automated tests pass. Final build status and GitHub CI can be checked in the repository. Future main-branch pushes deploy each independently configured Vercel project.

Demo login emails: `alex@kk-smart.example`, `sarah@kk-smart.example`, `daniel@kk-smart.example`, `emily@kk-smart.example`, `gate-a@kk-smart.example`, and `management@kk-smart.example`. The shared fictional demo password is the `DEMO_PASSWORD` value in the private ignored `.env.operator.local` file. Open that local file; do not paste it into GitHub or public documents.
