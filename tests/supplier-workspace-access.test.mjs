import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("supplier product and document queries are scoped by profile and authenticated owner", () => {
  const source = read("src/services/workspace.ts");
  for (const functionName of ["listSupplierProducts", "listSupplierDocuments"]) {
    const start = source.indexOf(`export async function ${functionName}`);
    assert.notEqual(start, -1);
    const end = source.indexOf("\nexport async function", start + 1);
    const body = source.slice(start, end === -1 ? source.length : end);
    assert.match(body, /supplierId: string, ownerUserId: string/);
    assert.match(body, /where\("supplierId", "==", normalizedSupplierId\)/);
    assert.match(body, /where\("ownerUserId", "==", normalizedOwnerUserId\)/);
    assert.match(body, /item\.supplierId === normalizedSupplierId && item\.ownerUserId === normalizedOwnerUserId/);
    assert.match(body, /limit\(250\)/);
  }
});

test("supplier workspace callers derive owner scope from the authenticated Firebase user", () => {
  const workspace = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  const dashboard = read("src/pages/SupplierDashboardPage.tsx");
  assert.match(workspace, /const ownerUserId = firebaseUser\?\.uid/);
  assert.match(workspace, /listSupplierProducts\(supplierId, ownerUserId\)/);
  assert.match(workspace, /listSupplierDocuments\(supplierId, ownerUserId\)/);
  assert.match(dashboard, /listSupplierDocuments\(appUser\.supplierProfileId, userId\)/);
});

async function importDashboardLoader() {
  const source = read("src/utils/supplierDashboardLoad.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("a documents failure preserves supplier submissions and the remaining dashboard metrics", async () => {
  const { loadSupplierDashboardData } = await importDashboardLoader();
  const result = await loadSupplierDashboardData({
    submissions: async () => [{ id: "submission-1" }],
    rfqs: async () => [{ id: "rfq-1" }],
    documents: async () => { throw Object.assign(new Error("denied"), { code: "permission-denied" }); },
    conversations: async () => [{ id: "conversation-1" }],
  });
  assert.equal(result.submissions.length, 1);
  assert.equal(result.rfqCount, 1);
  assert.equal(result.documentCount, 0);
  assert.equal(result.conversationCount, 1);
  assert.deepEqual(result.errors, [{ scope: "documents", code: "permission-denied", critical: false }]);
});

test("retry can recover an optional supplier dashboard section", async () => {
  const { loadSupplierDashboardData } = await importDashboardLoader();
  let attempts = 0;
  const loaders = {
    submissions: async () => [{ id: "submission-1" }],
    rfqs: async () => [],
    documents: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary");
      return [{ id: "document-1" }];
    },
    conversations: async () => [],
  };
  const first = await loadSupplierDashboardData(loaders);
  const second = await loadSupplierDashboardData(loaders);
  assert.equal(first.documentCount, 0);
  assert.equal(first.errors[0].scope, "documents");
  assert.equal(second.documentCount, 1);
  assert.deepEqual(second.errors, []);
});

test("supplier workspace loaders guard stale responses and do not introduce polling", () => {
  const dashboard = read("src/pages/SupplierDashboardPage.tsx");
  const pages = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  assert.match(dashboard, /loadRequestRef/);
  assert.match(dashboard, /return \(\) => \{ loadRequestRef\.current \+= 1; \}/);
  assert.match(pages, /loadRequestRef/);
  assert.doesNotMatch(`${dashboard}\n${pages}`, /setInterval\(|onSnapshot\(/);
});

test("owned supplier preview uses a protected route and hides buyer actions", () => {
  const app = read("src/AppV2.tsx");
  const profile = read("src/pages/SupplierProfilePage.tsx");
  assert.match(app, /path="supplier\/company-preview"/);
  assert.match(app, /allowedRoles=\{supplierRoles\}/);
  assert.match(profile, /SupplierOwnedProfilePreviewPage/);
  assert.match(profile, /ownedPreview \? appUser\?\.supplierProfileId/);
  assert.match(profile, /const canContribute = !ownedPreview/);
  assert.match(profile, /const isBuyerAccount = !ownedPreview/);
});

test("supplier workspace uses localized safe errors, retry actions, and empty states", () => {
  const pages = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  assert.match(pages, /Document records could not be loaded\. Please retry or contact platform administration/);
  assert.match(pages, /<DashboardError message=\{error\} retry=\{\(\) => void load\(\)\} \/>/);
  assert.match(pages, /<InlineEmptyState title=\{text\.empty\}/);
  assert.doesNotMatch(pages, /String\(error\)|error\.message/);
});

test("file uploads remain disabled and document metadata stays text-only", () => {
  const flags = read("src/config/features.ts");
  const workspace = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  assert.match(flags, /fileUploads/);
  assert.match(workspace, /DisabledFileUpload/);
  assert.doesNotMatch(workspace, /uploadBytes|uploadString|getDownloadURL/);
});

test("Firestore rules preserve supplier ownership and document verification fields", () => {
  const rules = read("firestore.rbac.rules");
  assert.match(rules, /request\.resource\.data\.supplierId == resource\.data\.supplierId/);
  assert.match(rules, /request\.resource\.data\.ownerUserId == resource\.data\.ownerUserId/);
  assert.match(rules, /request\.resource\.data\.verificationStatus == resource\.data\.verificationStatus/);
  assert.match(rules, /currentSupplierCanWrite\(resource\.data\.supplierId\)/);
});
