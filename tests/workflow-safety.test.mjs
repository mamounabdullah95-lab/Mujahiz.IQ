import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const trustedAdminUsers = fs.readFileSync(new URL("../functions/src/adminUsers.ts", import.meta.url), "utf8");
const taxonomy = fs.readFileSync(new URL("../src/contexts/TaxonomyContext.tsx", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../src/bootstrap.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../scripts/migrate-linked-supplier-accounts.mjs", import.meta.url), "utf8");

test("supplier RFQ eligibility follows the linked account status", () => {
  assert.match(trustedAdminUsers, /target\.accountType === "supplier" && typeof target\.supplierProfileId === "string"/);
  assert.match(trustedAdminUsers, /canReceiveRfqs: status === "approved"/);
});

test("public pages use local taxonomy without protected Firestore reads", () => {
  assert.match(main, /import\("\.\/bootstrap"\)/);
  assert.match(bootstrap, /<AuthProvider>[\s\S]*?<TaxonomyProvider>/);
  assert.match(taxonomy, /isFirebaseConfigured && !firebaseUser/);
  assert.match(taxonomy, /catch \{[\s\S]*?setTaxonomy\(taxonomyFromSettings\(\)\)/);
});

test("linked supplier migration is dry-run by default and requires --apply", () => {
  assert.match(migration, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(migration, /No Firestore documents were changed/);
  assert.match(migration, /LINKABLE=/);
  assert.match(migration, /UNLINKABLE=/);
  assert.match(migration, /DUPLICATES=/);
  assert.match(migration, /WOULD_UPDATE=/);
  assert.match(migration, /WRITES_EXECUTED=0/);
  assert.match(migration, /multiple_accounts_claim_same_profile/);
  assert.match(migration, /supplier_profile_owned_by_another_account/);
  assert.match(migration, /canReceiveRfqs: \{ booleanValue: candidate\.desiredEligibility \}/);
});
