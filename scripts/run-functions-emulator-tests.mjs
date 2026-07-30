import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const firebaseCli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
const testCommand = "node --test --test-concurrency=1 tests/supplier-ownership-functions-emulator.mjs";

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
    "demo-mujahiziq-integration",
    "--only",
    "auth,firestore,functions",
    testCommand,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      CLAIM_SUPPLIER_PROFILE_ENABLED: "true",
      GCLOUD_PROJECT: "demo-mujahiziq-integration",
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
  process.stderr.write(`Firebase Functions Emulator runner failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`Firebase Functions Emulator runner exited after ${signal}.\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
