export function parseAllowedEmailDomains(source?: string) {
  return (source || process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || process.env.ALLOWED_EMAIL_DOMAINS || "shaftdrillers.com")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string, source?: string) {
  const normalized = email.trim().toLowerCase();
  return parseAllowedEmailDomains(source).some((domain) => normalized.endsWith(`@${domain}`));
}

export function allowedDomainsLabel() {
  return parseAllowedEmailDomains().map((domain) => `@${domain}`).join(", ");
}
