export const CAPTCHA_SIGNALS = [
  "recaptcha",
  "hcaptcha",
  "g-recaptcha",
  "h-captcha",
  "verify you are human",
  "verifique que voce e humano",
  "verifique que você é humano",
  "cf-challenge",
  "cloudflare",
  "access denied",
  "acesso negado",
  "rate limit",
  "limite de taxa",
];

export function detectCaptcha(content: string): boolean {
  const lower = content.toLowerCase();
  return CAPTCHA_SIGNALS.some((s) => lower.includes(s));
}

export function detectBlocked(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("access denied") ||
    lower.includes("acesso negado") ||
    lower.includes("403 forbidden") ||
    lower.includes("captcha")
  );
}
