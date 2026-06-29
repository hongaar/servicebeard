import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = join(import.meta.dir, "../../reports/security");
const JUNIT_PATH = join(REPORT_DIR, "junit.xml");

interface TestCase {
  suite: string;
  name: string;
  classname: string;
  time: number;
  status: "passed" | "failed" | "skipped";
  failureMessage?: string;
}

function parseJUnit(xml: string): { cases: TestCase[]; totals: Record<string, number> } {
  const cases: TestCase[] = [];

  const testcaseRegex =
    /<testcase\b([^>]*?)\/>|<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;

  let match: RegExpExecArray | null;
  while ((match = testcaseRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? match[2] ?? "";
    const inner = match[3] ?? "";
    const name = attrs.match(/name="([^"]*)"/)?.[1]?.replace(/&apos;/g, "'") ?? "";
    const classname = attrs.match(/classname="([^"]*)"/)?.[1]?.replace(/&apos;/g, "'") ?? "";
    const time = Number(attrs.match(/time="([^"]*)"/)?.[1] ?? 0);

    let status: TestCase["status"] = "passed";
    let failureMessage: string | undefined;
    if (inner.includes("<failure")) {
      status = "failed";
      failureMessage = inner
        .replace(/<\/?failure[^>]*>/g, "")
        .replace(/<\/?error[^>]*>/g, "")
        .trim();
    } else if (inner.includes("<skipped")) {
      status = "skipped";
    }

    cases.push({
      suite: classname || "Security tests",
      name,
      classname,
      time,
      status,
      failureMessage,
    });
  }

  const totals = {
    total: cases.length,
    passed: cases.filter((c) => c.status === "passed").length,
    failed: cases.filter((c) => c.status === "failed").length,
    skipped: cases.filter((c) => c.status === "skipped").length,
  };

  return { cases, totals };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMarkdown(cases: TestCase[], totals: Record<string, number>): string {
  const lines = [
    "# Security / Pentest Test Report",
    "",
    "Automated API resource isolation and access-control tests against the running ServiceBeard stack.",
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Total | ${totals.total} |`,
    `| Passed | ${totals.passed} |`,
    `| Failed | ${totals.failed} |`,
    `| Skipped | ${totals.skipped} |`,
    "",
    "## Tests",
    "",
    "| Suite | Test description | Result | Duration (s) |",
    "| --- | --- | --- | ---: |",
  ];

  for (const testCase of cases) {
    lines.push(
      `| ${testCase.suite} | ${testCase.name.replace(/\|/g, "\\|")} | ${testCase.status.toUpperCase()} | ${testCase.time.toFixed(3)} |`,
    );
    if (testCase.failureMessage) {
      lines.push(`| | Failure: ${testCase.failureMessage.replace(/\|/g, "\\|")} | | |`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildHtml(cases: TestCase[], totals: Record<string, number>): string {
  const rows = cases
    .map((testCase) => {
      const resultClass =
        testCase.status === "passed"
          ? "pass"
          : testCase.status === "failed"
            ? "fail"
            : "skip";
      const failure = testCase.failureMessage
        ? `<pre class="failure">${escapeHtml(testCase.failureMessage)}</pre>`
        : "";
      return `<tr class="${resultClass}">
        <td>${escapeHtml(testCase.suite)}</td>
        <td>${escapeHtml(testCase.name)}${failure}</td>
        <td>${testCase.status.toUpperCase()}</td>
        <td>${testCase.time.toFixed(3)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Security Test Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { margin-bottom: 0.25rem; }
    .summary { margin: 1rem 0 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    tr.pass td:nth-child(3) { color: #0a7; font-weight: 600; }
    tr.fail td:nth-child(3) { color: #c00; font-weight: 600; }
    tr.skip td:nth-child(3) { color: #888; font-weight: 600; }
    pre.failure { margin: 0.5rem 0 0; white-space: pre-wrap; font-size: 0.85rem; color: #900; }
  </style>
</head>
<body>
  <h1>Security / Pentest Test Report</h1>
  <p>Automated API resource isolation and access-control tests against the running ServiceBeard stack.</p>
  <div class="summary">
    <strong>Summary:</strong>
    ${totals.total} total,
    ${totals.passed} passed,
    ${totals.failed} failed,
    ${totals.skipped} skipped
  </div>
  <table>
    <thead>
      <tr>
        <th>Suite</th>
        <th>Test description</th>
        <th>Result</th>
        <th>Duration (s)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

function main(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const xml = readFileSync(JUNIT_PATH, "utf8");
  const { cases, totals } = parseJUnit(xml);

  writeFileSync(join(REPORT_DIR, "security-report.md"), buildMarkdown(cases, totals), "utf8");
  writeFileSync(join(REPORT_DIR, "security-report.html"), buildHtml(cases, totals), "utf8");

  console.log(`Wrote security reports to ${REPORT_DIR}`);
  console.log(
    `Summary: ${totals.passed}/${totals.total} passed, ${totals.failed} failed, ${totals.skipped} skipped`,
  );

  if (totals.failed > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
