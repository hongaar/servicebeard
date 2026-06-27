/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUGSINK_DSN?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
