import type { CreateRuleInput } from "./schemas";

/** Matches any inbound mail; use a high priority so specific rules run first. */
export const DEFAULT_CATCH_ALL_RULE: CreateRuleInput = {
  name: "Catch-all",
  priority: 1000,
  isEnabled: true,
  matchSender: null,
  matchSubject: null,
  matchBody: null,
  actionCreateIssue: true,
  actionReopenOnReply: true,
  actionStatus: null,
  actionLabels: [],
  actionAssigneeId: null,
};
