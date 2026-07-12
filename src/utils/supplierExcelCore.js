export const MAX_SUPPLIER_EXCEL_SIZE = 200 * 1024;
export const MAX_SUPPLIER_IMPORT_ROWS = 50;
export const MAX_SUPPLIER_IMPORT_COLUMNS = 40;

const field = (key, headerAr, headerEn, required = false, kind = "text") => ({
  key,
  headerAr,
  headerEn,
  header: `${required ? "* " : ""}${headerAr} / ${headerEn}`,
  required,
  kind,
});

export const SUPPLIER_EXCEL_FIELDS = Object.freeze([
  field("nameOriginal", "اسم المجهز", "supplier name", true),
  field("displayName", "الاسم الظاهر", "display name"),
  field("nameLanguage", "لغة اسم الشركة", "company name language", true, "code"),
  field("nameAr", "اسم الشركة بالعربية", "arabic company name"),
  field("nameEn", "اسم الشركة بالإنكليزية", "english company name"),
  field("businessType", "نوع النشاط", "business type", true, "code"),
  field("shortDescription", "وصف مختصر", "short description"),
  field("governorates", "المحافظات", "governorates", true, "codes"),
  field("city", "المدينة الرئيسية", "main city", true),
  field("marketArea", "السوق أو المنطقة الرئيسية", "main market or area", true),
  field("address", "العنوان الكامل", "full address"),
  field("googleMapsLink", "رابط خرائط Google", "google maps link", false, "url"),
  field("coverageAreas", "نطاقات التغطية", "coverage areas", false, "codes"),
  field("branchDetails", "تفاصيل الفروع", "branch details"),
  field("primaryPhone", "الهاتف الأساسي", "primary phone", true, "phone"),
  field("secondaryPhone", "الهاتف الثاني", "secondary phone", false, "phone"),
  field("whatsappAvailable", "واتساب متاح", "whatsapp available", true, "code"),
  field("email", "البريد الإلكتروني", "email", false, "email"),
  field("website", "الموقع الإلكتروني", "website", false, "url"),
  field("facebook", "صفحة فيسبوك", "facebook page", false, "url"),
  field("instagramLinkedin", "إنستغرام أو LinkedIn", "instagram or linkedin", false, "url"),
  field("contactPerson", "مسؤول الاتصال", "contact person"),
  field("contactPersonRole", "صفة مسؤول الاتصال", "contact role"),
  field("categories", "التصنيفات الرئيسية", "main categories", true, "codes"),
  field("subcategories", "التصنيفات الفرعية", "subcategories", false, "list"),
  field("capabilityTags", "وسوم القدرات", "capability tags", true, "codes"),
  field("paymentOptions", "خيارات الدفع المقبولة", "accepted payment options", false, "codes"),
  field("acceptsCredit", "يقبل الدفع الآجل", "accepts credit payment", false, "code"),
  field("creditDays", "أيام الدفع الآجل", "credit days", false, "numbers"),
  field("creditStart", "بداية مدة الدفع الآجل", "credit period starts", false, "code"),
  field("creditTermsNote", "ملاحظات الدفع الآجل", "credit terms note"),
  field("sourceType", "مصدر المعلومات", "source of information", true, "code"),
  field("confidenceLevel", "مستوى الثقة", "confidence level", true, "code"),
  field("hasDirectExperience", "خبرة مباشرة سابقة", "previous direct experience", true, "code"),
  field("lastInteractionYear", "سنة آخر تعامل", "last interaction year", false, "year"),
]);

export const DEFAULT_SUPPLIER_IMPORT_OPTIONS = Object.freeze({
  nameLanguage: ["arabic", "english", "mixed"],
  businessType: ["company", "office", "workshop", "factory", "trader", "authorized_distributor", "importer", "service_provider", "individual_supplier", "other"],
  governorates: ["baghdad", "basra", "nineveh", "erbil", "sulaymaniyah", "duhok", "kirkuk", "najaf", "karbala", "babil", "wasit", "diyala", "anbar", "salah_al_din", "dhi_qar", "maysan", "muthanna", "qadisiyyah"],
  coverageAreas: ["local_only", "governorate_level", "all_iraq", "imports_outside_iraq"],
  yesNoUnknown: ["yes", "no", "unknown"],
  categories: ["electrical_materials", "mechanical_materials", "piping_materials", "flanges_fittings", "valves", "instrumentation", "civil_construction", "steel_fabrication", "welding_machining", "safety_ppe", "tools_equipment", "heavy_equipment_rental", "transport_logistics", "office_supplies", "it_electronics", "furniture", "chemicals", "oil_gas_materials", "power_plant_materials", "general_trading", "maintenance_services", "printing_advertising", "other"],
  capabilityTags: ["local_stock", "import_only", "custom_fabrication", "fast_delivery", "technical_support", "site_visit", "installation", "warranty", "company_profile", "project_experience", "obsolete_items", "repair_overhaul", "emergency_sourcing", "works_ngos", "works_construction", "works_oil_gas", "works_power_plants", "official_invoice"],
  paymentOptions: ["cash", "bank_transfer", "usd", "iqd", "official_invoice"],
  creditStart: ["invoice_date", "delivery_date", "invoice_approval"],
  sourceType: ["purchased_before", "requested_quotation", "trusted_recommendation", "market_visit", "found_online", "known_market_supplier", "other"],
  confidenceLevel: ["high", "medium", "low", "needs_verification"],
  directExperience: ["yes", "no", "not_sure"],
});

const arabicDigits = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const latinDigits = "01234567890123456789";
const unsafeTextPattern = /<\/?(?:script|iframe|object|embed|svg|img)|javascript\s*:|data\s*:\s*text\/html|on\w+\s*=/i;
const fieldByKey = new Map(SUPPLIER_EXCEL_FIELDS.map((item) => [item.key, item]));

export function toLatinDigits(value) {
  return String(value ?? "").replace(/[٠-٩۰-۹]/g, (digit) => latinDigits[arabicDigits.indexOf(digit)] || digit);
}

export function cleanSupplierImportText(value, maximumLength = 1200) {
  const text = toLatinDigits(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (unsafeTextPattern.test(text)) return { value: "", error: "unsafe_content" };
  if (text.length > maximumLength) return { value: text.slice(0, maximumLength), error: "value_too_long" };
  return { value: text, error: "" };
}

export function normalizeSupplierImportHeader(value) {
  return String(value ?? "")
    .replace(/^\s*\*+\s*/, "")
    .replace(/[–—-]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function aliasesForField(item) {
  const internal = item.key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  return new Set([
    item.header,
    `${item.headerAr} / ${item.headerEn}`,
    item.headerAr,
    item.headerEn,
    item.key,
    internal,
  ].map(normalizeSupplierImportHeader));
}

const headerAliases = new Map(SUPPLIER_EXCEL_FIELDS.map((item) => [item.key, aliasesForField(item)]));

export function mapSupplierImportHeaders(headers) {
  if (!Array.isArray(headers) || !headers.length) throw new Error("supplierImportMissingHeaders");
  if (headers.length > MAX_SUPPLIER_IMPORT_COLUMNS) throw new Error("supplierImportTooManyColumns");
  const columns = {};
  const unknownColumns = [];
  const duplicateColumns = [];
  headers.forEach((header, index) => {
    const normalized = normalizeSupplierImportHeader(header);
    if (!normalized) return;
    const matched = SUPPLIER_EXCEL_FIELDS.find((item) => headerAliases.get(item.key)?.has(normalized));
    if (!matched) {
      unknownColumns.push({ index, header: String(header || "") });
      return;
    }
    if (columns[matched.key] != null) {
      duplicateColumns.push(matched.key);
      return;
    }
    columns[matched.key] = index;
  });
  const missingRequiredColumns = SUPPLIER_EXCEL_FIELDS.filter((item) => item.required && columns[item.key] == null).map((item) => item.key);
  const missingOptionalColumns = SUPPLIER_EXCEL_FIELDS.filter((item) => !item.required && columns[item.key] == null).map((item) => item.key);
  return { columns, unknownColumns, duplicateColumns, missingRequiredColumns, missingOptionalColumns };
}

export function validateSupplierImportFileMetadata(file) {
  const name = String(file?.name || "");
  const type = String(file?.type || "").toLowerCase();
  const size = Number(file?.size || 0);
  if (!name.toLowerCase().endsWith(".xlsx")) throw new Error("unsupportedSupplierImportFile");
  if (!Number.isFinite(size) || size <= 0) throw new Error("invalidSupplierImportFile");
  if (size > MAX_SUPPLIER_EXCEL_SIZE) throw new Error("supplierImportTooLarge");
  const acceptedMime = new Set(["", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"]);
  if (!acceptedMime.has(type)) throw new Error("unsupportedSupplierImportMime");
}

function splitValues(value) {
  return cleanSupplierImportText(value, 1200).value.split(",").map((item) => item.trim()).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeName(value) {
  return cleanSupplierImportText(value, 240).value.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeEmail(value) {
  const cleaned = cleanSupplierImportText(value, 254).value;
  const at = cleaned.lastIndexOf("@");
  if (at <= 0) return cleaned;
  return `${cleaned.slice(0, at)}@${cleaned.slice(at + 1).toLocaleLowerCase("en")}`;
}

function normalizePhone(value) {
  const raw = toLatinDigits(value).trim();
  if (/https?:\/\//i.test(raw)) return { value: "", error: "phone_is_url" };
  let normalized = raw.replace(/[\s()\-\.]/g, "");
  if (normalized.startsWith("00964")) normalized = `+${normalized.slice(2)}`;
  else if (/^9647\d{9}$/.test(normalized)) normalized = `+${normalized}`;
  else if (/^07\d{9}$/.test(normalized)) normalized = `+964${normalized.slice(1)}`;
  if (/^\+9647\d{9}$/.test(normalized) || /^\+[1-9]\d{7,14}$/.test(normalized)) return { value: normalized, error: "" };
  return { value: normalized, error: normalized ? "invalid_phone" : "" };
}

function normalizeUrl(value, mapsOnly = false) {
  const cleaned = cleanSupplierImportText(value, 1000);
  if (cleaned.error) return { value: "", error: cleaned.error };
  if (!cleaned.value) return { value: "", error: "" };
  if (/^(?:javascript|data):/i.test(cleaned.value)) return { value: "", error: "unsafe_url" };
  const candidate = /^https?:\/\//i.test(cleaned.value) ? cleaned.value : `https://${cleaned.value}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return { value: "", error: "unsafe_url" };
    if (mapsOnly && !/(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/i.test(url.hostname)) return { value: "", error: "invalid_google_maps_url" };
    return { value: url.toString(), error: "" };
  } catch {
    return { value: "", error: "invalid_url" };
  }
}

function parseCodes(key, value, options) {
  const values = unique(splitValues(value));
  const allowed = new Set(options[key] || []);
  const unknown = values.filter((item) => !allowed.has(item));
  return { values: values.filter((item) => allowed.has(item)), unknown };
}

function parseSingleCode(key, value, options) {
  const cleaned = cleanSupplierImportText(value, 120).value;
  if (!cleaned) return { value: "", error: "" };
  return (options[key] || []).includes(cleaned) ? { value: cleaned, error: "" } : { value: "", error: `unknown_code:${key}:${cleaned}` };
}

function createSearchKeywords(values) {
  const keywords = new Set();
  values.filter(Boolean).forEach((value) => {
    const normalized = normalizeName(value);
    if (normalized) keywords.add(normalized);
    normalized.split(" ").filter((item) => item.length > 1).forEach((item) => keywords.add(item));
  });
  return Array.from(keywords).slice(0, 80);
}

function fieldHasValue(profile, key) {
  let value = profile[key];
  if (key === "primaryPhone") value = value || profile.phones?.[0];
  if (key === "secondaryPhone") value = value || profile.phones?.[1];
  if (key === "governorates") value = value?.length ? value : profile.governorate ? [profile.governorate] : [];
  if (key === "branchDetails") value = value || ((profile.branches || []).length ? "structured_branches" : "");
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  return value != null && String(value).trim() !== "";
}

export function calculateSupplierProfileCompleteness(profile) {
  const statuses = {};
  SUPPLIER_EXCEL_FIELDS.forEach((item) => { statuses[item.key] = fieldHasValue(profile, item.key) ? "complete" : "missing"; });
  if (profile.nameLanguage === "arabic") statuses.nameEn = "not_applicable";
  if (profile.nameLanguage === "english") statuses.nameAr = "not_applicable";
  if (!profile.branchDetails && !(profile.branches || []).length) statuses.branchDetails = "not_applicable";
  if (profile.acceptsCredit === false) {
    statuses.creditDays = "not_applicable";
    statuses.creditStart = "not_applicable";
    statuses.creditTermsNote = "not_applicable";
  }
  if (profile.hasDirectExperience !== "yes") statuses.lastInteractionYear = "not_applicable";
  const applicable = Object.values(statuses).filter((status) => status !== "not_applicable");
  const complete = applicable.filter((status) => status === "complete").length;
  const percentage = applicable.length ? Math.round((complete / applicable.length) * 100) : 0;
  return {
    percentage,
    completedFields: complete,
    applicableFields: applicable.length,
    missingFields: Object.entries(statuses).filter(([, status]) => status === "missing").map(([key]) => key),
    notApplicableFields: Object.entries(statuses).filter(([, status]) => status === "not_applicable").map(([key]) => key),
    statuses,
  };
}

function requiredValueErrors(values) {
  const missing = SUPPLIER_EXCEL_FIELDS.filter((item) => item.required && !fieldHasValue(values, item.key)).map((item) => item.key);
  if (values.nameLanguage === "arabic" && !values.nameAr) missing.push("nameAr");
  if (values.nameLanguage === "english" && !values.nameEn) missing.push("nameEn");
  if (values.nameLanguage === "mixed" && (!values.nameAr || !values.nameEn)) {
    if (!values.nameAr) missing.push("nameAr");
    if (!values.nameEn) missing.push("nameEn");
  }
  if (values.businessType === "other" && !values.shortDescription) missing.push("shortDescription");
  if (values.acceptsCredit === true) {
    if (!(values.creditDays || []).length) missing.push("creditDays");
    if (!values.creditStart) missing.push("creditStart");
  }
  return unique(missing);
}

function similarity(left, right) {
  const a = new Set(normalizeName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = Array.from(a).filter((item) => b.has(item)).length;
  return intersection / new Set([...a, ...b]).size;
}

function duplicateAgainst(draft, indexes) {
  const exact = [];
  const possible = [];
  for (const item of indexes || []) {
    const phones = item.normalizedPhones || [];
    const samePhone = draft.normalizedPhones.some((phone) => phones.includes(phone));
    const sameEmail = Boolean(draft.normalizedEmail && item.normalizedEmail && draft.normalizedEmail === item.normalizedEmail);
    const sameWebsite = Boolean(draft.website && item.website && draft.website === item.website);
    const sameNameAndPlace = Boolean(draft.normalizedName && draft.normalizedName === item.normalizedName && (!item.governorate || item.governorate === draft.governorate));
    const match = {
      supplierId: item.supplierId || item.submissionId || item.id || "unknown",
      supplierName: item.supplierName || item.nameOriginal || "Similar supplier",
      reason: samePhone ? "same_phone" : sameEmail ? "same_email" : sameWebsite ? "same_website" : "similar_name",
      confidence: samePhone || sameEmail || sameWebsite ? "high" : "medium",
      score: samePhone || sameEmail || sameWebsite ? 1 : similarity(draft.nameOriginal, item.supplierName || item.nameOriginal || ""),
      source: item.source || "database",
    };
    if (samePhone || sameEmail || sameWebsite || sameNameAndPlace) exact.push(match);
    else if (similarity(draft.nameOriginal, item.supplierName || item.nameOriginal || "") >= 0.78) possible.push(match);
  }
  return { exact, possible };
}

export function valuesFromSupplierImportRow(cells, columns) {
  const values = {};
  SUPPLIER_EXCEL_FIELDS.forEach((item) => { values[item.key] = String(cells[columns[item.key]] ?? ""); });
  return values;
}

export function validateSupplierImportValues(inputValues, context = {}) {
  const options = { ...DEFAULT_SUPPLIER_IMPORT_OPTIONS, ...(context.options || {}) };
  const errors = [];
  const warnings = [];
  const values = {};
  SUPPLIER_EXCEL_FIELDS.forEach((item) => {
    const result = cleanSupplierImportText(inputValues[item.key] ?? "", ["shortDescription", "address", "branchDetails", "creditTermsNote"].includes(item.key) ? 1200 : 500);
    values[item.key] = result.value;
    if (result.error) errors.push(`${item.key}:${result.error}`);
  });
  for (const key of context.formulaFields || []) errors.push(`${key}:formula_not_allowed`);

  const singleCodeMap = { nameLanguage: "nameLanguage", businessType: "businessType", whatsappAvailable: "yesNoUnknown", creditStart: "creditStart", sourceType: "sourceType", confidenceLevel: "confidenceLevel", hasDirectExperience: "directExperience" };
  Object.entries(singleCodeMap).forEach(([fieldKey, optionKey]) => {
    const parsed = parseSingleCode(optionKey, values[fieldKey], options);
    values[fieldKey] = parsed.value;
    if (parsed.error) errors.push(parsed.error);
  });
  const multiCodeMap = { governorates: "governorates", coverageAreas: "coverageAreas", categories: "categories", capabilityTags: "capabilityTags", paymentOptions: "paymentOptions" };
  Object.entries(multiCodeMap).forEach(([fieldKey, optionKey]) => {
    const parsed = parseCodes(optionKey, values[fieldKey], options);
    values[fieldKey] = parsed.values;
    parsed.unknown.forEach((code) => errors.push(`unknown_code:${fieldKey}:${code}`));
  });
  values.subcategories = unique(splitValues(values.subcategories));
  const primaryPhone = normalizePhone(values.primaryPhone);
  const secondaryPhone = normalizePhone(values.secondaryPhone);
  values.primaryPhone = primaryPhone.value;
  values.secondaryPhone = secondaryPhone.value;
  if (primaryPhone.error) errors.push(`primaryPhone:${primaryPhone.error}`);
  if (secondaryPhone.error) errors.push(`secondaryPhone:${secondaryPhone.error}`);
  values.email = normalizeEmail(values.email);
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push("email:invalid_email");
  for (const [key, mapsOnly] of [["website", false], ["facebook", false], ["instagramLinkedin", false], ["googleMapsLink", true]]) {
    const parsed = normalizeUrl(values[key], mapsOnly);
    values[key] = parsed.value;
    if (parsed.error) errors.push(`${key}:${parsed.error}`);
  }
  const creditCode = parseSingleCode("yesNoUnknown", values.acceptsCredit, options);
  if (creditCode.error) errors.push(creditCode.error);
  values.acceptsCredit = creditCode.value === "yes" ? true : creditCode.value === "no" ? false : undefined;
  values.creditDays = unique(splitValues(values.creditDays).map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 365));
  if (inputValues.creditDays && !values.creditDays.length) errors.push("creditDays:invalid_number");
  if (values.lastInteractionYear && (!/^\d{4}$/.test(values.lastInteractionYear) || Number(values.lastInteractionYear) < 1950 || Number(values.lastInteractionYear) > new Date().getFullYear())) errors.push("lastInteractionYear:invalid_year");

  values.displayName ||= values.nameOriginal;
  const phones = unique([values.primaryPhone, values.secondaryPhone].filter(Boolean));
  const branches = values.branchDetails ? [{ governorate: values.governorates[0] || "", city: values.city, marketArea: values.marketArea, address: values.branchDetails, phone: "" }] : [];
  const draft = {
    nameOriginal: values.nameOriginal,
    displayName: values.displayName,
    nameLanguage: values.nameLanguage || "mixed",
    nameAr: values.nameAr || undefined,
    nameEn: values.nameEn || undefined,
    shortDescription: values.shortDescription || undefined,
    businessType: values.businessType || "company",
    governorate: values.governorates[0] || "",
    governorates: values.governorates,
    branches,
    branchDetails: values.branchDetails || undefined,
    city: values.city,
    marketArea: values.marketArea,
    address: values.address || undefined,
    googleMapsLink: values.googleMapsLink || undefined,
    coverageAreas: values.coverageAreas,
    phones,
    normalizedPhones: phones,
    whatsappAvailable: values.whatsappAvailable || "unknown",
    email: values.email || undefined,
    normalizedEmail: values.email || undefined,
    website: values.website || undefined,
    facebook: values.facebook || undefined,
    instagramLinkedin: values.instagramLinkedin || undefined,
    contactPerson: values.contactPerson || undefined,
    contactPersonRole: values.contactPersonRole || undefined,
    categories: values.categories,
    subcategories: values.subcategories,
    capabilityTags: values.capabilityTags,
    paymentOptions: values.paymentOptions,
    acceptsCredit: values.acceptsCredit,
    creditDays: values.creditDays,
    creditStart: values.creditStart || undefined,
    creditTermsNote: values.creditTermsNote || undefined,
    sourceType: values.sourceType,
    confidenceLevel: values.confidenceLevel,
    hasDirectExperience: values.hasDirectExperience || "not_sure",
    lastInteractionYear: values.lastInteractionYear || undefined,
    completionScore: 0,
    normalizedName: normalizeName(values.nameOriginal),
    searchKeywords: createSearchKeywords([values.nameOriginal, values.displayName, values.nameAr, values.nameEn, values.city, values.marketArea, ...values.categories, ...values.subcategories]),
  };
  const completion = calculateSupplierProfileCompleteness({ ...values, branches });
  draft.completionScore = completion.percentage;
  const missingFields = requiredValueErrors(values);
  const duplicates = duplicateAgainst(draft, context.duplicateIndexes || []);
  if (context.formulaFields?.length) warnings.push("formula_cells_detected");
  let validationStatus = "valid";
  if (errors.length) validationStatus = "invalid";
  else if (missingFields.length) validationStatus = "missing_required_data";
  else if (duplicates.exact.length) validationStatus = "exact_duplicate";
  else if (duplicates.possible.length) validationStatus = "possible_duplicate";
  else if (warnings.length) validationStatus = "needs_review";
  return { values, draft, errors: unique(errors), warnings: unique(warnings), missingFields, completion, validationStatus, duplicateMatches: [...duplicates.exact, ...duplicates.possible] };
}

export function parseSupplierImportRows(input) {
  const { headers, rows, rowNumbers = [], formulaColumnsByRow = {}, options, duplicateIndexes = [] } = input;
  const headerMap = mapSupplierImportHeaders(headers);
  if (headerMap.duplicateColumns.length) throw new Error("supplierImportDuplicateColumns");
  if (headerMap.missingRequiredColumns.length) {
    const error = new Error("supplierImportMissingRequiredColumns");
    error.missingColumns = headerMap.missingRequiredColumns;
    throw error;
  }
  const actualRows = rows.map((cells, index) => ({ cells, rowNumber: rowNumbers[index] || index + 2 })).filter((item) => item.cells.some((cell) => cleanSupplierImportText(cell, 1200).value));
  if (!actualRows.length) throw new Error("supplierImportNoRows");
  if (actualRows.length > MAX_SUPPLIER_IMPORT_ROWS) throw new Error("supplierImportTooManyRows");
  const seenIndexes = [...duplicateIndexes];
  const parsedRows = actualRows.map(({ cells, rowNumber }) => {
    const sourceValues = valuesFromSupplierImportRow(cells, headerMap.columns);
    const formulaFields = (formulaColumnsByRow[rowNumber] || []).map((columnIndex) => SUPPLIER_EXCEL_FIELDS.find((item) => headerMap.columns[item.key] === columnIndex)?.key).filter(Boolean);
    const result = validateSupplierImportValues(sourceValues, { options, duplicateIndexes: seenIndexes, formulaFields });
    seenIndexes.push({ submissionId: `file-row-${rowNumber}`, supplierName: result.draft.nameOriginal, normalizedName: result.draft.normalizedName, normalizedPhones: result.draft.normalizedPhones, normalizedEmail: result.draft.normalizedEmail, website: result.draft.website, governorate: result.draft.governorate, source: "same_file" });
    return { ...result, originalRowNumber: rowNumber, excluded: !["valid", "needs_review"].includes(result.validationStatus), overrideReason: "" };
  });
  return { headerMap, rows: parsedRows, summary: summarizeSupplierImportRows(parsedRows) };
}

export function summarizeSupplierImportRows(rows) {
  const count = (status) => rows.filter((row) => row.validationStatus === status).length;
  const averageCompleteness = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.completion.percentage, 0) / rows.length) : 0;
  return {
    totalRowsDetected: rows.length,
    validRows: count("valid") + count("needs_review"),
    incompleteRows: count("missing_required_data"),
    invalidRows: count("invalid"),
    exactDuplicateRows: count("exact_duplicate"),
    possibleDuplicateRows: count("possible_duplicate"),
    completeRows: rows.filter((row) => row.completion.percentage === 100).length,
    averageCompleteness,
  };
}

export function canUseSupplierExcelImport(user) {
  if (!user || user.status === "suspended") return false;
  if (user.role === "owner" || user.role === "admin") return true;
  return user.accountType === "buyer" || (user.accountType == null && user.role === "contributor");
}

export function isSupplierImportRowAccepted(row, user) {
  if (row.excluded) return false;
  if (["valid", "needs_review"].includes(row.validationStatus)) return true;
  return row.validationStatus === "possible_duplicate" && (user?.role === "owner" || user?.role === "admin") && String(row.overrideReason || "").trim().length >= 10;
}

export function supplierImportFieldLabel(key, locale = "en") {
  const item = fieldByKey.get(key);
  return item ? (locale === "ar" ? item.headerAr : item.headerEn) : key;
}
