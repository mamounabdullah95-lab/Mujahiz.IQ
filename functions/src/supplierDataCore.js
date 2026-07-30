import { createHash } from "node:crypto";
import { OwnershipValidationError } from "./supplierOwnershipCore.js";
import {
  normalizeSupplierName,
  supplierNameSearchVariants,
} from "./supplierNameNormalization.js";

const SPECIAL_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SUPPLIER_KEYS = new Set([
  "nameOriginal", "displayName", "nameLanguage", "nameAr", "nameEn", "shortDescription",
  "businessType", "governorate", "governorates", "branches", "branchDetails", "city",
  "marketArea", "address", "googleMapsLink", "coverageAreas", "phones", "normalizedPhones",
  "whatsappAvailable", "email", "normalizedEmail", "website", "facebook", "instagramLinkedin",
  "contactPerson", "contactPersonRole", "categories", "subcategories", "capabilityTags",
  "paymentOptions", "acceptsCredit", "creditDays", "creditStart", "creditTermsNote", "sourceType",
  "confidenceLevel", "hasDirectExperience", "lastInteractionYear", "relatedMaterialService",
  "sourceNote", "completionScore", "normalizedName", "searchKeywords",
]);
const BRANCH_KEYS = new Set(["governorate", "city", "marketArea", "address", "phone"]);
const BUSINESS_TYPES = new Set([
  "company", "office", "workshop", "factory", "trader", "authorized_distributor",
  "importer", "service_provider", "individual_supplier", "other",
]);
const SOURCE_TYPES = new Set([
  "purchased_before", "requested_quotation", "trusted_recommendation", "market_visit",
  "found_online", "known_market_supplier", "other",
]);
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low", "needs_verification"]);
const CREDIT_STARTS = new Set(["invoice_date", "delivery_date", "invoice_approval"]);
function fail(message) {
  throw new OwnershipValidationError("invalid-argument", message);
}

function assertPlainObject(value, fieldName, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${fieldName} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`${fieldName} has an unsupported prototype.`);
  const keys = Object.keys(value);
  if (keys.some((key) => SPECIAL_KEYS.has(key))) fail(`${fieldName} contains an unsafe key.`);
  if (keys.some((key) => !allowedKeys.has(key))) fail(`${fieldName} contains unsupported fields.`);
  return value;
}

function cleanText(value, fieldName, minimum, maximum, required = false) {
  if (value == null && !required) return undefined;
  if (typeof value !== "string") fail(`${fieldName} must be a string.`);
  const cleaned = value.normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n").trim();
  if (cleaned.length < minimum || cleaned.length > maximum) {
    fail(`${fieldName} must contain ${minimum}-${maximum} characters.`);
  }
  return cleaned;
}

function enumValue(value, fieldName, values) {
  if (typeof value !== "string" || !values.has(value)) fail(`${fieldName} is invalid.`);
  return value;
}

function stringList(value, fieldName, maximumItems, maximumLength, required = true) {
  if (value == null && !required) return [];
  if (!Array.isArray(value) || value.length > maximumItems) fail(`${fieldName} is invalid.`);
  return [...new Set(value.map((item, index) => cleanText(item, `${fieldName}[${index}]`, 1, maximumLength, true)))];
}

export function normalizeSupplierPhone(value) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.startsWith("00964")) return `964${digits.slice(5)}`;
  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("7")) return `964${digits}`;
  return digits.slice(0, 24);
}

export function normalizeSupplierEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 320) : "";
}

export function normalizeSupplierUrl(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").slice(0, 500)
    : "";
}

function validateBranches(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) fail("branches is invalid.");
  return value.map((item, index) => {
    const branch = assertPlainObject(item, `branches[${index}]`, BRANCH_KEYS);
    return {
      governorate: cleanText(branch.governorate, `branches[${index}].governorate`, 1, 80, true),
      city: cleanText(branch.city, `branches[${index}].city`, 1, 120, true),
      ...(branch.marketArea == null ? {} : { marketArea: cleanText(branch.marketArea, `branches[${index}].marketArea`, 0, 160, true) }),
      ...(branch.address == null ? {} : { address: cleanText(branch.address, `branches[${index}].address`, 0, 500, true) }),
      ...(branch.phone == null ? {} : { phone: cleanText(branch.phone, `branches[${index}].phone`, 0, 40, true) }),
    };
  });
}

function derivedKeywords(data) {
  const values = [data.nameOriginal, data.nameAr, data.nameEn, data.city, data.marketArea,
    ...data.governorates, ...data.categories, ...data.subcategories, ...data.capabilityTags];
  return [...new Set(values.flatMap((item) => normalizeSupplierName(item).split(/\s+/)).filter((item) => item.length > 1))]
    .slice(0, 100);
}

export function validateAndNormalizeSupplierData(value) {
  const source = assertPlainObject(value, "supplierData", SUPPLIER_KEYS);
  const nameOriginal = cleanText(source.nameOriginal, "nameOriginal", 2, 200, true);
  const displayName = cleanText(source.displayName ?? nameOriginal, "displayName", 2, 200, true);
  const nameAr = cleanText(source.nameAr, "nameAr", 0, 200);
  const nameEn = cleanText(source.nameEn, "nameEn", 0, 200);
  const phones = stringList(source.phones, "phones", 10, 40);
  if (!phones.length) fail("phones must contain at least one phone number.");
  const governorate = cleanText(source.governorate, "governorate", 1, 80, true);
  const governorates = stringList(source.governorates ?? [governorate], "governorates", 20, 80);
  const categories = stringList(source.categories, "categories", 20, 100);
  const subcategories = stringList(source.subcategories, "subcategories", 50, 120);
  const capabilityTags = stringList(source.capabilityTags, "capabilityTags", 50, 120);
  const coverageAreas = stringList(source.coverageAreas, "coverageAreas", 20, 100);
  const paymentOptions = stringList(source.paymentOptions, "paymentOptions", 20, 100);
  const creditDays = source.creditDays == null ? [] : source.creditDays;
  if (!Array.isArray(creditDays) || creditDays.length > 12
    || creditDays.some((item) => !Number.isInteger(item) || item < 1 || item > 365)) fail("creditDays is invalid.");
  const completionScore = source.completionScore;
  if (typeof completionScore !== "number" || !Number.isFinite(completionScore)
    || completionScore < 0 || completionScore > 100) fail("completionScore is invalid.");
  if (source.acceptsCredit != null && typeof source.acceptsCredit !== "boolean") fail("acceptsCredit is invalid.");
  const result = {
    nameOriginal, displayName,
    nameLanguage: enumValue(source.nameLanguage, "nameLanguage", new Set(["arabic", "english", "mixed"])),
    ...(nameAr === undefined ? {} : { nameAr }), ...(nameEn === undefined ? {} : { nameEn }),
    ...(source.shortDescription == null ? {} : { shortDescription: cleanText(source.shortDescription, "shortDescription", 0, 1200, true) }),
    businessType: enumValue(source.businessType, "businessType", BUSINESS_TYPES),
    governorate, governorates, branches: validateBranches(source.branches),
    ...(source.branchDetails == null ? {} : { branchDetails: cleanText(source.branchDetails, "branchDetails", 0, 1200, true) }),
    city: cleanText(source.city, "city", 0, 120, true),
    marketArea: cleanText(source.marketArea, "marketArea", 0, 160, true),
    ...(source.address == null ? {} : { address: cleanText(source.address, "address", 0, 500, true) }),
    ...(source.googleMapsLink == null ? {} : { googleMapsLink: cleanText(source.googleMapsLink, "googleMapsLink", 0, 500, true) }),
    coverageAreas, phones, normalizedPhones: [...new Set(phones.map(normalizeSupplierPhone).filter(Boolean))],
    whatsappAvailable: enumValue(source.whatsappAvailable, "whatsappAvailable", new Set(["yes", "no", "unknown"])),
    ...(source.email == null ? {} : { email: cleanText(source.email, "email", 0, 320, true) }),
    ...(source.website == null ? {} : { website: cleanText(source.website, "website", 0, 500, true) }),
    ...(source.facebook == null ? {} : { facebook: cleanText(source.facebook, "facebook", 0, 500, true) }),
    ...(source.instagramLinkedin == null ? {} : { instagramLinkedin: cleanText(source.instagramLinkedin, "instagramLinkedin", 0, 500, true) }),
    ...(source.contactPerson == null ? {} : { contactPerson: cleanText(source.contactPerson, "contactPerson", 0, 160, true) }),
    ...(source.contactPersonRole == null ? {} : { contactPersonRole: cleanText(source.contactPersonRole, "contactPersonRole", 0, 120, true) }),
    categories, subcategories, capabilityTags, paymentOptions,
    ...(source.acceptsCredit == null ? {} : { acceptsCredit: source.acceptsCredit }),
    creditDays: [...new Set(creditDays)].sort((a, b) => a - b),
    ...(source.creditStart == null ? {} : { creditStart: enumValue(source.creditStart, "creditStart", CREDIT_STARTS) }),
    ...(source.creditTermsNote == null ? {} : { creditTermsNote: cleanText(source.creditTermsNote, "creditTermsNote", 0, 500, true) }),
    sourceType: enumValue(source.sourceType, "sourceType", SOURCE_TYPES),
    confidenceLevel: enumValue(source.confidenceLevel, "confidenceLevel", CONFIDENCE_LEVELS),
    hasDirectExperience: enumValue(source.hasDirectExperience, "hasDirectExperience", new Set(["yes", "no", "not_sure"])),
    ...(source.lastInteractionYear == null ? {} : { lastInteractionYear: cleanText(source.lastInteractionYear, "lastInteractionYear", 0, 20, true) }),
    ...(source.relatedMaterialService == null ? {} : { relatedMaterialService: cleanText(source.relatedMaterialService, "relatedMaterialService", 0, 300, true) }),
    ...(source.sourceNote == null ? {} : { sourceNote: cleanText(source.sourceNote, "sourceNote", 0, 1200, true) }),
    completionScore,
  };
  result.normalizedEmail = normalizeSupplierEmail(result.email);
  result.normalizedName = normalizeSupplierName([...new Set([nameOriginal, nameAr, nameEn].filter(Boolean))].join(" "));
  if (result.normalizedName.length < 2) fail("normalizedName is invalid.");
  result.searchKeywords = derivedKeywords(result);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 50_000) fail("supplierData is too large.");
  return result;
}

export function duplicateIdentityFromSupplierData(value) {
  const source = assertPlainObject(value, "supplierData", SUPPLIER_KEYS);
  const nameOriginal = cleanText(source.nameOriginal, "nameOriginal", 2, 200, true);
  const nameAr = cleanText(source.nameAr, "nameAr", 0, 200) || "";
  const nameEn = cleanText(source.nameEn, "nameEn", 0, 200) || "";
  const phones = stringList(source.phones ?? [], "phones", 10, 40);
  const nameVariants = supplierNameSearchVariants(
    [...new Set([nameOriginal, nameAr, nameEn].filter(Boolean))].join(" "),
  );
  return {
    normalizedName: nameVariants[0],
    normalizedNameVariants: nameVariants,
    normalizedPhones: [...new Set(phones.map(normalizeSupplierPhone).filter(Boolean))],
    normalizedEmail: normalizeSupplierEmail(source.email),
    website: normalizeSupplierUrl(source.website), facebook: normalizeSupplierUrl(source.facebook),
    governorates: stringList(source.governorates ?? (source.governorate ? [source.governorate] : []), "governorates", 20, 80),
    categories: stringList(source.categories ?? [], "categories", 20, 100),
  };
}

export function canonicalSupplierFingerprints(data) {
  const nameVariants = supplierNameSearchVariants(
    [...new Set([data.nameOriginal, data.nameAr, data.nameEn].filter(Boolean))].join(" "),
  );
  const descriptors = [...nameVariants.map((value) => ["name", value]), ["email", data.normalizedEmail],
    ["website", normalizeSupplierUrl(data.website)], ["facebook", normalizeSupplierUrl(data.facebook)],
    ...data.normalizedPhones.map((phone) => ["phone", phone])].filter(([, value]) => Boolean(value));
  return [...new Map(descriptors.map(([kind, value]) => {
    const id = createHash("sha256").update(`${kind}\0${value}`, "utf8").digest("hex");
    return [id, { id, kind }];
  })).values()];
}

export function stablePayloadHash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
