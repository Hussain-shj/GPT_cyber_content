(() => {
  const W = 1080, H = 1350;
  const ICONS = {
    regenerate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-3M4 4v4h4M4 13a8.1 8.1 0 0 0 15.5 3M20 20v-4h-4"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.7 10.7l6.6-4.1M8.7 13.3l6.6 4.1"/></svg>'
  };

  function bidiSafe(text) {
    return String(text || '').replace(/([A-Za-z][A-Za-z0-9./+&_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./+&_-]*)*)/g, '\u2066$1\u2069');
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(bidiSafe(test)).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
  }

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(','), mime = (head.match(/data:([^;]+)/) || [,'image/png'])[1];
    const bytes = atob(body), arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function getSlide(index) { try { return current?.data?.slides?.[index] || null; } catch { return null; } }
  function getCaption() {
    try {
      const d = current?.data || {};
      const parts = [d.caption, d.cta, ...(d.hashtags || [])].filter(Boolean);
      return parts.join('\n\n').trim();
    } catch { return ''; }
  }

  function buildFinalPng(index) {
    const s = getSlide(index); if (!s?.image_b64) throw new Error('الصورة غير جاهزة بعد');
    const card = document.querySelectorAll('.slide')[index], img = card?.querySelector('.art > img');
    if (!img || !img.complete || !img.naturalWidth) throw new Error('انتظر اكتمال تحميل الصورة ثم جرّب مرة أخرى');
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d');
    const ir = img.naturalWidth / img.naturalHeight, cr = W / H; let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
    if (ir > cr) { sw = img.naturalHeight * cr; sx = (img.naturalWidth - sw) / 2; } else { sh = img.naturalWidth / cr; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H); ctx.direction='rtl'; ctx.textAlign='right'; ctx.textBaseline='top';
    ctx.fillStyle='rgba(255,255,255,.90)'; roundRect(ctx,55,55,970,235,28); ctx.fill(); ctx.fillStyle='#0a2454'; ctx.font='800 54px Cairo, Arial, sans-serif';
    wrapText(ctx,s.headline,900).slice(0,3).forEach((line,n)=>ctx.fillText(bidiSafe(line),970,82+n*70));
    ctx.font='600 31px Cairo, Arial, sans-serif'; const bLines=wrapText(ctx,s.body,500).slice(0,6), bodyH=55+bLines.length*48;
    ctx.fillStyle='rgba(255,255,255,.88)'; roundRect(ctx,500,330,525,bodyH,26); ctx.fill(); ctx.fillStyle='#172b48';
    bLines.forEach((line,n)=>ctx.fillText(bidiSafe(line),975,355+n*48));
    ctx.fillStyle='rgba(255,255,255,.92)'; roundRect(ctx,260,1243,705,72,20); ctx.fill(); ctx.fillStyle='#102b61'; ctx.font='700 27px Cairo, Arial, sans-serif';
    ctx.fillText('نبض سيبراني | \u2066GRC\u2069 | \u2066@cyberpulse_ar\u2069',930,1263);
    ctx.beginPath();ctx.arc(95,1278,46,0,Math.PI*2);ctx.fillStyle='#08295c';ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 34px Cairo, Arial, sans-serif';ctx.fillText(String(s.number||index+1),95,1278);
    return canvas.toDataURL('image/png',1);
  }

  async function preparedFile(index) {
    if (document.fonts?.ready) await document.fonts.ready;
    const blob=dataUrlToBlob(buildFinalPng(index)), slide=getSlide(index);
    return new File([blob],`cyberpulse-grc-slide-${slide?.number||index+1}.png`,{type:'image/png'});
  }

  async function saveImage(index) {
    const file=await preparedFile(index), url=URL.createObjectURL(file), a=document.createElement('a');
    a.href=url;a.download=file.name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  async function shareImage(index) {
    const file=await preparedFile(index), caption=getCaption();
    // Web Share API: pass the final PNG together with the generated post caption.
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file],title:'نبض سيبراني | GRC',text:caption}); return;
    }
    // Desktop/fallback: copy caption first, then save the image so both are ready for posting.
    if (caption && navigator.clipboard?.writeText) await navigator.clipboard.writeText(caption).catch(()=>{});
    await saveImage(index);
    alert('المشاركة المباشرة غير مدعومة في هذا المتصفح. تم تجهيز الصورة ونسخ Caption للحافظة.');
  }

  function makeButton(type,label,index,handler) {
    const b=document.createElement('button');b.type='button';b.className='image-action image-action-'+type;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=ICONS[type]+`<span>${label}</span>`;
    b.addEventListener('click',async()=>{try{b.disabled=true;await handler(index)}catch(e){if(e?.name!=='AbortError')alert(label+': '+(e?.message||e))}finally{b.disabled=false}});return b;
  }

  function applyRtlPreview(){document.querySelectorAll('.overlay-head,.overlay-body,.overlay-footer').forEach(el=>{el.dir='rtl';el.style.direction='rtl';el.style.textAlign='right';el.style.unicodeBidi='plaintext'})}
  function addStyles(){if(document.getElementById('image-action-styles'))return;const s=document.createElement('style');s.id='image-action-styles';s.textContent=`.slide-actions .image-action{display:inline-flex;align-items:center;gap:6px;min-height:38px}.image-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.image-action-regenerate{color:#bfe8ff!important}.image-action-save{color:#bff6df!important}.image-action-share{color:#ffe3a8!important}@media(max-width:520px){.image-action span{font-size:12px}}`;document.head.appendChild(s)}

  function enhance(){addStyles();applyRtlPreview();document.querySelectorAll('.slide').forEach((card,index)=>{const s=getSlide(index),actions=card.querySelector('.slide-actions');if(!actions||!s?.image_b64)return;
    // Replace the old generic save/share button and visually distinguish regenerate.
    actions.querySelectorAll('[data-mobile-save]').forEach(x=>x.remove());
    const regen=actions.querySelector('[data-img]');if(regen&&!regen.dataset.iconized){regen.dataset.iconized='1';regen.classList.add('image-action','image-action-regenerate');regen.innerHTML=ICONS.regenerate+'<span>إعادة إنشاء</span>';}
    if(!actions.querySelector('[data-save-image]')){const b=makeButton('save','حفظ الصورة',index,saveImage);b.dataset.saveImage=index;actions.appendChild(b)}
    if(!actions.querySelector('[data-share-image]')){const b=makeButton('share','مشاركة الصورة',index,shareImage);b.dataset.shareImage=index;actions.appendChild(b)}
  })}
  const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',enhance);setInterval(enhance,1500);
})();