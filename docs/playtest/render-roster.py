#!/usr/bin/env python3
"""
Render 10 role-specific playtest instructions for run-orchestrator.sh.

Reads CODE / HOST_TOKEN / TESSERA_URL / COMPLEXITY / DURATION_MIN from
the environment (with fallbacks), generates one instruction string per
role using the hard-coded roster, and writes them as separate JSON
payload files into /tmp/orch-runs/<idx>-<role>-<name>.instruction.json
ready to be POSTed via `curl -F "init_params=<file"`.

Usage:
    CODE=ABC-123 HOST_TOKEN=xxx python3 render-roster.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

CODE = os.environ.get("CODE", "")
HOST_TOKEN = os.environ.get("HOST_TOKEN", "")
if not CODE and len(sys.argv) > 1:
    CODE = sys.argv[1]
TESSERA_URL = os.environ.get("TESSERA_URL", "https://tessera.schaffters.com")
COMPLEXITY = int(os.environ.get("COMPLEXITY", "5"))
DURATION_MIN = int(os.environ.get("DURATION_MIN", "10"))

if not CODE or not HOST_TOKEN:
    print("CODE and HOST_TOKEN env vars are required", file=sys.stderr)
    sys.exit(2)

ROSTER = [
    {"role": "gm", "name": "Facilitator", "pair_idx": None},
    {"role": "builder", "name": "Avery", "pair_idx": 0},
    {"role": "guider", "name": "Bri", "pair_idx": 0},
    {"role": "builder", "name": "Cameron", "pair_idx": 1},
    {"role": "guider", "name": "Drew", "pair_idx": 1},
    {"role": "builder", "name": "Ellis", "pair_idx": 2},
    {"role": "guider", "name": "Finley", "pair_idx": 2},
    {"role": "observer", "name": "Gray", "pair_idx": 0},
    {"role": "observer", "name": "Harper", "pair_idx": 1},
    {"role": "observer", "name": "Indigo", "pair_idx": 2},
]

PLAYBOOK = {
    "gm": (
        "### GM playbook\n"
        "1. Claim host session: navigate to {url}/host-recover/{code}, paste the host token in the form, submit. You should land on /g/{code}/master.\n"
        "2. Wait until 9 players appear in the lobby.\n"
        "3. Click the numeric `pairs` input in the auto-allocate block, set it to 3, click 'Create 3 pairs'.\n"
        "4. Click 'Auto-assign 3 observers'.\n"
        "5. Set complexity to {complexity} (the +/- stepper) and duration to {duration_min} minutes (free-text input). Click Start round 1.\n"
        "6. While the round runs: switch focused pair every ~90s by clicking pairs in the PairsPanel.\n"
        "7. When the timer hits 0, observe the round-end view. End the game.\n"
        "Findings: GM dashboard responsiveness with 3 active pairs, pair-switching delay, allocation UX with 9 lobby members, super-power firing latency."
    ),
    "builder": (
        "### Builder playbook (name: {name}, pair {pair_idx})\n"
        "1. Navigate to {url}/g/{code}/join. Name = '{name}'. Submit. Save the recovery URL the modal shows you.\n"
        "2. Wait in lobby until the GM assigns you a pair + starts the round.\n"
        "3. After start: open your sealed brief envelope. Place ~10-14 pieces using a mix of shapes/colors. Sample latency at 5 placements (click → piece visible).\n"
        "4. Tap 'Test solution' at least twice — once early (≥3 placements), once late (≥10).\n"
        "5. Try 'Clear all' once: tap, observe arming, tap again to confirm.\n"
        "Findings: place-piece responsiveness (any visible stutter? optimistic→server gap?), test-solution feedback clarity, brief envelope dismissal flow, pair-name nudge UX, Clear-all confirm."
    ),
    "guider": (
        "### Guider playbook (name: {name}, pair {pair_idx})\n"
        "1. Navigate to {url}/g/{code}/join. Name = '{name}'. Submit. Save the recovery URL the modal shows you.\n"
        "2. Wait for pair assignment + round start.\n"
        "3. Open your brief envelope, observe the goal pattern.\n"
        "4. Within first 60s, click the PairNameBadge (yellow when unnamed) and rename the pair to 'The Pelicans'.\n"
        "5. Try minimizing the brief (the - button) and re-expanding (click the seal circle).\n"
        "Findings: goal canvas readability at complexity {complexity}, brief minimize/seal flow, pair-rename UX, brief overlay vs canvas (should NOT overlay)."
    ),
    "observer": (
        "### Observer playbook (name: {name}, pair {pair_idx})\n"
        "1. Navigate to {url}/g/{code}/join. Name = '{name}'. Submit. Save the recovery URL the modal shows you.\n"
        "2. Wait for the GM to assign you to a pair as observer.\n"
        "3. After round start: observe the side-by-side builder + goal layout. Time from join to first goal canvas mounted.\n"
        "4. If multiple pairs are available, switch to a different pair at least once.\n"
        "Findings: observer view scaling at complexity {complexity}, pair-switcher UX, missing affordances, realtime updates lag."
    ),
}

out_dir = pathlib.Path("/tmp/orch-runs")
out_dir.mkdir(exist_ok=True)
for f in out_dir.glob("*.json"):
    f.unlink()

for i, entry in enumerate(ROSTER):
    role = entry["role"]
    body = PLAYBOOK[role].format(
        url=TESSERA_URL,
        code=CODE,
        name=entry["name"],
        pair_idx=entry["pair_idx"],
        complexity=COMPLEXITY,
        duration_min=DURATION_MIN,
    )
    pair_idx_str = "null" if entry["pair_idx"] is None else str(entry["pair_idx"])
    name_slug = entry["name"].lower().replace(" ", "-")

    setup = (
        f"You are playing one role in a live Tessera workshop running at {TESSERA_URL} (code: {CODE}).\n\n"
        f"Your role: {role}\n"
        f"Your display name: {entry['name']}\n"
        f"Pair index: {pair_idx_str}\n"
        f"Host token (only used if role == gm): {HOST_TOKEN}\n\n"
        "## Setup\n"
        "1. `npx --yes playwright install chromium` (the prism-playwright snapshot is missing the binary).\n"
        "2. Open ONE Playwright browser context.\n"
        "3. Note wall-clock time when you start (joined_at).\n\n"
    )

    output_schema = (
        "\n## Final output (stdout JSON)\n"
        "The LAST thing you print MUST be a single JSON object matching:\n\n"
        "```json\n"
        "{\n"
        f'  "scenario_id": "orchestrator-{role}-{name_slug}",\n'
        '  "outcome": "passed | failed | partial",\n'
        '  "duration_sec": 0,\n'
        f'  "role": "{role}",\n'
        f'  "name": "{entry["name"]}",\n'
        f'  "pair_idx": {pair_idx_str},\n'
        '  "findings": [\n'
        '    {"severity": "blocker | major | minor | nit", "area": "' + role + '", "category": "bug | ux-confusion | slowness | copy | accessibility | visual", "title": "...", "detail": "...", "url_or_route": "/g/' + CODE + '/play", "evidence": "..."}\n'
        "  ],\n"
        '  "console_errors": [],\n'
        '  "network_errors": []\n'
        "}\n"
        "```\n\n"
        "Notes/narrative go ABOVE the JSON. The orchestrator parses only the LAST valid JSON object."
    )

    full = (
        setup
        + body
        + "\n\n## Universal observations\nNote console errors, network errors, and general UX surprises (confusing copy, missing affordances, rough transitions).\n"
        + output_schema
    )

    p = out_dir / f"{i:02d}-{role}-{name_slug}.instruction.json"
    p.write_text(json.dumps({"instruction": full}))
    print(f"  {i:02d} {role:9} {entry['name']:12} pair={pair_idx_str}  {len(full)} chars  -> {p.name}")

print(f"\nWrote {len(ROSTER)} instruction files to {out_dir}/")
