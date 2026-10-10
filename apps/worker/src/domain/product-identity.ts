export function normalizeProductTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Reject missing, placeholder and checksum-invalid identifiers before cross-store reuse. */
export function validatedGtin(value: string | null | undefined): string | null {
  if (
    !value ||
    !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) ||
    /^0+$/.test(value)
  )
    return null;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? value.padStart(14, "0") : null;
}
