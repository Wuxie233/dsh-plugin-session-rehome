# AGENTS.md

dsh 双半插件：`move_agent_to_root` over `session.rehome`，通用设置里可选询问 / 自动。

## Architecture

- `lib/index.js` 注册工具、systemPrompt usage、以及 `session-rehome` 设置命名空间 schema。
- `lib/client.js` 浏览器半：General Settings → 移动工作区（询问 / 自动）。
- `lib/logic.js` 纯函数：ask/auto 分支（确认离开、多匹配选择、唯一匹配改写）。
- Deploy by copy (`install.sh`), never symlink.
- Host needs `tools`, `agents`, `workspaceRegistry`, `systemPrompt`; uses optional `apiProxy`, `userQuestions`, `sandboxPolicy`, `settings`.
- Browser half injects `slots`, `locale`, `connection`, `remote`, `settingsScope`.

## Conventions

- Edit → `./install.sh` → restart dsh web（host 半）；刷新页面（浏览器半）。
- Confirmation uses `ctx.userQuestions.ask`, not a nested `ask_user_question` tool call.
- Settings namespace is `session-rehome` on both halves so the row actually persists.

## Gotchas & Decisions

- Do not mkdir. Host `session.rehome` registers an existing directory.
- Canonical No Repo path is refused as a target.
- If `apiProxy` is missing, fall back to `workspaceRegistry.create` + `setSessionHome` + detach/attach.
- Default mode is `ask` (historical confirmation). `auto` skips prompts and keeps the model's canonical path when several registered workspaces match; unique No Repo matches still remap onto the registered workspace path.
- Package name must stay identical in three places: `package.json` `name`, `lib/client.js` `__ModuleLoader__.load({ id })`, and the `cordis.patch.yml` mount row `name`.
- Do not symlink-deploy: Node ESM resolves the real path and then cannot find `@deepseek-ai/*` from the profile.

## Commands

- `./install.sh` — 部署到运行时（幂等）
- `node scripts/rehome-policy.test.mjs` — 纯函数
- `node --check lib/client.js`；ESM 的 `index.js` / `logic.js` 复制为 `.mjs` 再查
- 生效验证：`cd ~/.dsh/profiles/web && node -e "await import('@wuxie/dsh-session-rehome')"`

## Module Map

单包。`lib/logic.js` + `lib/index.js` + `lib/client.js`。
