// Settings page. No inline scripts (MV3 CSP).

import { DEFAULT_THRESHOLD, getSettings, isAllowedRelayUrl } from "./settings";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

function flash(text: string, ok = true) {
  const status = $<HTMLParagraphElement>("status");
  status.textContent = text;
  status.style.color = ok ? "#27ae60" : "#c0392b";
  setTimeout(() => { status.textContent = ""; }, 2500);
}

document.addEventListener("DOMContentLoaded", async () => {
  const s = await getSettings();
  $("gmail-token").value = s.gmailToken;
  $("linear-token").value = s.linearToken;
  $("jira-token").value = s.jiraToken;
  $("jira-domain").value = s.jiraDomain;
  $("relay-url").value = s.relayUrl;
  $("relay-secret").value = s.relaySecret;
  $("threshold").value = String(s.threshold);
  $<HTMLElement>("threshold-out").textContent = String(s.threshold);
  $("src-gmail").checked = s.sources.gmail;
  $("src-linear").checked = s.sources.linear;
  $("src-jira").checked = s.sources.jira;
  $("src-relay").checked = s.sources.relay;

  $("threshold").addEventListener("input", () => {
    $<HTMLElement>("threshold-out").textContent = $("threshold").value;
  });

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const relayUrl = $("relay-url").value.trim().replace(/\/+$/, "");
    if (relayUrl && !isAllowedRelayUrl(relayUrl)) {
      flash("Relay URL must be https (or http://localhost).", false);
      return;
    }
    await chrome.storage.local.set({
      gmailToken: $("gmail-token").value.trim(),
      linearToken: $("linear-token").value.trim(),
      jiraToken: $("jira-token").value.trim(),
      jiraDomain: $("jira-domain").value.trim(),
      relayUrl,
      relaySecret: $("relay-secret").value.trim(),
      threshold: Number.parseInt($("threshold").value, 10) || DEFAULT_THRESHOLD,
      sources: {
        gmail: $("src-gmail").checked,
        linear: $("src-linear").checked,
        jira: $("src-jira").checked,
        relay: $("src-relay").checked,
      },
    });
    flash("Saved.");
  });

  $<HTMLButtonElement>("test").addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "POLL_NOW" });
    flash("Polling now…");
  });
});
