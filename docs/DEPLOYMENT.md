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

## Management update — 23 October 2026

- Overview now has four primary cards: registered residents, successful entries, denied attempts, and alerts requiring review. The context line contains total attempts, distinct entrants and block count. Denied attempts do not establish intrusion.
- Residential Activity uses Day / Week / Month grouping instead of separate repeated trend charts. No exit, occupancy or nights-stayed calculations were added.
- Holiday Planning lets management publish a fictional holiday name, start/end dates and declaration deadline. Student choices are entire period, selected inclusive dates, not staying/withdraw, and unsure. Management selects the holiday and can inspect declared stays for a particular date. Holiday metrics use the selected holiday and the college/block filters, independently of the activity date range.
- Residential Records → View details opens a shareable student fragment URL, profile, holiday declarations, and entry attempts. Individual history is loaded on demand, paginated at 50 records, supports MYT date filters or all available dates, and requires a management role. Connected history requests are audited. No exits are recorded.
- Applied migration `20261022161910_holiday_periods_and_student_history.sql` and deployed kk-api version 2. Existing declarations were retained. All five migrations must run before the SQL seed.
- 32 automated tests passed; all three builds passed. Connected browser testing saved Alex's selected dates (25–28 October), published Mid-semester break · Demo, and loaded his individual history. Realtime API rehearsal passed after a transient upstream timeout. Test cleanup now signs out only its own sessions.

### Demo walkthrough

1. Student Portal → Holiday stay declaration: select a named holiday, review dates/deadline, choose a plan, then Save declaration.
2. Management → Holiday planning: choose the same holiday. Review declared stays, nonresponses and a specific planning day. These are plans, not physical presence.
3. Management → Residential records: search DEMO001, choose View details. Use From/Until or All dates, then Refresh entry history after a new scan.
4. A fresh Alex QR still grants entry at Block A. Expired/reused QR codes and unauthorised residential permissions are denied as before.
