import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readSource = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const backendRegionSource = readSource("../functions/src/callableRegion.ts");
const clientSource = readSource("../src/config/firebase.ts");
const emulatorSource = readSource("./supplier-ownership-functions-emulator.mjs");
const callableSources = [
  "../functions/src/adminUsers.ts",
  "../functions/src/supplierSubmissionApproval.ts",
  "../functions/src/supplierOwnership.ts",
  "../functions/src/supplierDuplicate.ts",
].map(readSource);

function configuredRegion(source) {
  return source.match(/FIREBASE_FUNCTIONS_REGION\s*=\s*"([^"]+)"/)?.[1];
}

test("backend and web client use the same europe-west1 callable region", () => {
  const backendRegion = configuredRegion(backendRegionSource);
  const clientRegion = configuredRegion(clientSource);

  assert.equal(backendRegion, "europe-west1");
  assert.equal(clientRegion, backendRegion);
  assert.match(clientSource, /getFunctions\(app, FIREBASE_FUNCTIONS_REGION\)/);
  for (const source of callableSources) {
    assert.match(source, /region: FIREBASE_FUNCTIONS_REGION/);
  }
});

test("Functions Emulator client targets the production callable region contract", () => {
  const backendRegion = configuredRegion(backendRegionSource);
  const emulatorRegion = emulatorSource.match(/getFunctions\(app, "([^"]+)"\)/)?.[1];

  assert.equal(emulatorRegion, backendRegion);
});

test("trusted callable configuration contains no us-central1 endpoint", () => {
  const scopedSources = [backendRegionSource, clientSource, emulatorSource, ...callableSources];
  for (const source of scopedSources) {
    assert.doesNotMatch(source, /us-central1/);
  }
});
