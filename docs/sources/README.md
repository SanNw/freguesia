# Source Registry

This directory documents each source configured in the system, including terms review status and limitations.

## Current Sources

| Source | Slug | Type | Status | Terms Reviewed |
| --- | --- | --- | --- | --- |
| Manual Entry | `manual` | manual | Enabled (MVP) | N/A |
| Feed Example | `feed-example` | feed | Disabled | N/A |
| Amazon | `amazon` | api | Disabled | Pending |
| Mercado Livre | `mercadolivre-experimental` | page | Disabled (experimental) | Pending |

## Adding a New Source

1. Create adapter implementing `SourceAdapter` interface
2. Register source in `sources` table via seed
3. Document terms review date and link in this file
4. Set `enabled = FALSE` initially
5. Test with private channel only
6. Get explicit terms approval before enabling
