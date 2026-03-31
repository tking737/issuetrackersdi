export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function daysSince(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}

export function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
