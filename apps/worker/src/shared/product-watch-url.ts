import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import {
  parseProductIdentity,
  productHosts,
  safeProductUrl,
  type ProductIdentity,
} from "../domain/product-watch.js";

const shortHosts = new Set([
  "s.shopee.com.br",
  "shope.ee",
  "amzn.to",
  "a.co",
  "mercadolivre.com",
  "meli.la",
  "s.click.aliexpress.com",
  "a.aliexpress.com",
]);
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Restrict IPv6 to global unicast; exclude transition/documentation ranges.
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  const first = parseInt(normalized.split(":")[0], 16);
  return (
    first >= 0x2000 &&
    first <= 0x3fff &&
    !normalized.startsWith("2001:") &&
    !normalized.startsWith("2002:")
  );
}

interface Address {
  address: string;
  family: number;
}
interface RedirectResponse {
  statusCode: number;
  location?: string;
}
export interface ProductUrlTransport {
  lookup(hostname: string): Promise<Address[]>;
  request(url: URL, address: Address): Promise<RedirectResponse>;
}
const transport: ProductUrlTransport = {
  lookup: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  request: (url, address) =>
    new Promise((resolve, reject) => {
      // The TLS hostname stays unchanged; the socket uses exactly the checked IP.
      const req = request(
        url,
        {
          method: "HEAD",
          agent: false,
          family: address.family,
          lookup: (_host, _options, callback) =>
            callback(null, address.address, address.family),
          headers: { "User-Agent": "Freguesia/1.0" },
        },
        (response) => {
          resolve({
            statusCode: response.statusCode ?? 0,
            location: response.headers.location,
          });
          response.destroy();
        },
      );
      const timeout = setTimeout(
        () => req.destroy(new Error("Tempo limite ao resolver o link.")),
        5000,
      );
      req.once("close", () => clearTimeout(timeout));
      req.once("error", reject);
      req.end();
    }),
};

export async function resolveProductUrl(
  raw: string,
  io: ProductUrlTransport = transport,
): Promise<ProductIdentity> {
  let url = safeProductUrl(raw);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (
      !url ||
      (!productHosts.has(url.hostname) && !shortHosts.has(url.hostname))
    )
      throw new Error(
        "Link HTTPS de loja não suportada ou destino não permitido.",
      );
    const identity = parseProductIdentity(url.toString());
    if (identity) return identity;
    // Product-site login/cart/search pages cannot be used as a redirect oracle.
    if (!shortHosts.has(url.hostname))
      throw new Error("O link não identifica um produto suportado.");
    const addresses = await io.lookup(url.hostname);
    if (
      !addresses.length ||
      addresses.some((address) => !isPublicAddress(address.address))
    )
      throw new Error(
        "O link não resolve exclusivamente para endereços públicos.",
      );
    const response = await io.request(url, addresses[0]);
    if (
      ![301, 302, 303, 307, 308].includes(response.statusCode) ||
      !response.location
    )
      throw new Error(
        "O link curto está indisponível ou não identifica um produto.",
      );
    try {
      url = safeProductUrl(new URL(response.location, url).toString());
    } catch {
      url = null;
    }
  }
  throw new Error("Limite de redirecionamentos excedido.");
}
