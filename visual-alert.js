/* Visual Alert Editor — one-click Arabic short-form video workflow */
(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const byId = (id) => document.getElementById(id);
  let pollTimer = null;

  async function responseData(response) {
    const raw = await response.text();
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch { throw new Error(`استجابة غير صالحة من الخادم (HTTP ${response.status})`); }
  }

  function init() {
    if (byId("visual-alert-editor")) return;
    const tabs = document.querySelector(".tabs");
    const wrap = document.querySelector(".wrap");
    if (!tabs || !wrap) return;
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.dataset.view = "visual-alert-editor";
    tab.textContent = "محرر التنبيهات المرئي";
    tabs.insertBefore(tab, tabs.querySelector('[data-view="archive"]'));

    const section = document.createElement("section");
    section.id = "visual-alert-editor";
    section.className = "card hidden va-section";
    section.innerHTML = `
      <div class="section-title va-title">
        <div><h2>محرر التنبيهات المرئي</h2><p>حوّل التنبيه السيبراني إلى فيديو عربي عمودي أقل من دقيقة بضغطة واحدة.</p></div>
        <span class="counter">Cinematic AI</span>
      </div>
      <div class="va-form">
        <label>عنوان التنبيه</label>
        <input id="vaTitle" maxlength="500" placeholder="مثال: ثغرة أمنية حرجة في Microsoft SharePoint">
        <label>محتوى التنبيه</label>
        <textarea id="vaContent" rows="10" maxlength="12000" placeholder="أدخل تفاصيل التنبيه كما وردت من المصدر"></textarea>
        <label>الإجراء المطلوب</label>
        <textarea id="vaAction" rows="5" maxlength="4000" placeholder="أدخل الإجراءات المطلوب اتخاذها"></textarea>
        <label>النمط البصري</label>
        <select id="vaVisualStyle"><option value="Cinematic AI">Cinematic AI — سينمائي واقعي</option><option value="Auto">تلقائي حسب المحتوى</option><option value="SOC Operations">مركز عمليات SOC</option><option value="Executive GRC">مؤسسي وGRC</option><option value="Cyber Awareness">توعية سيبرانية</option></select>
        <label>توزيع المواد البصرية</label>
        <select id="vaVideoCount"><option value="1">فيديو واحد + 5 صور</option><option value="3">3 فيديوهات + 3 صور</option></select>
        <button id="vaGenerate" class="action va-generate">🎬 إنشاء مواد المعاينة</button>
        <div id="vaStatus" class="status"></div>
        <div id="vaProgressWrap" class="va-progress-wrap hidden"><div class="va-progress"><span id="vaProgressBar"></span></div><div id="vaSteps" class="va-steps"></div></div>
      </div>
      <div id="vaResult" class="va-result"></div>`;
    wrap.appendChild(section);

    const style = document.createElement("style");
    style.textContent = `
      .va-section{max-width:1050px;margin:0 auto}.va-title h2{margin:0}.va-title p{margin:5px 0;color:#9eb2c9}
      .va-form{max-width:820px;margin:18px auto}.va-form textarea{line-height:1.8}.va-generate{display:block;min-width:220px;margin:18px auto 0}
      .va-progress-wrap{max-width:820px;margin:18px auto}.va-progress{height:12px;background:#06101d;border:1px solid #294760;border-radius:20px;overflow:hidden}
      .va-progress span{display:block;width:0;height:100%;background:linear-gradient(90deg,#0a84ff,#1bd3cf);transition:width .45s ease}.va-steps{text-align:center;color:#77f2ee;margin-top:9px}
      .va-result{max-width:820px;margin:20px auto}.va-player{display:block;width:min(100%,390px);aspect-ratio:9/16;margin:0 auto;background:#02070c;border:1px solid #1bd3cf55;border-radius:18px}
      .va-review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.va-review-card{padding:10px;background:#071421;border:1px solid #294760;border-radius:14px}.va-review-card h4{margin:0 0 8px}.va-review-card img,.va-review-card video{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;background:#02070c}.va-audio{width:100%;margin:10px 0 4px}.va-review-note{padding:12px;border-radius:12px;background:#10283a;color:#c8f8f5;text-align:center}
      .va-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:14px}.va-actions a{text-decoration:none}.va-script{margin-top:18px;padding:14px;border:1px solid #294760;border-radius:13px;background:#081827}
      .va-scene{padding:10px 0;border-bottom:1px solid #1b3147}.va-scene:last-child{border-bottom:0}.va-scene b{color:#77f2ee}.va-scene p{margin:5px 0;color:#c6d5e5}
      @media(max-width:640px){.va-section{padding:14px}.va-generate{width:100%}.va-review-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);

    tab.onclick = () => showSection(tab, section);
    document.querySelectorAll('.tab:not([data-view="visual-alert-editor"])').forEach((button) => button.addEventListener("click", () => section.classList.add("hidden")));
    byId("vaGenerate").onclick = generate;
    if (location.hash === "#visual-alert-editor") tab.click();
  }

  function showSection(tab, section) {
    ["studio", "archive", "news"].forEach((id) => byId(id)?.classList.add("hidden"));
    section.classList.remove("hidden");
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button === tab));
    history.replaceState(null, "", "#visual-alert-editor");
  }

  function validate() {
    if (!byId("vaTitle").value.trim()) return "يرجى إدخال عنوان التنبيه.";
    if (!byId("vaContent").value.trim()) return "يرجى إدخال محتوى التنبيه.";
    if (!byId("vaAction").value.trim()) return "يرجى إدخال الإجراء المطلوب.";
    return "";
  }

  async function generate() {
    const error = validate();
    if (error) return byId("vaStatus").textContent = error;
    clearTimeout(pollTimer);
    byId("vaGenerate").disabled = true;
    byId("vaResult").innerHTML = "";
    byId("vaProgressWrap").classList.remove("hidden");
    updateProgress(3, "بدء المهمة...");
    try {
      const response = await fetch("/api/visual-alert/render", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:byId("vaTitle").value.trim(), content:byId("vaContent").value.trim(), required_action:byId("vaAction").value.trim(), visual_style:byId("vaVisualStyle").value, video_count:Number(byId("vaVideoCount").value)})});
      const job = await responseData(response);
      if (!response.ok) throw new Error(job.detail || "تعذر بدء إنشاء الفيديو");
      poll(job.id);
    } catch (err) {
      fail(err.message);
    }
  }

  function updateProgress(progress, message) {
    byId("vaProgressBar").style.width = `${Math.max(0, Math.min(100, progress || 0))}%`;
    byId("vaSteps").textContent = message || "جاري المعالجة...";
    byId("vaStatus").textContent = message || "";
  }

  async function poll(jobId) {
    try {
      const response = await fetch(`/api/visual-alert/status/${encodeURIComponent(jobId)}`);
      const job = await responseData(response);
      if (!response.ok) throw new Error(job.detail || "تعذر قراءة حالة الفيديو");
      updateProgress(job.progress, job.message);
      if (job.status === "failed") throw new Error(job.detail || job.message || "تعذر إنشاء الفيديو");
      if (job.status === "ready_for_review") return showReview(jobId, job);
      if (job.status === "completed") return showResult(jobId, job.script || {});
      pollTimer = setTimeout(() => poll(jobId), 2500);
    } catch (err) { fail(err.message); }
  }

  function showReview(jobId, job) {
    byId("vaGenerate").disabled = false;
    const videos = job.clip_count ? Array.from({length:job.clip_count}, (_,i) => i+1).map((n) => `<div class="va-review-card"><h4>الفيديو ${n}</h4><video controls playsinline preload="metadata" src="/api/visual-alert/preview-video/${encodeURIComponent(jobId)}/${n}"></video></div>`).join("") : `<div class="va-review-card"><h4>لقطات الفيديو</h4><p>لم تتوفر بسبب حد Veo اليومي. تم التعويض بصور إضافية.</p></div>`;
    const images = Array.from({length:job.image_count || 0}, (_,i) => i+1).map((n) => `<div class="va-review-card"><h4>الصورة ${n}</h4><img src="/api/visual-alert/preview-image/${encodeURIComponent(jobId)}/${n}" alt="معاينة الصورة ${n}"></div>`).join("");
    const scenes = ((job.script || {}).scenes || []).map((scene) => `<div class="va-scene"><b>${esc(scene.onScreenText)}</b><p>${esc(scene.voiceText)}</p><p lang="en" dir="ltr">${esc(scene.subtitleEnglish)}</p></div>`).join("");
    byId("vaResult").innerHTML = `<div class="va-review-note">راجع ${job.clip_count || 0} فيديو و${job.image_count || 0} صور والتعليق الصوتي. لن يتم الدمج قبل موافقتك.</div><div class="va-review-grid">${videos}${images}</div><div class="va-review-card"><h4>التعليق الصوتي العربي</h4><audio class="va-audio" controls preload="metadata" src="/api/visual-alert/preview-audio/${encodeURIComponent(jobId)}"></audio></div><div class="va-actions"><button id="vaApprove" class="action">✅ موافقة ودمج الفيديو</button><button id="vaReject" class="action secondary">إعادة إنشاء المواد</button></div>${scenes ? `<details class="va-script"><summary>مراجعة النص والترجمة</summary>${scenes}</details>` : ""}`;
    byId("vaApprove").onclick = async () => {
      byId("vaApprove").disabled = true; byId("vaReject").disabled = true;
      try {
        const response = await fetch(`/api/visual-alert/approve/${encodeURIComponent(jobId)}`, {method:"POST"});
        const data = await responseData(response);
        if (!response.ok) throw new Error(data.detail || "تعذر اعتماد المواد");
        updateProgress(80, "تمت الموافقة؛ جاري دمج الفيديو..."); poll(jobId);
      } catch (err) { fail(err.message); }
    };
    byId("vaReject").onclick = generate;
  }

  function showResult(jobId, script) {
    byId("vaGenerate").disabled = false;
    const url = `/api/visual-alert/video/${encodeURIComponent(jobId)}`;
    const scenes = (script.scenes || []).map((scene) => `<div class="va-scene"><b>${esc(scene.onScreenText)}</b><p>${esc(scene.voiceText)}</p></div>`).join("");
    byId("vaResult").innerHTML = `<video class="va-player" controls playsinline preload="metadata" src="${url}"></video><div class="va-actions"><a class="action" href="${url}" download>تحميل MP4</a><button id="vaAgain" class="action secondary">إعادة إنشاء الفيديو</button><button id="vaEdit" class="action secondary">تعديل المحتوى</button></div>${scenes ? `<details class="va-script"><summary>معاينة السيناريو والمشاهد</summary>${scenes}</details>` : ""}`;
    byId("vaAgain").onclick = generate;
    byId("vaEdit").onclick = () => { byId("vaTitle").focus(); window.scrollTo({top:sectionTop(), behavior:"smooth"}); };
  }

  function sectionTop() { return Math.max(0, byId("visual-alert-editor").offsetTop - 20); }
  function fail(message) {
    clearTimeout(pollTimer);
    byId("vaGenerate").disabled = false;
    updateProgress(0, `خطأ: ${message}`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
