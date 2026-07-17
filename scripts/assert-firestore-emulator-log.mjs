import fs from "node:fs";

const logFiles = ["firestore-debug.log", "firebase-debug.log"].filter((path) => fs.existsSync(path));
if (logFiles.length === 0) {
  throw new Error("Firestore Emulator diagnostic log was not created.");
}

const forbiddenDiagnostics = [
  ["expression limit", /maximum of 1000 expressions/i],
  ["document access-call limit", /maximum of (?:10|20) (?:document )?(?:access calls|exists|get|getAfter)/i],
  ["rules call-depth limit", /maximum (?:call|function) depth/i],
];

const failures = [];
for (const path of logFiles) {
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    forbiddenDiagnostics.forEach(([label, pattern]) => {
      if (pattern.test(line)) failures.push(`${path}:${index + 1}: ${label}: ${line.trim()}`);
    });
  });
}

if (failures.length > 0) {
  throw new Error(`Firestore Rules limit diagnostics detected:\n${failures.join("\n")}`);
}

console.log(`Firestore Emulator diagnostics passed (${logFiles.join(", ")}).`);
