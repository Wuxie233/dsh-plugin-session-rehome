# dsh-plugin-session-rehome

Cursor 对等的对话改挂：模型工具 `move_agent_to_root({ rootPath })` 把当前对话迁到已存在的项目目录。侧边栏分组和本回合后续 bash/fs/AGENTS.md 跟随新根。不 mkdir，不能改挂回 No Repo。

## 行为

| 当前家 | 目标 | 动作 |
| --- | --- | --- |
| No Repo | 唯一已注册匹配 | 直接改挂 |
| No Repo | 多个已注册匹配 | `userQuestions` 选择 |
| No Repo | 已存在未注册目录 | 直接改挂（Host 创建工作区） |
| 真项目 | 另一个目录 | 先确认 Move / Stay |
| 任意 | `$DSH_HOME/no-repo` | 拒绝 |

需要 Host `session.rehome`（deepseek-harness `7e166f8` 起）。

## 安装 / 更新

```sh
./install.sh
# 然后重启 dsh web（host 半插件需要重启生效）
```

挂载行（写入 `~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
- insert:
    - id: session-rehome
      name: '@wuxie/dsh-session-rehome'
```
