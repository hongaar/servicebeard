import type { IssueProvider } from "@servicebeard/providers";
import { describe, expect, test } from "bun:test";
import { maybeReopenIssueOnReply } from "./issue-reopen";

function mockProvider(overrides: Partial<IssueProvider> = {}): IssueProvider {
  return {
    name: "gitlab",
    getIssueState: async () => ({ closed: true, statusId: "closed" }),
    getDefaultOpenStatus: async () => "opened",
    updateIssueStatus: async () => {},
    ...overrides,
  } as IssueProvider;
}

const baseProject = {
  projectId: "project-1",
  providerName: "gitlab",
  rules: [
    {
      id: "rule-1",
      actionStatus: "gid://gitlab/Status/1",
      actionReopenOnReply: true,
    },
  ],
};

const baseThread = {
  id: "thread-1",
  issueIid: 7,
  matchedRuleId: "rule-1",
  issueMissingAt: null,
};

const baseEmail = {
  senderEmail: "customer@example.com",
  senderName: "Customer",
};

describe("maybeReopenIssueOnReply", () => {
  test("skips when matched rule has reopen disabled", async () => {
    let updated = false;
    const provider = mockProvider({
      updateIssueStatus: async () => {
        updated = true;
      },
    });

    const reopened = await maybeReopenIssueOnReply(
      provider,
      {
        ...baseProject,
        rules: [
          {
            id: "rule-1",
            actionStatus: null,
            actionReopenOnReply: false,
          },
        ],
      },
      baseThread,
      baseEmail,
    );

    expect(reopened).toBe(false);
    expect(updated).toBe(false);
  });

  test("skips when issue is not closed", async () => {
    let updated = false;
    const provider = mockProvider({
      getIssueState: async () => ({ closed: false, statusId: "opened" }),
      updateIssueStatus: async () => {
        updated = true;
      },
    });

    const reopened = await maybeReopenIssueOnReply(
      provider,
      baseProject,
      baseThread,
      baseEmail,
    );

    expect(reopened).toBe(false);
    expect(updated).toBe(false);
  });

  test("reopens with rule default status", async () => {
    let targetStatus: string | undefined;
    const provider = mockProvider({
      updateIssueStatus: async (_issueIid, status) => {
        targetStatus = status;
      },
    });

    const reopened = await maybeReopenIssueOnReply(
      provider,
      baseProject,
      baseThread,
      baseEmail,
    );

    expect(reopened).toBe(true);
    expect(targetStatus).toBe("gid://gitlab/Status/1");
  });

  test("uses provider default open status when rule has no status", async () => {
    let targetStatus: string | undefined;
    const provider = mockProvider({
      updateIssueStatus: async (_issueIid, status) => {
        targetStatus = status;
      },
    });

    const reopened = await maybeReopenIssueOnReply(
      provider,
      {
        ...baseProject,
        rules: [
          { id: "rule-1", actionStatus: null, actionReopenOnReply: true },
        ],
      },
      baseThread,
      baseEmail,
    );

    expect(reopened).toBe(true);
    expect(targetStatus).toBe("opened");
  });
});
