/* LinkedIn AI Studio premium Cyber Pulse image compositor.
   Loaded after linkedin.js at build time. It only affects Executive Editorial single-post images. */
(() => {
  const previousFetch = window.fetch.bind(window);
  const W = 1080, H = 1350;
  const LOGO = "/cyberpulse-logo-dark.svg";

  const loadImage = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر تحميل عنصر التصميم"));
    img.src = src;
  });

  const isArabic = text => /[\u0600-\u06ff]/.test(String(text || ""));

  function wrap(ctx, text, maxWidth) {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function cleanSummary(title, body) {
    let text = String(body || "")
      .replace(/\r?\n+/g, " ")
      .replace(/[#*_•]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const t = String(title || "").trim();
    if (t && text.startsWith(t)) text = text.slice(t.length).trim();
    return text.slice(0, 330);
  }

  function sceneDirection(title, body) {
    const story = `${title || ""} ${body || ""}`.toLowerCase();
    let scene = "a contemporary UAE government or enterprise decision-making environment directly related to the post topic, with realistic people, documents, screens or operational context only when they add meaning";
    if (/ai|ذكاء اصطناعي|shadow ai|42001/.test(story)) {
      scene = "a contemporary UAE enterprise AI-governance review: Emirati and international professionals evaluating responsible AI use around laptops/tablets with abstract non-readable AI interface shapes, data-governance cues and human oversight; no sci-fi holograms";
    } else if (/مورد|vendor|third-party|third party|supply chain|طرف ثالث/.test(story)) {
      scene = "a realistic third-party risk and vendor-governance review in a UAE enterprise: decision makers evaluating a supplier relationship, contract/service dependency and risk evidence using papers and tablets with non-readable interface shapes";
    } else if (/سياس|policy|policies|امتثال|compliance|iso 27001/.test(story)) {
      scene = "a policy-and-governance working session in a refined UAE enterprise office: leaders reviewing policy lifecycle, accountability and implementation evidence using structured documents and subtle non-readable status visuals; focus on people and decisions rather than a dashboard";
    } else if (/استمراري|resilien|bcp|continuity|recovery|تعافي|incident|حادث/.test(story)) {
      scene = "an enterprise resilience and service-recovery planning scene in the UAE: leadership and operational staff coordinating continuity priorities and recovery decisions with realistic service maps and status cues containing no readable text";
    } else if (/مخاطر|risk|مجلس|board|risk appetite|شهية/.test(story)) {
      scene = "an executive risk decision scene in a premium UAE boardroom: Emirati and international leaders discussing strategic risk, with a simple unlabeled risk matrix or trend visualization secondary to the people and decision; not a SOC dashboard";
    } else if (/ثغرات|vulnerab|patch|remediation|تصحيح/.test(story)) {
      scene = "a realistic vulnerability-governance and remediation-prioritization scene: security and business owners reviewing affected enterprise assets and treatment priorities using non-readable status visuals; no hacker clichés";
    } else if (/توعية|culture|awareness|سلوك|موظف/.test(story)) {
      scene = "a realistic UAE workplace security-culture scene showing employees and leaders discussing safe behavior and accountability in a calm office setting; human-centered and professional";
    }
    return `LINKEDIN EXECUTIVE EDITORIAL FEATURE — NOT BREAKING NEWS. Create only the cinematic background scene. ${scene}. The composition should feel like a premium management magazine cover: dark navy and cyan Cyber Pulse atmosphere, realistic depth, restrained lighting, one dominant scene, visually sophisticated and clean. Keep the top 22% low-detail for the real Cyber Pulse logo and the lower 38% free of critical faces/details because the application will overlay Arabic title and summary there. ABSOLUTELY NO generated text, letters, numbers, logos, watermarks, captions, pseudo-text, floating shields, generic hacker hoodies, Matrix code, sci-fi control rooms or decorative cybersecurity clichés. Choose the scene semantically from the topic; do not force every governance post into a boardroom or dashboard.`;
  }

  function drawCover(ctx, img) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / scale, sh = H / scale;
    const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  async function composeArtwork(rawData, title, body) {
    const src = `data:${rawData.mime_type || "image/jpeg"};base64,${rawData.b64_json}`;
    const [art, logo] = await Promise.all([loadImage(src), loadImage(LOGO)]);
    if (document.fonts?.ready) await document.fonts.ready;
    try { await document.fonts?.load("800 58px Cairo"); } catch {}

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    drawCover(ctx, art);

    const top = ctx.createLinearGradient(0, 0, 0, 300);
    top.addColorStop(0, "rgba(3,10,18,.94)");
    top.addColorStop(.65, "rgba(3,10,18,.42)");
    top.addColorStop(1, "rgba(3,10,18,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 315);

    const bottom = ctx.createLinearGradient(0, 680, 0, H);
    bottom.addColorStop(0, "rgba(3,10,18,0)");
    bottom.addColorStop(.28, "rgba(3,10,18,.55)");
    bottom.addColorStop(.58, "rgba(3,10,18,.90)");
    bottom.addColorStop(1, "rgba(3,10,18,.99)");
    ctx.fillStyle = bottom; ctx.fillRect(0, 650, W, 700);

    ctx.strokeStyle = "#18C7C2";
    ctx.lineWidth = 4;
    roundRect(ctx, 18, 18, W - 36, H - 36, 28);
    ctx.stroke();

    // Real Cyber Pulse logo, never AI-generated.
    const logoW = 330, logoH = logoW * (150 / 520);
    ctx.drawImage(logo, 48, 38, logoW, logoH);

    ctx.direction = isArabic(title) ? "rtl" : "ltr";
    ctx.textAlign = isArabic(title) ? "right" : "left";
    const textX = isArabic(title) ? 992 : 88;
    const maxText = 900;

    ctx.font = "800 58px Cairo, Arial, sans-serif";
    const titleLines = wrap(ctx, title, maxText).slice(0, 3);
    const titleStart = 910 - Math.max(0, titleLines.length - 2) * 44;
    titleLines.forEach((line, i) => {
      ctx.fillStyle = i === titleLines.length - 1 && titleLines.length > 1 ? "#21D4D0" : "#FFFFFF";
      ctx.fillText(line, textX, titleStart + i * 76);
    });

    const accentY = titleStart + titleLines.length * 76 + 8;
    ctx.fillStyle = "#18C7C2";
    if (isArabic(title)) ctx.fillRect(780, accentY, 212, 5); else ctx.fillRect(88, accentY, 212, 5);

    const summary = cleanSummary(title, body);
    ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.font = "500 28px Cairo, Arial, sans-serif";
    ctx.fillStyle = "rgba(238,246,255,.94)";
    wrap(ctx, summary, 900).slice(0, 3).forEach((line, i) => ctx.fillText(line, 992, accentY + 50 + i * 44));

    const footerY = 1278;
    const chips = ["حوكمة", "مخاطر", "قرار"];
    let chipX = 990;
    ctx.font = "700 22px Cairo, Arial, sans-serif";
    for (const chip of chips) {
      const tw = ctx.measureText(chip).width + 44;
      chipX -= tw;
      roundRect(ctx, chipX, footerY - 32, tw, 42, 21);
      ctx.fillStyle = "rgba(10,132,255,.16)"; ctx.fill();
      ctx.strokeStyle = "rgba(24,199,194,.55)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#DFFBFA"; ctx.textAlign = "center"; ctx.fillText(chip, chipX + tw / 2, footerY - 3);
      chipX -= 12;
    }
    ctx.textAlign = "left";
    ctx.font = "600 20px Cairo, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fillText("CYBER PULSE • EXECUTIVE EDITORIAL", 56, footerY - 3);

    const dataUrl = canvas.toDataURL("image/jpeg", .94);
    return dataUrl.split(",")[1];
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    let payload = null;
    let nextInit = init;
    let isLinkedInEditorial = false;

    if (url.includes("/api/generate-image") && init?.body) {
      try {
        payload = JSON.parse(init.body);
        isLinkedInEditorial = payload?.visual_style === "Cyber Pulse" && /EXECUTIVE EDITORIAL/i.test(String(payload?.visual_direction || ""));
        if (isLinkedInEditorial) {
          const originalTitle = payload.title || "";
          const originalBody = payload.body || "";
          payload.visual_direction = sceneDirection(originalTitle, originalBody);
          payload.body = `EDITORIAL FEATURE — NOT INCIDENT NEWS. Do not invent a vendor, CVE, breach, attack path or technical incident. Treat this as enterprise governance thought leadership. Original post context: ${originalBody}`.slice(0, 2600);
          nextInit = {...init, body: JSON.stringify(payload)};
          payload.__overlay_title = originalTitle;
          payload.__overlay_body = originalBody;
        }
      } catch {}
    }

    const response = await previousFetch(input, nextInit);
    if (!isLinkedInEditorial || !response.ok) return response;

    try {
      const data = await response.clone().json();
      if (!data?.b64_json) return response;
      data.b64_json = await composeArtwork(data, payload.__overlay_title, payload.__overlay_body);
      data.mime_type = "image/jpeg";
      data.overlay_required = false;
      data.artwork_version = "linkedin-premium-cyberpulse-v1";
      data.linkedin_brand_composited = true;
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.delete("Content-Length");
      return new Response(JSON.stringify(data), {status: response.status, statusText: response.statusText, headers});
    } catch (error) {
      console.warn("Cyber Pulse LinkedIn compositor fallback:", error);
      return response;
    }
  };
})();
