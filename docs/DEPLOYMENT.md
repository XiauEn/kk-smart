# Deployment verification — 22 October 2026

The dedicated private repository is https://github.com/XiauEn/kk-smart. The dedicated Supabase project is `yzqggrnkkynwpjomqopn` in TEF Case Study, Singapore. Only fictional data is used.

All four migrations are applied. The database contains 200 students and six blocks, deterministic activity and holiday declarations. Six fictional Auth accounts are provisioned. `kk-api` is active; the one-time provisioning endpoint has been retired and verified to return HTTP 410. Demo controls are enabled server-side for authorised gate terminals.

Hosted API verification passed: all six account logins, short-lived issuance, correct-block grant, wrong-block/nonresident/expired denial, atomic replay rejection, server expiry, permission change with restoration, event visibility and alert deduplication. A separate authenticated Realtime check received the exact committed gate event at management.

The private, ignored `.env.operator.local` contains the shared fictional demo password. Do not commit or distribute that file publicly. No service-role key is in the browser configuration. Browser variables use only the public publishable key.

The database security advisor's remaining deny-all RLS notices are intentional for service-only tables. Leaked password protection is disabled in the account settings; demo passwords are randomly generated. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection for that optional Auth setting.

Camera hardware must still be rehearsed on the actual presentation device. Camera use requires HTTPS and browser permission; manual QR input and clearly labelled synthetic demo controls provide fallback paths.
