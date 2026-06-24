export const GITHUB_REPO_URL = "https://github.com/hongaar/servicebeard";

export const LANDING_FEATURES = [
  {
    title: "Mailbox ↔ issue sync",
    description:
      "Connect IMAP and SMTP to GitHub or GitLab. Incoming mail becomes issues and comments; replies flow back as email.",
    icon: "sync",
  },
  {
    title: "Rules engine",
    description:
      "Match sender, subject, or body to route messages — create issues with preset status, labels and assignees.",
    icon: "rules",
  },
  {
    title: "Teams & projects",
    description:
      "Organize members, mailboxes, and issue trackers per team. Run multiple projects from one install.",
    icon: "teams",
  },
  {
    title: "Loop-safe by design",
    description:
      "Bot filtering, sync markers, and deduplication keep bidirectional sync from spiraling into reply loops.",
    icon: "shield",
  },
] as const;
