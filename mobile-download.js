(() => {
  const W = 1080, H = 1350;

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? word + ' ' + line : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const mime = (head.match(/data:([^;]+)/) || [,'image/png'])[1];
    const bytes = atob(body);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function getSlide(index) {
    try { return current?.data?.slides?.[index] || null; }
    catch { return null; }
  }

  function buildFinalPng(index) {
    const s = getSlide(index);
    if (!s?.image_b64) throw new Error('الصورة غير جاهزة بعد');

    const card = document.querySelectorAll('.slide')[index];
    const img = card?.querySelector('.art > img');
    if (!img || !img.complete || !img.naturalWidth) throw new Error('انتظر اكتمال تحميل الصورة ثم جرّب مرة أخرى');

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Artwork, cover crop into 4:5.
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = W / H;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (ir > cr) { sw = img.naturalHeight * cr; sx = (img.naturalWidth - sw) / 2; }
    else { sh = img.naturalWidth / cr; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    // Headline readable area.
    ctx.fillStyle = 'rgba(255,255,255,.90)';
    roundRect(ctx, 55, 55, 970, 235, 28); ctx.fill();
    ctx.fillStyle = '#0a2454';
    ctx.font = '800 54px Cairo, Arial, sans-serif';
    const hLines = wrapText(ctx, s.headline, 900).slice(0, 3);
    hLines.forEach((line, n) => ctx.fillText(line, 970, 82 + n * 70));

    // Body card.
    ctx.font = '600 31px Cairo, Arial, sans-serif';
    const bLines = wrapText(ctx, s.body, 500).slice(0, 6);
    const bodyH = 55 + bLines.length * 48;
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    roundRect(ctx, 500, 330, 525, bodyH, 26); ctx.fill();
    ctx.fillStyle = '#172b48';
    bLines.forEach((line, n) => ctx.fillText(line, 975, 355 + n * 48));

    // Footer identity.
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    roundRect(ctx, 260, 1243, 705, 72, 20); ctx.fill();
    ctx.fillStyle = '#102b61';
    ctx.font = '700 27px Cairo, Arial, sans-serif';
    ctx.fillText('نبض سيبراني | GRC | @cyberpulse_ar', 930, 1263);

    // Slide number fixed bottom-left.
    ctx.beginPath(); ctx.arc(95, 1278, 46, 0, Math.PI * 2); ctx.fillStyle = '#08295c'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 34px Cairo, Arial, sans-serif'; ctx.fillText(String(s.number || index + 1), 95, 1278);

    return canvas.toDataURL('image/png', 1);
  }

  async function saveOrShare(index) {
    const btn = document.querySelector(`[data-mobile-save="${index}"]`);
    const old = btn?.textContent;
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'جاري تجهيز الصورة...'; }
      if (document.fonts?.ready) await document.fonts.ready;
      const dataUrl = buildFinalPng(index);
      const blob = dataUrlToBlob(dataUrl);
      const slide = getSlide(index);
      const filename = `cyberpulse-grc-slide-${slide?.number || index + 1}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'نبض سيبراني | GRC' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        setTimeout(() => {
          const w = window.open(url, '_blank');
          if (!w) alert('إذا لم يبدأ الحفظ، اضغط مطولًا على الصورة واختر «حفظ في الصور».');
        }, 100);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') alert('تعذر حفظ الصورة: ' + (e?.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old || 'حفظ / مشاركة'; }
    }
  }

  function enhance() {
    document.querySelectorAll('.slide').forEach((card, index) => {
      const s = getSlide(index);
      const actions = card.querySelector('.slide-actions');
      if (!actions || !s?.image_b64 || actions.querySelector('[data-mobile-save]')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'حفظ / مشاركة';
      b.setAttribute('data-mobile-save', String(index));
      b.addEventListener('click', () => saveOrShare(index));
      actions.appendChild(b);
    });
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', enhance);
  setInterval(enhance, 1500);
})();
