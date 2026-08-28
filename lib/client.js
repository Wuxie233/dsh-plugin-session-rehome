window.__ModuleLoader__.load({
  id: "@wuxie/dsh-session-rehome",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // Ask vs auto rehome preference. Persisted in the Host user-settings
    // section "session-rehome", selectable in General Settings as the
    // "移动工作区" row:
    //   "ask"  — product default: confirm leaving a real project, or choose
    //            among several registered matches from No Repo.
    //   "auto" — skip those prompts and rehome to the model's canonical path.
    const react = require("react");
    const { createSnapshotStore } = require("@deepseek-ai/dsh-client-store");
    const { Menu, IconChevronDownOutline14 } = require("@deepseek-ai/dsh-client-ui-primitives");

    const NS = "session-rehome";
    const REHOME_MODE_FIELD = "rehomeMode";
    const REHOME_MODES = ["ask", "auto"];
    const DEFAULT_REHOME_MODE = "ask";

    const zh = {
      "settings.rehomeMode.title": "移动工作区",
      "settings.rehomeMode.description": "识别到目标项目后，是先询问还是直接把当前对话改挂过去",
      "settings.rehomeMode.ask": "询问",
      "settings.rehomeMode.auto": "自动",
    };
    const en = {
      "settings.rehomeMode.title": "Move workspace",
      "settings.rehomeMode.description": "When a target project is identified, ask before moving this conversation or rehome automatically",
      "settings.rehomeMode.ask": "Ask",
      "settings.rehomeMode.auto": "Automatic",
    };

    class RehomeModePolicy {
      constructor(host) {
        this.rehomeMode = createSnapshotStore(DEFAULT_REHOME_MODE);
        this.host = host;
        if (host !== undefined) {
          host.subscribe(() => { this.adopt(host) });
          this.adopt(host);
        }
      }

      setRehomeMode(mode) {
        if (this.rehomeMode.getSnapshot() === mode) return
        this.rehomeMode.set(mode)
        void this.host?.set(REHOME_MODE_FIELD, mode)
      }

      adopt(host) {
        const section = host.getSnapshot().value
        if (section === undefined || this.rehomeMode.getSnapshot() === section.rehomeMode) return
        this.rehomeMode.set(section.rehomeMode)
      }
    }

    const rowStyles = {
      row: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "16px 0",
        borderBottom: "1px solid var(--dsw-alias-border-l2)",
      },
      rowText: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingRight: 48,
      },
      title: {
        fontSize: 14,
        fontWeight: 400,
        lineHeight: "22px",
        color: "var(--dsw-alias-label-primary)",
      },
      desc: {
        fontSize: 12,
        fontWeight: 400,
        lineHeight: "18px",
        color: "var(--dsw-alias-label-tertiary)",
      },
      selector: {
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        height: 36,
        padding: "0 14px",
        border: "none",
        borderRadius: 18,
        background: "var(--dsw-alias-bg-module-platform)",
        font: "inherit",
        fontSize: 14,
        lineHeight: "22px",
        color: "var(--dsw-alias-label-primary)",
        cursor: "pointer",
      },
      chevron: { flex: "none" },
    };

    function RehomeModeRow({ useRehomeMode, setRehomeMode, t }) {
      const mode = useRehomeMode((value) => value)
      const [open, setOpen] = react.useState(false)
      const labelKey = mode === "auto" ? "settings.rehomeMode.auto" : "settings.rehomeMode.ask"
      return react.createElement(
        "div", { style: rowStyles.row },
        react.createElement(
          "div", { style: rowStyles.rowText },
          react.createElement("div", { style: rowStyles.title }, t("settings.rehomeMode.title")),
          react.createElement("div", { style: rowStyles.desc }, t("settings.rehomeMode.description")),
        ),
        react.createElement(Menu, {
          open,
          onClose: () => { setOpen(false) },
          items: REHOME_MODES.map((id) => ({
            id,
            label: t(id === "auto" ? "settings.rehomeMode.auto" : "settings.rehomeMode.ask"),
          })),
          selectedId: mode,
          onSelect: (id) => { setOpen(false); setRehomeMode(id) },
          align: "end",
          portal: true,
          anchor: react.createElement(
            "button",
            {
              type: "button",
              style: rowStyles.selector,
              "aria-haspopup": "menu",
              "aria-expanded": open,
              onClick: () => { setOpen((value) => !value) },
            },
            t(labelKey),
            react.createElement(IconChevronDownOutline14, { style: rowStyles.chevron }),
          ),
        }),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-rehome: dictionaries")
      const policy = new RehomeModePolicy(ctx.settingsScope.bind({ namespace: NS }))
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "session-rehome-mode",
        order: 32,
        locale: NS,
        inject: () => ({
          hooks: { rehomeMode: policy.rehomeMode },
          setRehomeMode: (mode) => { policy.setRehomeMode(mode) },
        }),
      }, RehomeModeRow))
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "connection", "remote", "settingsScope"];
    return module.exports;
  }
});
