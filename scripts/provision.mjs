// Server/operator script only. Never place the service-role key in a VITE_ variable.
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !DEMO_PASSWORD ||
  DEMO_PASSWORD.length < 12
)
  throw Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a DEMO_PASSWORD of at least 12 characters in this shell.",
  );
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const accounts = [
  ["alex@kk-smart.example", 1],
  ["sarah@kk-smart.example", 2],
  ["daniel@kk-smart.example", 3],
  ["emily@kk-smart.example", 4],
  ["management@kk-smart.example", "management"],
  ["gate-a@kk-smart.example", "terminal"],
];
const all = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({
    page,
    perPage: 1000,
  });
  if (error) throw error;
  all.push(...data.users);
  if (data.users.length < 1000) break;
}
for (const [email, role] of accounts) {
  let user = all.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { demo: true },
    });
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw Error("User provisioning failed");
  if (typeof role === "number") {
    const { data, error } = await db
      .from("students")
      .update({ auth_user_id: user.id })
      .eq("id", `00000000-0000-4000-8000-${String(role).padStart(12, "0")}`)
      .select("id");
    if (error) throw error;
    if (!data.length)
      throw Error("Run supabase/seed/demo.sql before provisioning accounts.");
  } else {
    const { error } = await db
      .from("account_roles")
      .upsert({ auth_user_id: user.id, role });
    if (error) throw error;
    if (role === "terminal") {
      const { error } = await db.from("gate_terminals").upsert(
        {
          auth_user_id: user.id,
          block_id: "00000000-0000-4000-8000-000000001001",
          name: "KK3 Block A demo gate",
          revoked: false,
        },
        { onConflict: "auth_user_id" },
      );
      if (error) throw error;
    }
  }
  console.log(
    `Ready: ${email} (${typeof role === "number" ? "student" : role})`,
  );
}
console.log(
  "Existing account passwords were preserved. New accounts use DEMO_PASSWORD. No credentials were written to disk.",
);
