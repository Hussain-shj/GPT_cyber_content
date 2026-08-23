/* Personal LinkedIn connection and publishing */
(() => {
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);

  async function data(response) {
    const raw = await response.text();
    let body = {};
    if (raw) { try { body = JSON.parse(raw); } catch { throw new Error(`استجابة غير صالحة (HTTP ${response.status})`); } }
    if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
    return body;
  }

  function init() {
    if (byId("linkedin")) return;
    const tabs = document.querySelector(".tabs"), wrap = document.querySelector(".wrap");
    if (!tabs || !wrap) return;
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.dataset.view = "linkedin";
    tab.textContent = "LinkedIn";
    tabs.insertBefore(tab, tabs.querySelector('[data-view="archive"]'));
    const section = document.createElement("section");
    section.id = "linkedin";
    section.className = "card hidden li-section";
    section.innerHTML = `<div class="section-title"><div><h2>LinkedIn الشخصي</h2><p>اربط حسابك مرة واحدة، ثم انشر المحتوى والصورة مباشرة بعد المعاينة.</p></div><span class="counter">OAuth 2.0</span></div><div id="liStatus" class="li-status">جاري التحقق من الاتصال...</div><div class="row"><a id="liConnect" class="action" href="/auth/linkedin/start">ربط حساب LinkedIn</a><button id="liDisconnect" class="action danger hidden">فصل الحساب</button></div><p class="li-note">لن يتم النشر تلقائيًا. كل عملية نشر تتطلب ضغط زر «نشر على LinkedIn» بعد مراجعة النص والصورة.</p>`;
    wrap.appendChild(section);
    const style = document.createElement("style");
    style.textContent = `.li-section{max-width:820px;margin:0 auto}.li-section h2{margin:0}.li-section p{color:#9eb2c9}.li-status{margin:18px 0;padding:14px;border:1px solid #294760;border-radius:12px;background:#081827}.li-status.connected{border-color:#1bd3cf;color:#77f2ee}.li-note{font-size:.92rem}.li-publish-modal{position:fixed;inset:0;z-index:9999;background:#020914d9;display:flex;align-items:center;justify-content:center;padding:18px}.li-publish-card{width:min(620px,100%);max-height:90vh;overflow:auto;background:#0d1a2b;border:1px solid #294760;border-radius:18px;padding:18px;direction:rtl}.li-publish-card textarea{min-height:220px;line-height:1.75}.li-publish-preview{display:block;width:min(260px,100%);max-height:330px;object-fit:contain;margin:12px auto;border-radius:12px;background:#06101d}.li-result a{color:#77f2ee}`;
    document.head.appendChild(style);
    tab.onclick = () => show(tab, section);
    document.querySelectorAll('.tab:not([data-view="linkedin"])').forEach((button) => button.addEventListener("click", () => section.classList.add("hidden")));
    byId("liDisconnect").onclick = disconnect;
    if (location.hash.startsWith("#linkedin")) tab.click();
    refreshStatus();
  }

  function show(tab, section) {
    ["studio", "archive", "news", "visual-alert-editor"].forEach((id) => byId(id)?.classList.add("hidden"));
    section.classList.remove("hidden");
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button === tab));
    history.replaceState(null, "", "#linkedin");
  }

  async function refreshStatus() {
    try {
      const status = await data(await fetch("/api/linkedin/status"));
      const box = byId("liStatus");
      if (!status.configured) {
        box.textContent = "أضف متغيرات LinkedIn الثلاثة في Railway ثم أعد النشر.";
        byId("liConnect").classList.add("hidden");
        return status;
      }
      if (status.connected) {
        box.className = "li-status connected";
        box.textContent = `✓ متصل بالحساب: ${status.member_name || "LinkedIn"}`;
        byId("liConnect").classList.add("hidden");
        byId("liDisconnect").classList.remove("hidden");
      } else {
        box.className = "li-status";
        box.textContent = "الحساب غير متصل أو انتهت صلاحية التفويض.";
        byId("liConnect").classList.remove("hidden");
        byId("liDisconnect").classList.add("hidden");
      }
      return status;
    } catch (error) {
      if (byId("liStatus")) byId("liStatus").textContent = `تعذر قراءة الاتصال: ${error.message}`;
      return {connected:false};
    }
  }

  async function disconnect() {
    if (!confirm("فصل حساب LinkedIn من الموقع؟")) return;
    try { await data(await fetch("/api/linkedin/disconnect", {method:"POST"})); await refreshStatus(); }
    catch (error) { alert(error.message); }
  }

  function splitDataUrl(dataUrl) {
    const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png));base64,(.+)$/s);
    return match ? {mime:match[1], b64:match[2]} : {mime:"image/jpeg", b64:""};
  }

  async function publish(text, imageDataUrl = "") {
    const status = await refreshStatus();
    if (!status.connected) {
      alert("اربط حساب LinkedIn أولًا من تبويب LinkedIn.");
      document.querySelector('[data-view="linkedin"]')?.click();
      return;
    }
    const modal = document.createElement("div");
    modal.className = "li-publish-modal";
    modal.innerHTML = `<div class="li-publish-card"><div class="section-title"><h3>معاينة منشور LinkedIn</h3><button class="copy-btn" data-li-close>إغلاق</button></div>${imageDataUrl ? `<img class="li-publish-preview" src="${esc(imageDataUrl)}" alt="الصورة التي ستُنشر">` : '<p>سيتم نشر النص بدون صورة.</p>'}<label>النص القابل للتعديل <span id="liCharacterCount" class="counter"></span></label><textarea id="liPublishText"></textarea><div class="row"><button class="action" id="liPublishConfirm">نشر الآن</button><button class="action secondary" data-li-close>إلغاء</button></div><div id="liPublishStatus" class="status li-result"></div></div>`;
    document.body.appendChild(modal);
    const field = byId("liPublishText");
    field.value = String(text || "");
    const updateCount = () => {
      const length = field.value.length;
      byId("liCharacterCount").textContent = `${length} / 3000`;
      byId("liCharacterCount").style.color = length > 3000 ? "#ff7777" : "";
      if (length > 3000) byId("liPublishStatus").textContent = `النص يتجاوز حد LinkedIn بمقدار ${length - 3000} حرفًا. اختصره من المعاينة قبل النشر.`;
      else if (byId("liPublishStatus").textContent.startsWith("النص يتجاوز حد LinkedIn")) byId("liPublishStatus").textContent = "";
    };
    field.addEventListener("input", updateCount);
    updateCount();
    modal.querySelectorAll("[data-li-close]").forEach((button) => button.onclick = () => modal.remove());
    byId("liPublishConfirm").onclick = async () => {
      const button = byId("liPublishConfirm"), content = byId("liPublishText").value.trim();
      if (!content) return byId("liPublishStatus").textContent = "النص مطلوب.";
      if (content.length > 3000) return byId("liPublishStatus").textContent = `النص يتجاوز حد LinkedIn بمقدار ${content.length - 3000} حرفًا. اختصره قبل النشر.`;
      button.disabled = true; byId("liPublishStatus").textContent = "جاري رفع الصورة ونشر المحتوى...";
      try {
        const image = splitDataUrl(imageDataUrl);
        const result = await data(await fetch("/api/linkedin/publish", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:content,image_b64:image.b64,image_mime_type:image.mime})}));
        byId("liPublishStatus").innerHTML = `تم النشر بنجاح. <a href="${esc(result.post_url)}" target="_blank" rel="noopener">فتح المنشور</a>`;
        button.textContent = "✓ تم النشر";
      } catch (error) { button.disabled = false; byId("liPublishStatus").textContent = `خطأ: ${error.message}`; }
    };
  }

  window.cyberPulseLinkedIn = {publish, refreshStatus};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
