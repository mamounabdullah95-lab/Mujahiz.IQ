import { isStrictlyEnabled } from "./runtimePolicy";

export const features = Object.freeze({
  fileUploads: isStrictlyEnabled(import.meta.env.VITE_FILE_UPLOADS_ENABLED),
  supplierExcelImport: isStrictlyEnabled(import.meta.env.VITE_SUPPLIER_EXCEL_IMPORT_ENABLED),
  supplierProfileClaim: isStrictlyEnabled(import.meta.env.VITE_SUPPLIER_PROFILE_CLAIM_ENABLED),
});

export type PlatformFeature = keyof typeof features;

export function isFeatureEnabled(feature: PlatformFeature) {
  return features[feature];
}
