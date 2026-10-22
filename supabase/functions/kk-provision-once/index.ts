// Temporary operator endpoint. Retire it with scripts/retire-provision.ts after setup.
// It never accepts a service-role key from a client. A high-entropy, expiring,
// one-time challenge is checked and consumed atomically by service-only SQL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Not found" }, 404);
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token))
    return reply({ error: "Unauthorised" }, 401);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const { data: allowed, error: challengeError } = await admin.rpc(
    "kk_consume_setup",
    { p_hash: hash },
  );
  if (challengeError || allowed !== true)
    return reply({ error: "Unauthorised" }, 401);
  try {
    const { password } = await req.json();
    if (
      typeof password !== "string" ||
      password.length < 24 ||
      password.length > 100
    )
      throw Error("Invalid operator password");
    const accounts = [
      ["alex@kk-smart.example", 1],
      ["sarah@kk-smart.example", 2],
      ["daniel@kk-smart.example", 3],
      ["emily@kk-smart.example", 4],
      ["management@kk-smart.example", "management"],
      ["gate-a@kk-smart.example", "terminal"],
    ] as const;
    const { data: existing, error: listError } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    for (const [email, role] of accounts) {
      let user = existing.users.find((u) => u.email === email);
      if (!user) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { demo: true },
        });
        if (error || !data.user) throw Error("Account creation failed");
        user = data.user;
      }
      if (typeof role === "number") {
        const { data, error } = await admin
          .from("students")
          .update({ auth_user_id: user.id })
          .eq("id", `00000000-0000-4000-8000-${String(role).padStart(12, "0")}`)
          .select("id");
        if (error || data?.length !== 1) throw Error("Student link failed");
      } else {
        const { error } = await admin
          .from("account_roles")
          .upsert({ auth_user_id: user.id, role });
        if (error) throw error;
        if (role === "terminal") {
          const { error } = await admin
            .from("gate_terminals")
            .upsert(
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
    }
    return reply({ ok: true, accounts: accounts.length });
  } catch {
    console.error(
      "Demo account provisioning failed; inspect Auth and database logs.",
    );
    return reply({ error: "Provisioning failed" }, 400);
  }
});
