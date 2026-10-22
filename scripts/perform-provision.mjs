import fs from "node:fs";
const { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_PASSWORD, KK_SETUP_TOKEN } =
  process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !DEMO_PASSWORD || !KK_SETUP_TOKEN)
  throw Error("Load the private operator environment file first.");
const r = await fetch(`${SUPABASE_URL}/functions/v1/kk-provision-once`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${KK_SETUP_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ password: DEMO_PASSWORD }),
});
if (!r.ok)
  throw Error(
    `One-time provisioning failed (${r.status}); inspect the function logs.`,
  );
const result = await r.json();
if (!result.ok || result.accounts !== 6)
  throw Error("Unexpected provisioning result");
const path = ".env.operator.local";
const text = fs
  .readFileSync(path, "utf8")
  .split(/\r?\n/)
  .filter((line) => !line.startsWith("KK_SETUP_TOKEN="))
  .join("\n");
fs.writeFileSync(path, text, { mode: 0o600 });
console.log(
  "Provisioned six fictional accounts. The one-time token was removed from the private operator file.",
);
