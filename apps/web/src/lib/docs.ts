/** Public documentation routes (SPA only — not exported as static HTML). */
export const DOC_PATHS = {
  index: "/docs",
  mailbox: "/docs/mailbox",
  issueProviders: "/docs/issue-providers",
  github: "/docs/issue-providers/github",
  gitlab: "/docs/issue-providers/gitlab",
  linear: "/docs/issue-providers/linear",
  selfHost: "/docs/self-host",
} as const;
