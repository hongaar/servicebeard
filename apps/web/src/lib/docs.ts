/** Public documentation routes (SPA only — not exported as static HTML). */
export const DOC_PATHS = {
  index: "/docs",
  mailbox: "/docs/mailbox",
  issueProviders: "/docs/issue-providers",
  github: "/docs/issue-providers/github",
  gitlab: "/docs/issue-providers/gitlab",
} as const;
