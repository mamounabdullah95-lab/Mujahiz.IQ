import test from "node:test";
import assert from "node:assert/strict";
import { isValidEmailAddress, isValidIraqiPhone, normalizeAccountEmail, normalizeIraqiPhone } from "../src/utils/accountValidation.ts";

test("Iraqi phone formats normalize to E.164", () => {
  assert.equal(normalizeIraqiPhone("0781 234 5678"), "+9647812345678");
  assert.equal(normalizeIraqiPhone("+964-781-234-5678"), "+9647812345678");
  assert.equal(normalizeIraqiPhone("٠٧٨١٢٣٤٥٦٧٨"), "+9647812345678");
  assert.equal(isValidIraqiPhone("12345"), false);
});

test("email validation trims and normalizes only the domain", () => {
  assert.equal(normalizeAccountEmail("  Buyer.Name@EXAMPLE.COM  "), "Buyer.Name@example.com");
  assert.equal(isValidEmailAddress("Buyer.Name@example.com"), true);
  assert.equal(isValidEmailAddress("buyer @example.com"), false);
  assert.equal(isValidEmailAddress("buyer@example"), false);
});
