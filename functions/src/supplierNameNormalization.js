const ARABIC_COMMON_WORDS = new Set([
  "\u0634\u0631\u0643\u0647", "\u0645\u0643\u062a\u0628", "\u0645\u062c\u0645\u0648\u0639\u0647",
  "\u0644\u0644\u062a\u062c\u0627\u0631\u0647", "\u0627\u0644\u062a\u062c\u0627\u0631\u0647",
  "\u0627\u0644\u0639\u0627\u0645\u0647", "\u0627\u0644\u0645\u062d\u062f\u0648\u062f\u0647",
  "\u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062a", "\u0645\u062c\u0647\u0632",
  "\u0645\u062c\u0647\u064a\u0632", "\u0645\u0624\u0633\u0633\u0647",
]);

const ENGLISH_COMMON_WORDS = new Set([
  "company", "co", "ltd", "llc", "trading", "general", "group", "office", "services",
  "contracting", "corp", "corporation",
]);

const ARABIC_INDIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
const PERSIAN_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
const LATIN_DIGITS = "0123456789";

// One canonical value plus at most three existing-record compatibility forms.
export const MAX_SUPPLIER_NAME_SEARCH_VARIANTS = 4;

function normalizeArabicLetters(value) {
  return value
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A");
}

function toLatinDigits(value) {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(digit);
    return LATIN_DIGITS[arabicIndex >= 0 ? arabicIndex : PERSIAN_DIGITS.indexOf(digit)];
  });
}

function toDigitSet(value, digits) {
  return toLatinDigits(value).replace(/[0-9]/g, (digit) => digits[Number(digit)]);
}

function sourceText(value) {
  return typeof value === "string" ? value.normalize("NFKC") : "";
}

export function normalizeSupplierName(value) {
  const text = normalizeArabicLetters(toLatinDigits(sourceText(value)))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Script=Arabic}a-z0-9\s]/gu, " ");
  const seenNumericTokens = new Set();
  const tokens = text.split(/\s+/).filter((token) => {
    if (!token) return false;
    if (/^[0-9]+$/.test(token)) {
      if (seenNumericTokens.has(token)) return false;
      seenNumericTokens.add(token);
      return true;
    }
    if (/\p{Script=Arabic}/u.test(token)) return !ARABIC_COMMON_WORDS.has(token);
    return !ENGLISH_COMMON_WORDS.has(token);
  });
  return tokens.join(" ").slice(0, 200);
}

export function normalizeLiteralSupplierName(value) {
  return toLatinDigits(sourceText(value))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Script=Arabic}a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function normalizeLegacySupplierName(value) {
  const text = sourceText(value);
  const arabic = normalizeArabicLetters(text)
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !ARABIC_COMMON_WORDS.has(word))
    .join(" ");
  const english = text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !ENGLISH_COMMON_WORDS.has(word))
    .join(" ");
  return `${arabic} ${english}`.replace(/\s+/g, " ").trim().slice(0, 200);
}

// Canonical first; literal-import and legacy digit-script forms avoid any migration or fallback scan.
export function supplierNameSearchVariants(value) {
  const text = sourceText(value);
  const digitForms = /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(text)
    ? [
      text,
      toLatinDigits(text),
      toDigitSet(text, ARABIC_INDIC_DIGITS),
      toDigitSet(text, PERSIAN_DIGITS),
    ]
    : [text];
  return [...new Set([
    normalizeSupplierName(text),
    normalizeLiteralSupplierName(text),
    ...digitForms.map(normalizeLegacySupplierName),
  ].filter(Boolean))].slice(0, MAX_SUPPLIER_NAME_SEARCH_VARIANTS);
}