import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { removeDeploymentData, validateDeploymentEnv } from "./build-vercel.mjs";

test("deployment accepts only an HTTPS API origin and disables fake mode", () => {
  for (const value of ["https://api.example.test", "https://api.example.test/", "https://api.example.test:8443"]) {
    assert.equal(validateDeploymentEnv({ VITE_API_URL: value }), value);
  }
  for (const value of [undefined, "", "http://api.example.test", "https://user:secret@api.example.test", "https://api.example.test/api", "https://api.example.test/../", "https://api.example.test?", "https://api.example.test#", " https://api.example.test", "https://api.example.test\\"]) {
    assert.throws(() => validateDeploymentEnv({ VITE_API_URL: value }));
  }
  for (const value of ["1", "true", "yes"]) assert.throws(() => validateDeploymentEnv({ VITE_API_URL: "https://api.example.test", VITE_USE_FAKE: value }));
});

test("cleanup removes only generated deployment datasets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "burnadette-build-"));
  try {
    await mkdir(path.join(root, "dist", "data"), { recursive: true });
    await mkdir(path.join(root, "public", "data"), { recursive: true });
    for (const name of ["dist/data/pinned.json", "dist/fake_cell_week.csv", "dist/index.html", "public/data/pinned.json"]) await writeFile(path.join(root, name), "keep-or-remove");
    await removeDeploymentData(root);
    await assert.rejects(readFile(path.join(root, "dist/data/pinned.json")), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(root, "dist/fake_cell_week.csv")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(root, "dist/index.html"), "utf8"), "keep-or-remove");
    assert.equal(await readFile(path.join(root, "public/data/pinned.json"), "utf8"), "keep-or-remove");
  } finally {
    const resolved = await realpath(root);
    assert.equal(path.dirname(resolved), await realpath(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("burnadette-build-"));
    await rm(resolved, { recursive: true, force: true });
  }
});
