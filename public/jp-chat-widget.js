(function () {
  if (window.__JP_CHAT_WIDGET_LOADED__) return;
  window.__JP_CHAT_WIDGET_LOADED__ = true;

  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_ENDPOINT =
    (currentScript && currentScript.getAttribute("data-endpoint")) ||
    (window.location.port === "3001" ? "/api/widget/chat" : "http://localhost:3001/api/widget/chat");

  // Injeksi CSS Khusus (Scattered & Scoped agar tidak tabrakan dengan CSS OJS / Bootstrap / Tailwind)
  const style = document.createElement("style");
  style.id = "jp-widget-styles";
  style.textContent = `
    .jp-widget-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #0b2545 0%, #134074 100%);
      color: #ffffff;
      border: 2px solid #e0a96d;
      border-radius: 50px;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(11, 37, 69, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .jp-widget-fab:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 12px 30px rgba(11, 37, 69, 0.45);
      background: linear-gradient(135deg, #134074 0%, #1d4e89 100%);
    }
    .jp-widget-fab svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
    }
    .jp-widget-window {
      position: fixed;
      bottom: 84px;
      right: 24px;
      width: 380px;
      height: 540px;
      max-height: calc(100vh - 110px);
      max-width: calc(100vw - 32px);
      z-index: 999999;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: jpWidgetFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes jpWidgetFadeIn {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .jp-widget-header {
      background: #0b2545;
      color: #ffffff;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e0a96d;
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
      color: #94a3b8;
      font-weight: normal;
    }
    .jp-widget-close {
      background: none;
      border: none;
      color: #cbd5e1;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .jp-widget-close:hover {
      color: #ffffff;
    }
    .jp-widget-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
    }
    .jp-widget-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      word-break: break-word;
    }
    .jp-widget-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .jp-widget-msg-user {
      align-self: flex-end;
      background: #0b2545;
      color: #ffffff;
    }
    .jp-widget-source-card {
      margin-top: 8px;
      padding: 8px 10px;
      background: #f1f5f9;
      border-left: 3px solid #134074;
      border-radius: 6px;
      font-size: 11px;
      color: #475569;
    }
    .jp-widget-source-title {
      font-weight: 600;
      color: #0b2545;
      margin-bottom: 2px;
    }
    .jp-widget-quick-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .jp-widget-pill {
      background: #e2e8f0;
      color: #1e293b;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      transition: all 0.15s;
    }
    .jp-widget-pill:hover {
      background: #0b2545;
      color: #ffffff;
      border-color: #0b2545;
    }
    .jp-widget-footer {
      padding: 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    .jp-widget-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .jp-widget-input:focus {
      border-color: #0b2545;
    }
    .jp-widget-send {
      background: #0b2545;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .jp-widget-send:hover {
      background: #134074;
    }
    .jp-widget-loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #cbd5e1;
      border-top-color: #0b2545;
      border-radius: 50%;
      animation: jpWidgetSpin 0.7s linear infinite;
    }
    @keyframes jpWidgetSpin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Buat Elemen Floating Button
  const fab = document.createElement("button");
  fab.className = "jp-widget-fab";
  fab.setAttribute("aria-label", "Tanya Jurnal Permukiman");
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    <span>Tanya JP</span>
  `;
  document.body.appendChild(fab);

  // Buat Jendela Chat
  const win = document.createElement("div");
  win.className = "jp-widget-window";
  win.innerHTML = `
    <div class="jp-widget-header">
      <div>
        <div class="jp-widget-header-title">
          <span>🏛️ JP-Insight</span>
        </div>
        <div class="jp-widget-header-sub">Asisten Cerdas Jurnal Permukiman KemenPU</div>
      </div>
      <button class="jp-widget-close" aria-label="Tutup">&times;</button>
    </div>
    <div class="jp-widget-body" id="jp-widget-body">
      <div class="jp-widget-msg jp-widget-msg-bot">
        Halo! Saya asisten cerdas <strong>Jurnal Permukiman</strong>. Tanyakan referensi naskah yang sudah terbit, temuan riset terdahulu, atau rujukan standar SNI bidang ke-PU-an:
        <div class="jp-widget-quick-prompts">
          <button class="jp-widget-pill" data-query="SNI ketahanan gempa permukiman">SNI Gempa</button>
          <button class="jp-widget-pill" data-query="Pengolahan air minum lahan gambut">Air Minum Gambut</button>
          <button class="jp-widget-pill" data-query="Pemanfaatan abu terbang beton">Beton Abu Terbang</button>
        </div>
      </div>
    </div>
    <form class="jp-widget-footer" id="jp-widget-form">
      <input type="text" class="jp-widget-input" id="jp-widget-input" placeholder="Ketik pertanyaan riset Anda..." required />
      <button type="submit" class="jp-widget-send" id="jp-widget-send">Kirim</button>
    </form>
  `;
  document.body.appendChild(win);

  // Event Listeners
  let isOpen = false;
  function toggleWidget() {
    isOpen = !isOpen;
    win.style.display = isOpen ? "flex" : "none";
    if (isOpen) {
      document.getElementById("jp-widget-input").focus();
    }
  }

  fab.addEventListener("click", toggleWidget);
  win.querySelector(".jp-widget-close").addEventListener("click", toggleWidget);

  const bodyEl = document.getElementById("jp-widget-body");
  const formEl = document.getElementById("jp-widget-form");
  const inputEl = document.getElementById("jp-widget-input");
  const sendBtn = document.getElementById("jp-widget-send");

  // Handle Quick Prompts
  win.addEventListener("click", function (e) {
    if (e.target.classList.contains("jp-widget-pill")) {
      const q = e.target.getAttribute("data-query");
      if (q) {
        inputEl.value = q;
        formEl.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  });

  function appendMessage(text, role, sources) {
    const div = document.createElement("div");
    div.className = "jp-widget-msg " + (role === "user" ? "jp-widget-msg-user" : "jp-widget-msg-bot");
    
    // Format text with paragraph breaks
    let html = text.replace(/\\n\\n/g, "<br><br>").replace(/\\n/g, "<br>");
    div.innerHTML = html;

    if (sources && sources.length > 0) {
      const srcBox = document.createElement("div");
      srcBox.innerHTML = '<div style="font-weight:600;margin-top:8px;font-size:11px;color:#0b2545;">📚 Rujukan Terbitan Terverifikasi:</div>';
      sources.slice(0, 3).forEach((s) => {
        const sc = document.createElement("div");
        sc.className = "jp-widget-source-card";
        sc.innerHTML = `
          <div class="jp-widget-source-title">📄 ${s.filename} (Bagian ${s.chunk_index + 1})</div>
          <div>${s.snippet || ""}</div>
        `;
        srcBox.appendChild(sc);
      });
      div.appendChild(srcBox);
    }

    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  formEl.addEventListener("submit", async function (e) {
    e.preventDefault();
    const q = inputEl.value.trim();
    if (!q) return;

    appendMessage(q, "user");
    inputEl.value = "";
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="jp-widget-loading"></span>';

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (!res.ok) {
        appendMessage(data.error || "Gagal mendapatkan respon dari server JP-Insight.", "bot");
      } else {
        appendMessage(data.answer, "bot", data.sources);
      }
    } catch (_err) {
      appendMessage("Tidak dapat terhubung ke server asisten JP-Insight. Pastikan server aktif.", "bot");
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "Kirim";
      inputEl.focus();
    }
  });
})();
