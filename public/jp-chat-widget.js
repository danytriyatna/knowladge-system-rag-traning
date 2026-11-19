(function () {
  const WIDGET_VERSION = "20261118_callout2";
  if (window.__JP_CHAT_WIDGET_LOADED__ === WIDGET_VERSION) return;
  if (typeof window.__JP_CHAT_WIDGET_CLEANUP__ === "function") {
    try {
      window.__JP_CHAT_WIDGET_CLEANUP__();
    } catch (_e) {
      // abaikan error pembersihan versi lama
    }
  }
  document
    .querySelectorAll(".jp-widget-fab, .jp-widget-window, .jp-widget-callout, #jp-widget-styles")
    .forEach((el) => el.remove());
  window.__JP_CHAT_WIDGET_LOADED__ = WIDGET_VERSION;

  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_ENDPOINT =
    (currentScript && currentScript.getAttribute("data-endpoint")) ||
    (window.location.port === "3001" ? "/api/widget/chat" : "http://localhost:3001/api/widget/chat");

  const SCRIPT_SRC = currentScript && currentScript.src ? currentScript.src : "";
  const LOGO_URL = SCRIPT_SRC
    ? new URL("jp-insight-logo.png?v=20261115_v2_gold_ring", SCRIPT_SRC).href
    : "/jp-insight-logo.png?v=20261115_v2_gold_ring";

  // Injeksi CSS Khusus (Scattered & Scoped agar tidak tabrakan dengan CSS OJS / Bootstrap / Tailwind)
  const style = document.createElement("style");
  style.id = "jp-widget-styles";
  style.textContent = `
    .jp-widget-fab {
      position: fixed;
      bottom: 20px;
      right: 24px;
      z-index: 999999;
      background: transparent !important;
      color: #ffffff;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      outline: none !important;
      box-shadow: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .jp-widget-fab:hover,
    .jp-widget-fab:focus-visible {
      transform: translateY(-3px) scale(1.06);
      background: transparent !important;
      box-shadow: none !important;
    }
    .jp-widget-fab-logo {
      width: 82px;
      height: 82px;
      border-radius: 9999px;
      object-fit: cover;
      background: transparent;
      display: block;
      flex-shrink: 0;
      filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.38));
    }
    .jp-widget-fab-label {
      font-size: 13.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      line-height: 1.15;
      color: #ffffff;
      white-space: nowrap;
      paint-order: stroke fill;
      -webkit-text-stroke: 4px #081A36;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
    }
    .jp-widget-fab.jp-widget-fab-hidden {
      display: none !important;
    }
    .jp-widget-callout {
      position: fixed;
      bottom: 132px;
      right: 24px;
      z-index: 999998;
      width: max-content;
      max-width: min(268px, calc(100vw - 32px));
      background: #ffffff;
      color: #1C1917;
      border: 1px solid #C7D8EE;
      border-radius: 16px;
      border-bottom-right-radius: 4px;
      padding: 12px 15px;
      box-shadow: 0 10px 26px rgba(15, 44, 89, 0.16);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: none;
      cursor: pointer;
      animation: jpWidgetFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .jp-widget-callout.is-visible {
      display: block;
    }
    .jp-widget-callout:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(15, 44, 89, 0.22);
    }
    .jp-widget-callout-close {
      position: absolute !important;
      top: -7px !important;
      right: -7px !important;
      width: 22px !important;
      height: 22px !important;
      border-radius: 9999px !important;
      border: 1px solid #D9E1EC !important;
      background: #ffffff !important;
      color: #64748B !important;
      padding: 0 !important;
      margin: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1) !important;
      line-height: 1 !important;
    }
    .jp-widget-callout-close svg {
      width: 12px;
      height: 12px;
      display: block;
      pointer-events: none;
    }
    .jp-widget-callout-close:hover {
      color: #123B72 !important;
      background: #EEF4FC !important;
    }
    .jp-widget-callout-title {
      margin: 0 0 3px 0;
      font-size: 13.5px;
      font-weight: 700;
      line-height: 1.3;
      color: #0B254B;
    }
    .jp-widget-callout-desc {
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      color: #475569;
    }
    .jp-widget-header-logo {
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      object-fit: cover;
      background: #ffffff;
      display: block;
      flex-shrink: 0;
    }
    .jp-widget-window {
      position: fixed;
      bottom: 132px;
      right: 24px;
      width: 380px;
      height: 540px;
      max-height: calc(100vh - 156px);
      max-width: calc(100vw - 32px);
      z-index: 999999;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
      display: none;
      margin: 0;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: jpWidgetFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease;
    }
    .jp-widget-window.is-open {
      display: flex;
    }
    .jp-widget-window.is-minimized {
      width: 320px;
      max-width: calc(100vw - 32px);
      height: auto;
      max-height: none;
      bottom: 24px;
      right: 24px;
      border-radius: 12px;
    }
    .jp-widget-window.is-minimized .jp-widget-header {
      cursor: pointer;
      border-bottom: none;
    }
    .jp-widget-window.is-minimized .jp-widget-body,
    .jp-widget-window.is-minimized .jp-widget-footer {
      display: none;
    }
    .jp-widget-window.is-maximized {
      top: 12px;
      right: 12px;
      bottom: 12px;
      left: 12px;
      width: calc(100vw - 24px);
      height: calc(100vh - 24px);
      max-width: none;
      max-height: none;
      border-radius: 14px;
    }
    @keyframes jpWidgetFadeIn {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .jp-widget-header {
      background: linear-gradient(135deg, #0E3161 0%, #081A36 100%);
      color: #ffffff;
      padding: 12px 14px 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 2px solid #F2C94C;
      flex-shrink: 0;
    }
    .jp-widget-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .jp-widget-header-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .jp-widget-header-sub {
      font-size: 11px;
      color: #DBEAFE;
      font-weight: normal;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .jp-widget-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .jp-widget-header-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      padding: 0 !important;
      margin: 0 !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 7px !important;
      color: #DBEAFE !important;
      cursor: pointer !important;
      line-height: 1 !important;
      box-shadow: none !important;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .jp-widget-header-btn:hover {
      background: rgba(255, 255, 255, 0.2) !important;
      border-color: rgba(255, 255, 255, 0.35) !important;
      color: #ffffff !important;
    }
    .jp-widget-header-btn.jp-widget-close:hover {
      background: rgba(239, 68, 68, 0.28) !important;
      border-color: rgba(252, 165, 165, 0.55) !important;
      color: #ffffff !important;
    }
    .jp-widget-header-btn:focus-visible {
      outline: 2px solid #F2C94C !important;
      outline-offset: 1px !important;
    }
    .jp-widget-header-btn svg {
      width: 14px;
      height: 14px;
      display: block;
      pointer-events: none;
    }
    .jp-widget-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #F3F6FA;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
    }
    .jp-widget-window.is-maximized .jp-widget-body {
      padding: 20px 24px;
    }
    .jp-widget-msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      animation: jpWidgetMsgIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .jp-widget-msg-row-bot {
      justify-content: flex-start;
    }
    .jp-widget-msg-row-user {
      justify-content: flex-end;
    }
    @keyframes jpWidgetMsgIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .jp-widget-bot-avatar {
      width: 26px;
      height: 26px;
      border-radius: 9999px;
      object-fit: cover;
      background: #ffffff;
      border: 1px solid #C7D8EE;
      flex-shrink: 0;
      margin-bottom: 18px;
    }
    .jp-widget-msg-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 84%;
      min-width: 0;
    }
    .jp-widget-window.is-maximized .jp-widget-msg-stack {
      max-width: min(76%, 820px);
    }
    .jp-widget-msg {
      max-width: 100%;
      padding: 10px 14px;
      border-radius: 14px;
      line-height: 1.52;
      word-break: break-word;
    }
    .jp-widget-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1F2937;
      border: 1px solid #D9E1EC;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(15, 44, 89, 0.06);
    }
    .jp-widget-msg-user {
      align-self: flex-end;
      background: #123B72;
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .jp-widget-p {
      margin: 0 0 8px 0;
    }
    .jp-widget-p:last-child {
      margin-bottom: 0;
    }
    .jp-widget-list {
      margin: 4px 0 8px 18px;
      padding: 0;
    }
    .jp-widget-list:last-child {
      margin-bottom: 0;
    }
    .jp-widget-list li {
      margin: 2px 0;
    }
    .jp-widget-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11.5px;
      background: #EEF4FC;
      color: #0B254B;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .jp-widget-msg-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px;
      font-size: 10.5px;
      color: #64748B;
    }
    .jp-widget-msg-row-user .jp-widget-msg-meta {
      justify-content: flex-end;
    }
    .jp-widget-copy-btn {
      background: none !important;
      border: none !important;
      padding: 0 2px !important;
      margin: 0 !important;
      font-size: 10.5px !important;
      font-weight: 600 !important;
      color: #475569 !important;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      box-shadow: none !important;
      line-height: 1.2 !important;
    }
    .jp-widget-copy-btn:hover {
      color: #123B72 !important;
    }
    .jp-widget-typing-wrap {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 2px 0;
    }
    .jp-widget-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .jp-widget-dots span {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      background: #123B72;
      opacity: 0.3;
      animation: jpWidgetDotBounce 1.2s infinite ease-in-out;
    }
    .jp-widget-dots span:nth-child(2) {
      animation-delay: 0.18s;
    }
    .jp-widget-dots span:nth-child(3) {
      animation-delay: 0.36s;
    }
    @keyframes jpWidgetDotBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
      30% { transform: translateY(-4px); opacity: 1; }
    }
    .jp-widget-typing-status {
      font-size: 12px;
      color: #475569;
      font-weight: 500;
    }
    .jp-widget-retry-btn {
      margin-top: 8px;
      background: #EEF4FC !important;
      color: #123B72 !important;
      border: 1px solid #C7D8EE !important;
      border-radius: 7px !important;
      padding: 4px 10px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      box-shadow: none !important;
    }
    .jp-widget-retry-btn:hover {
      background: #123B72 !important;
      color: #ffffff !important;
    }
    .jp-widget-sources-wrap {
      animation: jpWidgetMsgIn 0.25s ease;
    }
    .jp-widget-source-card {
      display: block;
      margin-top: 8px;
      padding: 9px 11px;
      background: #F4F7FC;
      border: 1px solid #E1E9F5;
      border-left: 3px solid #123B72;
      border-radius: 8px;
      font-size: 11px;
      color: #4B5563;
      text-decoration: none;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }
    a.jp-widget-source-card {
      cursor: pointer;
    }
    a.jp-widget-source-card:hover {
      background: #EAF1FB;
      border-color: #C7D8EE;
      border-left-color: #EAB308;
      box-shadow: 0 2px 6px rgba(15, 44, 89, 0.08);
      transform: translateY(-1px);
      text-decoration: none;
    }
    a.jp-widget-source-card:hover .jp-widget-source-title {
      color: #123B72;
      text-decoration: underline;
    }
    .jp-widget-source-title {
      font-weight: 600;
      color: #0B254B;
      margin-bottom: 2px;
    }
    .jp-widget-source-meta {
      font-size: 10px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .jp-widget-source-link {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-top: 5px;
      font-size: 10.5px;
      font-weight: 600;
      color: #123B72;
      text-decoration: none;
    }
    a.jp-widget-source-card:hover .jp-widget-source-link {
      text-decoration: underline;
    }
    .jp-widget-quick-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .jp-widget-pill {
      background: #EEF4FC;
      color: #0B254B;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid #C7D8EE;
      transition: all 0.15s;
    }
    .jp-widget-pill:hover {
      background: #123B72;
      color: #ffffff;
      border-color: #123B72;
    }
    .jp-widget-footer {
      padding: 12px;
      background: #ffffff;
      border-top: 1px solid #D9E1EC;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .jp-widget-input {
      flex: 1;
      border: 1px solid #C2CEE0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      font-family: inherit;
      line-height: 1.4;
      min-height: 38px;
      max-height: 96px;
      resize: none;
      overflow-y: auto;
      outline: none;
      transition: border-color 0.15s;
    }
    .jp-widget-input:focus {
      border-color: #123B72;
    }
    .jp-widget-send {
      background: #123B72;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0;
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, opacity 0.15s;
    }
    .jp-widget-send svg {
      width: 17px;
      height: 17px;
      display: block;
      pointer-events: none;
    }
    .jp-widget-send:hover:not(:disabled) {
      background: #0B254B;
    }
    .jp-widget-send:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .jp-widget-window.is-maximized .jp-widget-footer {
      padding: 14px 24px;
    }
    .jp-widget-loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #DBEAFE;
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: jpWidgetSpin 0.7s linear infinite;
    }
    @keyframes jpWidgetSpin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 640px) {
      .jp-widget-window {
        left: 12px;
        right: 12px;
        width: auto;
        max-width: none;
        bottom: 118px;
        height: 480px;
        max-height: calc(100vh - 134px);
      }
      .jp-widget-window.is-minimized {
        left: auto;
        right: 16px;
        bottom: 16px;
        width: min(320px, calc(100vw - 32px));
        height: auto;
      }
      .jp-widget-window.is-maximized {
        top: 8px;
        right: 8px;
        bottom: 8px;
        left: 8px;
        width: calc(100vw - 16px);
        height: calc(100vh - 16px);
        border-radius: 12px;
      }
      .jp-widget-callout {
        bottom: 122px;
        right: 16px;
        max-width: min(252px, calc(100vw - 32px));
      }
    }
  `;
  document.head.appendChild(style);

  const ICON_RESET =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  const ICON_MINIMIZE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  const ICON_MAXIMIZE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  const ICON_RESTORE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>';
  const ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';

  function buildWelcomeHtml() {
    return `
      <div class="jp-widget-msg-row jp-widget-msg-row-bot">
        <img class="jp-widget-bot-avatar" src="${LOGO_URL}" alt="JP-Insight" />
        <div class="jp-widget-msg-stack">
          <div class="jp-widget-msg jp-widget-msg-bot">
            Halo! Saya <strong>JP-Insight</strong>, asisten cerdas <strong>Jurnal Permukiman</strong>. Jawaban dan rujukan bersumber dari artikel terbitan OJS serta informasi resmi Jurnal Permukiman &amp; JP-Insight:
            <div class="jp-widget-quick-prompts">
              <button type="button" class="jp-widget-pill" data-query="Ketahanan gempa bangunan RISHA">Ketahanan Gempa RISHA</button>
              <button type="button" class="jp-widget-pill" data-query="Bagaimana panduan dan ketentuan submit naskah di Jurnal Permukiman?">Panduan Submit Jurnal</button>
              <button type="button" class="jp-widget-pill" data-query="Apa itu JP-Insight dan bagaimana cara kerjanya?">Apa itu JP-Insight?</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Buat Elemen Floating Button
  const fab = document.createElement("button");
  fab.className = "jp-widget-fab";
  fab.setAttribute("aria-label", "JP Insight — Tanya Jurnal Permukiman");
  fab.innerHTML = `
    <img class="jp-widget-fab-logo" src="${LOGO_URL}" alt="Logo JP Insight" />
    <span class="jp-widget-fab-label">JP Insight</span>
  `;
  document.body.appendChild(fab);
  let callout = null;

  function positionFabInRightGutter() {
    const ojsPage = document.querySelector(".pkp_structure_page");
    let rightOffset = "24px";
    if (ojsPage) {
      const rect = ojsPage.getBoundingClientRect();
      const rightGutter = document.documentElement.clientWidth - rect.right;
      const fabW = fab.offsetWidth || 82;
      if (rightGutter >= fabW + 24) {
        rightOffset = Math.round((rightGutter - fabW) / 2) + "px";
      }
    }
    fab.style.right = rightOffset;
    if (callout) {
      callout.style.right = rightOffset;
    }
  }
  positionFabInRightGutter();
  window.addEventListener("resize", positionFabInRightGutter);
  window.addEventListener("load", positionFabInRightGutter);
  requestAnimationFrame(positionFabInRightGutter);

  // Buat Jendela Chat
  const win = document.createElement("div");
  win.className = "jp-widget-window";
  win.innerHTML = `
    <div class="jp-widget-header">
      <div class="jp-widget-header-info">
        <img class="jp-widget-header-logo" src="${LOGO_URL}" alt="JP-Insight" />
        <div style="min-width:0;flex:1;">
          <div class="jp-widget-header-title">
            <span>JP-Insight</span>
          </div>
          <div class="jp-widget-header-sub">Asisten Cerdas Jurnal Permukiman KemenPU</div>
        </div>
      </div>
      <div class="jp-widget-header-actions">
        <button type="button" class="jp-widget-header-btn jp-widget-reset" aria-label="Mulai obrolan baru" title="Obrolan baru">${ICON_RESET}</button>
        <button type="button" class="jp-widget-header-btn jp-widget-minimize" aria-label="Perkecil jendela chat" title="Minimize">${ICON_MINIMIZE}</button>
        <button type="button" class="jp-widget-header-btn jp-widget-maximize" aria-label="Perbesar layar penuh" aria-pressed="false" title="Maximize">${ICON_MAXIMIZE}</button>
        <button type="button" class="jp-widget-header-btn jp-widget-close" aria-label="Tutup" title="Tutup">${ICON_CLOSE}</button>
      </div>
    </div>
    <div class="jp-widget-body" id="jp-widget-body">
      ${buildWelcomeHtml()}
    </div>
    <form class="jp-widget-footer" id="jp-widget-form">
      <textarea rows="1" class="jp-widget-input" id="jp-widget-input" placeholder="Ketik pertanyaan riset atau info jurnal... (Enter kirim, Shift+Enter baris baru)" required></textarea>
      <button type="submit" class="jp-widget-send" id="jp-widget-send" aria-label="Kirim pesan" title="Kirim">${ICON_SEND}</button>
    </form>
  `;
  document.body.appendChild(win);

  // Balon Callout Ajakan di atas Maskot
  const CALLOUT_DISMISS_KEY = "jp_insight_widget_callout_closed_v1";
  callout = document.createElement("div");
  callout.className = "jp-widget-callout";
  callout.setAttribute("role", "dialog");
  callout.setAttribute("aria-label", "Have a research question? Ask JP-Insight");
  callout.innerHTML = `
    <button type="button" class="jp-widget-callout-close" aria-label="Tutup ajakan">${ICON_CLOSE}</button>
    <p class="jp-widget-callout-title">Have a research question?</p>
    <p class="jp-widget-callout-desc">Ask JP-Insight. Answers are drawn from articles published in Jurnal Permukiman.</p>
  `;
  document.body.appendChild(callout);
  if (fab.style.right) {
    callout.style.right = fab.style.right;
  }

  const calloutCloseBtn = callout.querySelector(".jp-widget-callout-close");
  let calloutTimer = null;

  function isCalloutDismissed() {
    const store = getSessionStorageSafe();
    if (!store) return false;
    try {
      return store.getItem(CALLOUT_DISMISS_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function hideCallout() {
    if (calloutTimer) {
      clearTimeout(calloutTimer);
      calloutTimer = null;
    }
    callout.classList.remove("is-visible");
  }

  function dismissCallout() {
    hideCallout();
    const store = getSessionStorageSafe();
    if (!store) return;
    try {
      store.setItem(CALLOUT_DISMISS_KEY, "1");
    } catch (_e) {
      // abaikan error akses storage
    }
  }

  const resetBtn = win.querySelector(".jp-widget-reset");
  const minimizeBtn = win.querySelector(".jp-widget-minimize");
  const maximizeBtn = win.querySelector(".jp-widget-maximize");
  const closeBtn = win.querySelector(".jp-widget-close");
  const headerEl = win.querySelector(".jp-widget-header");
  const bodyEl = document.getElementById("jp-widget-body");
  const formEl = document.getElementById("jp-widget-form");
  const inputEl = document.getElementById("jp-widget-input");
  const sendBtn = document.getElementById("jp-widget-send");

  // State Jendela: Normal / Minimized (bar header) / Maximized (hampir layar penuh)
  const SESSION_STORAGE_KEY = "jp_insight_widget_session_v1";
  const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_SESSION_MESSAGES = 40;

  let isOpen = false;
  let isMinimized = false;
  let isMaximized = false;
  let isBusy = false;
  let activeRequestSeq = 0;
  let revealTimer = null;
  let chatMessages = [];

  function getSessionStorageSafe() {
    try {
      return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
    } catch (_e) {
      return null;
    }
  }

  function saveSession() {
    const store = getSessionStorageSafe();
    if (!store) return;
    try {
      if (chatMessages.length > MAX_SESSION_MESSAGES) {
        chatMessages = chatMessages.slice(-MAX_SESSION_MESSAGES);
      }
      if (chatMessages.length === 0 && !isOpen && !isMinimized && !isMaximized) {
        store.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      store.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          updatedAt: Date.now(),
          windowState: {
            isOpen: Boolean(isOpen),
            isMinimized: Boolean(isMinimized),
            isMaximized: Boolean(isMaximized),
          },
          messages: chatMessages,
        }),
      );
    } catch (_e) {
      // Abaikan jika penyimpanan browser penuh atau diblokir (mode privat)
    }
  }

  function clearSession() {
    chatMessages = [];
    const store = getSessionStorageSafe();
    if (!store) return;
    try {
      store.removeItem(SESSION_STORAGE_KEY);
    } catch (_e) {
      // abaikan error akses storage
    }
  }

  function loadSession() {
    const store = getSessionStorageSafe();
    if (!store) return null;
    try {
      const raw = store.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.updatedAt !== "number" || Date.now() - parsed.updatedAt > SESSION_TTL_MS) {
        store.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      const ws = parsed.windowState && typeof parsed.windowState === "object" ? parsed.windowState : {};
      const validMessages = Array.isArray(parsed.messages)
        ? parsed.messages
            .filter(
              (m) =>
                m &&
                typeof m === "object" &&
                (m.role === "user" || m.role === "bot") &&
                typeof m.text === "string" &&
                m.text.length > 0,
            )
            .slice(-MAX_SESSION_MESSAGES)
            .map((m) => ({
              role: m.role,
              text: m.text,
              time: typeof m.time === "string" ? m.time : "",
              sources: Array.isArray(m.sources) ? m.sources : [],
              retryQuery: typeof m.retryQuery === "string" ? m.retryQuery : "",
            }))
        : [];
      return {
        windowState: {
          isOpen: Boolean(ws.isOpen),
          isMinimized: Boolean(ws.isMinimized),
          isMaximized: Boolean(ws.isMaximized),
        },
        messages: validMessages,
      };
    } catch (_e) {
      return null;
    }
  }

  function renderWindowState(persist = true) {
    win.classList.toggle("is-open", isOpen);
    win.classList.toggle("is-minimized", isOpen && isMinimized);
    win.classList.toggle("is-maximized", isOpen && isMaximized && !isMinimized);
    fab.classList.toggle("jp-widget-fab-hidden", isOpen && (isMinimized || isMaximized));
    if (isOpen) {
      callout.classList.remove("is-visible");
    }

    minimizeBtn.setAttribute(
      "aria-label",
      isMinimized ? "Pulihkan jendela chat" : "Perkecil jendela chat",
    );
    minimizeBtn.setAttribute("title", isMinimized ? "Pulihkan" : "Minimize");
    minimizeBtn.setAttribute("aria-pressed", String(isMinimized));

    const maxActive = isMaximized && !isMinimized;
    maximizeBtn.innerHTML = maxActive ? ICON_RESTORE : ICON_MAXIMIZE;
    maximizeBtn.setAttribute(
      "aria-label",
      maxActive ? "Kembalikan ukuran normal" : "Perbesar layar penuh",
    );
    maximizeBtn.setAttribute("title", maxActive ? "Restore" : "Maximize");
    maximizeBtn.setAttribute("aria-pressed", String(maxActive));

    if (persist) {
      saveSession();
    }
  }

  function autoResizeInput() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight || 38, 96) + "px";
  }

  function setBusyState(busy) {
    isBusy = busy;
    inputEl.disabled = busy;
    sendBtn.disabled = busy;
    sendBtn.innerHTML = busy
      ? '<span class="jp-widget-loading" aria-hidden="true"></span>'
      : ICON_SEND;
    sendBtn.setAttribute("aria-label", busy ? "Mengirim pesan..." : "Kirim pesan");
    sendBtn.setAttribute("title", busy ? "Mengirim..." : "Kirim");
  }

  function resetConversation() {
    activeRequestSeq += 1;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
    setBusyState(false);
    clearSession();
    bodyEl.innerHTML = buildWelcomeHtml();
    bodyEl.scrollTop = 0;
    inputEl.value = "";
    autoResizeInput();
    saveSession();
    if (isOpen && !isMinimized) {
      inputEl.focus();
    }
  }

  function openWidget() {
    hideCallout();
    isOpen = true;
    isMinimized = false;
    renderWindowState();
    inputEl.focus();
  }

  function closeWidget() {
    isOpen = false;
    isMinimized = false;
    isMaximized = false;
    renderWindowState();
  }

  function toggleMinimize() {
    if (!isOpen) return;
    if (isMinimized) {
      isMinimized = false;
    } else {
      isMaximized = false;
      isMinimized = true;
    }
    renderWindowState();
    if (!isMinimized) {
      inputEl.focus();
    }
  }

  function toggleMaximize() {
    if (!isOpen) return;
    if (isMinimized) {
      isMinimized = false;
      isMaximized = true;
    } else {
      isMaximized = !isMaximized;
    }
    renderWindowState();
    inputEl.focus();
  }

  fab.addEventListener("click", function () {
    if (isOpen && !isMinimized) {
      closeWidget();
    } else {
      openWidget();
    }
  });
  callout.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest(".jp-widget-callout-close")) {
      return;
    }
    dismissCallout();
    openWidget();
  });
  if (calloutCloseBtn) {
    calloutCloseBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      dismissCallout();
    });
  }
  resetBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    resetConversation();
  });
  minimizeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMinimize();
  });
  maximizeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMaximize();
  });
  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    closeWidget();
  });
  headerEl.addEventListener("click", function (e) {
    if (isMinimized && !e.target.closest(".jp-widget-header-btn")) {
      isMinimized = false;
      renderWindowState();
      inputEl.focus();
    }
  });
  function onDocumentKeyDown(e) {
    if (e.key === "Escape" && isOpen && isMaximized) {
      isMaximized = false;
      renderWindowState();
    }
  }
  document.addEventListener("keydown", onDocumentKeyDown);

  window.__JP_CHAT_WIDGET_CLEANUP__ = function () {
    if (calloutTimer) clearTimeout(calloutTimer);
    if (revealTimer) clearInterval(revealTimer);
    window.removeEventListener("resize", positionFabInRightGutter);
    window.removeEventListener("load", positionFabInRightGutter);
    document.removeEventListener("keydown", onDocumentKeyDown);
    if (style && style.parentNode) style.parentNode.removeChild(style);
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);
    if (win && win.parentNode) win.parentNode.removeChild(win);
    if (callout && callout.parentNode) callout.parentNode.removeChild(callout);
  };

  inputEl.addEventListener("input", autoResizeInput);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!isBusy && inputEl.value.trim()) {
        if (typeof formEl.requestSubmit === "function") {
          formEl.requestSubmit();
        } else {
          formEl.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      }
    }
  });

  // Handle Quick Prompts & Retry Actions
  win.addEventListener("click", function (e) {
    const pill = e.target && e.target.closest ? e.target.closest(".jp-widget-pill") : null;
    if (pill) {
      if (isBusy) return;
      const q = pill.getAttribute("data-query");
      if (q) {
        inputEl.value = q;
        formEl.dispatchEvent(new Event("submit", { cancelable: true }));
      }
      return;
    }
    const retryBtn = e.target && e.target.closest ? e.target.closest(".jp-widget-retry-btn") : null;
    if (retryBtn && !isBusy) {
      const retryQuery = retryBtn.getAttribute("data-retry-query");
      if (retryQuery) {
        inputEl.value = retryQuery;
        formEl.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  });

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(raw) {
    if (!raw || typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
      return trimmed;
    }
    return "";
  }

  function formatInlineMarkdown(escapedLine) {
    return escapedLine
      .replace(/`([^`]+)`/g, '<code class="jp-widget-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  }

  function formatMarkdownHtml(rawText) {
    const escaped = escapeHtml(rawText);
    const lines = escaped.split(/\r?\n/);
    const chunks = [];
    let listType = null;
    let listItems = [];
    let paraLines = [];

    function flushParagraph() {
      if (paraLines.length === 0) return;
      chunks.push(`<p class="jp-widget-p">${paraLines.map(formatInlineMarkdown).join("<br>")}</p>`);
      paraLines = [];
    }

    function flushList() {
      if (!listType || listItems.length === 0) return;
      chunks.push(
        `<${listType} class="jp-widget-list">${listItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</${listType}>`,
      );
      listType = null;
      listItems = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }
      const ulMatch = line.match(/^[-*•]\s+(.*)$/);
      if (ulMatch) {
        flushParagraph();
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(ulMatch[1]);
        continue;
      }
      const olMatch = line.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        flushParagraph();
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(olMatch[1]);
        continue;
      }
      flushList();
      paraLines.push(rawLine);
    }

    flushParagraph();
    flushList();

    return chunks.join("") || '<p class="jp-widget-p"></p>';
  }

  function formatTimeNow() {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
    } catch (_e) {
      return "";
    }
  }

  function formatAuthors(raw) {
    if (!raw) return "";
    if (Array.isArray(raw)) return raw.join(", ");
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch (_e) {
      // ignore non-JSON string
    }
    return String(raw);
  }

  function cleanSourceSnippet(raw) {
    const text = String(raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/^\s*#{1,6}\s+/gm, "")
      .replace(/\s+#{1,6}\s+/g, " ")
      .replace(/^\s*[-*•]\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return text;
  }

  function dedupeSources(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return [];
    const result = [];
    const indexByKey = new Map();

    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (!s || typeof s !== "object") continue;
      const docId = typeof s.document_id === "string" ? s.document_id.trim() : "";
      const sourceUrl = typeof s.source_url === "string" ? s.source_url.trim() : "";
      const articleUrl = typeof s.article_url === "string" ? s.article_url.trim() : "";
      const title = typeof s.title === "string" ? s.title.trim().toLowerCase() : "";
      const filename = typeof s.filename === "string" ? s.filename.trim().toLowerCase() : "";
      const key = docId
        ? `doc:${docId}`
        : sourceUrl
          ? `url:${sourceUrl}`
          : articleUrl
            ? `url:${articleUrl}`
            : title
              ? `title:${title}`
              : filename
                ? `file:${filename}`
                : `idx:${i}`;

      const existingIdx = indexByKey.get(key);
      if (existingIdx === undefined) {
        indexByKey.set(key, result.length);
        result.push(s);
        continue;
      }

      const existing = result[existingIdx];
      const candSim = typeof s.similarity === "number" ? s.similarity : -1;
      const existSim = typeof existing.similarity === "number" ? existing.similarity : -1;
      const candChunk = typeof s.chunk_index === "number" ? s.chunk_index : Number.MAX_SAFE_INTEGER;
      const existChunk = typeof existing.chunk_index === "number" ? existing.chunk_index : Number.MAX_SAFE_INTEGER;
      if (candSim > existSim || (candSim === existSim && candChunk < existChunk)) {
        result[existingIdx] = s;
      }
    }

    return result;
  }

  function buildSourcesBox(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return null;

    const topSources = dedupeSources(sources).slice(0, 4);
    if (topSources.length === 0) return null;
    const hasPortalOrInfo = topSources.some(
      (s) => s && (s.source === "ojs_portal" || s.source === "jp_insight_info"),
    );
    const sectionHeading = hasPortalOrInfo
      ? "Referensi Sumber Resmi:"
      : "Referensi Jurnal Terbit OJS:";

    const srcBox = document.createElement("div");
    srcBox.className = "jp-widget-sources-wrap";
    srcBox.innerHTML = `<div style="font-weight:700;margin-top:10px;font-size:11px;color:#8C2806;">${sectionHeading}</div>`;
    function resolveSourceUrl(s) {
      let raw = s.source_url || s.article_url || "";
      let widgetOrigin = "";
      try {
        widgetOrigin = new URL(API_ENDPOINT, win.location.href).origin;
      } catch (_e) {
        widgetOrigin = "";
      }
      if (!raw && s.source === "jp_insight_info" && widgetOrigin) {
        raw = `${widgetOrigin}/panduan`;
      } else if (typeof raw === "string" && raw.startsWith("/") && s.source === "jp_insight_info" && widgetOrigin) {
        raw = `${widgetOrigin}${raw}`;
      }
      return safeUrl(raw);
    }

    topSources.forEach((s, idx) => {
      const isPortal = s.source === "ojs_portal";
      const isInfo = s.source === "jp_insight_info";
      const fallbackTitle = isInfo
        ? "Dokumentasi Resmi JP-Insight"
        : isPortal
          ? "Portal Resmi Jurnal Permukiman"
          : "Artikel Jurnal Permukiman";
      const displayTitle = escapeHtml(s.title || s.filename || fallbackTitle);

      let metaLine = "";
      if (isInfo) {
        metaLine = "Dokumentasi Resmi JP-Insight";
      } else if (isPortal) {
        metaLine = "Halaman Resmi Portal Jurnal Permukiman";
      } else {
        const authors = formatAuthors(s.authors);
        const volParts = [
          s.volume ? `Vol. ${s.volume}` : "",
          s.issue_number ? `No. ${s.issue_number}` : "",
          s.published_year ? `(${s.published_year})` : "",
        ].filter(Boolean).join(" ");
        metaLine = [authors ? escapeHtml(authors) : "", escapeHtml(volParts), s.doi ? `DOI: ${escapeHtml(s.doi)}` : ""]
          .filter(Boolean)
          .join(" · ");
      }

      const targetUrl = resolveSourceUrl(s);
      const linkLabel = isInfo
        ? "Buka Panduan JP-Insight &#8599;"
        : isPortal
          ? "Buka Halaman Resmi &#8599;"
          : "Baca Artikel OJS &#8599;";
      const sc = document.createElement(targetUrl ? "a" : "div");
      sc.className = "jp-widget-source-card";
      if (targetUrl) {
        sc.href = targetUrl;
        sc.target = "_blank";
        sc.rel = "noopener noreferrer";
      }
      const ctaHtml = targetUrl
        ? `<div class="jp-widget-source-link">${linkLabel}</div>`
        : "";
      const cleanedSnippet = cleanSourceSnippet(s.snippet);
      sc.innerHTML = `
        <div class="jp-widget-source-title">[${idx + 1}] ${displayTitle}</div>
        ${metaLine ? `<div class="jp-widget-source-meta">${metaLine}</div>` : ""}
        ${cleanedSnippet ? `<div>${escapeHtml(cleanedSnippet)}</div>` : ""}
        ${ctaHtml}
      `;
      srcBox.appendChild(sc);
    });

    return srcBox;
  }

  function attachCopyAction(metaEl, plainText) {
    if (!metaEl || !plainText) return;
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "jp-widget-copy-btn";
    copyBtn.textContent = "Salin";
    copyBtn.addEventListener("click", function () {
      const done = () => {
        copyBtn.textContent = "Tersalin!";
        setTimeout(() => {
          copyBtn.textContent = "Salin";
        }, 1500);
      };
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(done).catch(() => {});
      }
    });
    metaEl.appendChild(copyBtn);
  }

  function appendUserMessage(text, options) {
    const timeText = options && options.time ? options.time : formatTimeNow();
    const row = document.createElement("div");
    row.className = "jp-widget-msg-row jp-widget-msg-row-user";

    const stack = document.createElement("div");
    stack.className = "jp-widget-msg-stack";

    const bubble = document.createElement("div");
    bubble.className = "jp-widget-msg jp-widget-msg-user";
    bubble.innerHTML = escapeHtml(text).replace(/\r?\n/g, "<br>");

    const meta = document.createElement("div");
    meta.className = "jp-widget-msg-meta";
    meta.textContent = timeText;

    stack.appendChild(bubble);
    stack.appendChild(meta);
    row.appendChild(stack);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    if (!options || !options.skipPersist) {
      chatMessages.push({ role: "user", text: String(text || ""), time: timeText });
      saveSession();
    }
  }

  function populateBotExtras(bubbleEl, metaEl, cleanText, sources, retryQuery, timeText) {
    const srcBox = buildSourcesBox(sources);
    if (srcBox) bubbleEl.appendChild(srcBox);

    if (retryQuery) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "jp-widget-retry-btn";
      retryBtn.setAttribute("data-retry-query", retryQuery);
      retryBtn.textContent = "Coba Lagi";
      bubbleEl.appendChild(retryBtn);
    }

    metaEl.textContent = "";
    if (timeText) {
      const timeSpan = document.createElement("span");
      timeSpan.textContent = timeText;
      metaEl.appendChild(timeSpan);
    }
    if (!retryQuery) {
      attachCopyAction(metaEl, cleanText);
    }
  }

  function appendBotStaticMessage(entry) {
    const row = document.createElement("div");
    row.className = "jp-widget-msg-row jp-widget-msg-row-bot";

    const avatar = document.createElement("img");
    avatar.className = "jp-widget-bot-avatar";
    avatar.src = LOGO_URL;
    avatar.alt = "JP-Insight";

    const stack = document.createElement("div");
    stack.className = "jp-widget-msg-stack";

    const bubble = document.createElement("div");
    bubble.className = "jp-widget-msg jp-widget-msg-bot";
    bubble.innerHTML = formatMarkdownHtml(entry.text);

    const meta = document.createElement("div");
    meta.className = "jp-widget-msg-meta";

    populateBotExtras(
      bubble,
      meta,
      entry.text,
      entry.sources,
      entry.retryQuery || "",
      entry.time || "",
    );

    stack.appendChild(bubble);
    stack.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(stack);
    bodyEl.appendChild(row);
  }

  function createBotTypingRow() {
    const row = document.createElement("div");
    row.className = "jp-widget-msg-row jp-widget-msg-row-bot jp-widget-typing-row";

    const avatar = document.createElement("img");
    avatar.className = "jp-widget-bot-avatar";
    avatar.src = LOGO_URL;
    avatar.alt = "JP-Insight";

    const stack = document.createElement("div");
    stack.className = "jp-widget-msg-stack";

    const bubble = document.createElement("div");
    bubble.className = "jp-widget-msg jp-widget-msg-bot";
    bubble.innerHTML = `
      <div class="jp-widget-typing-wrap" role="status" aria-live="polite">
        <span class="jp-widget-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="jp-widget-typing-status">Menelusuri sumber Jurnal Permukiman...</span>
      </div>
    `;

    const meta = document.createElement("div");
    meta.className = "jp-widget-msg-meta";

    stack.appendChild(bubble);
    stack.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(stack);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    const statusEl = bubble.querySelector(".jp-widget-typing-status");
    const phaseTimer = setTimeout(() => {
      if (statusEl) statusEl.textContent = "Menyusun jawaban bersitasi...";
    }, 1500);

    return { row, bubble, meta, phaseTimer };
  }

  function finalizeBotBubble(target, text, sources, reqSeq, options) {
    clearTimeout(target.phaseTimer);
    if (reqSeq !== activeRequestSeq) return;

    const cleanText = String(text || "");
    const retryQuery = options && options.retryQuery ? options.retryQuery : "";
    const timeText = formatTimeNow();
    const dedupedSources = dedupeSources(sources).slice(0, 4);

    chatMessages.push({
      role: "bot",
      text: cleanText,
      sources: dedupedSources,
      retryQuery,
      time: timeText,
    });
    saveSession();

    const renderFinalExtras = () => {
      populateBotExtras(target.bubble, target.meta, cleanText, dedupedSources, retryQuery, timeText);
      setBusyState(false);
      bodyEl.scrollTop = bodyEl.scrollHeight;
      if (isOpen && !isMinimized) {
        inputEl.focus();
      }
    };

    const words = cleanText.match(/\S+\s*/g) || [cleanText];
    if (words.length <= 1 || retryQuery) {
      target.bubble.innerHTML = formatMarkdownHtml(cleanText);
      renderFinalExtras();
      return;
    }

    const step = Math.max(2, Math.ceil(words.length / 45));
    let cursor = 0;
    revealTimer = setInterval(() => {
      if (reqSeq !== activeRequestSeq) {
        clearInterval(revealTimer);
        revealTimer = null;
        return;
      }
      cursor = Math.min(words.length, cursor + step);
      const partial = words.slice(0, cursor).join("");
      target.bubble.innerHTML = formatMarkdownHtml(partial);
      bodyEl.scrollTop = bodyEl.scrollHeight;

      if (cursor >= words.length) {
        clearInterval(revealTimer);
        revealTimer = null;
        target.bubble.innerHTML = formatMarkdownHtml(cleanText);
        renderFinalExtras();
      }
    }, 18);
  }

  function restoreSessionOnBoot() {
    const restored = loadSession();
    if (!restored) return;

    isOpen = restored.windowState.isOpen;
    isMinimized = restored.windowState.isMinimized;
    isMaximized = restored.windowState.isMaximized;

    if (restored.messages.length > 0) {
      chatMessages = restored.messages.slice(-MAX_SESSION_MESSAGES);
      chatMessages.forEach((entry) => {
        if (entry.role === "user") {
          appendUserMessage(entry.text, { time: entry.time, skipPersist: true });
        } else {
          appendBotStaticMessage(entry);
        }
      });
    }

    renderWindowState(false);
    if (isOpen && !isMinimized) {
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }
  }

  restoreSessionOnBoot();

  if (!isOpen && !isCalloutDismissed()) {
    calloutTimer = setTimeout(() => {
      if (!isOpen && !isCalloutDismissed()) {
        callout.classList.add("is-visible");
      }
    }, 900);
  }

  formEl.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isBusy) return;
    const q = inputEl.value.trim();
    if (!q) return;

    const reqSeq = ++activeRequestSeq;
    appendUserMessage(q);
    inputEl.value = "";
    autoResizeInput();
    setBusyState(true);

    const botTarget = createBotTypingRow();

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (!res.ok) {
        finalizeBotBubble(
          botTarget,
          data.error || "Gagal mendapatkan respon dari server JP-Insight.",
          [],
          reqSeq,
          { retryQuery: q },
        );
      } else {
        finalizeBotBubble(botTarget, data.answer, data.sources, reqSeq);
      }
    } catch (_err) {
      finalizeBotBubble(
        botTarget,
        "Tidak dapat terhubung ke server asisten JP-Insight. Pastikan server aktif.",
        [],
        reqSeq,
        { retryQuery: q },
      );
    }
  });
})();
