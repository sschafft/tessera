# Jetty task definitions

Workflow definitions deployed to the `jettyio` Jetty collection. Each `.json` here is the source of truth for a deployed task. To change a task's behaviour, edit the file, commit it, and re-deploy.

## Tasks

| File | Task | Purpose |
|------|------|---------|
| `tessera-tl.json` | `tessera-tl` | Adversarial code review on every PR. Wired up via `.github/workflows/tessera-tl.yml`. |
| `tessera-playtest-role.json` | `tessera-playtest-role` | Single-role child workflow used by the shell-script orchestrator. Empty `init_params` (no defaults) so the rendered instruction passes through cleanly. Don't run directly. |
| `tessera-playtest-orchestrator.json` | `tessera-playtest-orchestrator` | Stub — kept around as a placeholder. Jetty's `list_emit_await` doesn't pass per-item values to children (verified 2026-04-27 across three variants), so the working orchestrator lives in `docs/playtest/run-orchestrator.sh` and shells out to `tessera-playtest-scenario` ten times in parallel. |

`tessera-playtest-scenario` is **kept** (no JSON in this dir; it predates the canon). It accepts an arbitrary instruction via `init_params.instruction` and is what `run-orchestrator.sh` fans out to as the per-role child.

Deleted (no longer in use, removed from Jetty 2026-04-27): `tessera-smoke` (early hello-world), `tessera-playtest-player` (was the per-role child of the original fan-out design — superseded by `tessera-playtest-role`).

## Deploy / update

```sh
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' /Users/schaffter/www/tessera/.env.local | cut -d= -f2)
COLLECTION=jettyio
TASK_FILE=docs/playtest/jetty-tasks/tessera-tl.json
TASK_NAME=$(jq -r .name "$TASK_FILE")

# Create (first time):
curl -X POST \
  -H "Authorization: Bearer $JETTY_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @"$TASK_FILE" \
  "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION"

# Update (subsequent edits):
curl -X PUT \
  -H "Authorization: Bearer $JETTY_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @"$TASK_FILE" \
  "https://flows-api.jetty.io/api/v1/tasks/$COLLECTION/$TASK_NAME"
```

> The first-time POST may return a 409 if a task with the same name already exists. In that case use PUT.

## Verify a deploy

```sh
# List all flows in the collection.
curl -H "Authorization: Bearer $JETTY_API_KEY" \
  "https://flows-api.jetty.io/api/v1/db/flows/$COLLECTION" | jq .

# Smoke-fire a task with empty init params (will likely fail validation,
# but proves the task is registered):
curl -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
  -F 'init_params={}' \
  "https://flows-api.jetty.io/api/v1/run/$COLLECTION/$TASK_NAME"
```

## When to re-deploy

After **any change** to the JSON in this directory. Treat the file in git as the canonical version; the deployed copy on Jetty is essentially a cached build. If the two diverge, one of:

- Someone edited via the Jetty UI without committing back here. Don't do that — bring the change into git first.
- A deploy was missed. Re-PUT the file.

The PR-review action (`tessera-tl` on every PR) means this matters: a stale deployed task means the review you're seeing on a PR doesn't match the prompt in `tessera-tl.json` on disk.
