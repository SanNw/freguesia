export type AffiliateLinkResult =
  | { status: "generated"; url: string }
  | { status: "manual_required"; reason: string }
  | { status: "session_expired" }
  | { status: "captcha_required" }
  | { status: "unsupported"; reason: string };

export interface AffiliateLinkContext {
  source: string;
  canonicalUrl: string;
}

export function validateAffiliateUrl(
  url: string,
  allowedDomains: string[],
  requireHttps: boolean,
): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    if (requireHttps && parsed.protocol !== "https:") {
      return { valid: false, reason: "NOT_HTTPS" };
    }
    const hostname = parsed.hostname;
    const isAllowed = allowedDomains.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
    if (!isAllowed) {
      return { valid: false, reason: "DOMAIN_NOT_ALLOWED" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "INVALID_URL" };
  }
}
