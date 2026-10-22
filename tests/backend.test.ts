import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Embedded PostgreSQL exercises real PL/pgSQL, transactions, constraints and RLS.
// pgcrypto is shimmed ONLY in this test engine; cryptographic primitives are NOT validated here.
const db = new PGlite();
const actor = "11111111-1111-4111-8111-111111111111",
  terminal = "22222222-2222-4222-8222-222222222222",
  manager = "33333333-3333-4333-8333-333333333333",
  outsider = "44444444-4444-4444-8444-444444444444";
async function rpc(name: string, args: unknown[] = []) {
  const p = args.map((_, i) => `$${i + 1}`).join(",");
  const r = await db.query<{ result: any }>(
    `select public.${name}(${p}) as result`,
    args,
  );
  return r.rows[0].result;
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create schema extensions;
 create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1)||md5($1),'hex')$$;
 create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'hex')$$;
 create publication supabase_realtime;`);
  const first = readFileSync(
    "supabase/migrations/202610220001_initial.sql",
    "utf8",
  ).replace(
    "create extension if not exists pgcrypto with schema extensions;",
    "",
  );
  await db.exec(first);
  await db.exec(
    readFileSync("supabase/migrations/202610220002_demo_issuance.sql", "utf8"),
  );

  await db.exec(
    readFileSync(
      "supabase/migrations/20261022150535_server_demo_configuration.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261022150933_tighten_rls_and_indexes.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261022161910_holiday_periods_and_student_history.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/seed/demo.sql", "utf8"));
  await db.query(`insert into auth.users(id) values ($1),($2),($3),($4)`, [
    actor,
    terminal,
    manager,
    outsider,
  ]);
  await db.query(
    `update public.students set auth_user_id=$1 where student_id='DEMO001'`,
    [actor],
  );
  await db.query(
    `insert into public.account_roles values($1,'terminal'),($2,'management')`,
    [terminal, manager],
  );
  await db.query(
    `insert into public.gate_terminals(auth_user_id,block_id,name) values($1,'00000000-0000-4000-8000-000000001001','Test terminal')`,
    [terminal],
  );
}, 60000);
afterAll(async () => {
  await db.close();
});
describe.sequential("trusted PostgreSQL backend", () => {
  it("loads all 200 fictional profiles and full snapshot without API row truncation", async () => {
    const data = await rpc("kk_snapshot", [manager, "management"]);
    expect(data.students).toHaveLength(200);
    expect(data.events.length).toBeGreaterThan(3000);
  });
  it("only returns own identity to a student and rejects a management impersonation", async () => {
    const s = await rpc("kk_snapshot", [actor, "student"]);
    expect(s.students).toHaveLength(1);
    expect(s.events).toHaveLength(0);
    await expect(rpc("kk_snapshot", [actor, "management"])).rejects.toThrow(
      "Management account required",
    );
  });
  it("issues exact 15-second tokens, stores a hash, grants once and rejects replay", async () => {
    const c = await rpc("kk_issue", [actor]);
    expect(Date.parse(c.expires_at) - Date.parse(c.issued_at)).toBe(15000);
    const stored = await db.query<{ credential_hash: string }>(
      "select credential_hash from public.qr_credentials order by issued_at desc limit 1",
    );
    expect(stored.rows[0].credential_hash).not.toBe(c.token);
    expect((await rpc("kk_verify", [terminal, c.token])).granted).toBe(true);
    expect((await rpc("kk_verify", [terminal, c.token])).reason).toBe(
      "QR credential already used",
    );
  });
  it("denies wrong-block, non-resident and expired credentials", async () => {
    for (let i = 2; i <= 4; i++) {
      const hash = String(i).repeat(64);
      await rpc("kk_demo_issue", [
        terminal,
        `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        hash,
      ]);
      await db.query(
        `update public.qr_credentials set credential_hash=encode(extensions.digest($1,'sha256'),'hex') where credential_hash=$2`,
        [`scenario-${i}`, hash],
      );
      expect(
        (await rpc("kk_verify", [terminal, `scenario-${i}`])).granted,
      ).toBe(false);
    }
  });
  it("rejects credentials after server expiry", async () => {
    const c = await rpc("kk_issue", [actor]);
    await db.query(
      `update public.qr_credentials set issued_at=issued_at-interval '16 seconds',expires_at=expires_at-interval '16 seconds' where used_at is null`,
    );
    expect((await rpc("kk_verify", [terminal, c.token])).reason).toBe(
      "QR credential expired",
    );
  });
  it("rejects unauthorised and revoked terminals", async () => {
    await expect(rpc("kk_verify", [outsider, "bad"])).rejects.toThrow(
      "Authorised terminal required",
    );
    await db.query(
      "update public.gate_terminals set revoked=true where auth_user_id=$1",
      [terminal],
    );
    await expect(rpc("kk_verify", [terminal, "bad"])).rejects.toThrow(
      "Authorised terminal required",
    );
    await db.query(
      "update public.gate_terminals set revoked=false where auth_user_id=$1",
      [terminal],
    );
  });
  it("alerts on the fifth failure and suppresses repeat alerts within two minutes", async () => {
    await db.exec(
      "delete from public.access_events where terminal_id is not null; delete from public.security_alerts where terminal_id is not null;",
    );
    for (let i = 0; i < 7; i++) {
      const r = await rpc("kk_verify", [terminal, `invalid-${i}`]);
      expect(r.granted).toBe(false);
      expect(Boolean(r.alert)).toBe(i === 4);
    }
  });
  it("validates, audits and applies management permission changes", async () => {
    const data = await rpc("kk_snapshot", [manager, "management"]);
    const s = data.students[0];
    await expect(rpc("kk_manage_residency", [actor, s])).rejects.toThrow(
      "Management account required",
    );
    await rpc("kk_manage_residency", [
      manager,
      { ...s, block_id: "00000000-0000-4000-8000-000000001002" },
    ]);
    const c = await rpc("kk_issue", [actor]);
    expect((await rpc("kk_verify", [terminal, c.token])).reason).toBe(
      "No active block permission",
    );
    const audit = await db.query("select * from public.audit_log");
    expect(audit.rows.length).toBeGreaterThan(0);
    await rpc("kk_manage_residency", [manager, s]);
  });
  it("rejects invalid active dates and invalid blocks", async () => {
    const s = (await rpc("kk_snapshot", [actor, "student"])).students[0];
    await expect(
      rpc("kk_manage_residency", [manager, { ...s, end_date: "2020-01-01" }]),
    ).rejects.toThrow("Active permission");
    await expect(
      rpc("kk_manage_residency", [manager, { ...s, block_id: outsider }]),
    ).rejects.toThrow("Valid block");
  });
  it("binds holiday declarations to the authenticated student", async () => {
    const period = (
      await rpc("kk_snapshot", [actor, "student"])
    ).holiday_periods.find((p: any) => p.name === "Semester break");
    await rpc("kk_declare", [
      actor,
      {
        student_id: outsider,
        holiday_name: "Semester break",
        period_id: period.id,
        response: "entire",
        start_date: period.start_date,
        end_date: period.end_date,
        staying: true,
      },
    ]);
    const s = await rpc("kk_snapshot", [actor, "student"]);
    expect(
      s.holidays.every((h: any) => h.student_id === s.students[0].id),
    ).toBe(true);
    await expect(
      rpc("kk_declare", [outsider, { holiday_name: "Semester break" }]),
    ).rejects.toThrow("Student account required");
  });
  it("requires an operator flag and an authorised terminal for demo controls", async () => {
    expect(await rpc("kk_demo_controls_enabled", [terminal])).toBe(false);
    await db.exec(
      "update kk_internal.settings set value='true'::jsonb where key='demo_controls_enabled'",
    );
    expect(await rpc("kk_demo_controls_enabled", [terminal])).toBe(true);
    expect(await rpc("kk_demo_controls_enabled", [outsider])).toBe(false);
    await db.exec(
      "update kk_internal.settings set value='false'::jsonb where key='demo_controls_enabled'",
    );
  });
  it("consumes setup challenges once and denies expired challenges", async () => {
    await db.query(
      "insert into kk_internal.setup_challenges(credential_hash,expires_at) values($1,clock_timestamp()+interval '1 minute'),($2,clock_timestamp()-interval '1 minute')",
      ["a".repeat(64), "b".repeat(64)],
    );
    expect(await rpc("kk_consume_setup", ["a".repeat(64)])).toBe(true);
    expect(await rpc("kk_consume_setup", ["a".repeat(64)])).toBe(false);
    expect(await rpc("kk_consume_setup", ["b".repeat(64)])).toBe(false);
  });
  it("prevents direct browser mutation and protects identity data with RLS", async () => {
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${actor}';`,
    );
    try {
      const rows = await db.query("select * from public.students");
      expect(rows.rows).toHaveLength(1);
      expect(
        (await db.query("select * from public.access_events")).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("select * from public.qr_credentials")).rows,
      ).toHaveLength(0);
      await expect(
        db.query(`select public.kk_issue($1)`, [actor]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query(`update public.residencies set status='active'`),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role;");
    }
  });
  it("publishes named holidays only for management and validates date bounds", async () => {
    const period = {
      name: "Test study break · Demo",
      start_date: "2026-12-01",
      end_date: "2026-12-14",
      declaration_deadline: "2026-11-27",
    };
    await expect(rpc("kk_holiday_period", [actor, period])).rejects.toThrow(
      "Management account required",
    );
    await expect(
      rpc("kk_holiday_period", [
        manager,
        { ...period, end_date: "2026-11-01" },
      ]),
    ).rejects.toThrow();
    await rpc("kk_holiday_period", [manager, period]);
    const snapshot = await rpc("kk_snapshot", [actor, "student"]);
    const published = snapshot.holiday_periods.find(
      (p: any) => p.name === period.name,
    );
    expect(published.start_date).toBe(period.start_date);
    await expect(
      rpc("kk_declare", [
        actor,
        {
          period_id: published.id,
          response: "dates",
          start_date: "2026-11-30",
          end_date: "2026-12-02",
        },
      ]),
    ).rejects.toThrow("within holiday");
    await expect(
      rpc("kk_declare", [
        actor,
        {
          period_id: published.id,
          response: "dates",
          start_date: "2026-12-04",
          end_date: "2026-12-02",
        },
      ]),
    ).rejects.toThrow("within holiday");
    await rpc("kk_declare", [
      actor,
      {
        period_id: published.id,
        student_id: outsider,
        response: "dates",
        start_date: "2026-12-03",
        end_date: "2026-12-07",
      },
    ]);
    let declaration = (
      await rpc("kk_snapshot", [actor, "student"])
    ).holidays.find((h: any) => h.period_id === published.id);
    expect(declaration.student_id).toBe(snapshot.students[0].id);
    expect(declaration.staying).toBe(true);
    expect(declaration.start_date).toBe("2026-12-03");
    await rpc("kk_declare", [
      actor,
      { period_id: published.id, response: "away" },
    ]);
    declaration = (await rpc("kk_snapshot", [actor, "student"])).holidays.find(
      (h: any) => h.period_id === published.id,
    );
    expect(declaration.staying).toBe(false);
    await rpc("kk_declare", [
      actor,
      { period_id: published.id, response: "unsure" },
    ]);
    expect(
      (await rpc("kk_snapshot", [actor, "student"])).holidays.find(
        (h: any) => h.period_id === published.id,
      ).response,
    ).toBe("unsure");
  });
  it("rejects declarations after the server-controlled deadline", async () => {
    await rpc("kk_holiday_period", [
      manager,
      {
        name: "Closed break · Demo",
        start_date: "2020-01-01",
        end_date: "2020-01-14",
        declaration_deadline: "2020-01-01",
      },
    ]);
    const p = (
      await rpc("kk_snapshot", [actor, "student"])
    ).holiday_periods.find((p: any) => p.name === "Closed break · Demo");
    await expect(
      rpc("kk_declare", [actor, { period_id: p.id, response: "entire" }]),
    ).rejects.toThrow("deadline");
  });
  it("restricts and audits individual history, with stable pagination and MYT date filters", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    await expect(
      rpc("kk_student_history", [actor, id, null, null, 0]),
    ).rejects.toThrow("Management account required");
    await expect(
      rpc("kk_student_history", [terminal, id, null, null, 0]),
    ).rejects.toThrow("Management account required");
    await db.query(
      `insert into public.access_events(student_id,block_id,timestamp,granted,verification_method) select $1,'00000000-0000-4000-8000-000000001001','2026-08-01T16:00:00Z'::timestamptz + n * interval '1 second',true,'history_test' from generate_series(1,55) n`,
      [id],
    );
    const first = await rpc("kk_student_history", [
      manager,
      id,
      "2026-08-02",
      "2026-08-02",
      0,
    ]);
    const second = await rpc("kk_student_history", [
      manager,
      id,
      "2026-08-02",
      "2026-08-02",
      50,
    ]);
    expect(first.total).toBe(55);
    expect(first.events).toHaveLength(50);
    expect(second.events).toHaveLength(5);
    expect(
      new Set([...first.events, ...second.events].map((e: any) => e.id)).size,
    ).toBe(55);
    expect(
      (
        await rpc("kk_student_history", [
          manager,
          id,
          "2026-08-01",
          "2026-08-01",
          0,
        ])
      ).total,
    ).toBe(0);
    expect(
      (
        await db.query(
          "select * from public.audit_log where action='student_history_view'",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
    await expect(
      rpc("kk_student_history", [manager, id, null, null, -1]),
    ).rejects.toThrow("Invalid history");
  });
});
