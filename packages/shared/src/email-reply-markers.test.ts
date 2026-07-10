import { describe, expect, test } from "bun:test";
import {
  containsQuoteAttribution,
  findQuoteReplyCutIndex,
} from "./email-reply-markers";
import { stripQuotedReply } from "./mail";

describe("locale quote markers", () => {
  const cases = [
    {
      locale: "English",
      body: "Thanks!\n\nOn Fri, Jul 10, 2026 at 2:16 PM, support@mail.test wrote:\n> old",
      expected: "Thanks!",
    },
    {
      locale: "Dutch",
      body: "Antwoord\n\nsupport@mail.test schreef op 2026-07-10 14:19:\n> quoted",
      expected: "Antwoord",
    },
    {
      locale: "French",
      body: "Merci\n\nLe ven. 10 juil. 2026 à 14:19, support@mail.test a écrit :\n> ancien",
      expected: "Merci",
    },
    {
      locale: "German",
      body: "Danke\n\nAm 10.07.2026 um 14:19 schrieb support@mail.test <support@mail.test>:\n> alt",
      expected: "Danke",
    },
    {
      locale: "Spanish",
      body: "Gracias\n\nEl vie, 10 jul 2026 a las 14:19, support@mail.test escribió:\n> viejo",
      expected: "Gracias",
    },
    {
      locale: "Italian",
      body: "Grazie\n\nIl giorno ven 10 lug 2026 alle 14:19 support@mail.test ha scritto:\n> vecchio",
      expected: "Grazie",
    },
    {
      locale: "Portuguese",
      body: "Obrigado\n\nEm sex., 10 de jul. de 2026 às 14:19, support@mail.test escreveu:\n> antigo",
      expected: "Obrigado",
    },
    {
      locale: "Finnish",
      body: "Kiitos\n\npe 10.7.2026 klo 14.19 support@mail.test kirjoitti:\n> vanha",
      expected: "Kiitos",
    },
    {
      locale: "Danish",
      body: "Tak\n\nDen 10. jul. 2026 kl. 14.19 skrev support@mail.test:\n> gammel",
      expected: "Tak",
    },
  ] as const;

  for (const { locale, body, expected } of cases) {
    test(`strips ${locale} quote attribution`, () => {
      expect(stripQuotedReply(body)).toBe(expected);
      expect(containsQuoteAttribution(body)).toBe(true);
      expect(findQuoteReplyCutIndex(body)).toBeLessThan(body.length);
    });
  }

  test("keeps body without quote markers", () => {
    expect(stripQuotedReply("Just a new message")).toBe("Just a new message");
    expect(containsQuoteAttribution("Just a new message")).toBe(false);
  });
});
