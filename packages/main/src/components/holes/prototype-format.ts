const fieldDateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fieldTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatFieldDateTime(timestamp: string): string {
  return fieldDateTimeFormatter.format(new Date(timestamp));
}

export function formatFieldTime(timestamp: string): string {
  return fieldTimeFormatter.format(new Date(timestamp));
}

export function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
