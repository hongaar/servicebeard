import type { IssueProvider } from "@servicebeard/providers";
import { describe, expect, test } from "bun:test";
import { reopenIssueOnReply, resolveClosedIssueReply } from "./issue-reopen";

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

describe("resolveClosedIssueReply", () => {
  test("returns create-new-issue when reopen is disabled on a closed issue", async () => {
    const action = await resolveClosedIssueReply(
      mockProvider(),
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
    );

    expect(action).toBe("create-new-issue");
  });

  test("returns comment when issue is open", async () => {
    const action = await resolveClosedIssueReply(
      mockProvider({
        getIssueState: async () => ({ closed: false, statusId: "opened" }),
      }),
      baseProject,
      baseThread,
    );

    expect(action).toBe("comment");
  });

  test("returns reopen when issue is closed and reopen is enabled", async () => {
    const action = await resolveClosedIssueReply(
      mockProvider(),
      baseProject,
      baseThread,
    );

    expect(action).toBe("reopen");
  });
});

describe("reopenIssueOnReply", () => {
  test("reopens with rule default status", async () => {
    let targetStatus: string | undefined;
    const provider = mockProvider({
      updateIssueStatus: async (_issueIid, status) => {
        targetStatus = status;
      },
    });

    const reopened = await reopenIssueOnReply(
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

    const reopened = await reopenIssueOnReply(
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
