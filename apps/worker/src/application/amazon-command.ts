function parsePrice(value: string): number {
  const normalized = value
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function field(fields: Map<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    const value = fields.get(name);
    if (value) return value;
  }
  return null;
}

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function parseAmazonCommand(text: string) {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/).slice(1)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    fields.set(
      normalizeLabel(line.slice(0, separator)),
      line.slice(separator + 1).trim(),
    );
  }

  const title = field(fields, "titulo");
  const affiliateUrl = field(fields, "link afiliado", "link");
  const imageUrl = field(fields, "imagem", "imagem principal");
  const currentPriceCents = parsePrice(
    field(fields, "preco atual", "preco") ?? "",
  );
  const previousPriceRaw = field(fields, "preco anterior", "de");
  const previousPriceCents = previousPriceRaw
    ? parsePrice(previousPriceRaw)
    : null;

  if (!title || !affiliateUrl || !imageUrl || currentPriceCents <= 0) {
    throw new Error("Preencha Titulo, Preco atual, Link afiliado e Imagem.");
  }

  const extraImages = field(fields, "imagens extras", "outras imagens");
  return {
    title,
    canonicalUrl: affiliateUrl,
    currentPriceCents,
    previousPriceCents,
    imageUrl,
    additionalImages: extraImages
      ? extraImages.split(/[;,\s]+/).filter((url) => /^https?:\/\//i.test(url))
      : [],
    couponCode: field(fields, "cupom", "codigo do cupom"),
    couponDescription: field(fields, "descricao do cupom", "descricao cupom"),
    affiliateUrl,
    store: "Amazon",
    category: field(fields, "categoria"),
    availability: "in_stock" as const,
  };
}
