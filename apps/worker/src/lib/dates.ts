export function coerceDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
