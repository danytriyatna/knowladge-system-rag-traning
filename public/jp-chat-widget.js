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
      background: linear-gradient(135deg, #C13D0D 0%, #8C2806 100%);
      color: #ffffff;
      border: 2px solid #F2C94C;
      border-radius: 50px;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(140, 40, 6, 0.32);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .jp-widget-fab:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 12px 30px rgba(140, 40, 6, 0.42);
      background: linear-gradient(135deg, #D04917 0%, #A0320A 100%);
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
      background: linear-gradient(135deg, #B93A0C 0%, #8C2806 100%);
      color: #ffffff;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #F2C94C;
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
      color: #FDE8DF;
      font-weight: normal;
    }
    .jp-widget-close {
      background: none;
      border: none;
      color: #FDE8DF;
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
      background: #F7F5F0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
    }
    .jp-widget-msg {
      max-width: 86%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      word-break: break-word;
    }
    .jp-widget-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1F2937;
      border: 1px solid #E5E0D8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .jp-widget-msg-user {
      align-self: flex-end;
      background: #C13D0D;
      color: #ffffff;
    }
    .jp-widget-source-card {
      margin-top: 8px;
      padding: 8px 10px;
      background: #FAF8F4;
      border-left: 3px solid #C13D0D;
      border-radius: 6px;
      font-size: 11px;
      color: #4B5563;
    }
    .jp-widget-source-title {
      font-weight: 600;
      color: #8C2806;
      margin-bottom: 2px;
    }
    .jp-widget-source-meta {
      font-size: 10px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .jp-widget-source-link {
      display: inline-block;
      margin-top: 4px;
      font-size: 10.5px;
      font-weight: 600;
      color: #C13D0D;
      text-decoration: none;
    }
    .jp-widget-source-link:hover {
      text-decoration: underline;
    }
    .jp-widget-quick-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .jp-widget-pill {
      background: #FAF4EF;
      color: #8C2806;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid #E8CFC4;
      transition: all 0.15s;
    }
    .jp-widget-pill:hover {
      background: #C13D0D;
      color: #ffffff;
      border-color: #C13D0D;
    }
    .jp-widget-footer {
      padding: 12px;
      background: #ffffff;
      border-top: 1px solid #E5E0D8;
      display: flex;
      gap: 8px;
    }
    .jp-widget-input {
      flex: 1;
      border: 1px solid #D6D0C4;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .jp-widget-input:focus {
      border-color: #C13D0D;
    }
    .jp-widget-send {
      background: #C13D0D;
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
      background: #A0320A;
    }
    .jp-widget-loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #FDE8DF;
      border-top-color: #ffffff;
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
        Halo! Saya asisten cerdas <strong>Jurnal Permukiman</strong>. Jawaban dan rujukan hanya bersumber dari artikel jurnal yang telah terbit di OJS:
        <div class="jp-widget-quick-prompts">
          <button class="jp-widget-pill" data-query="Ketahanan gempa bangunan RISHA">Ketahanan Gempa RISHA</button>
          <button class="jp-widget-pill" data-query="Pengolahan air limbah dan air bersih bencana">Air Bersih &amp; Sanitasi</button>
          <button class="jp-widget-pill" data-query="Rumah susun sederhana sewa rusunawa">Rusunawa</button>
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

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function appendMessage(text, role, sources) {
    const div = document.createElement("div");
    div.className = "jp-widget-msg " + (role === "user" ? "jp-widget-msg-user" : "jp-widget-msg-bot");

    const html = escapeHtml(text).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
    div.innerHTML = html;

    if (Array.isArray(sources) && sources.length > 0) {
      const srcBox = document.createElement("div");
      srcBox.innerHTML = '<div style="font-weight:700;margin-top:10px;font-size:11px;color:#8C2806;">Referensi Jurnal Terbit OJS:</div>';
      sources.slice(0, 4).forEach((s, idx) => {
        const sc = document.createElement("div");
        sc.className = "jp-widget-source-card";
        const displayTitle = escapeHtml(s.title || s.filename || "Artikel Jurnal Permukiman");
        const authors = formatAuthors(s.authors);
        const volParts = [
          s.volume ? `Vol. ${s.volume}` : "",
          s.issue_number ? `No. ${s.issue_number}` : "",
          s.published_year ? `(${s.published_year})` : "",
        ].filter(Boolean).join(" ");
        const metaLine = [authors ? escapeHtml(authors) : "", escapeHtml(volParts), s.doi ? `DOI: ${escapeHtml(s.doi)}` : ""]
          .filter(Boolean)
          .join(" · ");
        const linkHtml = s.article_url
          ? `<div><a class="jp-widget-source-link" href="${escapeHtml(s.article_url)}" target="_blank" rel="noopener noreferrer">Baca Artikel OJS &#8599;</a></div>`
          : "";
        sc.innerHTML = `
          <div class="jp-widget-source-title">[${idx + 1}] ${displayTitle}</div>
          ${metaLine ? `<div class="jp-widget-source-meta">${metaLine}</div>` : ""}
          ${s.snippet ? `<div>${escapeHtml(s.snippet)}</div>` : ""}
          ${linkHtml}
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
