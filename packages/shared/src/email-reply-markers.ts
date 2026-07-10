/**
 * Quote attribution patterns for inbound reply stripping.
 *
 * Adapted from crisp-oss/email-reply-parser (lib/regex.ts), which extended
 * Zendesk's original email_reply_parser with multilingual client headers.
 */

const LINE_START = "(?:^|\\n)";

/** Plain-text markers where quoted history begins. Earliest match wins. */
export const QUOTE_REPLY_MARKER_PATTERNS: RegExp[] = [
  // English
  new RegExp(`${LINE_START}-*\\s*On\\s.+\\s.+\\n?wrote:?\\s*-*$`, "im"),
  new RegExp(`${LINE_START}.+@.+\\s+wrote:\\s*(?:\\n|$)`, "i"),
  new RegExp(`${LINE_START}.+\\son.*at.*wrote:`, "i"),

  // Dutch
  new RegExp(`${LINE_START}[^\\n]+ schreef op [^\\n]+:\\s*(?:\\n|$)`, "i"),
  new RegExp(`${LINE_START}\\s*Op\\s[\\s\\S]+?\\n?\\n?schreef[\\s\\S]+:`, "im"),
  new RegExp(`${LINE_START}\\s*Van\\s?:.+\\s?\\n?\\s*(\\[|<).+(\\]|>)`, "im"),

  // French
  new RegExp(`${LINE_START}-*\\s*Le\\s.+\\s.+\\n?écrit\\s?:?\\s*-*$`, "im"),
  new RegExp(`${LINE_START}\\s*De\\s?:.+\\s?\\n?\\s*(\\[|<).+(\\]|>)`, "im"),
  new RegExp(`${LINE_START}-{1,12}\\s*Message d'origine\\s*-{1,12}\\s*$`, "im"),

  // German
  new RegExp(`${LINE_START}.+\\s<.+>\\sschrieb:`, "im"),
  new RegExp(
    `${LINE_START}\\s*Am\\s.+\\n?\\n?schrieb.+\\s?(\\[|<).+(\\]|>):`,
    "im",
  ),
  new RegExp(`${LINE_START}\\s*Am\\s.+um\\s.+\\n?schrieb\\s.+:`, "im"),
  new RegExp(`${LINE_START}\\s*Von\\s?:.+\\s?\\n?\\s*(\\[|<).+(\\]|>)`, "im"),
  new RegExp(
    `${LINE_START}-{1,12}\\s*Ursprüngliche Nachricht\\s*-{0,12}\\s*$`,
    "im",
  ),

  // Spanish
  new RegExp(`${LINE_START}-*\\s*El\\s.+\\s.+\\n?escribió:?\\s*-*$`, "im"),
  new RegExp(`${LINE_START}\\s*De\\s?:.+\\s?\\n?\\s*(\\[|<).+(\\]|>)`, "im"),

  // Italian
  new RegExp(`${LINE_START}-*\\s*Il\\s.+\\s.+\\n?scritto:?\\s*-*$`, "im"),

  // Portuguese
  new RegExp(`${LINE_START}-*\\s*Em\\s.+\\s.+\\n?escreveu:?\\s*-*$`, "im"),

  // Polish
  new RegExp(
    `${LINE_START}\\s*((W\\sdniu|Dnia)\\s[\\s\\S]+?(pisze|napisał(\\(a\\))?):)`,
    "imu",
  ),

  // Danish / Norwegian
  new RegExp(`${LINE_START}\\s*(Den\\s.+\\s\\n?skrev\\s.+:)`, "im"),
  new RegExp(`${LINE_START}-{1,12}\\s*Oprindelig besked\\s*-{1,12}\\s*$`, "im"),
  new RegExp(
    `${LINE_START}[a-z]{3,4}\\.\\s[\\s\\S]+\\sskrev\\s[\\s\\S]+:`,
    "im",
  ),

  // Finnish
  new RegExp(`${LINE_START}\\s*(pe\\s.+\\s.+\\n?kirjoitti:)`, "im"),

  // Russian
  new RegExp(
    `${LINE_START}\\s*(ср,\\s.+\\n? г\\. в\\s.+,.+(\\[|<).+(\\]|>):)`,
    "im",
  ),

  // Chinese
  new RegExp(`${LINE_START}(在[\\s\\S]+写道：)`, "m"),

  // Korean
  new RegExp(`${LINE_START}(20[0-9]{2}\\..+\\s작성:)`, "m"),

  // Japanese
  new RegExp(`${LINE_START}(20[0-9]{2}\\/.+のメッセージ:)`, "m"),

  // Outlook / Exchange (multilingual)
  new RegExp(`${LINE_START}\\s*From\\s?:.+\\s?\\n?\\s*(\\[|<).+(\\]|>)`, "im"),

  // Locale-specific date + name headers
  new RegExp(
    `${LINE_START}(20[0-9]{2})-([0-9]{2}).([0-9]{2}).([0-9]{2}):([0-9]{2})\\n?(.*)>:`,
    "m",
  ),
  new RegExp(
    `${LINE_START}([0-9]{2}).([0-9]{2}).(20[0-9]{2})(.*)(([0-9]{2}).([0-9]{2}))(.*)"( *)<(.*)>( *):`,
    "m",
  ),
  new RegExp(
    `${LINE_START}[0-9]{2}:[0-9]{2}(.*)[0-9]{4}(.*)"( *)<(.*)>( *):`,
    "m",
  ),

  // English / Outlook
  new RegExp(`${LINE_START}-{1,12}\\s*Original Message\\s*-{1,12}\\s*$`, "im"),
  new RegExp(`${LINE_START}From:\\s.+\\nSent:\\s`, "i"),
  new RegExp(`${LINE_START}From:\\s.+\\nDate:\\s`, "i"),
  new RegExp(`${LINE_START}_{3,}\\s*\\n`),
];

/** Substring patterns for stripping quote attributions from HTML. */
export const QUOTE_ATTRIBUTION_TEXT_PATTERNS: RegExp[] = [
  /\bOn [^<]+ wrote:/i,
  /[^<\n]+ schreef op [^<\n]+:/i,
  /\bLe [^<]+ écrit\s*:/i,
  /\bEl [^<]+ escribió\s*:/i,
  /\bIl [^<]+ scritto\s*:/i,
  /\bEm [^<]+ escreveu\s*:/i,
  /schrieb[^<\n]*:/i,
  /\bDen [^<]+ skrev[^<\n]*:/i,
  /kirjoitti:/i,
  /写道：/,
  /のメッセージ:/,
  /\s작성:/,
  /Message d'origine/i,
  /Ursprüngliche Nachricht/i,
  /Oprindelig besked/i,
];

export function findQuoteReplyCutIndex(body: string): number {
  let cutAt = body.length;

  for (const pattern of QUOTE_REPLY_MARKER_PATTERNS) {
    const match = pattern.exec(body);
    if (match && match.index < cutAt) {
      cutAt = match.index;
    }
  }

  return cutAt;
}

export function containsQuoteAttribution(body: string): boolean {
  const normalized = body.replace(/\r\n/g, "\n");
  return findQuoteReplyCutIndex(normalized) < normalized.length;
}
