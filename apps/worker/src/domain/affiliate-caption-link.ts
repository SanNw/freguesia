export function buildAffiliateCaptionLink(url: string): string {
  const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<a href="${safeUrl}">🛒 Comprar com desconto</a>`;
}
