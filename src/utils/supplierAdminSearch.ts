import type { Supplier } from "../types/domain";

function appendSearchValue(parts: string[], value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => appendSearchValue(parts, item));
    return;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => appendSearchValue(parts, item));
    return;
  }
  const text = String(value);
  parts.push(text);
  const digits = text.replace(/\D+/g, "");
  if (digits.length >= 4) parts.push(digits);
}

export function normalizeSupplierAdminQuery(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function supplierMatchesAdminQuery(supplier: Supplier, value: unknown) {
  const query = normalizeSupplierAdminQuery(value);
  if (!query) return true;

  const record = supplier as unknown as Record<string, unknown>;
  const parts: string[] = [];
  [
    supplier.id,
    supplier.nameAr,
    supplier.nameEn,
    supplier.nameOriginal,
    supplier.displayName,
    supplier.email,
    supplier.normalizedEmail,
    supplier.phones,
    supplier.normalizedPhones,
    record.whatsapp,
    record.whatsappNumber,
    supplier.contactPerson,
    supplier.contactPersonRole,
    supplier.governorate,
    supplier.governorates,
    supplier.city,
    supplier.marketArea,
    supplier.address,
    supplier.branches,
    supplier.categories,
    supplier.subcategories,
    supplier.capabilityTags,
    supplier.searchKeywords,
    supplier.relatedMaterialService,
    supplier.sourceSummary,
    supplier.sourceNote,
    record.uatIdentifier,
    record.registrationReference,
    record.registrationNumber,
    record.registrationId,
    record.referenceId,
    record.sourceReference,
    record.taxRegistrationNumber,
  ].forEach((item) => appendSearchValue(parts, item));

  const haystack = normalizeSupplierAdminQuery(parts.join(" "));
  return query.split(" ").every((term) => haystack.includes(term));
}

export function filterSuppliersForAdmin(suppliers: Supplier[], value: unknown) {
  return suppliers.filter((supplier) => supplierMatchesAdminQuery(supplier, value));
}

