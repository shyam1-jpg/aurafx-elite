# AuraFX — Test After Development Hooks

These Cursor hooks implement: **develop first → test when the agent stops**.

## Behavior

| Event | What happens |
|-------|----------------|
| `afterFileEdit` | After `.mq5`, `.mqh`, `.js`, `.py`, etc. edits, sets a marker file |
| `stop` | If marker exists, agent gets one `followup_message` with the MT5 testing checklist, then marker is cleared |

`loop_limit: 1` prevents repeated test loops on the same stop chain.

## Activate

1. Open **`AuraFX-Elite`** as the Cursor workspace (hooks are in `.cursor/hooks.json`),  
   **or** use the Desktop workspace (hooks at `Desktop/.cursor/hooks.json` point here).
2. Save `hooks.json` — Cursor reloads hooks automatically.
3. If hooks do not appear: **Cursor Settings → Hooks**, or restart Cursor.

## Test the hook

1. Ask the agent to edit any `.mq5` file.
2. Let the agent finish (`stop` event).
3. You should see a follow-up prompting the MT5 testing checklist.

## Disable temporarily

Rename or remove `.cursor/hooks.json`, or delete the `stop` entry.
