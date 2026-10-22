# Security intelligence and guard deployment

Implemented 23 October 2026 for the fictional KK Smart competition project.

## Four independent applications

| App        | Root                      | Local port | Production                             |
| ---------- | ------------------------- | ---------- | -------------------------------------- |
| Student    | apps/student-portal       | 5173       | https://kk-smart-student.vercel.app    |
| Gate       | apps/gate-scanner         | 5174       | https://kk-smart-gate.vercel.app       |
| Management | apps/management-dashboard | 5175       | https://kk-smart-management.vercel.app |
| Guard      | apps/guard-web            | 5176       | https://kk-smart-guard.vercel.app      |

The Guard Web was created with the user's explicit authorisation because no fourth app existed. The original three apps, QR verification, alert review and management pages are retained. Guard is a separate Vite entry point, workspace and Vercel project using the same Supabase project.

## Implemented features and files

- `apps/management-dashboard/src/SecurityIntelligence.tsx`: private aggregate charts, block comparison, declaration planning, explainable rules, source labels, synthetic peak toggle and prefilled draft action.
- `apps/management-dashboard/src/DutyPlanning.tsx`: date filter; create/edit, save draft, approve/publish, cancel; version conflict messages; cancelled-history filter.
- `apps/management-dashboard/src/App.tsx`: two new sidebar sections. Existing pages remain separate.
- `apps/guard-web/`: independent authenticated guard app with today's/upcoming published block duties, instructions, last-check/version indicators and scoped operational alert review. No student identities or movement feed.
- `packages/shared/src/operations.tsx`: typed duty model, pure explainable recommendation rules, shared refresh hook and local-only fixtures.
- `packages/shared/src/client.tsx`, `index.ts`, `styles.css`: guard role and alert refresh, exports and minimal matching styles.
- `supabase/functions/kk-api/index.ts`: authenticated routes to trusted analytics, duties, guard snapshot and scoped alert review.
- `supabase/migrations/20261022175216_security_intelligence_and_duties.sql`: additive role/table/RLS/RPC/publication changes.
- `scripts/provision.mjs`, `verify-operations.mjs`: repeatable operator guard provisioning and hosted role/approval/realtime verification. One-time bootstrap source is included for audit; its hosted endpoint is retired and returns 410.
- `tests/backend.test.ts`, `tests/operations.test.ts`: database permissions, approval/conflict/cancellation, privacy and recommendation checks. Test runner updated to Vitest 5 to remove dependency audit findings; suite execution remains sequential by default.
- Root `package.json`, lockfile and README: fourth workspace, dev command, setup and verification instructions.

## Database and access control

`account_roles` now permits `guard`. No user-editable metadata authorises access.

`guard_blocks(auth_user_id, block_id)` defines authorised block scope. Its RLS allows self-read or management read; browser writes are denied. The fictional `guard-a@kk-smart.example` account has KK3 Block A only. Use the existing private demo password in `.env.operator.local`. Do not publish that file.

`security_duties` stores block, start/end timestamps, instructions, Draft/Published/Cancelled status, source label, version, update timestamp/actor, approval actor/time. Intervals must be positive and no longer than 24 hours. Every publish or edit of a published version requires an explicit management approval request. Concurrent edits check the current version. All mutations are audited.

Duty RLS permits management reads and guard reads of published duties only within authorised blocks. There are no authenticated INSERT/UPDATE/DELETE grants. Service-only `kk_save_duty` checks the verified actor's management role. `kk_duties` rejects student and terminal accounts; guard results apply publication and scope predicates again. Guard clients cannot retrieve drafts through REST or the Edge API.

Guard alert reads add a scoped SELECT policy. `kk_guard_alert_status` checks both role and block before accepting operational review changes. Existing management alert handling remains unchanged.

`kk_intelligence` is service-only and checks management role server-side. All new RPC execution is revoked from PUBLIC, anon and authenticated; the Edge Function validates every bearer token with Supabase Auth before supplying the actor ID. No browser service-role key is used.

## Analytics rules and source data

The normal source is the project's existing entirely fictional access events and holiday declarations. No new fake access events are inserted for the peak scenario.

- Select a seven-day window, defaulting to the seven completed days before today. Hours and dates use Asia/Kuala_Lumpur.
- Successful hourly/block cells require at least five distinct entrants. Smaller nonzero cells are suppressed. Released counts are rounded to the nearest five. Zero is distinct from suppression.
- Baseline: the same weekday/hour windows shifted back one, two, three and four weeks. A peak requires at least three populated baseline windows, a positive released baseline, at least ten released entries, and at least 1.5 times the baseline. Sparse/zero/suppressed baselines cannot produce peak claims.
- Denied-attempt planning reviews require at least five attempts for the block over the selected week; counts are rounded. Invalid scans often have no identified student, so this threshold is attempts, not a count of people. A review is not an accusation or an urgent five-failure alert.
- Holiday summaries use active allocations and submitted staying declarations for the selected named holiday. Small stay groups are suppressed, counts rounded to five, shares rounded to ten percentage points. A released share of 30% or below suggests reviewing patrol/emergency support. Nonresponse is not absence. Declarations are plans, never physical occupancy.
- Synthetic peak mode returns a clearly labelled standalone hourly illustration (30 versus 10, four comparison windows) without inserting any rows. Other block and holiday tables still use stored fictional data. Its duty source label retains the synthetic provenance.

Privacy controls are a prototype aggregation/suppression policy, not formal differential privacy. No individual risk score, AI crime prediction, new student movement dashboard, occupancy calculation, curfew or housing eligibility decision is added. Late-night arrival is explicitly normal.

## Synchronisation and stale instructions

Management and Guard subscribe to `security_duties` using existing Supabase Postgres Changes. RLS filters the guard channel. Both apps also refresh through the authenticated API every ten seconds, on window focus and on manual Refresh.

Cancellation/withdrawal can make a row invisible to guard RLS, so the ten-second refresh is necessary even when no change notification arrives. Scoped API reads remove that row. Guard displays last successful check, duty version and update timestamp; offline, failed or old checks label instructions cached/unavailable. Confirm with management when stale. No automatic publishing occurs.

Local Demo Mode remains isolated by origin: management drafts do not appear in a separate local guard origin. A published synthetic guard fixture demonstrates the layout. Connected mode is required for the cross-app workflow.

## Setup and deployment

The dedicated Supabase project is `yzqggrnkkynwpjomqopn`. Apply all migrations in filename order, then seed and provision. Existing project migration and kk-api are already applied/deployed. The temporary guard bootstrap was nonce/hash protected, consumed once, then retired (410). Future operators can use `npm run provision` with their private service key to create the seven fictional accounts; existing passwords are preserved.

Guard uses the same public variables as the other apps: `VITE_MODE=connected`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Its Vercel root is `apps/guard-web`, Node 22, source outside root enabled, install `cd ../.. && npm ci`, output `dist`. No additional secrets or paid infrastructure are required. When ALLOWED_ORIGINS is configured, include the guard origin too. Current deployment uses the existing authenticated CORS configuration.

## Tests and verification

- 41 automated tests pass on Vitest 5, including real migration/RLS/PLpgSQL tests in embedded Postgres. Test-only pgcrypto shims do not validate crypto strength; the hosted backend uses real pgcrypto.
- All four production builds and TypeScript checks pass. npm audit reports zero vulnerabilities.
- Hosted `verify-operations.mjs` passed management-only analytics, student/terminal schedule denial, guard write denial, draft hiding, explicit approval, publish, guard Realtime, editing, version conflict and cancellation, plus bootstrap HTTP 410.
- Hosted existing QR rehearsal passed correct grant, wrong-block/nonresident/expired denial, exact server expiry, replay, permission-change restoration and five-failure alert deduplication.
- Connected browser check: synthetic insight -> saved hidden draft -> reviewed publish -> guard shows the exact Block A instructions. Deployment/browser acceptance is checked separately before handover.

Run hosted checks without exposing credentials:

```powershell
node --env-file=.env.operator.local scripts/verify-operations.mjs
node --env-file=.env.operator.local scripts/verify-connected.mjs
```

Test cleanup signs out only its own sessions. Operational test duties are cancelled, not deleted. No genuine production access logs are fabricated.

## Known limitations and advisory notes

- Block-based duty scope; no individual team/personnel assignment, attendance or payroll.
- Entry-only data cannot establish nights stayed or physical presence. Suppressed data may yield no natural peak recommendation; the labelled scenario supports a reliable rehearsal.
- Updated/withdrawn duties may take up to the ten-second refresh interval to appear/disappear. Venue internet/camera/speaker still require device rehearsal.
- Existing deny-all RLS notices for service-only tables are intentional ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Existing leaked-password protection setting remains disabled; demo passwords are randomly generated ([Auth setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Multiple permissive alert read policies have a performance advisory because management and scoped guard reads coexist ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)); no access was widened beyond the defined guard scope.

## 90-second demonstration

1. **0–20 seconds:** Management -> Adaptive Security Intelligence. Explain hourly aggregates, suppression and ordinary late-night access. Choose Synthetic peak scenario so its provenance is unmistakable.
2. **20–40 seconds:** Point to the 30-versus-10 illustration and recommendation. Click Create draft duty assignment. Review the prefilled block, time and instructions, then Save draft. Show it is not on Guard Web.
3. **40–60 seconds:** Management -> Security Duty Schedule -> Edit/review -> Approve & publish. Emphasise that a manager decides; analytics never deploys a guard automatically.
4. **60–75 seconds:** Guard Web -> My Duty Schedule. Show the published Block A instruction, version, source and last check. The account sees no drafts and cannot edit duties.
5. **75–90 seconds:** Return to management's Holiday Security Planning insight, explain declared plans versus presence, and conclude: Access data -> explainable insight -> human decision -> scoped guard deployment. Security alerts remain separate and accessible.
