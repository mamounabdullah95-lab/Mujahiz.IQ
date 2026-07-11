interface ImportMetaEnv {
  readonly VITE_FORCE_DEMO?: string;
  readonly VITE_FILE_UPLOADS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
