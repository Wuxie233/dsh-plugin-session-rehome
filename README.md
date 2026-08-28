# dsh-plugin-session-rehome

Cursor 对等的对话改挂：模型工具 `move_agent_to_root({ rootPath })` 把当前对话迁到已存在的项目目录。侧边栏分组和本回合后续 bash/fs/AGENTS.md 跟随新根。不 mkdir，不能改挂回 No Repo。

通用设置 → **移动工作区** 可选询问或自动（默认询问）。

## 行为

| 模式 | 当前家 | 目标 | 动作 |
| --- | --- | --- | --- |
| 询问 | No Repo | 唯一已注册匹配 | 直接改挂 |
| 询问 | No Repo | 多个已注册匹配 | `userQuestions` 选择 |
| 询问 | No Repo | 已存在未注册目录 | 直接改挂（Host 创建工作区） |
| 询问 | 真项目 | 另一个目录 | 先确认 Move / Stay |
| 自动 | 任意（非 No Repo 目标） | 模型给出的绝对路径 | 直接改挂；多匹配不弹窗 |
| 任意 | 任意 | `$DSH_HOME/no-repo` | 拒绝 |

Web 组合走 Host `ctx.sessionController.rehome({ sessionId, path })`。没有 Session Controller 时，在线非 subagent 会话回退到 `workspaceRegistry.create` + `setSessionHome`。

## 安装 / 更新

```sh
./install.sh
# 然后重启 dsh web（host 半插件需要重启生效）
# 浏览器半：刷新页面即可看到设置行
```

挂载行（写入 `~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
- insert:
    - id: session-rehome
      name: '@wuxie/dsh-session-rehome'
```
