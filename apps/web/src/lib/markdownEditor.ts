export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const nextValue =
    value.slice(0, start) + before + selected + after + value.slice(end);
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + selected.length;
  return { value: nextValue, selectionStart, selectionEnd };
}

export function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const block = selected || "";
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, index) => {
      if (!line.trim()) return line;
      if (prefix === "1. ")
        return `${index + 1}. ${line.replace(/^\d+\.\s+/, "")}`;
      return `${prefix}${line}`;
    })
    .join("\n");
  const nextValue = value.slice(0, start) + prefixed + value.slice(end);
  return {
    value: nextValue,
    selectionStart: start,
    selectionEnd: start + prefixed.length,
  };
}

export function insertLink(
  value: string,
  start: number,
  end: number,
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const label = selected || "link text";
  const markdown = `[${label}](https://)`;
  const nextValue = value.slice(0, start) + markdown + value.slice(end);
  const urlStart = start + label.length + 3;
  const urlEnd = urlStart + 8;
  return { value: nextValue, selectionStart: urlStart, selectionEnd: urlEnd };
}
