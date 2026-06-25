import type { ProviderOptions, Rule } from "./api";

export function resolveStatusName(
  statusId: string,
  options?: ProviderOptions,
): string {
  const match = options?.statuses.find((status) => status.id === statusId);
  if (match) return match.name;
  if (statusId === "open") return "Open";
  if (statusId === "closed") return "Closed";
  return statusId;
}

export function resolveAssigneeName(
  assigneeId: string,
  options?: ProviderOptions,
): string {
  const member = options?.members.find((m) => m.id === assigneeId);
  if (!member) return `User #${assigneeId}`;
  if (member.name && member.name !== member.username) {
    return `${member.name} (@${member.username})`;
  }
  return `@${member.username}`;
}

export function formatRuleMatch(rule: Rule): string {
  const parts: string[] = [];
  if (rule.matchSender) parts.push(`sender: ${rule.matchSender}`);
  if (rule.matchSubject) parts.push(`subject: ${rule.matchSubject}`);
  if (rule.matchBody) parts.push(`body: ${rule.matchBody}`);
  return parts.length ? parts.join(" · ") : "All emails";
}

export function ruleHasActions(rule: Rule): boolean {
  return Boolean(
    rule.actionStatus || rule.actionLabels.length > 0 || rule.actionAssigneeId,
  );
}
