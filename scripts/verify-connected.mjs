// Run against the dedicated fictional competition project after provisioning.
// Credentials remain in process memory. Never run this against real student data.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password)
  throw Error(
    "SUPABASE_URL, SUPABASE_ANON_KEY and DEMO_PASSWORD are required in the operator environment.",
  );
const clients = [];
async function account(email) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw Error(`Demo account login failed: ${email}`);
  clients.push(client);
  return client;
}
async function call(client, action, body = {}) {
  const { data, error } = await client.functions.invoke("kk-api", {
    body: { action, ...body },
  });
  if (error || data?.error)
    throw Error(`Connected operation failed: ${action}`);
  return data;
}
const terminal = await account("gate-a@kk-smart.example");
const manager = await account("management@kk-smart.example");
const alex = await account("alex@kk-smart.example");
try {
  const initial = await call(manager, "snapshot", { role: "management" });
  assert.equal(
    initial.students.length,
    200,
    "Expected the dedicated 200-student fictional seed.",
  );
  const gate = await call(terminal, "snapshot", { role: "terminal" });
  const original = initial.students.find((s) => s.student_id === "DEMO001");
  assert.equal(
    original.block_id,
    gate.terminal_block_id,
    "Restore Alex to the terminal block before rehearsal.",
  );
  assert.equal(original.status, "active");
  const credential = await call(alex, "issue");
  assert.equal(
    Date.parse(credential.expires_at) - Date.parse(credential.issued_at),
    15000,
  );
  const granted = await call(terminal, "verify", { token: credential.token });
  assert.equal(
    granted.granted,
    true,
    "A fresh Alex credential must grant entry.",
  );
  const replay = await call(terminal, "verify", { token: credential.token });
  assert.equal(replay.granted, false);
  assert.equal(replay.reason, "QR credential already used");
  const after = await call(manager, "snapshot", { role: "management" });
  assert.ok(
    after.events.some((e) => e.id === granted.event.id && e.granted),
    "The gate event must reach the shared management dataset.",
  );
  console.log(
    "PASS: student Auth → server-issued QR → authorised gate → Supabase event → management snapshot; replay denied.",
  );
  for (const [email, reason] of [
    ["sarah@kk-smart.example", "No active block permission"],
    ["daniel@kk-smart.example", "No active block permission"],
    ["emily@kk-smart.example", "Residential permission expired"],
  ]) {
    const student = await account(email);
    const c = await call(student, "issue");
    const denied = await call(terminal, "verify", { token: c.token });
    assert.equal(denied.granted, false);
    assert.equal(denied.reason, reason);
  }
  console.log(
    "PASS: wrong block, non-resident and expired residency denied by the deployed backend.",
  );
  const expired = await call(alex, "issue");
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.max(
        0,
        Date.parse(expired.expires_at) - Date.parse(expired.server_time),
      ) + 1100,
    ),
  );
  const expiredDecision = await call(terminal, "verify", {
    token: expired.token,
  });
  assert.equal(expiredDecision.granted, false);
  assert.equal(expiredDecision.reason, "QR credential expired");
  console.log(
    "PASS: server expiry rejects the credential after its 15-second lifetime.",
  );
  const otherBlock = initial.blocks.find((b) => b.id !== original.block_id);
  try {
    await call(manager, "manage_residency", {
      student: { ...original, block_id: otherBlock.id },
    });
    const c = await call(alex, "issue");
    assert.equal(
      (await call(terminal, "verify", { token: c.token })).granted,
      false,
    );
  } finally {
    await call(manager, "manage_residency", { student: original });
  }
  const restored = await call(alex, "issue");
  assert.equal(
    (await call(terminal, "verify", { token: restored.token })).granted,
    true,
  );
  console.log(
    "PASS: management permission changes affect fresh verification; original permission restored.",
  );
  let created = 0;
  for (let i = 0; i < 5; i++) {
    const r = await call(terminal, "verify", {
      token: `INVALID-REHEARSAL-${crypto.randomUUID()}`,
    });
    assert.equal(r.granted, false);
    if (r.alert) created++;
  }
  assert.ok(
    created <= 1,
    "Repeated failures must not create duplicate alerts within cooldown.",
  );
  const snapshot = await call(manager, "snapshot", { role: "management" });
  assert.ok(
    snapshot.alerts.some(
      (a) =>
        a.block_id === gate.terminal_block_id &&
        Date.now() - Date.parse(a.timestamp) < 150000,
    ),
    "Expected an operational alert in the shared management dataset.",
  );
  console.log(
    "PASS: failure alert reaches management; duplicate alert suppression holds.",
  );
  console.log(
    "Connected API rehearsal complete. Browser, camera, and Realtime transport checks remain separate.",
  );
} finally {
  await Promise.all(clients.map((c) => c.auth.signOut({ scope: "local" })));
}
