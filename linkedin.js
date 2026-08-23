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
    style.textContent = `.li-section{max-width:820px;margin:0 auto}.li-section h2{margin:0}.li-section p{color:#9eb2c9}.li-status{margin:18px 0;padding:14px;border:1px solid #294760;border-radius:12px;background:#081827}.li-status.connected{border-color:#1bd3cf;color:#77f2ee}.li-note{font-size:.92rem}.li-publish-modal{position:fixed;inset:0;z-index:9999;background:#020914d9;display:flex;align-items:center;justify-content:center;padding:18px}.li-publish-card{width:min(760px,100%);max-height:90vh;overflow:auto;background:#0d1a2b;border:1px solid #294760;border-radius:18px;padding:18px;direction:rtl}.li-publish-card textarea{min-height:220px;line-height:1.75;direction:rtl;text-align:right;unicode-bidi:plaintext}.li-publish-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:9px;margin:12px 0}.li-publish-image{margin:0;text-align:center}.li-publish-image figcaption{font-size:.8rem;color:#9eb2c9}.li-publish-preview{display:block;width:100%;max-height:240px;object-fit:contain;margin:0 auto 4px;border-radius:10px;background:#06101d}.li-result a{color:#77f2ee}`;
    document.head.appendChild(style);
    tab.onclick = () => show(tab, section);
    document.querySelectorAll('.tab:not([data-view="linkedin"])').forEach((button) => button.addEventListener("click", () => section.classList.add("hidden")));
    byId("liDisconnect").onclick = disconnect;
    if (location.hash.startsWith("#linkedin")) tab.click();
    refreshStatus();
  }

  function show(tab, section) {
    ["studio", "archive", "news", "visual-alert-editor", "linkedin-ai-studio"].forEach((id) => byId(id)?.classList.add("hidden"));
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

  function prepareLinkedInText(text) {
    const normalized = String(text || "").replace(/\r\n?/g, "\n");
    if (!/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(normalized)) return normalized;
    return normalized.split("\n").map((line) => !line.trim() || line.startsWith("\u200f") ? line : "\u200f" + line).join("\n");
  }

  async function publish(text, imageDataUrl = "") {
    const status = await refreshStatus();
    if (!status.connected) {
      alert("اربط حساب LinkedIn أولًا من تبويب LinkedIn.");
      document.querySelector('[data-view="linkedin"]')?.click();
      return;
    }
    const images = (Array.isArray(imageDataUrl) ? imageDataUrl : imageDataUrl ? [imageDataUrl] : [])
      .map((image) => typeof image === "string" ? {data_url:image,alt_text:""} : image)
      .filter((image) => image?.data_url)
      .slice(0, 20);
    const previews = images.length
      ? `<div class="li-publish-images">${images.map((image,index) => `<figure class="li-publish-image"><img class="li-publish-preview" src="${esc(image.data_url)}" alt="${esc(image.alt_text || `الصورة ${index + 1}`)}"><figcaption>${index + 1}. ${esc(image.alt_text || "صورة")}</figcaption></figure>`).join("")}</div>`
      : '<p>سيتم نشر النص بدون صورة.</p>';
    const modal = document.createElement("div");
    modal.className = "li-publish-modal";
    modal.innerHTML = `<div class="li-publish-card"><div class="section-title"><h3>معاينة منشور LinkedIn${images.length > 1 ? ` — ${images.length} صور` : ""}</h3><button class="copy-btn" data-li-close>إغلاق</button></div>${previews}<label>النص القابل للتعديل <span id="liCharacterCount" class="counter"></span></label><textarea id="liPublishText" dir="rtl"></textarea><div class="row"><button class="action" id="liPublishConfirm">نشر الآن</button><button class="action secondary" data-li-close>إلغاء</button></div><div id="liPublishStatus" class="status li-result"></div></div>`;
    document.body.appendChild(modal);
    const field = byId("liPublishText");
    field.value = String(text || "");
    const updateCount = () => {
      const length = prepareLinkedInText(field.value).length;
      byId("liCharacterCount").textContent = `${length} / 3000`;
      byId("liCharacterCount").style.color = length > 3000 ? "#ff7777" : "";
      if (length > 3000) byId("liPublishStatus").textContent = `النص يتجاوز حد LinkedIn بمقدار ${length - 3000} حرفًا. اختصره من المعاينة قبل النشر.`;
      else if (byId("liPublishStatus").textContent.startsWith("النص يتجاوز حد LinkedIn")) byId("liPublishStatus").textContent = "";
    };
    field.addEventListener("input", updateCount);
    updateCount();
    modal.querySelectorAll("[data-li-close]").forEach((button) => button.onclick = () => modal.remove());
    byId("liPublishConfirm").onclick = async () => {
      const button = byId("liPublishConfirm"), content = prepareLinkedInText(byId("liPublishText").value.trim());
      if (!content) return byId("liPublishStatus").textContent = "النص مطلوب.";
      if (content.length > 3000) return byId("liPublishStatus").textContent = `النص يتجاوز حد LinkedIn بمقدار ${content.length - 3000} حرفًا. اختصره قبل النشر.`;
      button.disabled = true; byId("liPublishStatus").textContent = images.length > 1 ? `جاري رفع ${images.length} صور ونشر المحتوى...` : "جاري رفع الصورة ونشر المحتوى...";
      try {
        const payloadImages = images.map((image) => {const parsed=splitDataUrl(image.data_url);return {image_b64:parsed.b64,image_mime_type:parsed.mime,alt_text:String(image.alt_text || "").slice(0,120)};});
        const result = await data(await fetch("/api/linkedin/publish", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:content,images:payloadImages})}));
        byId("liPublishStatus").innerHTML = `تم النشر بنجاح. <a href="${esc(result.post_url)}" target="_blank" rel="noopener">فتح المنشور</a>`;
        button.textContent = "✓ تم النشر";
      } catch (error) { button.disabled = false; byId("liPublishStatus").textContent = `خطأ: ${error.message}`; }
    };
  }

  window.cyberPulseLinkedIn = {publish, refreshStatus};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* LinkedIn AI Studio MVP — human approval required before publishing */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const STORAGE_KEY = "cyberpulse_linkedin_ai_studio_v1";
  const STRATEGY = {
    positioning: "Cybersecurity Governance + GRC + Cyber Risk + AI Governance + CISO Perspective",
    audience: "UAE/GCC government and enterprise leaders and cybersecurity/GRC professionals",
    language: "Arabic",
    cadence: 4,
    commercialOffers: ["GRC Health Check","Cyber Risk Assessment","ISO 27001 Gap Assessment","AI Risk/Governance Assessment","Executive Cybersecurity Workshop","GRC Digital Toolkit"]
  };
  const PLAN = [
    ["أساسيات الحوكمة السيبرانية","كيف يتحول GRC من أوراق إلى قرارات إدارية؟","ما الذي يجب أن يراه مجلس الإدارة من الأمن السيبراني؟","Checklist: علامات ضعف برنامج GRC"],
    ["إدارة المخاطر","5 أخطاء تجعل Risk Register بلا قيمة","Case Study: عندما لا يكون Risk Owner واضحًا","AI Risk: مخاطر Shadow AI داخل المؤسسة","Checklist: مراجعة سجل المخاطر"],
    ["ISO 27001 والتطبيق","لماذا لا تكفي شهادة ISO 27001 وحدها؟","Case Study: الفرق بين الامتثال والنضج","كيف تربط الضوابط بالمخاطر الفعلية؟","Checklist: ISO 27001 Gap Review"],
    ["مخاطر الموردين","Third-Party Risk: أين تبدأ المشكلة؟","Case Study: مورد صغير وتأثير كبير","AI vendors: ما الذي يجب أن تسأل عنه؟","Checklist: Third-Party Security Review"],
    ["القيادة السيبرانية","ما الذي يجب أن يطلبه CISO من الإدارة؟","Case Study: قرار Risk Acceptance غير موثق","Cyber metrics التي تهم الإدارة العليا","Checklist: Executive Cyber Dashboard"],
    ["AI Governance","من يملك مخاطر الذكاء الاصطناعي داخل المؤسسة؟","Case Study: رفع بيانات حساسة إلى أدوات AI","ISO 42001 من منظور عملي","Checklist: AI Governance Readiness"],
    ["إدارة الثغرات","CVSS العالي ليس المشكلة الوحيدة","Case Study: Patch موجود لكن الأصل مكشوف","كيف تربط Vulnerability Management بالمخاطر؟","Checklist: Vulnerability Governance"],
    ["الاستمرارية والمرونة","Cyber Resilience ليست Backup فقط","Case Study: انقطاع خدمة بسبب هجوم","BCP وIncident Response: أين يلتقيان؟","Checklist: Cyber Resilience Review"],
    ["الثقافة الأمنية","Awareness أم Security Culture؟","Case Study: لماذا لا يغير التدريب السلوك؟","كيف تقيس أثر التوعية؟","Checklist: Security Culture"],
    ["الخصوصية والبيانات","من يقرر ما الذي يمكن رفعه إلى AI؟","Case Study: مشاركة مستندات مع أدوات خارجية","Data Classification كأداة قرار","Checklist: AI/Data Sharing"],
    ["النضج والقياس","كيف تقيس نضج GRC بدون تعقيد؟","Case Study: KPI ممتاز وKRI مفقود","أهم مؤشرات المخاطر للإدارة","Checklist: GRC Maturity"],
    ["التحويل التجاري","7 علامات تحتاج معها GRC Health Check","Case Study: من الملاحظة إلى Roadmap","كيف تبني Cyber Risk Roadmap لـ90 يومًا؟","Checklist: Executive GRC Health Check"]
  ];
  const SLOTS = [
    {day:"الإثنين", pillar:"GRC / Governance", objective:"Authority", type:"Single Post"},
    {day:"الثلاثاء", pillar:"Case Study", objective:"Expertise", type:"Single Post"},
    {day:"الخميس", pillar:"AI / Cyber Risk", objective:"Reach", type:"Single Post"},
    {day:"السبت", pillar:"Checklist / Carousel", objective:"Leads", type:"Carousel"}
  ];

  function state() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {posts:[],weekOffset:0}; }
    catch { return {posts:[],weekOffset:0}; }
  }
  function save(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function weekNumber() {
    const start = new Date(2026, 7, 24);
    const now = new Date();
    const diff = Math.max(0, Math.floor((now - start) / 604800000));
    return Math.min(11, diff + Number(state().weekOffset || 0));
  }
  async function api(path, options={}) {
    const response = await fetch(path, {headers:{"Content-Type":"application/json", ...(options.headers||{})}, ...options});
    const raw = await response.text();
    let body = {};
    if (raw) { try { body = JSON.parse(raw); } catch { throw new Error(`استجابة غير صالحة (${response.status})`); } }
    if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
    return body;
  }
  function buildText(content) {
    const hashtags = (content.hashtags || []).join(" ");
    const recommendations = (content.recommendations || []).filter(Boolean);
    let text = `${content.hook || content.title || ""}\n\n${content.caption || ""}`;
    if (recommendations.length) text += `\n\nإجراءات عملية:\n${recommendations.map(x=>`• ${x}`).join("\n")}`;
    if (content.cta) text += `\n\n${content.cta}`;
    if (hashtags) text += `\n\n${hashtags}`;
    return text.trim().slice(0, 2980);
  }
  function score(content, text) {
    const hook = Math.min(100, 55 + Math.min(35, String(content.hook||"").length));
    const authority = /إدارة|حوكمة|مخاطر|GRC|CISO|ISO|مجلس|قرار/i.test(text) ? 90 : 74;
    const practical = (content.recommendations||[]).length >= 3 || /Checklist|قائمة|خطوات|إجراءات/i.test(text) ? 92 : 80;
    const originality = /Case Study|من واقع|سيناريو|لماذا|كيف/i.test(text) ? 87 : 79;
    const readability = text.length >= 500 && text.length <= 2200 ? 92 : text.length <= 2800 ? 84 : 76;
    const commercial = /Health Check|Assessment|Workshop|Checklist|قائمة|تقييم/i.test(text) ? 84 : 68;
    const overall = Math.round((hook+authority+practical+originality+readability+commercial)/6);
    return {hook, authority, practical_value:practical, originality, readability, commercial_intent:commercial, overall};
  }
  function canvasLines(ctx, text, maxWidth) {
    const words = String(text||"").split(/\s+/), lines=[]; let line="";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line=word; }
      else line=test;
    }
    if (line) lines.push(line);
    return lines;
  }
  async function renderCarousel(post) {
    if (document.fonts?.ready) await document.fonts.ready;
    const slides = post.content.slides?.length ? post.content.slides : [{headline:post.title,body:post.content.caption||""}];
    const images = [];
    for (let i=0; i<slides.length; i++) {
      const slide = slides[i], canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=1350;
      const ctx=canvas.getContext("2d");
      const dark = post.pillar.includes("AI") || post.pillar.includes("Cyber");
      ctx.fillStyle = dark ? "#071421" : "#f6f9fc"; ctx.fillRect(0,0,1080,1350);
      ctx.fillStyle = dark ? "#00d1c7" : "#0a56a8"; ctx.fillRect(0,0,1080,18);
      ctx.textAlign="right"; ctx.direction="rtl";
      ctx.font="700 28px Cairo, Arial"; ctx.fillStyle=dark?"#77f2ee":"#0a56a8"; ctx.fillText(`${post.pillar}  •  ${i+1}/${slides.length}`,960,100);
      ctx.font="800 58px Cairo, Arial"; ctx.fillStyle=dark?"#f4f8ff":"#102b45";
      const hLines=canvasLines(ctx, slide.headline||post.title, 860).slice(0,3);
      hLines.forEach((line,idx)=>ctx.fillText(line,960,250+idx*78));
      ctx.font="500 36px Cairo, Arial"; ctx.fillStyle=dark?"#c8d5e6":"#334e68";
      const bLines=canvasLines(ctx, slide.body||"", 860).slice(0,8);
      bLines.forEach((line,idx)=>ctx.fillText(line,960,560+idx*58));
      ctx.font="600 26px Cairo, Arial"; ctx.fillStyle=dark?"#9eb2c9":"#6b7d90";
      ctx.fillText("Cybersecurity Governance • Risk • AI Governance",960,1240);
      ctx.fillStyle=dark?"#00d1c7":"#0a56a8"; ctx.fillText("Hussain Alblooshi",960,1290);
      images.push({data_url:canvas.toDataURL("image/jpeg",0.92),alt_text:`${post.title} — ${i+1}`});
    }
    return images;
  }
  async function generateSingleImage(post) {
    const response = await api("/api/generate-image", {method:"POST",body:JSON.stringify({
      title: post.title,
      body: `${post.content.hook || ""}\n${post.content.caption || ""}`.slice(0,1600),
      slide_number: 1,
      post_type: "Single Post",
      domain: post.pillar.includes("AI") ? "AI Governance" : post.pillar.includes("Cyber") ? "Cybersecurity" : "GRC",
      visual_style: post.pillar.includes("Cyber") ? "Cyber Pulse" : "Executive Minimal",
      visual_direction: `Executive LinkedIn visual for ${post.pillar}. Central concept, premium enterprise style, no generated text.`
    })});
    return [{data_url:`data:${response.mime_type||"image/jpeg"};base64,${response.b64_json}`,alt_text:post.title}];
  }
  async function createPost(slot, topic, index) {
    const useWeb = slot.pillar.includes("AI") || slot.pillar.includes("Cyber");
    const requestTopic = `${topic}. اكتب من منظور مسؤول أمن معلومات/حوكمة، مع رأي عملي واضح وليس ملخصًا عامًا. اربط الفكرة بالقرار الإداري والمخاطر. الهدف ${slot.objective}. لا تستخدم أخبارًا أو أرقامًا حديثة غير موثقة.`;
    const content = await api("/api/generate-content", {method:"POST",body:JSON.stringify({
      topic:requestTopic,
      domain:slot.pillar.includes("AI") ? "AI Governance" : slot.pillar.includes("Cyber") ? "Cybersecurity" : "GRC",
      post_type:slot.type,
      platform:"LinkedIn",
      audience:STRATEGY.audience,
      language:"Arabic",
      slides:slot.type==="Carousel" ? 6 : 1,
      tone:"Professional, practical, executive-friendly, CISO perspective",
      use_web_search:useWeb
    })});
    const text=buildText(content), quality=score(content,text);
    return {
      id:`li-studio-${Date.now()}-${index}`, week:weekNumber()+1, day:slot.day, pillar:slot.pillar,
      objective:slot.objective, type:slot.type, title:topic, status:"REVIEW", text, content, quality,
      assets:[], created_at:new Date().toISOString(), approved_at:null
    };
  }
  function colorScore(n){ return n>=85?"#67e8a9":n>=75?"#ffd166":"#ff7b89"; }
  function postCard(post) {
    const hasAssets=post.assets?.length;
    return `<article class="lai-post" data-id="${esc(post.id)}">
      <div class="lai-post-head"><div><span class="lai-badge">${esc(post.day)}</span><span class="lai-badge">${esc(post.pillar)}</span><span class="lai-badge">${esc(post.objective)}</span></div><strong style="color:${colorScore(post.quality.overall)}">${post.quality.overall}/100</strong></div>
      <h3>${esc(post.title)}</h3>
      <textarea class="lai-text" dir="rtl">${esc(post.text)}</textarea>
      <div class="lai-scores">Hook ${post.quality.hook} · Authority ${post.quality.authority} · Value ${post.quality.practical_value} · Readability ${post.quality.readability}</div>
      <div class="lai-assets">${hasAssets ? post.assets.map(a=>`<img src="${esc(a.data_url)}" alt="${esc(a.alt_text||"")}">`).join("") : `<div class="lai-empty-visual">لا توجد صور بعد</div>`}</div>
      <div class="row lai-actions">
        <button class="action" data-act="approve">${post.status==="APPROVED"?"✓ معتمد":"اعتماد"}</button>
        <button class="action secondary" data-act="visual">${hasAssets?"إعادة تصميم الصور":"إنشاء الصور"}</button>
        <button class="action secondary" data-act="regenerate">إعادة كتابة</button>
        <button class="action secondary" data-act="publish" ${post.status!=="APPROVED"?"disabled":""}>معاينة ونشر</button>
        <button class="action danger" data-act="reject">رفض</button>
      </div>
      <div class="status lai-post-status"></div>
    </article>`;
  }
  function render() {
    const s=state(), container=$("laiPosts"); if (!container) return;
    const posts=s.posts.filter(p=>p.week===weekNumber()+1);
    $("laiWeek").textContent=`الأسبوع ${weekNumber()+1} من 12`;
    $("laiCount").textContent=`${posts.length}/4`;
    container.innerHTML=posts.length ? posts.map(postCard).join("") : `<div class="empty">لم يتم توليد محتوى هذا الأسبوع بعد.</div>`;
    bindCards();
  }
  function bindCards() {
    document.querySelectorAll(".lai-post").forEach(card=>{
      const id=card.dataset.id;
      const textarea=card.querySelector(".lai-text");
      textarea.addEventListener("change",()=>updatePost(id,p=>{p.text=textarea.value; p.quality=score(p.content,p.text);}));
      card.querySelectorAll("[data-act]").forEach(btn=>btn.onclick=()=>act(id,btn.dataset.act,card));
    });
  }
  function updatePost(id, fn) {
    const s=state(), p=s.posts.find(x=>x.id===id); if(!p)return null; fn(p); save(s); render(); return p;
  }
  async function act(id, action, card) {
    const s=state(), post=s.posts.find(x=>x.id===id); if(!post)return;
    const status=card.querySelector(".lai-post-status");
    try {
      if(action==="approve"){ post.status="APPROVED"; post.approved_at=new Date().toISOString(); save(s); render(); return; }
      if(action==="reject"){ post.status="REJECTED"; save(s); render(); return; }
      if(action==="visual"){
        status.textContent=post.type==="Carousel"?"جاري تصميم شرائح Carousel...":"جاري إنشاء الصورة...";
        post.assets = post.type==="Carousel" ? await renderCarousel(post) : await generateSingleImage(post);
        save(s); render(); return;
      }
      if(action==="regenerate"){
        status.textContent="جاري إعادة كتابة المحتوى...";
        const slot=SLOTS.find(x=>x.day===post.day)||SLOTS[0];
        const replacement=await createPost(slot,post.title,0);
        post.content=replacement.content; post.text=replacement.text; post.quality=replacement.quality; post.status="REVIEW"; post.assets=[];
        save(s); render(); return;
      }
      if(action==="publish"){
        if(post.status!=="APPROVED") throw new Error("اعتمد المنشور أولًا.");
        if(!post.assets?.length) throw new Error("أنشئ الصورة أو الـCarousel قبل النشر.");
        await window.cyberPulseLinkedIn.publish(post.text, post.assets);
      }
    } catch(error){ status.textContent=`خطأ: ${error.message}`; }
  }
  async function generateWeek() {
    const button=$("laiGenerate"), msg=$("laiStatus"), s=state(), week=weekNumber(), topics=PLAN[week];
    button.disabled=true; msg.textContent="جاري تجهيز 4 منشورات بناءً على خطة الـ90 يوم...";
    try {
      const existing=s.posts.filter(p=>p.week===week+1);
      if(existing.length && !confirm("يوجد محتوى لهذا الأسبوع. هل تريد استبداله؟")) return;
      s.posts=s.posts.filter(p=>p.week!==week+1); save(s);
      for(let i=0;i<4;i++){
        msg.textContent=`جاري إنشاء المنشور ${i+1} من 4 — ${SLOTS[i].day}`;
        const post=await createPost(SLOTS[i],topics[i],i);
        const fresh=state(); fresh.posts.push(post); save(fresh); render();
      }
      msg.textContent="اكتمل تجهيز محتوى الأسبوع. راجع النصوص ثم أنشئ الصور واعتمد المناسب.";
    } catch(error){ msg.textContent=`خطأ: ${error.message}`; }
    finally{ button.disabled=false; }
  }
  function init() {
    if($("linkedin-ai-studio"))return;
    const tabs=document.querySelector(".tabs"), wrap=document.querySelector(".wrap"); if(!tabs||!wrap)return;
    const tab=document.createElement("button"); tab.className="tab"; tab.dataset.view="linkedin-ai-studio"; tab.textContent="LinkedIn AI Studio";
    tabs.insertBefore(tab,tabs.querySelector('[data-view="archive"]'));
    const section=document.createElement("section"); section.id="linkedin-ai-studio"; section.className="card hidden";
    section.innerHTML=`<div class="section-title"><div><h2>LinkedIn AI Studio</h2><p>خطة 90 يوم → 4 منشورات أسبوعيًا → صور/Carousel → مراجعة → اعتماد → نشر.</p></div><span id="laiWeek" class="counter"></span></div>
      <div class="lai-strategy"><div><strong>التمركز</strong><p>${esc(STRATEGY.positioning)}</p></div><div><strong>الجمهور</strong><p>${esc(STRATEGY.audience)}</p></div><div><strong>الهدف التجاري</strong><p>Authority → Leads → Assessments / Workshops</p></div></div>
      <div class="row"><button id="laiGenerate" class="action">توليد محتوى الأسبوع</button><span id="laiCount" class="counter">0/4</span></div>
      <div id="laiStatus" class="status"></div><div id="laiPosts" class="lai-posts"></div>`;
    wrap.appendChild(section);
    const style=document.createElement("style"); style.textContent=`
      #linkedin-ai-studio{direction:rtl}.lai-strategy{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0 18px}.lai-strategy>div{background:#091625;border:1px solid #294760;border-radius:12px;padding:12px}.lai-strategy p{color:#9eb2c9;margin:6px 0 0;font-size:.9rem}.lai-posts{display:grid;gap:16px;margin-top:18px}.lai-post{background:#091625;border:1px solid #294760;border-radius:16px;padding:16px}.lai-post-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.lai-badge{display:inline-block;background:#10283a;color:#77f2ee;border-radius:999px;padding:4px 8px;margin-left:5px;font-size:.78rem}.lai-post h3{margin:12px 0}.lai-text{min-height:260px;line-height:1.8;unicode-bidi:plaintext}.lai-scores{color:#9eb2c9;font-size:.85rem;margin:9px 0}.lai-assets{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}.lai-assets img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;background:#06101d}.lai-empty-visual{padding:28px;border:1px dashed #294760;border-radius:10px;color:#9eb2c9;text-align:center}.lai-actions button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:800px){.lai-strategy{grid-template-columns:1fr}.lai-assets{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
    tab.onclick=()=>{
      ["studio","archive","news","visual-alert-editor","linkedin"].forEach(id=>$(id)?.classList.add("hidden"));
      section.classList.remove("hidden");
      document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===tab));
      history.replaceState(null,"","#linkedin-ai-studio"); render();
    };
    document.querySelectorAll('.tab:not([data-view="linkedin-ai-studio"])').forEach(b=>b.addEventListener("click",()=>section.classList.add("hidden")));
    $("laiGenerate").onclick=generateWeek;
    if(location.hash.startsWith("#linkedin-ai-studio"))tab.click(); else render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();
})();