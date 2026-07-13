export const features = Object.freeze({
  fileUploads: import.meta.env.VITE_FILE_UPLOADS_ENABLED === "true",
  supplierExcelImport: import.meta.env.VITE_SUPPLIER_EXCEL_IMPORT_ENABLED === "true",
});

export type PlatformFeature = keyof typeof features;

export function isFeatureEnabled(feature: PlatformFeature) {
  return features[feature];
}
