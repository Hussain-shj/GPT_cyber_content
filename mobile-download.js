/* Cyber Pulse image actions — JPEG export + fixed brand header */
(() => {
  const W = 1080,
    H = 1350,
    ICONS = { regenerate: "↻", save: "↓", share: "↗" },
    LIGHT =
      "https://raw.githubusercontent.com/Hussain-shj/GPT_cyber_content/main/cyberpulse-logo-light.svg";
  const bidi = (t) =>
    String(t || "").replace(
      /([A-Za-z][A-Za-z0-9./+&_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./+&_-]*)*)/g,
      "\u2066$1\u2069",
    );
  const load = (src) =>
    new Promise((ok, no) => {
      let i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = src;
    });
  function slide(i) {
    try {
      return current?.data?.slides?.[i];
    } catch {
      return null;
    }
  }
  function grcPostText(d) {
    const blocks = [];
    if (d.title) blocks.push(`🔐 ${d.title}`);
    if (d.hook) blocks.push(`💡 ${d.hook}`);
    if (d.caption) blocks.push(d.caption);
    const rec = (d.recommendations || []).filter(Boolean);
    if (rec.length)
      blocks.push(`📌 التوصيات العملية:\n${rec.map((x) => `✅ ${x}`).join("\n")}`);
    if (d.cta) blocks.push(`🎯 ${d.cta}`);
    const src = (d.sources || []).filter((x) => x && (x.name || x.url));
    if (src.length)
      blocks.push(
        `🔗 المصادر:\n${src.map((x) => `• ${x.name || "المصدر"}${x.url ? `: ${x.url}` : ""}`).join("\n")}`,
      );
    const tags = (d.hashtags || [])
      .filter(Boolean)
      .map((x) => (x.startsWith("#") ? x : `#${x}`));
    if (tags.length) blocks.push(tags.join(" "));
    return blocks.join("\n\n");
  }
  function wrap(c, t, w) {
    let l = "",
      o = [];
    for (const z of String(t || "").split(/\s+/)) {
      const n = l ? l + " " + z : z;
      if (l && c.measureText(bidi(n)).width > w) {
        o.push(l);
        l = z;
      } else l = n;
    }
    if (l) o.push(l);
    return o;
  }
  function dataBlob(u, type = "image/jpeg") {
    const b = atob(u.split(",")[1]),
      a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return new Blob([a], { type });
  }
  async function grcJpeg(i) {
    const s = slide(i);
    if (!s?.image_b64) throw Error("الصورة غير جاهزة");
    const existing = document.querySelectorAll(".slide")[i]?.querySelector(".art > img");
    const im = existing?.naturalWidth ? existing : await load(`data:${s.image_mime_type || "image/jpeg"};base64,${s.image_b64}`);
    await document.fonts?.ready;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, H);
    x.drawImage(im, 0, 0, W, H);
    try {
      const logo = await load(LIGHT);
      x.drawImage(logo, 735, 28, 300, 87);
    } catch {}
    x.direction = "rtl";
    x.textAlign = "right";
    x.fillStyle = "rgba(255,255,255,.91)";
    x.fillRect(55, 135, 970, 185);
    x.fillStyle = "#0a2454";
    x.font = "800 48px Cairo";
    wrap(x, s.headline, 900)
      .slice(0, 2)
      .forEach((v, n) => x.fillText(bidi(v), 970, 165 + n * 62));
    x.fillStyle = "rgba(255,255,255,.9)";
    x.fillRect(55, 1010, 970, 225);
    x.fillStyle = "#172b48";
    x.font = "600 28px Cairo";
    wrap(x, s.body, 900)
      .slice(0, 4)
      .forEach((v, n) => x.fillText(bidi(v), 970, 1042 + n * 43));
    x.fillStyle = "rgba(255,255,255,.92)";
    x.fillRect(260, 1255, 705, 60);
    x.fillStyle = "#102b61";
    x.font = "700 27px Cairo";
    x.fillText(
      "نبض سيبراني | \u2066GRC\u2069 | \u2066@cyberpulse_ar\u2069",
      930,
      1292,
    );
    return c.toDataURL("image/jpeg", 0.94);
  }
  window.cyberPulseGrcImages = {
    async renderAll() {
      const slides = current?.data?.slides || [];
      const rendered = [];
      for (let i = 0; i < slides.length; i++) {
        if (!slides[i]?.image_b64) continue;
        rendered.push({data_url:await grcJpeg(i),alt_text:String(slides[i].headline || `شريحة ${i + 1}`).slice(0, 120)});
      }
      return rendered;
    },
  };
  async function grcFile(i) {
    return new File(
      [dataBlob(await grcJpeg(i))],
      `cyberpulse-grc-${i + 1}.jpg`,
      { type: "image/jpeg" },
    );
  }
  async function downloadFile(f) {
    const u = URL.createObjectURL(f),
      a = document.createElement("a");
    a.href = u;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 20000);
  }
  async function saveGrc(i) {
    return downloadFile(await grcFile(i));
  }
  async function shareGrc(i) {
    const f = await grcFile(i),
      d = current?.data || {},
      text = grcPostText(d);
    if (navigator.share && navigator.canShare?.({ files: [f] }))
      return navigator.share({ files: [f], text, title: "نبض سيبراني | GRC" });
    await navigator.clipboard?.writeText(text);
    return downloadFile(f);
  }
  function enhance() {
    document.querySelectorAll(".slide").forEach((c, i) => {
      const a = c.querySelector(".slide-actions"),
        s = slide(i),
        art = c.querySelector(".art");
      if (art && !art.querySelector(".cp-logo")) {
        art.style.position = "relative";
        let l = document.createElement("img");
        l.className = "cp-logo";
        l.src = LIGHT;
        Object.assign(l.style, {
          position: "absolute",
          top: "12px",
          right: "12px",
          width: "190px",
          zIndex: "9",
          borderRadius: "7px",
        });
        art.appendChild(l);
      }
      if (!a || !s?.image_b64) return;
      const r = a.querySelector("[data-img]");
      if (r && !r.dataset.iconized) {
        r.dataset.iconized = "1";
        r.textContent = ICONS.regenerate + " إعادة إنشاء";
      }
      if (!a.querySelector("[data-save-image]")) {
        let b = document.createElement("button");
        b.dataset.saveImage = "1";
        b.textContent = ICONS.save + " تحميل الصورة";
        b.onclick = () => saveGrc(i);
        a.appendChild(b);
      }
      if (!a.querySelector("[data-share-image]")) {
        let b = document.createElement("button");
        b.dataset.shareImage = "1";
        b.textContent = ICONS.share + " مشاركة الصورة";
        b.onclick = () => shareGrc(i);
        a.appendChild(b);
      }
    });
  }
  new MutationObserver(enhance).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(enhance, 1200);
})();

/* Cyber Pulse News Designer — adaptive news/vulnerability layout + JPEG */
(() => {
  const q = (id) => document.getElementById(id),
    W = 1080,
    H = 1350,
    DARK =
      "https://raw.githubusercontent.com/Hussain-shj/GPT_cyber_content/main/cyberpulse-logo-dark.svg";
  let art = "",
    artMime = "image/jpeg",
    artOptions = [],
    selectedArtIndex = null,
    parsed = null,
    ready = false,
    visualReview = null;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  const bidi = (t) =>
    String(t || "").replace(
      /([A-Za-z][A-Za-z0-9./+&_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./+&_-]*)*)/g,
      "\u2066$1\u2069",
    );
  async function responseData(response) {
    const raw = await response.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      const upstream =
        /upstream error|bad gateway|service unavailable|gateway timeout/i.test(raw);
      throw new Error(
        upstream
          ? "خدمة التوليد غير متاحة مؤقتًا. انتظر قليلًا ثم أعد المحاولة."
          : `استجابة غير صالحة من الخادم (HTTP ${response.status}).`,
      );
    }
  }
  const load = (src) =>
    new Promise((ok, no) => {
      let i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = src;
    });
  function inject() {
    if (q("news")) return;
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;
    let t = document.createElement("button");
    t.className = "tab";
    t.dataset.view = "news";
    t.textContent = "الأخبار السيبرانية";
    tabs.insertBefore(t, tabs.querySelector('[data-view="archive"]'));
    let s = document.createElement("section");
    s.id = "news";
    s.className = "card hidden";
s.innerHTML = `<div class="section-title"><div><h2 style="margin:0">الأخبار السيبرانية</h2><p style="color:#9eb2c9">ألصق الخبر أو ارفع ملف تنبيه؛ Nano Banana 2 ينشئ ثلاثة تصاميم مختلفة، ثم تختار الصورة المناسبة.</p></div><span class="counter">NEWS v12</span></div><div class="news-upload"><label for="newsFile">رفع ملف التنبيه — لا يتم حفظ الملف</label><input id="newsFile" type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"><small>PDF، DOCX، TXT، MD، CSV أو JSON — بحد أقصى 8 MB. تتم معالجة الملف مؤقتًا في الذاكرة فقط.</small></div><label>عنوان الخبر</label><input id="newsTitle" placeholder="عنوان الخبر"><label>الخبر الكامل</label><textarea id="newsText" rows="13" placeholder="ألصق التاريخ، النوع، التفاصيل والإجراءات والمصدر إن وجدت"></textarea><div class="row"><button id="newsSuggest" class="action">تحليل الخبر وتوليد 3 تصاميم</button><button id="newsRegen" class="action secondary hidden">توليد 3 تصاميم جديدة</button><button id="newsCreate" class="action secondary hidden">إنشاء الخبر بالصورة المختارة</button><button id="newsSave" class="action secondary hidden">حفظ JPEG</button><button id="newsShare" class="action secondary hidden">مشاركة + Caption</button></div><div id="newsMsg" class="status"></div><div id="newsMeta"></div><div id="newsReview"></div><div id="newsResult"></div>`;
    document.querySelector(".wrap").appendChild(s);
    let st = document.createElement("style");
    st.textContent = `.news-upload{margin:15px 0;padding:14px;border:1px dashed #1bd3cf;border-radius:12px;background:#081827}.news-upload label{margin-top:0;color:#77f2ee;font-weight:700}.news-upload small{display:block;margin-top:7px;color:#9eb2c9}.news-stage{max-width:760px;margin:20px auto;aspect-ratio:4/5;position:relative;overflow:hidden;background:#050B12;border:1px solid #0A84FF55;border-radius:18px}.news-stage>.hero{width:100%;height:100%;object-fit:cover}.news-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.news-option{background:#071421;border:2px solid #24415e;border-radius:16px;overflow:hidden;padding:0;color:#fff;text-align:right;transition:.18s}.news-option.selected{border-color:#00D1C7;box-shadow:0 0 0 3px #00D1C733}.news-option img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}.news-option-info{padding:11px;direction:rtl}.news-option-info b{display:block;margin-bottom:5px}.news-option-info small{display:block;color:#9eb2c9;line-height:1.55;min-height:42px}.news-option button{width:100%;margin-top:9px;border:0;border-radius:8px;padding:9px;background:#173149;color:#def;cursor:pointer;font-weight:700}.news-option.selected button{background:#00D1C7;color:#021011}.news-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,11,18,.96) 0%,rgba(5,11,18,.82) 29%,rgba(5,11,18,.18) 54%,rgba(5,11,18,.18) 82%,rgba(5,11,18,.78) 100%)}.news-logo{position:absolute;z-index:4;right:4%;top:2.5%;width:29%;border-radius:7px}.news-content{position:absolute;z-index:2;right:5%;left:5%;top:14%;height:80%;direction:rtl;text-align:right;color:#fff;font-family:Cairo;display:flex;flex-direction:column;gap:12px}.news-head{max-width:92%;font-size:clamp(24px,3.2vw,44px);font-weight:900;line-height:1.35;text-shadow:0 3px 18px #000}.news-badges{display:flex;direction:rtl;gap:7px;flex-wrap:wrap}.news-badge{background:#071522cc;border:1px solid #00D1C7;color:#00D1C7;padding:5px 10px;border-radius:8px;font-size:12px}.sev-high{background:#6d1010d9;border-color:#ff4d4f;color:#fff}.news-source{margin-top:auto;color:#d7e5ef;font-size:clamp(10px,1vw,14px);text-shadow:0 2px 10px #000}.news-meta-box,.news-review{margin-top:12px;padding:12px;border:1px solid #24415e;border-radius:10px;color:#b9c9d9;direction:rtl}@media(max-width:900px){.news-options{grid-template-columns:1fr}}`;
    st.textContent += `.news-badge-cve{direction:ltr;text-align:left;flex-basis:100%;line-height:1.65;white-space:normal}`;
    document.head.appendChild(st);
    t.onclick = () => {
      q("studio")?.classList.add("hidden");
      q("archive")?.classList.add("hidden");
      s.classList.remove("hidden");
      document
        .querySelectorAll(".tab")
        .forEach((b) => b.classList.toggle("active", b === t));
    };
    document
      .querySelectorAll('.tab[data-view="studio"],.tab[data-view="archive"]')
      .forEach((b) =>
        b.addEventListener("click", () => s.classList.add("hidden")),
      );
    q("newsSuggest").onclick = analyse;
    q("newsFile").onchange = uploadNewsFile;
    q("newsRegen").onclick = generateArt;
    q("newsCreate").onclick = create;
    q("newsSave").onclick = save;
    q("newsShare").onclick = share;
  }
  async function uploadNewsFile(event) {
    const input = event.currentTarget,
      file = input.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      input.value = "";
      return (q("newsMsg").textContent = "حجم الملف يتجاوز 8 ميجابايت.");
    }
    q("newsMsg").textContent = "جاري استخراج التنبيه من الملف دون حفظه...";
    try {
      const r = await fetch("/api/extract-news-file", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-News-Filename": encodeURIComponent(file.name),
          },
          body: file,
        }),
        d = await responseData(r);
      if (!r.ok) throw Error(d.detail || "فشل استخراج الملف");
      q("newsText").value = d.text || "";
      if (!q("newsTitle").value.trim()) q("newsTitle").value = d.title || "";
      q("newsMsg").textContent = `تم استخراج ${d.filename}. لم يتم حفظ الملف. يبدأ التحليل الآن...`;
      await analyse();
    } catch (e) {
      q("newsMsg").textContent = "خطأ: " + e.message;
    } finally {
      input.value = "";
    }
  }
  async function analyse() {
    const title = q("newsTitle").value.trim(),
      news = q("newsText").value.trim();
    if (!title || !news)
      return (q("newsMsg").textContent = "أدخل عنوان الخبر والخبر الكامل.");
    q("newsMsg").textContent = "جاري تحليل الخبر...";
    try {
      let r = await fetch("/api/parse-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, news }),
        }),
        d = await responseData(r);
      if (!r.ok) throw Error(d.detail || "فشل التحليل");
      parsed = d;
      const bits = [
        d.date ? `${d.date}${d.date_verified ? " ✓ تاريخ المصدر" : ""}` : "التاريخ غير موثّق",
        d.severity,
        d.cve,
        d.threat_type,
      ].filter(Boolean);
      q("newsMeta").innerHTML =
        `<div class="news-meta-box">${bits.map(esc).join(" | ")}</div>`;
      await generateArt();
    } catch (e) {
      q("newsMsg").textContent = "خطأ: " + e.message;
    }
  }
  async function generateArt() {
    if (!parsed) return;
    ready = false;
    art = "";
    artMime = "image/jpeg";
    artOptions = [];
    selectedArtIndex = null;
    visualReview = null;
    q("newsReview").innerHTML = "";
    q("newsCreate").classList.add("hidden");
    q("newsSave").classList.add("hidden");
    q("newsShare").classList.add("hidden");
    q("newsResult").innerHTML = "";
    q("newsMsg").textContent =
      "جاري توليد ثلاثة تصاميم مختلفة عبر Nano Banana 2... يتم إنشاء كل تصميم مرة واحدة.";
    const dir = `Direct literal news scene: ${parsed.visual_brief}. Threat category: ${parsed.threat_type}. Affected technology or entities: ${(parsed.entities || []).join(", ")}. Severity: ${parsed.severity}. Every prominent object must relate directly to the news. Do not use loose metaphors. No readable text anywhere.`;
    try {
      for (let variant = 1; variant <= 3; variant++) {
        q("newsMsg").textContent = `Nano Banana 2 ينشئ التصميم ${variant} من 3...`;
        const r = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsed.headline,
            body: parsed.summary,
            slide_number: 1,
            post_type: "Single Post",
            domain: "Cybersecurity",
            visual_style: "Cyber Pulse",
            visual_direction: dir,
            variant_index: variant,
          }),
        });
        const d = await responseData(r);
        if (!r.ok) throw Error(d.detail || `فشل التصميم ${variant}`);
        artOptions.push(d);
      }
      renderArtOptions();
      q("newsRegen").classList.remove("hidden");
      q("newsMsg").textContent =
        "اكتملت التصاميم الثلاثة. اختر الصورة المناسبة، ثم اضغط «إنشاء الخبر بالصورة المختارة».";
    } catch (e) {
      q("newsMsg").textContent = "خطأ: " + e.message;
    }
  }
  function renderArtOptions() {
    q("newsResult").innerHTML = `<div class="news-options">${artOptions
      .map((option, index) => {
        const review = option.semantic_review || {};
        const score = review.score == null ? "غير متاح" : `${review.score}/100`;
        return `<article class="news-option ${selectedArtIndex === index ? "selected" : ""}" data-news-option="${index}"><img src="data:${esc(option.mime_type || "image/jpeg")};base64,${option.b64_json}" alt="التصميم ${index + 1}"><div class="news-option-info"><b>التصميم ${index + 1} — ${esc(score)}</b><small>${esc(review.summary_ar || "مراجعة بصرية غير متاحة.")}</small><button type="button">${selectedArtIndex === index ? "✓ تم اختيار الصورة" : "اختيار هذه الصورة"}</button></div></article>`;
      })
      .join("")}</div>`;
    q("newsResult")
      .querySelectorAll("[data-news-option]")
      .forEach((card) =>
        card.querySelector("button").addEventListener("click", () =>
          selectArt(Number(card.dataset.newsOption)),
        ),
      );
  }
  function selectArt(index) {
    const option = artOptions[index];
    if (!option) return;
    selectedArtIndex = index;
    art = option.b64_json;
    artMime = option.mime_type || "image/jpeg";
    visualReview = option.semantic_review || null;
    ready = false;
    renderArtOptions();
    q("newsCreate").classList.remove("hidden");
    q("newsSave").classList.add("hidden");
    q("newsShare").classList.add("hidden");
    q("newsMsg").textContent = `تم اختيار التصميم ${index + 1}. اضغط «إنشاء الخبر بالصورة المختارة».`;
  }
  function create() {
    if (!art || !parsed) return;
    ready = true;
    const normalBadges = [parsed.severity, parsed.date].filter(Boolean).map((x, i) => `<span class="news-badge ${i === 0 && /عالي|حرج/.test(x) ? "sev-high" : ""}">${esc(x)}</span>`).join("");
    const cveBadge = parsed.cve ? `<span class="news-badge news-badge-cve">${cveLines(parsed.cve).map(esc).join("<br>")}</span>` : "";
    const badges = normalBadges + cveBadge;
    q("newsResult").innerHTML =
      `<div class="news-stage"><img class="hero" src="data:${esc(artMime)};base64,${art}"><div class="news-overlay"></div><img class="news-logo" src="${DARK}"><div class="news-content"><div class="news-head">${esc(parsed.headline)}</div>${badges ? `<div class="news-badges">${badges}</div>` : ""}${parsed.source ? `<div class="news-source">المصدر: <span style="color:#00D1C7">${esc(parsed.source)}</span></div>` : ""}</div></div>`;
    q("newsSave").classList.remove("hidden");
    q("newsShare").classList.remove("hidden");
    let publishButton = q("newsPublishLinkedIn");
    if (!publishButton) {
      publishButton = document.createElement("button");
      publishButton.id = "newsPublishLinkedIn";
      publishButton.className = "action secondary";
      publishButton.textContent = "نشر على LinkedIn";
      q("newsShare").after(publishButton);
    }
    publishButton.classList.remove("hidden");
    publishButton.onclick = async () => {
      const image = await finalJpeg();
      const readyPost = q("newsPostText")?.value.trim();
      const hashtags = (parsed.hashtags || [])
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .map((tag) => tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`)
        .join(" ");
      const fallback = [parsed.caption || [parsed.headline, parsed.summary, "@cyberpulse_ar"].filter(Boolean).join("\n\n"), hashtags]
        .filter(Boolean)
        .join("\n\n");
      const text = readyPost || fallback;
      window.cyberPulseLinkedIn?.publish(text, image);
    };
    q("newsMsg").textContent =
      "تم إنشاء الخبر. التفاصيل والإجراءات موجودة في النص الجاهز للنشر.";
  }
  function cveLines(value) {
    const raw = String(value || "").trim();
    const ids = raw.match(/CVE-\d{4}-\d+/gi) || raw.split(/[,;،]+/).map((item) => item.trim()).filter(Boolean);
    if (ids.length < 2 || ids.join(", ").length <= 44) return [ids.join(", ") || raw];
    const middle = Math.ceil(ids.length / 2);
    return [ids.slice(0, middle).join(", "), ids.slice(middle).join(", ")];
  }
  function wrap(c, t, w) {
    let l = "",
      o = [];
    for (const z of String(t || "").split(/\s+/)) {
      let n = l ? l + " " + z : z;
      if (l && c.measureText(bidi(n)).width > w) {
        o.push(l);
        l = z;
      } else l = n;
    }
    if (l) o.push(l);
    return o;
  }
  async function finalJpeg() {
    if (!ready) throw Error("اضغط إنشاء الخبر أولاً");
    await document.fonts?.ready;
    let im = await load(`data:${artMime};base64,${art}`),
      c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    let x = c.getContext("2d");
    x.fillStyle = "#050B12";
    x.fillRect(0, 0, W, H);
    x.drawImage(im, 0, 0, W, H);
    let g = x.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, "rgba(5,11,18,.98)");
    g.addColorStop(0.55, "rgba(5,11,18,.84)");
    g.addColorStop(1, "rgba(5,11,18,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, 720);
    let footer = x.createLinearGradient(0, 1100, 0, H);
    footer.addColorStop(0, "rgba(5,11,18,0)");
    footer.addColorStop(1, "rgba(5,11,18,.88)");
    x.fillStyle = footer;
    x.fillRect(0, 1080, W, 270);
    try {
      const logo = await load(DARK);
      x.drawImage(logo, 708, 28, 324, 94);
    } catch {}
    x.direction = "rtl";
    x.textAlign = "right";
    x.textBaseline = "top";
    x.fillStyle = "#fff";
    x.font = "900 58px Cairo";
    let y = 170;
    wrap(x, parsed.headline, 970)
      .slice(0, 4)
      .forEach((v, n) => {
        x.fillStyle = n === 1 ? "#00D1C7" : "#fff";
        x.fillText(bidi(v), 1015, y);
        y += 78;
      });
    const meta = [parsed.severity, parsed.date].filter(Boolean);
    if (meta.length || parsed.cve) {
      y += 16;
      x.font = "700 25px Cairo";
      let cursor = 1015;
      for (let i = 0; i < meta.length; i++) {
        const value = meta[i],
          label = bidi(value),
          mw = x.measureText(label).width + 34;
        x.fillStyle = i === 0 && /عالي|حرج/.test(value) ? "#ff4d4f" : "#dce8ef";
        x.strokeStyle =
          i === 0 && /عالي|حرج/.test(value) ? "#ff4d4f" : "#466277";
        x.lineWidth = 2;
        x.beginPath();
        x.roundRect(cursor - mw, y, mw, 48, 12);
        x.stroke();
        x.fillText(label, cursor - 17, y + 9);
        cursor -= mw + 18;
      }
      if (parsed.cve) {
        const lines = cveLines(parsed.cve);
        const cveY = y + (meta.length ? 62 : 0);
        const boxHeight = lines.length > 1 ? 82 : 48;
        x.strokeStyle = "#466277";
        x.lineWidth = 2;
        x.beginPath();
        x.roundRect(55, cveY, 960, boxHeight, 12);
        x.stroke();
        x.direction = "ltr";
        x.textAlign = "left";
        x.fillStyle = "#dce8ef";
        x.font = "700 22px Cairo";
        lines.forEach((line, index) => x.fillText(line, 72, cveY + 8 + index * 34));
        x.direction = "rtl";
        x.textAlign = "right";
      }
    }
    if (parsed.source) {
      x.fillStyle = "#d7e5ef";
      x.font = "600 23px Cairo";
      x.textAlign = "left";
      x.fillText(bidi("المصدر: " + parsed.source), 55, 1285);
    }
    return c.toDataURL("image/jpeg", 0.94);
  }
  function toBlob(u) {
    const b = atob(u.split(",")[1]),
      a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return new Blob([a], { type: "image/jpeg" });
  }
  async function file() {
    return new File(
      [toBlob(await finalJpeg())],
      `cyberpulse-news-${Date.now()}.jpg`,
      { type: "image/jpeg" },
    );
  }
  async function save() {
    try {
      let z = await file(),
        u = URL.createObjectURL(z),
        a = document.createElement("a");
      a.href = u;
      a.download = z.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 20000);
    } catch (e) {
      alert(e.message);
    }
  }
  async function share() {
    try {
      let z = await file(),
        text =
          parsed.caption ||
          [parsed.headline, parsed.summary, "@cyberpulse_ar"].join("\n\n");
      if (navigator.share && navigator.canShare?.({ files: [z] }))
        return navigator.share({
          files: [z],
          text,
          title: "نبض سيبراني | CYBER PULSE",
        });
      await navigator.clipboard?.writeText(text);
      let u = URL.createObjectURL(z),
        a = document.createElement("a");
      a.href = u;
      a.download = z.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 20000);
    } catch (e) {
      if (e.name !== "AbortError") alert(e.message);
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
