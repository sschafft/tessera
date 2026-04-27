# Jetty task definitions

Workflow definitions deployed to the `jettyio` Jetty collection. Each `.json` here is the source of truth for a deployed task. To change a task's behaviour, edit the file, commit it, and re-deploy.

## Tasks

| File | Task | Purpose |
|------|------|---------|
| `tessera-tl.json` | `tessera-tl` | Adversarial code review on every PR. Wired up via `.github/workflows/tessera-tl.yml`. |
| `tessera-playtest-player.json` | `tessera-playtest-player` | Single-role child workflow used by the orchestrator. Don't run directly. |
| `tessera-playtest-orchestrator.json` | `tessera-playtest-orchestrator` | 10-agent concurrent playtest. Spawns `tessera-playtest-player` ×10 + a synth pass. |

The existing `tessera-playtest-scenario` task (single-agent multi-tab playtest) remains deployed; it was the predecessor and is still useful for fast single-scenario runs.

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
