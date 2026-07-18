import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const canonicalOriginSource = read("src/config/canonicalOrigin.ts");
const transpiled = ts.transpileModule(canonicalOriginSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const canonicalOrigin = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

const canonicalUrl = "https://mujahiz.com";

function createLocation(input) {
  const url = new URL(input);
  const replacements = [];

  return {
    location: {
      hostname: url.hostname,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      href: url.href,
      replace(target) {
        replacements.push(target);
      },
    },
    replacements,
  };
}

test("redirects both exact legacy Firebase production hosts", () => {
  for (const host of ["mujahiziq.web.app", "mujahiziq.firebaseapp.com"]) {
    const fixture = createLocation(`https://${host}/directory`);
    assert.equal(
      canonicalOrigin.redirectLegacyProductionOrigin(fixture.location, canonicalUrl),
      true,
    );
    assert.deepEqual(fixture.replacements, ["https://mujahiz.com/directory"]);
  }
});

test("preserves pathname, query string, and hash during redirect", () => {
  const fixture = createLocation(
    "https://mujahiziq.web.app/directory?page=2&category=energy#results",
  );

  canonicalOrigin.redirectLegacyProductionOrigin(fixture.location, canonicalUrl);

  assert.deepEqual(fixture.replacements, [
    "https://mujahiz.com/directory?page=2&category=energy#results",
  ]);
});

test("preserves synthetic Firebase Auth action-link parameters", () => {
  const fixture = createLocation(
    "https://mujahiziq.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=synthetic#finish",
  );

  canonicalOrigin.redirectLegacyProductionOrigin(fixture.location, canonicalUrl);

  assert.deepEqual(fixture.replacements, [
    "https://mujahiz.com/__/auth/action?mode=verifyEmail&oobCode=synthetic#finish",
  ]);
});

test("does not redirect canonical, www, local, emulator, preview, or lookalike hosts", () => {
  const excluded = [
    "https://mujahiz.com/dashboard",
    "https://www.mujahiz.com/dashboard",
    "http://localhost:5173/dashboard",
    "http://127.0.0.1:5000/dashboard",
    "http://10.0.2.2:5000/dashboard",
    "https://mujahiziq--review-123.web.app/dashboard",
    "https://mujahiziq.web.app.example.com/dashboard",
  ];

  for (const input of excluded) {
    const fixture = createLocation(input);
    assert.equal(
      canonicalOrigin.redirectLegacyProductionOrigin(fixture.location, canonicalUrl),
      false,
      input,
    );
    assert.deepEqual(fixture.replacements, [], input);
  }
});

test("canonical redirect is evaluated before Firebase and application bootstrap", () => {
  const main = read("src/main.tsx");
  const redirectIndex = main.indexOf(
    "const redirected = redirectLegacyProductionOrigin(window.location, siteSettings.primaryUrl)",
  );
  const firebaseIndex = main.indexOf('import("./config/firebase")');
  const bootstrapIndex = main.indexOf('import("./bootstrap")');

  assert.ok(redirectIndex >= 0);
  assert.ok(firebaseIndex > redirectIndex);
  assert.ok(bootstrapIndex > firebaseIndex);
  assert.doesNotMatch(main, /from ["']\.\/config\/firebase["']/);
  assert.doesNotMatch(main, /https:\/\/mujahiz\.com/);
});
