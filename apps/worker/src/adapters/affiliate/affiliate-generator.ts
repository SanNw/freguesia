export interface AffiliateGenerator {
  readonly provider: string;
  generate(canonicalUrl: URL): Promise<string | null>;
}
