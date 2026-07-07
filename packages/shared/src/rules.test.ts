import { describe, expect, test } from "bun:test";
import { DEFAULT_CATCH_ALL_RULE } from "./default-rule";
import { evaluateRules } from "./rules";
import type { Rule } from "./types";
import { baseRule, testEmail, testEmailDate } from "./testing/email-fixtures";

describe("rules engine", () => {
  test("matches sender pattern", () => {
    const result = evaluateRules(
      [baseRule],
      testEmail({
        messageId: "m1",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "support@example.com",
        fromName: "Support",
        subject: "Help needed",
        body: "Please help",
        date: testEmailDate,
      }),
    );
    expect(result.matched).toBe(true);
    expect(result.rule?.name).toBe("Support");
  });

  test("does not match wrong sender", () => {
    const result = evaluateRules(
      [baseRule],
      testEmail({
        messageId: "m2",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "other@example.com",
        fromName: null,
        subject: "Help",
        body: "body",
        date: testEmailDate,
      }),
    );
    expect(result.matched).toBe(false);
  });

  test("subject regex match", () => {
    const rule = {
      ...baseRule,
      matchSender: null,
      matchSubject: "urgent",
      matchBody: null,
    };
    const result = evaluateRules(
      [rule],
      testEmail({
        messageId: "m3",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "a@b.com",
        fromName: null,
        subject: "URGENT: server down",
        body: "help",
        date: testEmailDate,
      }),
    );
    expect(result.matched).toBe(true);
  });

  test("first matching rule wins by priority", () => {
    const low = { ...baseRule, name: "Low", priority: 10, matchSender: null };
    const high = {
      ...baseRule,
      id: "2",
      name: "High",
      priority: 0,
      matchSender: null,
    };
    const result = evaluateRules(
      [low, high],
      testEmail({
        messageId: "m4",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "a@b.com",
        fromName: null,
        subject: "test",
        body: "test",
        date: testEmailDate,
      }),
    );
    expect(result.rule?.name).toBe("High");
  });

  test("default catch-all rule matches any email and runs after specific rules", () => {
    const catchAll: Rule = {
      ...baseRule,
      ...DEFAULT_CATCH_ALL_RULE,
      id: "catch-all",
    };
    const specific = {
      ...baseRule,
      id: "2",
      name: "VIP",
      priority: 0,
      matchSender: "vip@example.com",
    };
    const email = testEmail({
      messageId: "m-catch",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "anyone@example.com",
      fromName: null,
      subject: "Hello",
      body: "Anything",
      date: testEmailDate,
    });

    expect(evaluateRules([catchAll], email).rule?.name).toBe("Catch-all");
    expect(evaluateRules([specific, catchAll], email).rule?.name).toBe(
      "Catch-all",
    );
    expect(
      evaluateRules([specific, catchAll], {
        ...email,
        fromEmail: "vip@example.com",
        senderEmail: "vip@example.com",
      }).rule?.name,
    ).toBe("VIP");
  });

  test("matches Reply-To sender for relayed mail", () => {
    const result = evaluateRules(
      [baseRule],
      testEmail({
        messageId: "m-relay",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "noreply@servicebeard.app",
        fromName: "ServiceBeard",
        replyToEmail: "support@example.com",
        replyToName: "Support",
        subject: "Contact",
        body: "Help",
        date: testEmailDate,
      }),
    );
    expect(result.matched).toBe(true);
  });

  test("skips disabled rules", () => {
    const disabled = { ...baseRule, isEnabled: false, matchSender: null };
    const result = evaluateRules(
      [disabled],
      testEmail({
        messageId: "m5",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "a@b.com",
        fromName: null,
        subject: "test",
        body: "test",
        date: testEmailDate,
      }),
    );
    expect(result.matched).toBe(false);
  });
});
