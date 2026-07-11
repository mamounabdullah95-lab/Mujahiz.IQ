import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

test("file uploads default to disabled and require an explicit true flag", () => {
  assert.match(read("src/config/features.ts"), /VITE_FILE_UPLOADS_ENABLED === "true"/);
  assert.match(read("src/services/uploadService.ts"), /throw new FileUploadsDisabledError/);
  assert.match(read("src/services/uploadService.ts"), /No Storage adapter is bundled/);
});

test("application source has no Firebase Storage adapter or live file input", () => {
  const combined = sourceFiles(path.join(root, "src")).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(combined, /firebase\/storage|uploadBytes|uploadString|getDownloadURL/);
  assert.doesNotMatch(combined, /type\s*=\s*["']file["']/i);
});

test("Firestore rejects stored file fields and only accepts metadata-only documents", () => {
  const rules = read("firestore.rbac.rules");
  assert.match(rules, /function noStoredFileFields/);
  assert.match(rules, /request\.resource\.data\.storageStatus in \["metadata_only", "upload_pending_launch"\]/);
  assert.match(rules, /noStoredFileFields\(request\.resource\.data\)/);
});
