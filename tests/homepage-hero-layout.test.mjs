import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/pages/LandingPage.tsx", import.meta.url), "utf8");

test("homepage hero keeps the illustration and content card in one bounded responsive grid", () => {
  assert.match(source, /data-hero-layout/);
  assert.match(source, /max-w-\[96rem\]/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(26rem,0\.92fr\)\]/);
  assert.match(source, /lg:gap-\[clamp\(1rem,2vw,2rem\)\]/);
  assert.match(source, /data-hero-illustration/);
  assert.match(source, /max-h-\[30rem\].*max-w-\[48rem\].*object-contain/);
  assert.match(source, /data-hero-card/);
  assert.match(source, /max-w-\[44rem\].*lg:justify-self-start/);
});

test("homepage hero no longer positions the illustration independently from the card", () => {
  assert.doesNotMatch(source, /pointer-events-none absolute bottom-0 left-0/);
  assert.doesNotMatch(source, /absolute inset-y-0 left-0.*w-1\/2/);
  assert.doesNotMatch(source, /hidden min-h-\[22rem\] lg:block/);
  assert.match(source, /style=\{\{ direction: "ltr" \}\}/);
  assert.match(source, /style=\{\{ direction: locale === "ar" \? "rtl" : "ltr" \}\}/);
});