import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
  DEMO_PASSWORD: password,
} = process.env;
if (!url || !key || !password)
  throw Error("Load the private operator environment.");
const clients = [];
async function login(email) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw Error("Fictional login failed");
  clients.push(c);
  return c;
}
async function call(c, action, fields = {}) {
  const { data, error } = await c.functions.invoke("kk-api", {
    body: { action, ...fields },
  });
  if (error || data?.error) throw Error("Rejected API action: " + action);
  return data;
}
async function denied(c, action, fields = {}) {
  const { data, error } = await c.functions.invoke("kk-api", {
    body: { action, ...fields },
  });
  assert.ok(error || data?.error, "Expected request to be denied: " + action);
}
let duty, manager, channel;
try {
  manager = await login("management@kk-smart.example");
  const guard = await login("guard-a@kk-smart.example"),
    student = await login("alex@kk-smart.example"),
    gate = await login("gate-a@kk-smart.example");
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(Date.now());
  const snapshot = await call(guard, "snapshot", { role: "guard" });
  assert.equal(snapshot.blocks.length, 1);
  assert.equal(snapshot.events.length, 0);
  assert.equal(snapshot.students.length, 0);
  const from = new Date(Date.parse(day + "T12:00:00+08:00") - 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    to = new Date(Date.parse(day + "T12:00:00+08:00") - 86400000)
      .toISOString()
      .slice(0, 10);
  const analytics = await call(manager, "intelligence", {
    from,
    to,
    demo: true,
  });
  assert.match(analytics.source, /Synthetic/);
  assert.equal(analytics.hourly[0].entries, 30);
  for (const c of [guard, student, gate])
    await denied(c, "intelligence", { from, to });
  for (const c of [student, gate])
    await denied(c, "duties", { from: day, to: day });
  const base = {
    block_id: snapshot.blocks[0].id,
    starts_at: day + "T03:00:00+08:00",
    ends_at: day + "T04:00:00+08:00",
    instructions:
      "API rehearsal: fictional entrance coverage and free emergency exit review.",
    source_label: "Synthetic API test; not an access event",
    status: "draft",
  };
  duty = await call(manager, "save_duty", { duty: base });
  assert.ok(
    !(await call(guard, "duties", { from: day, to: day })).duties.some(
      (d) => d.id === duty.id,
    ),
  );
  await denied(guard, "save_duty", { duty, approve: true });
  await denied(manager, "save_duty", {
    duty: { ...duty, status: "published" },
    approve: false,
  });
  const seen = new Set();
  let onUpdate = () => {};
  channel = guard
    .channel("guard-duty-rehearsal-" + crypto.randomUUID())
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "security_duties" },
      (p) => {
        seen.add(p.new.id);
        onUpdate();
      },
    );
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(Error("Guard Realtime subscribe timeout")),
      15000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(t);
        resolve();
      } else if (status === "CHANNEL_ERROR") {
        clearTimeout(t);
        reject(Error("Guard subscription failed"));
      }
    });
  });
  duty = await call(manager, "save_duty", {
    duty: { ...duty, status: "published" },
    approve: true,
  });
  const realtimeObserved = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 10000);
    onUpdate = () => {
      if (seen.has(duty.id)) {
        clearTimeout(t);
        resolve(true);
      }
    };
    onUpdate();
  });
  console.log(
    realtimeObserved
      ? "PASS: published duty reached guard Realtime."
      : "NOTE: Realtime delivery not observed; verifying the authenticated polling fallback.",
  );
  assert.ok(
    (await call(guard, "duties", { from: day, to: day })).duties.some(
      (d) => d.id === duty.id,
    ),
  );
  const stale = { ...duty };
  duty = await call(manager, "save_duty", {
    duty: {
      ...duty,
      instructions:
        "API rehearsal revised instructions. Keep resident access open.",
    },
    approve: true,
  });
  await denied(manager, "save_duty", { duty: stale, approve: true });
  const { error: writeError } = await guard
    .from("security_duties")
    .update({ status: "published" })
    .eq("id", duty.id);
  assert.ok(writeError);
  duty = await call(manager, "save_duty", {
    duty: { ...duty, status: "cancelled" },
  });
  assert.ok(
    !(await call(guard, "duties", { from: day, to: day })).duties.some(
      (d) => d.id === duty.id,
    ),
  );
  console.log(
    "PASS: scoped guard identity, aggregate management-only analytics, student/terminal schedule denial, hidden drafts, guard write denial, explicit approval, publish, scoped refresh, editing, conflict protection and cancellation.",
  );
  const r = await fetch(url + "/functions/v1/kk-provision-guard-once", {
    method: "POST",
    headers: { apikey: key },
  });
  assert.equal(r.status, 410);
  console.log("PASS: guard bootstrap endpoint retired (410).");
} finally {
  if (duty && duty.status !== "cancelled" && manager) {
    try {
      await call(manager, "save_duty", {
        duty: { ...duty, status: "cancelled" },
      });
    } catch {}
  }
  if (channel) await clients[1]?.removeChannel(channel);
  await Promise.all(clients.map((c) => c.auth.signOut({ scope: "local" })));
}
