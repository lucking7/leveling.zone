# Planner discovery: orchestrate plugin skills

Planner: cloud agent `bc-5c4f3afb-6647-4e63-8a18-56419c224a62`
Goal (verbatim): _Say hello and list what skills you have access to from the orchestrate plugin_
Workspace: `.orchestrate/orchestrate-skills/`
Branch: `cursor/orchestrate-smoke-test-4a62`

## Greeting

Hello from the root planner.

## Plugin root

Resolved via `find /home/ubuntu/.cursor/plugins -name SKILL.md`:

```
/home/ubuntu/.cursor/plugins/cache/cursor-public/9333/d1cdb88a9eb33cf392395c87e3fd76419fc1010e/
```

The plugin name is `cursor-public/orchestrate` (Cursor's public plugin published at `github.com/cursor/plugins`, MIT-licensed; see plugin `README.md`).

## Skills found

| # | Path | `name` (frontmatter) | `description` (frontmatter, verbatim) |
|---|------|----------------------|---------------------------------------|
| 1 | `skills/orchestrate/SKILL.md` | `orchestrate` | Use only when the user explicitly types `/orchestrate <goal>` to decompose a large task, spawn a tree of parallel cloud-agent workers/subplanners/verifiers via the Cursor SDK, and collect structured handoffs; do not invoke autonomously. |

**Total `SKILL.md` files in the plugin: 1.**

The orchestrate plugin packages exactly one skill (`orchestrate`). It has the `disable-model-invocation: true` flag, so it loads only on an explicit `/orchestrate` invocation. The skill provides multiple _roles_ (dispatcher, root planner, subplanner, worker, verifier — each documented under `references/` and `prompts/`), but those are roles inside the single skill, not separate skills.

## Substrate exercise — outcome

A worker task `say-hello-list-skills` was authored in `plan.json` to confirm this discovery against an independent agent (the planner-only discovery is by-the-book "discover here before you publish tasks"; the worker would have provided the cross-check the SKILL prescribes for the substrate's spawn/wait/handoff loop).

The reconcile loop was invoked as required:

```
bun cli.ts run --root /workspace/.orchestrate/orchestrate-skills
```

It exited with code `2` and the message:

```
CURSOR_API_KEY required; see cursor-sdk/references/auth.md
```

`CURSOR_API_KEY` is not present in this cloud-agent VM's environment, so the substrate cannot spawn child agents. No `state.json` was written and no task ever transitioned out of `pending`; the workspace contains zero non-terminal task rows because no rows were created. Loop hygiene is satisfied — there is nothing to reattach to.

## Next step (operator-facing)

To exercise the spawn/wait/handoff loop end-to-end, add `CURSOR_API_KEY` (a personal user key starting with `cursor_`, from [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations)) as a Cloud Agent secret, then re-trigger the same `/orchestrate` goal. The plan in `plan.json` is unchanged and idempotent; the next planner can pick it up without any edits to the goal or task definitions.
