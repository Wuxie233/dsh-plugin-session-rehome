## 当前接入方式：dsh-std adapter

本插件通过 dsh-plugin.json 声明标准 host facet；lib/index.js 发布
plugins.starpivot.dev/v1 HostPlugin，lib/host.js 保留业务策略并接收 adapter API。
有浏览器界面的插件另声明 LocalModule，使用私有 WebPlugin surface。

执行 ./install.sh 会先验证全部九个自制插件的组合、Web 界面与 CodeCarry
原生 Remote，再备份并复制部署；失败不替换生产插件。需先安装同级 dsh-std
维护仓库及其依赖。部署后在没有活跃任务时重启 dsh，并刷新 Web。

不要把 lib/index.js 直接作为 Cordis 插件挂载；原插件的 cordis insert 行由
共享部署器移除，配置迁入 adapter.componentConfigs。不要链接运行时插件目录。
标准协议不承诺未来版本永久兼容；native ctx/hooks 的变化由候选门禁和集中
adapter 维护控制。Web 界面不会自动出现在原生 Android 中。

下方保留业务说明和历史修复记录；涉及旧式直接挂载、导入和安装步骤的内容，
以本节为准。

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

生产路径是在线回退：`workspaceRegistry.create` + `setSessionHome` + detach/attach（当前对话一定在线）。可选的 `ctx.apiProxy.sessions.rehome` 仅在组合仍提供该桩时使用，不是依赖。

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
