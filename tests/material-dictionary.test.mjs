import test from "node:test";
import assert from "node:assert/strict";
import { defaultMaterialTerms } from "../src/data/materialTerms.ts";
import { analyzeUnknownMaterialPhrases, matchMaterialTerms } from "../src/utils/materialDictionary.ts";

test("compound English procurement terms match as a phrase", () => {
  const matches = matchMaterialTerms("Differential Pressure Gauge (Mechanical)", defaultMaterialTerms);
  assert.equal(matches[0]?.canonicalEn, "Differential Pressure Gauge");
});

test("Arabic equivalent and common alias resolve to the same material", () => {
  assert.equal(matchMaterialTerms("أحتاج مقياس فرق الضغط ميكانيكي", defaultMaterialTerms)[0]?.id, "term_differential_pressure_gauge");
  assert.equal(matchMaterialTerms("DP Gauge", defaultMaterialTerms)[0]?.id, "term_differential_pressure_gauge");
});

test("unknown material words are grouped into the longest useful phrase", () => {
  const taxonomy = { governorates: [], supplierCategories: [] };
  const suggestions = analyzeUnknownMaterialPhrases("externally threaded taper pin", taxonomy, []);
  assert.deepEqual(suggestions, ["externally threaded taper pin"]);
});
