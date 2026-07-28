import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const firebaseCli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
const testCommand = [
  "node --test --test-concurrency=1",
  "tests/firestore-emulator.mjs",
  "tests/rfq-firestore-emulator.mjs",
  "tests/conversation-firestore-emulator.mjs",
  "tests/internal-emulator-accounts.mjs",
  "tests/password-recovery-emulator.mjs",
  "&& node scripts/assert-firestore-emulator-log.mjs",
].join(" ");

function forwardRedactedLines(stream, destination) {
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  lines.on("line", (line) => {
    const output = line.includes("/emulator/action?mode=resetPassword")
      ? "i  auth: [password-reset action link redacted]"
      : line;
    destination.write(`${output}\n`);
  });
}

const child = spawn(
  process.execPath,
  [
    firebaseCli,
    "emulators:exec",
    "--project",
    "demo-mujahiziq-integration",
    "--only",
    "auth,firestore",
    testCommand,
  ],
  {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  },
);

forwardRedactedLines(child.stdout, process.stdout);
forwardRedactedLines(child.stderr, process.stderr);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  process.stderr.write(`Firebase Emulator runner failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`Firebase Emulator runner exited after ${signal}.\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
