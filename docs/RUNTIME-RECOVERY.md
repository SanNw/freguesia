# Runtime recovery and checkout moves

The Compose project is explicitly named `freguesia`, so changing the checkout
directory does not create a second set of databases or browser-session volumes.
An explicit `docker compose -p ...` still overrides that name.

The private `.env` can select a runtime directory independently of the checkout:

```dotenv
FREGUESIA_RUNTIME_ROOT=/srv/freguesia-runtime
FREGUESIA_WORKER_BUILD_CONTEXT=./apps/worker
FREGUESIA_WORKER_IMAGE=freguesia-worker
```

The runtime directory must contain `database/schema.sql`,
`database/init-n8n-db.sh`, `infra/Caddyfile.dev`, `n8n/workflows/` and `data/awin/`.
Defaults remain relative to the checkout for new installations. Keep the existing
runtime directory when moving a checkout; do not initialize replacement volumes.

Restore `.env` from a protected backup or the configuration of the running
containers. Preserve the PostgreSQL credentials, `N8N_ENCRYPTION_KEY`, service
tokens and approval/revalidation settings. Do not commit `.env` or Docker
snapshots that inherit production credentials.

Set `AWIN_FEED_PATH` to the comma-separated container paths of CSVs that actually
exist in `data/awin/`. The directory is ignored by Git. ZIP backups must be
extracted before use; missing feeds must not remain in the configured list.
Check feed timestamps before using their prices for current offers.

Before replacing services, back up both databases and compare the resolved
Compose mount sources with the running containers. Recovery containers that
retain the same Compose service labels are treated as service replicas by
`docker compose up`; retain their images and protected configuration separately.

```bash
docker compose config --quiet
docker compose -f compose.yaml -f infra/compose.affiliate-queue.yaml config --quiet
docker compose up -d --no-deps --no-build --wait worker n8n
docker compose ps
docker compose exec worker node --input-type=module -e \
  'import {loadAwinFeed} from "./dist/adapters/sources/awin-feed.js"; console.log((await loadAwinFeed()).length)'
```

The last check reads the configured feeds without creating offers, contacting
customers or publishing messages. Successful parsing does not establish that
historical feed prices are current.
