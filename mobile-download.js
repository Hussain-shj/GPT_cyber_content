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
    if (navigator.share && navigator.canShare?.({files:[file]})) { await navigator.share({files:[file],title:'نبض سيبراني | GRC',text:caption}); return; }
    if (caption && navigator.clipboard?.writeText) await navigator.clipboard.writeText(caption).catch(()=>{});
    await saveImage(index); alert('المشاركة المباشرة غير مدعومة في هذا المتصفح. تم تجهيز الصورة ونسخ Caption للحافظة.');
  }

  function makeButton(type,label,index,handler) {
    const b=document.createElement('button');b.type='button';b.className='image-action image-action-'+type;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=ICONS[type]+`<span>${label}</span>`;
    b.addEventListener('click',async()=>{try{b.disabled=true;await handler(index)}catch(e){if(e?.name!=='AbortError')alert(label+': '+(e?.message||e))}finally{b.disabled=false}});return b;
  }

  function applyRtlPreview(){document.querySelectorAll('.overlay-head,.overlay-body,.overlay-footer').forEach(el=>{el.dir='rtl';el.style.direction='rtl';el.style.textAlign='right';el.style.unicodeBidi='plaintext'})}
  function addStyles(){if(document.getElementById('image-action-styles'))return;const s=document.createElement('style');s.id='image-action-styles';s.textContent=`.slide-actions .image-action{display:inline-flex;align-items:center;gap:6px;min-height:38px}.image-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.image-action-regenerate{color:#bfe8ff!important}.image-action-save{color:#bff6df!important}.image-action-share{color:#ffe3a8!important}@media(max-width:520px){.image-action span{font-size:12px}}`;document.head.appendChild(s)}

  function enhance(){addStyles();applyRtlPreview();document.querySelectorAll('.slide').forEach((card,index)=>{const s=getSlide(index),actions=card.querySelector('.slide-actions');if(!actions||!s?.image_b64)return;
    actions.querySelectorAll('[data-mobile-save]').forEach(x=>x.remove());
    const regen=actions.querySelector('[data-img]');if(regen&&!regen.dataset.iconized){regen.dataset.iconized='1';regen.classList.add('image-action','image-action-regenerate');regen.innerHTML=ICONS.regenerate+'<span>إعادة إنشاء</span>';}
    if(!actions.querySelector('[data-save-image]')){const b=makeButton('save','حفظ الصورة',index,saveImage);b.dataset.saveImage=index;actions.appendChild(b)}
    if(!actions.querySelector('[data-share-image]')){const b=makeButton('share','مشاركة الصورة',index,shareImage);b.dataset.shareImage=index;actions.appendChild(b)}
  })}
  const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',enhance);setInterval(enhance,1500);
})();

/* Cyber Pulse News Designer */
(() => {
  const NEWS_W=1080, NEWS_H=1350;
  let newsImageB64='';
  const q=id=>document.getElementById(id);
  const newsEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function newsBidiSafe(text){return String(text||'').replace(/([A-Za-z][A-Za-z0-9./+&_-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./+&_-]*)*)/g,'\u2066$1\u2069')}
  function highlightNews(text){
    const safe=newsEsc(text).replace(/\n/g,'<br>');
    return safe.replace(/(CVE-\d{4}-\d+|\b[A-Z][A-Z0-9._/-]{1,}\b|\b(?:Microsoft|Google|Apple|Cisco|Fortinet|Palo Alto|WordPress|VMware|Oracle|SAP|AWS|Azure|Android|iOS)\b)/g,'<span class="news-key">$1</span>');
  }

  function injectNewsUI(){
    if(q('news'))return;
    const tabs=document.querySelector('.tabs'); if(!tabs)return;
    const tab=document.createElement('button');tab.className='tab';tab.dataset.view='news';tab.textContent='الأخبار السيبرانية';tabs.insertBefore(tab,tabs.querySelector('[data-view="archive"]'));
    const wrap=document.querySelector('.wrap');
    const section=document.createElement('section');section.id='news';section.className='card hidden';
    section.innerHTML=`<div class="section-title"><div><h2 style="margin:0">الأخبار السيبرانية</h2><p style="color:#9eb2c9;margin:6px 0 0">نبض سيبراني | CYBER PULSE — منشور 4:5 بهوية الأخبار المعتمدة.</p></div><span class="counter">NEWS v1</span></div>
      <div class="news-form-grid">
        <div class="full"><label>عنوان / موضوع الخبر <small style="color:#7f98b1">(للسياق واختيار الـVisual، لا يظهر كعنوان منفصل)</small></label><input id="newsTitle" placeholder="مثال: ثغرة حرجة في WordPress تسمح بتنفيذ أكواد"></div>
        <div class="full"><label>نص الخبر كما سيظهر في التصميم</label><textarea id="newsText" rows="8" placeholder="اكتب نص الخبر هنا. يفضل 2–3 فقرات قصيرة."></textarea></div>
        <div class="full"><label>وصف الصورة المطلوبة</label><input id="newsVisual" placeholder="مثال: glowing WordPress logo beside an enterprise web server with a critical vulnerability shield"></div>
      </div>
      <div class="row"><button id="newsGenerate" class="action">إنشاء تصميم الخبر</button><button id="newsSave" class="action secondary hidden">حفظ الصورة</button><button id="newsShare" class="action secondary hidden">مشاركة + Caption</button></div>
      <div id="newsMsg" class="status"></div><div id="newsResult" class="news-result hidden"></div>`;
    wrap.appendChild(section);

    const style=document.createElement('style');style.id='news-styles';style.textContent=`
      .news-form-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:18px}.news-stage{max-width:760px;margin:22px auto 0;position:relative;aspect-ratio:4/5;background:#050B12;border:1px solid #0A84FF55;border-radius:18px;overflow:hidden;box-shadow:0 0 45px #0A84FF22}.news-stage>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.news-stage:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,11,18,.05) 0%,rgba(5,11,18,.18) 34%,rgba(5,11,18,.80) 48%,rgba(5,11,18,.97) 100%);pointer-events:none}.news-copy{position:absolute;z-index:2;right:5.5%;top:9%;bottom:12%;width:57%;padding:28px 24px;border:1px solid #00D1C755;border-radius:18px;direction:rtl;text-align:right;unicode-bidi:plaintext;color:#fff;font-family:'Cairo',Arial,sans-serif;display:flex;align-items:center}.news-copy-inner{font-size:clamp(17px,2vw,29px);font-weight:700;line-height:1.9;width:100%;white-space:normal}.news-copy-inner br{display:block;content:"";margin-bottom:16px}.news-key{color:#00D1C7;font-weight:800;direction:ltr;unicode-bidi:isolate}.news-brand{position:absolute;z-index:3;bottom:3.7%;right:5.5%;color:#fff;font-size:clamp(10px,1.1vw,15px);font-weight:700;letter-spacing:.1px}.news-brand .latin{color:#00D1C7;direction:ltr;unicode-bidi:isolate}.news-version{position:absolute;z-index:3;left:4%;bottom:3.7%;width:10px;height:10px;border-radius:50%;background:#00D1C7;box-shadow:0 0 14px #00D1C7}@media(max-width:720px){.news-copy{width:61%;right:4%;padding:18px 14px}.news-copy-inner{font-size:clamp(14px,3.4vw,22px)}}`;
    document.head.appendChild(style);

    function showNews(){q('studio')?.classList.add('hidden');q('archive')?.classList.add('hidden');q('news')?.classList.remove('hidden');document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='news'))}
    tab.addEventListener('click',showNews);
    document.querySelectorAll('.tab[data-view="studio"],.tab[data-view="archive"]').forEach(b=>b.addEventListener('click',()=>q('news')?.classList.add('hidden')));
    q('newsGenerate').addEventListener('click',generateNews);
    q('newsSave').addEventListener('click',saveNewsImage);
    q('newsShare').addEventListener('click',shareNewsImage);
  }

  function newsPrompt(title,text,visual){return `Create ONLY the background and hero visual layer for a premium Arabic cybersecurity news infographic for the brand "نبض سيبراني | CYBER PULSE". FORMAT: Instagram portrait 4:5, 1080x1350 composition. BRAND: deep black / very dark navy #050B12, Cyber Blue #0A84FF, Cyan #00D1C7, white reserved for later typography, red only if the topic is truly critical. Subtle blue glow, digital grid, circuit lines and cybersecurity HUD elements. Premium corporate media-publication look. No gaming aesthetic, hacker hoodie, masks, skulls or cliché hacker imagery. LAYOUT: LEFT SIDE HERO VISUAL occupying 35–40% of composition. Required hero visual: ${visual||title}. The hero should integrate naturally into the dark background with subtle cyan/blue lighting. RIGHT SIDE: reserve a clean dark text-safe zone occupying about 60–65%, with generous negative space and a thin cyan border/glow. ABSOLUTE RULE: generate ZERO readable text, Arabic, English, letters, numbers, labels, logos, fake UI text, hashtags or pseudo-text. The application will add all correct Arabic typography later in Cairo font. Keep overall layout, colors, spacing and Cyber Pulse identity consistent across every news post. Topic context: ${title}. News meaning for visual context only: ${text}. Final result should look like professional cybersecurity media artwork rather than an AI-generated poster.`}

  async function generateNews(){
    const title=q('newsTitle').value.trim(), text=q('newsText').value.trim(), visual=q('newsVisual').value.trim();
    if(!title||!text){q('newsMsg').textContent='أدخل عنوان الخبر ونص الخبر.';return}
    const b=q('newsGenerate');b.disabled=true;q('newsMsg').textContent='جاري إنشاء Hero Visual بهوية نبض سيبراني...';
    try{
      const r=await fetch('/api/generate-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,body:text,slide_number:1,post_type:'Single Post',domain:'Cybersecurity',visual_style:'Cyber Pulse',visual_direction:newsPrompt(title,text,visual)})});
      const d=await r.json();if(!r.ok)throw new Error(d.detail||'تعذر إنشاء الصورة');newsImageB64=d.b64_json;renderNews();q('newsSave').classList.remove('hidden');q('newsShare').classList.remove('hidden');q('newsMsg').textContent='تم إنشاء التصميم. النص العربي مركّب RTL بخط Cairo.';
    }catch(e){q('newsMsg').textContent='خطأ: '+e.message}finally{b.disabled=false}
  }

  function renderNews(){
    if(!newsImageB64)return;const text=q('newsText').value.trim();
    q('newsResult').classList.remove('hidden');q('newsResult').innerHTML=`<div class="news-stage" id="newsStage"><img src="data:image/png;base64,${newsImageB64}" alt="Cyber Pulse news artwork"><div class="news-copy"><div class="news-copy-inner">${highlightNews(text)}</div></div><div class="news-brand">نبض سيبراني | <span class="latin">CYBER PULSE</span></div><div class="news-version"></div></div>`;
  }

  function loadImg(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src})}
  function newsWrap(ctx,text,maxWidth){const words=String(text||'').split(/\s+/).filter(Boolean),lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(newsBidiSafe(t)).width>maxWidth&&line){lines.push(line);line=w}else line=t}if(line)lines.push(line);return lines}
  function newsRound(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h));}
  async function buildNewsPng(){
    if(!newsImageB64)throw new Error('أنشئ التصميم أولاً');if(document.fonts?.ready)await document.fonts.ready;
    const img=await loadImg('data:image/png;base64,'+newsImageB64), canvas=document.createElement('canvas');canvas.width=NEWS_W;canvas.height=NEWS_H;const ctx=canvas.getContext('2d');
    const ir=img.naturalWidth/img.naturalHeight,cr=NEWS_W/NEWS_H;let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;if(ir>cr){sw=img.naturalHeight*cr;sx=(img.naturalWidth-sw)/2}else{sh=img.naturalWidth/cr;sy=(img.naturalHeight-sh)/2}ctx.drawImage(img,sx,sy,sw,sh,0,0,NEWS_W,NEWS_H);
    const grad=ctx.createLinearGradient(360,0,1080,0);grad.addColorStop(0,'rgba(5,11,18,0.08)');grad.addColorStop(.23,'rgba(5,11,18,0.35)');grad.addColorStop(.55,'rgba(5,11,18,0.88)');grad.addColorStop(1,'rgba(5,11,18,0.98)');ctx.fillStyle=grad;ctx.fillRect(330,0,750,1350);
    ctx.strokeStyle='rgba(0,209,199,.42)';ctx.lineWidth=2;newsRound(ctx,440,120,580,1050,26);ctx.stroke();
    const text=q('newsText').value.trim(), paragraphs=text.split(/\n\s*\n/).filter(Boolean);const len=text.length;const fs=len<220?48:len<360?42:36;ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='top';ctx.font=`700 ${fs}px Cairo, Arial, sans-serif`;ctx.fillStyle='#FFFFFF';let y=190;
    for(const p of paragraphs.slice(0,3)){const lines=newsWrap(ctx,p,500);for(const line of lines){ctx.fillText(newsBidiSafe(line),975,y);y+=fs*1.72;if(y>1100)break}y+=fs*.65;if(y>1100)break}
    ctx.font='700 25px Cairo, Arial, sans-serif';ctx.fillStyle='#FFFFFF';ctx.fillText('نبض سيبراني | \u2066CYBER PULSE\u2069',970,1260);ctx.fillStyle='#00D1C7';ctx.beginPath();ctx.arc(70,1275,8,0,Math.PI*2);ctx.fill();
    return canvas.toDataURL('image/png',1);
  }

  async function newsFile(){const url=await buildNewsPng(),blob=(function(dataUrl){const [h,b]=dataUrl.split(','),bytes=atob(b),a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);return new Blob([a],{type:'image/png'})})(url);return new File([blob],`cyberpulse-news-${Date.now()}.png`,{type:'image/png'})}
  async function saveNewsImage(){try{const f=await newsFile(),u=URL.createObjectURL(f),a=document.createElement('a');a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}catch(e){alert('تعذر حفظ الصورة: '+e.message)}}
  function newsCaption(){return [q('newsTitle').value.trim(),q('newsText').value.trim(),'@cyberpulse_ar'].filter(Boolean).join('\n\n')}
  async function shareNewsImage(){try{const f=await newsFile(),caption=newsCaption();if(navigator.share&&navigator.canShare?.({files:[f]})){await navigator.share({files:[f],title:'نبض سيبراني | CYBER PULSE',text:caption});return}if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(caption).catch(()=>{});await saveNewsImage();alert('تم حفظ الصورة ونسخ Caption لأن المشاركة المباشرة غير مدعومة في هذا المتصفح.')}catch(e){if(e?.name!=='AbortError')alert('تعذر المشاركة: '+e.message)}}

  const ready=()=>injectNewsUI();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();