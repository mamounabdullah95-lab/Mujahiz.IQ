import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const firebaseCli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
const firebaseAdminPackage = fileURLToPath(new URL("../functions/node_modules/firebase-admin/package.json", import.meta.url));
const projectId = "demo-mujahiziq-auth-bridge-poc";

for (const [label, path] of [
  ["Firebase CLI", firebaseCli],
  ["Firebase Admin", firebaseAdminPackage],
]) {
  if (!existsSync(path)) {
    process.stderr.write(`${label} dependency is missing. Run npm ci in the repository root and functions directory.\n`);
    process.exit(1);
  }
}

function forwardLines(stream, destination) {
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  lines.on("line", (line) => destination.write(`${line}\n`));
}

const child = spawn(
  process.execPath,
  [
    firebaseCli,
    "emulators:exec",
    "--project",
    projectId,
    "--only",
    "auth",
    "node --test --test-concurrency=1 tests/firebase-supabase-auth-bridge-poc.mjs",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      FIREBASE_PROJECT_ID: projectId,
      GCLOUD_PROJECT: projectId,
    },
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  },
);

forwardLines(child.stdout, process.stdout);
forwardLines(child.stderr, process.stderr);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  process.stderr.write(`Auth bridge POC runner failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`Auth bridge POC runner exited after ${signal}.\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
