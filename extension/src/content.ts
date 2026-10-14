// Injected into every page. Draws the cat, the speech bubble and the inbox.
//
// SECURITY: notification titles and snippets come from email subjects, issue
// titles and text messages — anyone can control them. They are only ever
// written with textContent, never innerHTML, and colours come from a fixed map.
// The original version used innerHTML here, which let a crafted email subject
// inject HTML into every page you visit.

import { SOURCE_COLORS } from "../../shared/colors";
import type { ScoredNotification } from "../../shared/types";
import { createCat, type Mood } from "./cat3d";

(() => {
  const ROOT_ID = "__virtual_companion_root__";
  if (document.getElementById(ROOT_ID)) return;

  const SIZE = 120;
  const DRAG_THRESHOLD = 5;
  const SLEEP_AFTER_MS = 20_000;

  let catPos = { x: window.innerWidth - 160, y: window.innerHeight - 160 };
  let inbox: ScoredNotification[] = [];
  let unread = 0;
  let showInbox = false;
  let sleepTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- helpers ----
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = "", text?: string) {
    const node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- root & widget ----
  const root = el("div", `all:initial;position:fixed;z-index:2147483647;pointer-events:none;
    top:0;left:0;width:100vw;height:100vh;font-family:system-ui,sans-serif;`);
  root.id = ROOT_ID;
  document.body.appendChild(root);

  const widget = el("div", `position:absolute;width:${SIZE}px;height:${SIZE}px;pointer-events:all;
    cursor:grab;user-select:none;left:${catPos.x}px;top:${catPos.y}px;`);
  root.appendChild(widget);

  const cat = createCat(SIZE);
  cat.canvas.style.cssText = "border-radius:50%;display:block;";
  widget.appendChild(cat.canvas);

  void chrome.storage.local.get(["catX", "catY"]).then((r: { catX?: number; catY?: number }) => {
    if (typeof r.catX === "number") catPos.x = r.catX;
    if (typeof r.catY === "number") catPos.y = r.catY;
    widget.style.left = `${catPos.x}px`;
    widget.style.top = `${catPos.y}px`;
  });

  // ---- speech bubble ----
  const bubble = el("div", `display:none;position:absolute;bottom:${SIZE + 8}px;left:50%;
    transform:translateX(-50%);background:#fff;border:2px solid #e74c3c;border-radius:10px;
    padding:6px 10px;width:max-content;max-width:200px;font-size:12px;color:#111;line-height:1.4;
    pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.18);`);
  widget.appendChild(bubble);
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  function showBubble(text: string, color: string, ms = 5000) {
    bubble.textContent = text;
    bubble.style.borderColor = color;
    bubble.style.display = "block";
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.style.display = "none"; }, ms);
  }

  // ---- unread badge ----
  const badge = el("div", `display:none;position:absolute;top:-4px;right:-4px;background:#e74c3c;
    color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:600;
    align-items:center;justify-content:center;border:2px solid #fff;pointer-events:none;`);
  widget.appendChild(badge);
  function updateBadge() {
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.style.display = unread > 0 ? "flex" : "none";
  }

  // ---- inbox panel ----
  const panel = el("div", `display:none;position:fixed;bottom:16px;right:16px;width:320px;
    max-height:380px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.22);
    overflow:hidden;flex-direction:column;pointer-events:all;font-family:system-ui,sans-serif;`);
  root.appendChild(panel);

  function badgeStyle(score: number) {
    if (score >= 9) return { bg: "#fdecea", fg: "#c0392b", label: "critical" };
    if (score >= 7) return { bg: "#fff8e1", fg: "#856404", label: "high" };
    if (score >= 5) return { bg: "#e8f4fd", fg: "#1565c0", label: "medium" };
    return { bg: "#f5f5f5", fg: "#757575", label: "low" };
  }

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (!Number.isFinite(mins) || mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    return `${Math.round(mins / 60)}h`;
  }

  function renderInbox() {
    panel.replaceChildren();

    const header = el("div", "padding:10px 14px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;");
    header.appendChild(el("span", "font-size:13px;font-weight:500;color:#111;", "inbox"));
    const close = el("button", "border:none;background:transparent;font-size:15px;cursor:pointer;color:#888;padding:0 4px;", "✕");
    close.addEventListener("click", () => { showInbox = false; panel.style.display = "none"; });
    header.appendChild(close);
    panel.appendChild(header);

    const list = el("div", "overflow-y:auto;flex:1;");
    if (inbox.length === 0) {
      list.appendChild(el("p", "padding:16px 14px;font-size:13px;color:#999;margin:0;", "nothing yet — the cat is watching"));
    }
    for (const n of inbox) {
      const b = badgeStyle(n.importance);
      const row = el("div", "padding:9px 14px;border-bottom:1px solid #f5f5f5;display:flex;gap:10px;align-items:flex-start;");
      row.appendChild(el("div", `width:8px;height:8px;border-radius:50%;background:${SOURCE_COLORS[n.source]};margin-top:4px;flex-shrink:0;`));

      const body = el("div", "flex:1;min-width:0;");
      const top = el("div", "display:flex;align-items:center;gap:6px;margin-bottom:2px;");
      top.appendChild(el("span", "font-size:12px;font-weight:500;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;", n.title));
      top.appendChild(el("span", `font-size:10px;padding:1px 6px;border-radius:8px;background:${b.bg};color:${b.fg};flex-shrink:0;`, b.label));
      body.appendChild(top);
      body.appendChild(el("p", "font-size:12px;color:#666;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", n.snippet));
      if (n.triage.scoredBy === "llm" && n.triage.reason) {
        body.appendChild(el("p", "font-size:11px;color:#999;margin:2px 0 0;font-style:italic;", n.triage.reason));
      }
      row.appendChild(body);
      row.appendChild(el("span", "font-size:11px;color:#bbb;flex-shrink:0;margin-top:2px;", timeAgo(n.receivedAt)));
      list.appendChild(row);
    }
    panel.appendChild(list);
    panel.style.display = "flex";
  }

  // ---- drag vs click ----
  let dragStart: { x: number; y: number; posX: number; posY: number } | null = null;
  let isDragging = false;

  widget.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragStart = { x: e.clientX, y: e.clientY, posX: catPos.x, posY: catPos.y };
    isDragging = false;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDragging = true;
      widget.style.cursor = "grabbing";
    }
    if (isDragging) {
      catPos = {
        x: Math.max(0, Math.min(window.innerWidth - SIZE, dragStart.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - SIZE, dragStart.posY + dy)),
      };
      widget.style.left = `${catPos.x}px`;
      widget.style.top = `${catPos.y}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (!dragStart) return;
    if (!isDragging) {
      showInbox = !showInbox;
      if (showInbox) { unread = 0; updateBadge(); renderInbox(); }
      else panel.style.display = "none";
      resetSleepTimer();
    } else {
      void chrome.storage.local.set({ catX: catPos.x, catY: catPos.y });
    }
    widget.style.cursor = "grab";
    dragStart = null;
    isDragging = false;
  });

  // ---- sleep / wake ----
  function setMood(m: Mood) { cat.setMood(m); }
  function resetSleepTimer() {
    clearTimeout(sleepTimer);
    if (cat.getMood() === "sleep") setMood("idle");
    sleepTimer = setTimeout(() => setMood("sleep"), SLEEP_AFTER_MS);
  }
  resetSleepTimer();

  // ---- notifications from the service worker ----
  chrome.runtime.onMessage.addListener((msg: { type?: string; notifications?: ScoredNotification[] }) => {
    if (msg?.type !== "NEW_NOTIFICATIONS") return;
    const notifs = msg.notifications ?? [];
    inbox = [...notifs, ...inbox].slice(0, 30);
    unread += notifs.length;
    updateBadge();
    resetSleepTimer();

    const top = notifs[0];
    if (top) {
      setMood(top.importance >= 9 ? "alert" : "excited");
      showBubble(top.title, SOURCE_COLORS[top.source]);
      setTimeout(() => setMood("idle"), 3500);
    }
    if (showInbox) renderInbox();
  });
})();
