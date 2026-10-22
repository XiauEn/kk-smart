import fs from "node:fs";
import crypto from "node:crypto";
const [url, key] = process.argv.slice(2);
if (
  !/^https:\/\/[a-z]+\.supabase\.co$/.test(url ?? "") ||
  !key?.startsWith("sb_publishable_")
)
  throw Error(
    "Expected this deployment’s project URL and public publishable key.",
  );
const path = ".env.operator.local";
let values = {};
if (fs.existsSync(path))
  values = Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
if (values.SUPABASE_URL && values.SUPABASE_URL !== url)
  throw Error(
    "An operator file for another project already exists; refusing to overwrite it.",
  );
values = {
  ...values,
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
  DEMO_PASSWORD:
    values.DEMO_PASSWORD ?? crypto.randomBytes(24).toString("base64url"),
  KK_SETUP_TOKEN: crypto.randomBytes(32).toString("hex"),
};
fs.writeFileSync(
  path,
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
for (const app of ["student-portal", "gate-scanner", "management-dashboard"])
  fs.writeFileSync(
    `apps/${app}/.env.local`,
    `VITE_MODE=connected\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${key}\n`,
    { mode: 0o600 },
  );
console.log(
  JSON.stringify({
    setupHash: crypto
      .createHash("sha256")
      .update(values.KK_SETUP_TOKEN)
      .digest("hex"),
    projectUrl: url,
    operatorFile: path,
  }),
);
