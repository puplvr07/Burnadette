import { spawnSync } from "node:child_process";
import { lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const frontend = fileURLToPath(new URL("../", import.meta.url));

export function validateDeploymentEnv(env) {
  const value = env.VITE_API_URL;
  // Check the literal input too: URL parsing normalizes /../, backslashes and whitespace.
  if (typeof value !== "string" || !/^https:\/\/[^/?#\\\s]+\/?$/.test(value)) {
    throw new Error("VITE_API_URL must be an HTTPS origin, optionally ending in / (no /api path).");
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VITE_API_URL must have no credentials, path, query or fragment.");
  }
  if (env.VITE_USE_FAKE && env.VITE_USE_FAKE !== "0") {
    throw new Error("VITE_USE_FAKE must be unset or 0 for a Vercel deployment.");
  }
  return value;
}

export async function removeDeploymentData(root = frontend) {
  const resolvedRoot = await realpath(root);
  const dist = path.join(resolvedRoot, "dist");
  if ((await lstat(dist)).isSymbolicLink() || await realpath(dist) !== dist) {
    throw new Error("Refusing to clean a linked dist directory.");
  }
  // These are the only outputs removed; public/ and all application assets stay intact.
  for (const name of ["data", "fake_cell_week.csv"]) {
    const target = path.join(dist, name);
    try {
      if ((await lstat(target)).isSymbolicLink()) throw new Error(`Refusing to clean linked output: ${name}`);
      await rm(target, { recursive: name === "data", force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

export async function buildDeployment() {
  // Vite's production dotenv precedence matches the original npm run build command.
  const env = loadEnv("production", frontend, "VITE_");
  const api = validateDeploymentEnv(env);
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? (process.env.ComSpec || "cmd.exe") : "npm", windows ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"], {
    cwd: frontend,
    env: { ...process.env, VITE_API_URL: api, VITE_USE_FAKE: "0" },
    stdio: "inherit",
    shell: false,
    windowsHide: true, // Windows npm.cmd runs through an explicit shell with a fixed command.
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run build failed (${result.status ?? result.signal}).`);
  await removeDeploymentData();
  console.log("Vercel output ready: dist/ excludes data/ and fake_cell_week.csv.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDeployment().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
