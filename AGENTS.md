# AGENTS.md

Host-only dsh plugin: `move_agent_to_root` over `session.rehome`.

## Architecture

- `lib/index.js` registers the tool and a systemPrompt usage section.
- Deploy by copy (`install.sh`), never symlink.
- Needs `tools`, `agents`, `workspaceRegistry`, `systemPrompt`; uses optional `apiProxy`, `userQuestions`, `sandboxPolicy`.

## Conventions

- Edit → `./install.sh` → restart dsh web.
- Confirmation uses `ctx.userQuestions.ask`, not a nested `ask_user_question` tool call.

## Gotchas & Decisions

- Do not mkdir. Host `session.rehome` registers an existing directory.
- Canonical No Repo path is refused as a target.
- If `apiProxy` is missing, fall back to `workspaceRegistry.create` + `setSessionHome` + detach/attach.
