const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
];

export function normalizeUrl(raw: string): string | null {
  try {
    const trimmed = raw.trim();
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isAllowedDomain(
  url: string,
  allowedDomains: string[],
): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return allowedDomains.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
  } catch {
    return false;
  }
}

export function isPrivateOrLoopback(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
}

export function validateExternalUrl(
  url: string,
  allowedDomains: string[],
  requireHttps: boolean = true,
): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    if (requireHttps && parsed.protocol !== "https:") {
      return { valid: false, reason: "NOT_HTTPS" };
    }
    if (isPrivateOrLoopback(parsed.hostname)) {
      return { valid: false, reason: "PRIVATE_IP" };
    }
    if (!isAllowedDomain(url, allowedDomains)) {
      return { valid: false, reason: "DOMAIN_NOT_ALLOWED" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "INVALID_URL" };
  }
}
