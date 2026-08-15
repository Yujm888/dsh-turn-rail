// dsh-turn-rail — web client half.
// A Codex-style auto-hiding turn rail for the DeepSeek Harness Web UI.

window.__ModuleLoader__.load({
  id: "dsh-turn-rail",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");
    const ReactDOM = require("react-dom");

    // ---------------------------------------------------------------- tuning
    const EDGE_TRIGGER_PX = 110; // show the rail when the pointer is this close to the right edge
    const DETAIL_LEFT_PX = 46;   // tooltip appears between these two distances from the right edge
    const DETAIL_RIGHT_PX = 10;
    const HIDE_DELAY_MS = 120;   // wait before the rail starts fading out
    const UNMOUNT_AFTER_MS = 200; // remove tooltip/search after the fade completes
    const MAX_VISIBLE_MARKS = 30; // when there are more turns, the rail scrolls
    const BOTTOM_FOLLOW_TURNS = 15; // keep the rail pinned to the bottom while this close to the latest turn
    const SEARCH_LIMIT = 30;
    const PROJECTION_KEY = "turnRailMessages";

    // ------------------------------------------------------------------ css
    const css = [
      ".tr_rail{position:fixed;top:18vh;bottom:18vh;right:20px;z-index:100;width:20px;pointer-events:none;opacity:0;transition:opacity .18s ease;user-select:none;-webkit-user-select:none}",
      ".tr_rail.tr_show{opacity:1;pointer-events:auto}",
      ".tr_rail:not(.tr_show) .tr_mark{pointer-events:none}",
      ".tr_search{position:absolute;top:-26px;right:0;width:20px;height:20px;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:6px;background:var(--dsw-alias-button-floating-fill,rgba(255,255,255,.85));color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.75;transition:opacity .15s ease}",
      ".tr_search:hover{opacity:1}",
      ".tr_searchbox{position:absolute;top:-26px;right:28px;width:min(300px,calc(100vw - 48px));max-height:min(320px,60vh);display:flex;flex-direction:column;background:var(--dsw-alias-button-floating-fill,#fff);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:10px;box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.12));overflow:hidden;z-index:103}",
      ".tr_search_input{width:100%;box-sizing:border-box;border:none;outline:none;padding:8px 10px;background:transparent;color:inherit;font-size:12px;line-height:18px}",
      ".tr_results{overflow-y:auto;overscroll-behavior:contain}",
      ".tr_result{display:block;width:100%;box-sizing:border-box;border:none;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.12));background:transparent;color:inherit;padding:6px 10px;text-align:left;cursor:pointer;font-size:12px;line-height:18px}",
      ".tr_result:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}",
      ".tr_result_text{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".tr_result_time{display:block;color:var(--dsw-alias-label-caption,rgba(127,127,127,.75));font-size:11px}",
      ".tr_empty{padding:10px;color:var(--dsw-alias-label-caption,rgba(127,127,127,.75));font-size:12px}",
      ".tr_scroll{position:absolute;top:0;bottom:0;right:-10px;width:70px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;pointer-events:auto}",
      ".tr_scroll::-webkit-scrollbar{display:none}",
      ".tr_scroll .tr_mark{position:relative;top:auto;right:auto;width:70px;flex:0 0 auto}",
      ".tr_mark{position:absolute;right:-10px;width:70px;padding:0 10px 0 0;box-sizing:border-box;border:0;background:transparent;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;pointer-events:auto}",
      ".tr_line{width:clamp(14px,1.5vw,20px);height:clamp(4px,0.6vh,7px);border-radius:3px;background:var(--dsw-alias-label-tertiary,rgba(127,127,127,.45));transition:width .15s ease,height .15s ease,background-color .15s ease}",
      ".tr_mark:hover .tr_line{background:var(--dsw-alias-label-primary,rgba(0,0,0,.8));width:clamp(18px,2vw,26px);height:clamp(5px,0.8vh,9px)}",
      ".tr_mark.tr_active .tr_line{background:var(--dsw-alias-state-business-primary,#4d6bfe);width:clamp(18px,2vw,26px);height:clamp(5px,0.8vh,9px)}",
      ".tr_tip{position:fixed;z-index:101;right:56px;min-width:240px;max-width:360px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-button-floating-fill,#fff);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2));box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.12));font-size:12px;line-height:18px;pointer-events:auto;overflow-wrap:break-word;animation:trTipIn .16s ease}",
      "@keyframes trTipIn{from{opacity:0}to{opacity:1}}",
      ".tr_tip_time{display:block;margin-top:2px;color:var(--dsw-alias-label-caption,rgba(127,127,127,.75));font-size:11px}",
      "@media (prefers-reduced-motion:reduce){.tr_rail,.tr_line{transition:none}.tr_tip{animation:none}}"
    ].join("");

    const CSS_TAG = "dsh-turn-rail/styles.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-turn-rail";
      tag.dataset.pluginCss = CSS_TAG;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    const styles = {
      rail: "tr_rail",
      show: "tr_show",
      search: "tr_search",
      searchbox: "tr_searchbox",
      searchInput: "tr_search_input",
      results: "tr_results",
      result: "tr_result",
      resultText: "tr_result_text",
      resultTime: "tr_result_time",
      empty: "tr_empty",
      scroll: "tr_scroll",
      mark: "tr_mark",
      line: "tr_line",
      active: "tr_active",
      tip: "tr_tip",
      tipTime: "tr_tip_time"
    };

    // ------------------------------------------------------------- helpers
    const NOOP_STORE = { getSnapshot: () => void 0, subscribe: () => () => {} };
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function userTextOf(content) {
      if (!Array.isArray(content)) return "";
      let out = "";
      for (const block of content) {
        if (block && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
          out += block.text;
        }
      }
      return out.trim();
    }

    function normalize(item) {
      if (!item || typeof item !== "object" || typeof item.seq !== "number") return null;
      return {
        seq: item.seq,
        time: typeof item.time === "number" ? item.time : 0,
        text: typeof item.text === "string" ? item.text : ""
      };
    }

    function collectFromNodes(snapshot) {
      const out = [];
      if (!snapshot || !snapshot.chat) return out;
      for (const node of snapshot.chat.nodes.values()) {
        if (!node || typeof node !== "object" || node.kind !== "user") continue;
        const data = node.data;
        if (!data || typeof data !== "object" || !Array.isArray(data.content)) continue;
        if (typeof node.anchorSeq !== "number" || typeof node.key !== "string") continue;
        out.push({ seq: node.anchorSeq, time: typeof data.time === "number" ? data.time : 0, text: userTextOf(data.content), key: node.key });
      }
      out.sort((a, b) => a.seq - b.seq);
      return out;
    }

    function anchorKeyOf(item) {
      if (item && typeof item.key === "string" && item.key !== "") return item.key;
      if (item && typeof item.id === "string" && item.id !== "") return "13:input-message" + item.id;
      return void 0;
    }

    function timeText(ms) {
      if (typeof ms !== "number" || ms <= 0) return "";
      return new Date(ms).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    async function jumpToMessage(sessionsService, sessionId, key) {
      const session = sessionsService.binding(sessionId)?.session;
      if (!session) return false;
      let guard = 0;
      while (guard++ < 120) {
        const snap = session.getSnapshot();
        if (snap?.chat?.nodes?.get(key) !== void 0) break;
        if (snap?.hasMore !== true) return false;
        if (snap.loadingOlder === true) { await delay(50); continue; }
        await session.loadOlder();
      }
      const scrollport = typeof document !== "undefined" ? document.querySelector("[data-conversation-scroll]") : null;
      const row = scrollport === null ? null : scrollport.querySelector('[data-chat-anchor-key="' + CSS.escape(key) + '"]');
      if (row === null) return false;
      const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      return true;
    }

    // ------------------------------------------------------------- component
    function TurnRail({ useProjection, sessionId, sessionsService, t }) {
      const projected = useProjection(PROJECTION_KEY);
      const session = sessionId === void 0 ? void 0 : sessionsService.binding(sessionId)?.session;
      const fallbackStore = session === void 0 ? NOOP_STORE : session;
      const nodeSnapshot = React.useSyncExternalStore(
        (cb) => fallbackStore.subscribe(cb),
        () => fallbackStore.getSnapshot()
      );

      let messages = [];
      let source = "nodes";
      if (Array.isArray(projected) && projected.length > 0) {
        messages = projected.map(normalize).filter((m) => m !== null);
        source = "projection";
      }
      if (messages.length === 0) {
        messages = collectFromNodes(nodeSnapshot);
        source = "nodes";
      }

      const [activeIndex, setActiveIndex] = React.useState(-1);
      const [tip, setTip] = React.useState(null);
      const [visible, setVisible] = React.useState(false);
      const [searchOpen, setSearchOpen] = React.useState(false);
      const [query, setQuery] = React.useState("");

      const tipTimerRef = React.useRef(null);
      const tipDismissRef = React.useRef(null);
      const searchCloseRef = React.useRef(null);
      const hideTimerRef = React.useRef(null);
      const searchOpenRef = React.useRef(false);
      const railRef = React.useRef(null);
      const scrollRef = React.useRef(null);

      React.useEffect(() => () => {
        for (const ref of [tipTimerRef, tipDismissRef, searchCloseRef, hideTimerRef]) {
          if (ref.current !== null) clearTimeout(ref.current);
        }
      }, []);

      React.useEffect(() => {
        searchOpenRef.current = searchOpen;
        if (searchOpen) {
          if (hideTimerRef.current !== null) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
          if (searchCloseRef.current !== null) { clearTimeout(searchCloseRef.current); searchCloseRef.current = null; }
        }
      }, [searchOpen]);

      const cancelHide = () => {
        if (hideTimerRef.current !== null) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      };

      const beginFadeOut = (force = false) => {
        if (searchOpenRef.current && !force) return;
        cancelHide();
        setVisible(false);
        if (tipDismissRef.current !== null) clearTimeout(tipDismissRef.current);
        tipDismissRef.current = setTimeout(() => setTip(null), UNMOUNT_AFTER_MS);
        if (searchOpenRef.current) {
          if (searchCloseRef.current !== null) clearTimeout(searchCloseRef.current);
          searchCloseRef.current = setTimeout(() => setSearchOpen(false), UNMOUNT_AFTER_MS);
        } else {
          setSearchOpen(false);
        }
      };

      const hideSoon = (force = false) => {
        cancelHide();
        hideTimerRef.current = setTimeout(() => beginFadeOut(force), HIDE_DELAY_MS);
      };
      const scheduleHide = () => {
        if (searchOpenRef.current) return;
        hideSoon();
      };

      // A click outside the rail closes a pinned search box.
      React.useEffect(() => {
        if (!searchOpen) return;
        const onPointerDown = (event) => {
          if (railRef.current !== null && railRef.current.contains(event.target)) return;
          beginFadeOut(true);
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
      }, [searchOpen]);

      // Windows-taskbar-style edge peek. While search is open the rail stays put.
      React.useEffect(() => {
        const onMove = (event) => {
          if (searchOpenRef.current) { cancelHide(); return; }
          if (event.clientX >= window.innerWidth - EDGE_TRIGGER_PX) {
            cancelHide();
            setVisible(true);
          } else {
            scheduleHide();
          }
        };
        const onLeave = () => {
          if (searchOpenRef.current) return;
          hideSoon(true);
        };
        const onMouseOut = (event) => {
          if (event.relatedTarget === null) onLeave();
        };
        const onVisibility = () => {
          if (document.hidden) onLeave();
        };
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseout", onMouseOut, true);
        document.documentElement.addEventListener("mouseleave", onLeave);
        window.addEventListener("blur", onLeave);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseout", onMouseOut, true);
          document.documentElement.removeEventListener("mouseleave", onLeave);
          window.removeEventListener("blur", onLeave);
          document.removeEventListener("visibilitychange", onVisibility);
        };
      }, []);

      // Preload older history until the projection owns the full turn list.
      React.useEffect(() => {
        if (session === void 0) return;
        if (Array.isArray(projected) && projected.length > 0) return;
        let cancelled = false;
        const run = async () => {
          let guard = 0;
          while (!cancelled && guard++ < 120) {
            if (Array.isArray(projected) && projected.length > 0) return;
            const snap = session.getSnapshot();
            if (snap?.hasMore !== true) return;
            if (snap.loadingOlder === true) { await delay(50); continue; }
            await session.loadOlder();
          }
        };
        run().catch(() => {});
        return () => { cancelled = true; };
      }, [sessionId, session === void 0 ? "none" : "ready", Array.isArray(projected) && projected.length > 0 ? "have" : "none"]);

      // Track the turn nearest the 40% reading line in the chat viewport.
      React.useEffect(() => {
        if (messages.length === 0) return;
        const indexByKey = new Map();
        for (let i = 0; i < messages.length; i++) {
          const key = anchorKeyOf(messages[i]);
          if (key !== void 0) indexByKey.set(key, i);
        }
        const updateActive = () => {
          const sp = document.querySelector("[data-conversation-scroll]");
          if (sp === null) return;
          const rect = sp.getBoundingClientRect();
          if (rect.height === 0) return;
          const line = rect.top + rect.height * 0.4;
          let best = -1;
          let bestDist = Infinity;
          for (const row of sp.querySelectorAll('[data-chat-anchor-key^="13:input-message"]')) {
            const key = row.getAttribute("data-chat-anchor-key");
            if (key === null) continue;
            const idx = indexByKey.get(key) ?? -1;
            if (idx === -1) continue;
            const r = row.getBoundingClientRect();
            const dist = Math.abs(r.top + r.height / 2 - line);
            if (dist < bestDist) { bestDist = dist; best = idx; }
          }
          setActiveIndex(best);
        };
        updateActive();
        const el = document.querySelector("[data-conversation-scroll]");
        let scrollTimer = null;
        const onScroll = () => {
          if (scrollTimer !== null) return;
          scrollTimer = setTimeout(() => { scrollTimer = null; updateActive(); }, 60);
        };
        el === null ? void 0 : el.addEventListener("scroll", onScroll, { passive: true });
        const timer = setInterval(updateActive, 2000);
        return () => {
          if (scrollTimer !== null) clearTimeout(scrollTimer);
          el === null ? void 0 : el.removeEventListener("scroll", onScroll);
          clearInterval(timer);
        };
      }, [sessionId, messages.length, source]);

      // Auto-follow the scrolling rail: stay at the bottom while near the
      // latest turn; otherwise center the current turn in the visible window.
      React.useEffect(() => {
        if (messages.length <= MAX_VISIBLE_MARKS) return;
        const sc = scrollRef.current;
        if (sc === null) return;
        if (activeIndex < 0 || activeIndex >= messages.length - BOTTOM_FOLLOW_TURNS) {
          sc.scrollTop = sc.scrollHeight;
        } else {
          const item = sc.children[activeIndex];
          if (item !== undefined && item !== null) {
            sc.scrollTop = item.offsetTop - (sc.clientHeight - item.clientHeight) / 2;
          }
        }
      }, [activeIndex, messages.length]);

      if (sessionId === void 0 || messages.length < 2) return null;

      const n = messages.length;
      const topFor = (i) => (i / n) * 100;
      const heightFor = () => 100 / n;
      const inDetailZone = (clientX) => clientX >= window.innerWidth - DETAIL_LEFT_PX && clientX <= window.innerWidth - DETAIL_RIGHT_PX;

      const clearTipSoon = () => {
        if (tipTimerRef.current !== null) clearTimeout(tipTimerRef.current);
        tipTimerRef.current = setTimeout(() => setTip(null), 160);
      };
      const clearTipNow = () => {
        if (tipTimerRef.current !== null) clearTimeout(tipTimerRef.current);
        if (tipDismissRef.current !== null) { clearTimeout(tipDismissRef.current); tipDismissRef.current = null; }
        setTip(null);
      };
      const cancelTipClear = () => {
        if (tipTimerRef.current !== null) { clearTimeout(tipTimerRef.current); tipTimerRef.current = null; }
      };
      const showTip = (event, m) => {
        if (tipDismissRef.current !== null) { clearTimeout(tipDismissRef.current); tipDismissRef.current = null; }
        const rect = event.currentTarget.getBoundingClientRect();
        const tipHeight = 72;
        const center = rect.top + rect.height / 2;
        const top = Math.max(tipHeight / 2 + 8, Math.min(window.innerHeight - tipHeight / 2 - 8, center));
        setTip({ key: m.seq, top, text: m.text === "" ? t("noText") : m.text, time: timeText(m.time) });
      };

      const q = query.trim().toLowerCase();
      const searchResults = q === "" ? [] : messages.filter((m) => m.text.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT);

      const renderMarker = (m, i, compact) => {
        const key = anchorKeyOf(m);
        return React.createElement(
          "button",
          {
            type: "button",
            className: styles.mark + (activeIndex === i ? " " + styles.active : ""),
            style: compact ? { height: (100 / MAX_VISIBLE_MARKS) + "%" } : { top: topFor(i) + "%", height: heightFor() + "%" },
            "aria-label": t("roleUser") + ": " + (m.text.slice(0, 60) || t("noText")),
            "aria-current": activeIndex === i ? "location" : void 0,
            onMouseEnter: (e) => {
              cancelHide();
              if (inDetailZone(e.clientX)) {
                cancelTipClear();
                showTip(e, m);
              } else {
                clearTipNow();
              }
            },
            onMouseMove: (e) => {
              cancelHide();
              if (inDetailZone(e.clientX)) {
                if (tip === null || tip.key !== m.seq) {
                  cancelTipClear();
                  showTip(e, m);
                } else {
                  cancelTipClear();
                }
              } else {
                clearTipNow();
              }
            },
            key: "marker-" + m.seq,
            onClick: () => {
              setTip(null);
              if (key === void 0) return;
              jumpToMessage(sessionsService, sessionId, key).catch(() => {});
            }
          },
          React.createElement("span", { className: styles.line })
        );
      };

      const searchIcon = React.createElement(
        "svg",
        { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" },
        React.createElement("circle", { cx: 7.5, cy: 7.5, r: 4.5 }),
        React.createElement("line", { x1: 11, y1: 11, x2: 14, y2: 14 })
      );

      const searchButton = React.createElement(
        "button",
        {
          type: "button",
          key: "search-button",
          className: styles.search,
          title: t("searchLabel"),
          "aria-label": t("searchLabel"),
          onClick: () => {
            setSearchOpen((value) => !value);
            setTip(null);
          }
        },
        searchIcon
      );

      const searchBox = searchOpen ? React.createElement(
        "div",
        {
          key: "searchbox",
          className: styles.searchbox,
          onMouseEnter: cancelHide,
          onMouseLeave: scheduleHide,
          children: [
            React.createElement("input", {
              className: styles.searchInput,
              value: query,
              placeholder: t("searchPlaceholder"),
              autoFocus: true,
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }
            }),
            React.createElement(
              "div",
              { className: styles.results },
              q === "" ? null : searchResults.length === 0 ? React.createElement("div", { className: styles.empty }, t("noResults")) : searchResults.map((m) => {
                const key = anchorKeyOf(m);
                return React.createElement(
                  "button",
                  {
                    type: "button",
                    key: "result-" + m.seq,
                    className: styles.result,
                    onClick: () => {
                      setSearchOpen(false);
                      setQuery("");
                      setTip(null);
                      if (key === void 0) return;
                      jumpToMessage(sessionsService, sessionId, key).catch(() => {});
                    },
                    children: [
                      React.createElement("span", { className: styles.resultText }, m.text === "" ? t("noText") : m.text),
                      React.createElement("span", { className: styles.resultTime }, timeText(m.time))
                    ]
                  }
                );
              })
            )
          ]
        }
      ) : null;

      const markers = messages.length > MAX_VISIBLE_MARKS
        ? React.createElement(
            "div",
            { key: "scroll", className: styles.scroll, ref: scrollRef },
            messages.map((m, i) => renderMarker(m, i, true))
          )
        : messages.map((m, i) => renderMarker(m, i, false));

      const tipBox = tip === null ? null : React.createElement(
        "div",
        {
          key: "tip",
          className: styles.tip,
          style: { top: tip.top, transform: "translateY(-50%)" },
          onMouseEnter: () => { cancelHide(); cancelTipClear(); },
          onMouseLeave: () => { clearTipSoon(); scheduleHide(); }
        },
        tip.text,
        tip.time === "" ? null : React.createElement("span", { className: styles.tipTime }, tip.time)
      );

      return ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className: styles.rail + (visible ? " " + styles.show : ""),
            ref: railRef,
            role: "navigation",
            "aria-label": t("railLabel"),
            onMouseEnter: cancelHide,
            onMouseLeave: scheduleHide
          },
          searchButton,
          searchBox,
          markers,
          tipBox
        ),
        document.body
      );
    }

    // ---------------------------------------------------------------- locale
    const NS = "turn-rail";
    const inject = ["slots", "locale", "sessions"];
    const zh = {
      "railLabel": "对话轮次导航",
      "roleUser": "用户",
      "noText": "（无文本内容）",
      "searchLabel": "搜索消息",
      "searchPlaceholder": "搜索本会话消息...",
      "noResults": "无匹配消息"
    };
    const en = {
      "railLabel": "Conversation turn rail",
      "roleUser": "User",
      "noText": "(no text)",
      "searchLabel": "Search messages",
      "searchPlaceholder": "Search this conversation...",
      "noResults": "No matching messages"
    };

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "turn-rail:locale");
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "turn-rail",
        order: 40,
        locale: NS,
        inject: () => ({ sessionsService: ctx.sessions })
      }, TurnRail));
    }

    exports.TurnRail = TurnRail;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
