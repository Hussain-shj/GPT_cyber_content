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
    const s = slide(i),
      im = document.querySelectorAll(".slide")[i]?.querySelector(".art > img");
    if (!s?.image_b64 || !im?.naturalWidth) throw Error("الصورة غير جاهزة");
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
    x.fillRect(55, 140, 970, 220);
    x.fillStyle = "#0a2454";
    x.font = "800 54px Cairo";
    wrap(x, s.headline, 900)
      .slice(0, 3)
      .forEach((v, n) => x.fillText(bidi(v), 970, 170 + n * 70));
    x.fillStyle = "rgba(255,255,255,.9)";
    x.fillRect(500, 390, 525, 360);
    x.fillStyle = "#172b48";
    x.font = "600 31px Cairo";
    wrap(x, s.body, 490)
      .slice(0, 6)
      .forEach((v, n) => x.fillText(bidi(v), 975, 425 + n * 48));
    x.fillStyle = "rgba(255,255,255,.92)";
    x.fillRect(260, 1243, 705, 72);
    x.fillStyle = "#102b61";
    x.font = "700 27px Cairo";
    x.fillText(
      "نبض سيبراني | \u2066GRC\u2069 | \u2066@cyberpulse_ar\u2069",
      930,
      1285,
    );
    return c.toDataURL("image/jpeg", 0.94);
  }
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
      text = [d.caption, d.cta, ...(d.hashtags || [])]
        .filter(Boolean)
        .join("\n\n");
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
        b.textContent = ICONS.save + " حفظ JPEG";
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
    s.innerHTML = `<div class="section-title"><div><h2 style="margin:0">الأخبار السيبرانية</h2><p style="color:#9eb2c9">أدخل الخبر؛ التطبيق ينشئ ثلاثة تصاميم مختلفة، ثم تختار الصورة المناسبة لإنشاء الخبر.</p></div><span class="counter">NEWS v9</span></div><label>عنوان الخبر</label><input id="newsTitle" placeholder="عنوان الخبر"><label>الخبر الكامل</label><textarea id="newsText" rows="13" placeholder="ألصق التاريخ، النوع، التفاصيل والإجراءات والمصدر إن وجدت"></textarea><div class="row"><button id="newsSuggest" class="action">تحليل الخبر وتوليد 3 تصاميم</button><button id="newsRegen" class="action secondary hidden">توليد 3 تصاميم جديدة</button><button id="newsCreate" class="action secondary hidden">إنشاء الخبر بالصورة المختارة</button><button id="newsSave" class="action secondary hidden">حفظ JPEG</button><button id="newsShare" class="action secondary hidden">مشاركة + Caption</button></div><div id="newsMsg" class="status"></div><div id="newsMeta"></div><div id="newsReview"></div><div id="newsResult"></div>`;
    document.querySelector(".wrap").appendChild(s);
    let st = document.createElement("style");
    st.textContent = `.news-stage{max-width:760px;margin:20px auto;aspect-ratio:4/5;position:relative;overflow:hidden;background:#050B12;border:1px solid #0A84FF55;border-radius:18px}.news-stage>.hero{width:100%;height:100%;object-fit:cover}.news-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.news-option{background:#071421;border:2px solid #24415e;border-radius:16px;overflow:hidden;padding:0;color:#fff;text-align:right;transition:.18s}.news-option.selected{border-color:#00D1C7;box-shadow:0 0 0 3px #00D1C733}.news-option img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}.news-option-info{padding:11px;direction:rtl}.news-option-info b{display:block;margin-bottom:5px}.news-option-info small{display:block;color:#9eb2c9;line-height:1.55;min-height:42px}.news-option button{width:100%;margin-top:9px;border:0;border-radius:8px;padding:9px;background:#173149;color:#def;cursor:pointer;font-weight:700}.news-option.selected button{background:#00D1C7;color:#021011}.news-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,11,18,.96) 0%,rgba(5,11,18,.82) 29%,rgba(5,11,18,.18) 54%,rgba(5,11,18,.18) 82%,rgba(5,11,18,.78) 100%)}.news-logo{position:absolute;z-index:4;right:4%;top:2.5%;width:29%;border-radius:7px}.news-content{position:absolute;z-index:2;right:5%;left:5%;top:14%;height:80%;direction:rtl;text-align:right;color:#fff;font-family:Cairo;display:flex;flex-direction:column;gap:12px}.news-head{max-width:92%;font-size:clamp(24px,3.2vw,44px);font-weight:900;line-height:1.35;text-shadow:0 3px 18px #000}.news-badges{display:flex;direction:rtl;gap:7px;flex-wrap:wrap}.news-badge{background:#071522cc;border:1px solid #00D1C7;color:#00D1C7;padding:5px 10px;border-radius:8px;font-size:12px}.sev-high{background:#6d1010d9;border-color:#ff4d4f;color:#fff}.news-source{margin-top:auto;color:#d7e5ef;font-size:clamp(10px,1vw,14px);text-shadow:0 2px 10px #000}.news-meta-box,.news-review{margin-top:12px;padding:12px;border:1px solid #24415e;border-radius:10px;color:#b9c9d9;direction:rtl}@media(max-width:900px){.news-options{grid-template-columns:1fr}}`;
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
    q("newsRegen").onclick = generateArt;
    q("newsCreate").onclick = create;
    q("newsSave").onclick = save;
    q("newsShare").onclick = share;
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
      const bits = [d.date, d.severity, d.cve, d.threat_type].filter(Boolean);
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
    artOptions = [];
    selectedArtIndex = null;
    visualReview = null;
    q("newsReview").innerHTML = "";
    q("newsCreate").classList.add("hidden");
    q("newsSave").classList.add("hidden");
    q("newsShare").classList.add("hidden");
    q("newsResult").innerHTML = "";
    q("newsMsg").textContent =
      "جاري توليد ثلاثة تصاميم مختلفة... يتم إنشاء كل تصميم مرة واحدة.";
    const dir = `Direct literal news scene: ${parsed.visual_brief}. Threat category: ${parsed.threat_type}. Affected technology or entities: ${(parsed.entities || []).join(", ")}. Severity: ${parsed.severity}. Every prominent object must relate directly to the news. Do not use loose metaphors. No readable text anywhere.`;
    try {
      for (let variant = 1; variant <= 3; variant++) {
        q("newsMsg").textContent = `جاري إنشاء التصميم ${variant} من 3...`;
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
        return `<article class="news-option ${selectedArtIndex === index ? "selected" : ""}" data-news-option="${index}"><img src="data:image/png;base64,${option.b64_json}" alt="التصميم ${index + 1}"><div class="news-option-info"><b>التصميم ${index + 1} — ${esc(score)}</b><small>${esc(review.summary_ar || "مراجعة بصرية غير متاحة.")}</small><button type="button">${selectedArtIndex === index ? "✓ تم اختيار الصورة" : "اختيار هذه الصورة"}</button></div></article>`;
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
    const badges = [parsed.severity, parsed.date, parsed.cve]
      .filter(Boolean)
      .map(
        (x, i) =>
          `<span class="news-badge ${i === 0 && /عالي|حرج/.test(x) ? "sev-high" : ""}">${esc(x)}</span>`,
      )
      .join("");
    q("newsResult").innerHTML =
      `<div class="news-stage"><img class="hero" src="data:image/png;base64,${art}"><div class="news-overlay"></div><img class="news-logo" src="${DARK}"><div class="news-content"><div class="news-head">${esc(parsed.headline)}</div>${badges ? `<div class="news-badges">${badges}</div>` : ""}${parsed.source ? `<div class="news-source">المصدر: <span style="color:#00D1C7">${esc(parsed.source)}</span></div>` : ""}</div></div>`;
    q("newsSave").classList.remove("hidden");
    q("newsShare").classList.remove("hidden");
    q("newsMsg").textContent =
      "تم إنشاء الخبر. التفاصيل والإجراءات موجودة في النص الجاهز للنشر.";
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
    let im = await load("data:image/png;base64," + art),
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
    const meta = [parsed.severity, parsed.date, parsed.cve].filter(Boolean);
    if (meta.length) {
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
