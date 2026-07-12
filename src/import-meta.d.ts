interface ImportMetaEnv {
  readonly VITE_FORCE_DEMO?: string;
  readonly VITE_FILE_UPLOADS_ENABLED?: string;
  readonly VITE_SUPPLIER_EXCEL_IMPORT_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
