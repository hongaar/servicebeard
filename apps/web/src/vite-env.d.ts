/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUGSINK_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
