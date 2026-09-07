/* Latest Cybersecurity News Search — sources from uploaded Global Cybersecurity Resources */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function responseData(response) {
    const raw = await response.text();
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch {
      if (/upstream error|bad gateway|service unavailable|gateway timeout/i.test(raw)) {
        throw new Error('الخدمة الخارجية غير متاحة مؤقتًا. انتظر قليلًا ثم أعد المحاولة.');
      }
      throw new Error(`استجابة غير صالحة من الخادم (HTTP ${response.status}).`);
    }
  }
  const waitForNews = () => new Promise(resolve => {
    const found = document.getElementById('news');
    if (found) return resolve(found);
    const obs = new MutationObserver(() => {
      const el = document.getElementById('news');
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  });

  async function init() {
    const section = await waitForNews();
    if (document.getElementById('newsSearchNow')) return;

    const title = section.querySelector('.section-title');
    const panel = document.createElement('div');
    panel.id = 'newsSearchPanel';
    panel.innerHTML = `
      <div class="news-search-toolbar">
        <button id="newsSearchNow" class="action">🔎 ابحث الآن</button>
        <span class="news-search-note">أحدث الأخبار من المصادر المعتمدة في ملف Global Cybersecurity Resources</span>
      </div>
      <div id="newsSearchStatus" class="status"></div>
      <div id="newsSearchResults" class="news-search-results"></div>`;
    title.insertAdjacentElement('afterend', panel);

    const style = document.createElement('style');
    style.textContent = `
      .news-search-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0 4px}
      .news-search-note{color:#9eb2c9;font-size:12px}
      .news-search-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 18px}
      .news-search-card{background:#081827;border:1px solid #294760;border-radius:13px;padding:13px;cursor:pointer;text-align:right;color:#fff;transition:.18s}
      .news-search-card:hover{border-color:#1bd3cf;background:#0d2334;transform:translateY(-1px)}
      .news-search-card h4{margin:0 0 8px;font-size:15px;line-height:1.55}
      .news-search-meta{display:flex;gap:7px;flex-wrap:wrap;color:#77f2ee;font-size:11px;margin-bottom:7px}
      .news-search-card p{margin:0;color:#b8c8d9;font-size:12px;line-height:1.65}
      .news-search-source{margin-top:8px;color:#7f95aa;font-size:11px}
      @media(max-width:760px){.news-search-results{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    document.getElementById('newsSearchNow').onclick = searchNow;
  }

  async function searchNow() {
    const btn = document.getElementById('newsSearchNow');
    const status = document.getElementById('newsSearchStatus');
    const results = document.getElementById('newsSearchResults');
    btn.disabled = true;
    results.innerHTML = '';
    status.textContent = 'جاري البحث في أحدث الأخبار السيبرانية من المصادر المعتمدة...';
    try {
      const r = await fetch('/api/search-news', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
      const d = await responseData(r);
      if (!r.ok) throw new Error(d.detail || 'تعذر البحث');
      const items = d.items || [];
      if (!items.length) {
        status.textContent = 'لم يتم العثور على أخبار حديثة مناسبة في المصادر المعتمدة.';
        return;
      }
      status.textContent = `تم العثور على ${items.length} أخبار. اختر خبرًا لبدء التصميم.`;
      results.innerHTML = items.map((n,i) => `
        <button class="news-search-card" data-news-index="${i}">
          <h4>${esc(n.title_ar || n.title_original)}</h4>
          <div class="news-search-meta">
            ${n.date ? `<span>${esc(n.date)}</span>` : ''}
            ${n.content_type ? `<span>${esc(n.content_type)}</span>` : ''}
            ${n.severity ? `<span>${esc(n.severity)}</span>` : ''}
          </div>
          <p>${esc(n.summary_ar || '')}</p>
          <div class="news-search-source">${esc(n.source || '')}</div>
        </button>`).join('');
      results.querySelectorAll('[data-news-index]').forEach(b => b.onclick = () => selectNews(items[Number(b.dataset.newsIndex)]));
    } catch(e) {
      status.textContent = 'خطأ في البحث: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  function selectNews(n) {
    const title = document.getElementById('newsTitle');
    const text = document.getElementById('newsText');
    const status = document.getElementById('newsSearchStatus');
    if (!title || !text) return;
    title.value = n.title_ar || n.title_original || '';
    text.value = [
      n.date ? `التاريخ: ${n.date}` : '',
      n.content_type ? `النوع: ${n.content_type}` : '',
      n.severity ? `درجة الخطورة: ${n.severity}` : '',
      n.cve ? `CVE: ${n.cve}` : '',
      '',
      n.news_text_ar || n.summary_ar || '',
      '',
      n.recommendations?.length ? 'الإجراءات الموصى بها\n' + n.recommendations.map(x => '• ' + x).join('\n') : '',
      '',
      n.source ? `المصدر: ${n.source}` : '',
      n.url ? `الرابط: ${n.url}` : ''
    ].filter((x,idx,arr) => x !== '' || (idx>0 && arr[idx-1] !== '')).join('\n').trim();
    status.textContent = 'تم اختيار الخبر. جاري تحليل الخبر وتوليد الصورة المقترحة...';
    document.getElementById('newsSuggest')?.click();
    document.getElementById('newsResult')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Publish-ready news copy with hashtags */
(() => {
  let latestPost = '';
  const originalFetch = window.fetch.bind(window);

  function buildPost(data) {
    const fallback = [data.headline, data.summary, '@cyberpulse_ar'].filter(Boolean).join('\n\n');
    const hashtags = (data.hashtags || [])
      .map(tag => String(tag).trim())
      .filter(Boolean)
      .map(tag => tag.startsWith('#') ? tag : '#' + tag.replace(/^#+/, ''))
      .join(' ');
    return [data.caption || fallback, hashtags].filter(Boolean).join('\n\n');
  }

  function ensurePanel() {
    const news = document.getElementById('news');
    if (!news || document.getElementById('newsPostPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'newsPostPanel';
    panel.className = 'news-post-panel hidden';
    panel.innerHTML = `
      <div class="news-post-head">
        <h3>نص جاهز للينكدإن وإنستغرام</h3>
        <button id="newsCopyPost" class="copy-btn">نسخ النص والهاشتاقات</button>
      </div>
      <textarea id="newsPostText" rows="12" readonly></textarea>`;
    news.appendChild(panel);

    const style = document.createElement('style');
    style.textContent = `
      .news-post-panel{max-width:920px;margin:22px auto 0;padding:16px;background:#081827;border:1px solid #294760;border-radius:14px}
      .news-post-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .news-post-head h3{margin:0}
      .news-post-panel textarea{margin-top:12px;min-height:230px;line-height:1.9;direction:rtl;text-align:right;resize:vertical;background:#050f1b}`;
    document.head.appendChild(style);

    document.getElementById('newsCopyPost').onclick = async () => {
      if (!latestPost) return;
      const status = document.getElementById('newsMsg');
      try {
        await navigator.clipboard.writeText(latestPost);
      } catch {
        const field = document.getElementById('newsPostText');
        field.focus();
        field.select();
        document.execCommand('copy');
      }
      if (status) status.textContent = 'تم نسخ النص المنسق والهاشتاقات.';
    };
  }

  function showPost(data) {
    ensurePanel();
    latestPost = buildPost(data);
    const panel = document.getElementById('newsPostPanel');
    const field = document.getElementById('newsPostText');
    if (!panel || !field || !latestPost) return;
    field.value = latestPost;
    panel.classList.remove('hidden');
    window.dispatchEvent(new CustomEvent('cyberpulse:news-ready', {detail:data}));
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.includes('/api/parse-news') && response.ok) {
      response.clone().json().then(showPost).catch(() => {});
    }
    return response;
  };

  const observer = new MutationObserver(ensurePanel);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensurePanel);
  else ensurePanel();
})();

/* Bytez text-to-video option */
(() => {
  let latestNews = null;
  let pollTimer = null;

  function ensureVideoPanel() {
    const news = document.getElementById('news');
    if (!news || document.getElementById('newsVideoPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'newsVideoPanel';
    panel.className = 'news-video-panel hidden';
    panel.innerHTML = `
      <div class="news-video-head">
        <div><h3>إنشاء فيديو للخبر</h3><p>فيديو بصري بدون نصوص؛ مناسب كخلفية Reels أو LinkedIn.</p></div>
      </div>
      <div class="news-video-options">
        <label>القالب<select id="newsVideoStyle"><option value="Breaking News">خبر عاجل</option><option value="Cyber Awareness">توعية سيبرانية</option><option value="GRC">GRC</option></select></label>
        <label>المدة التقريبية<select id="newsVideoDuration"><option value="5">5 ثوانٍ</option><option value="10">10 ثوانٍ</option><option value="15">15 ثانية</option></select></label>
      </div>
      <button id="newsGenerateVideo" class="action">🎬 إنشاء الفيديو عبر Bytez</button>
      <div id="newsVideoStatus" class="status"></div>
      <div id="newsVideoResult"></div>`;
    news.appendChild(panel);
    const style = document.createElement('style');
    style.textContent = `
      .news-video-panel{max-width:920px;margin:18px auto 0;padding:16px;background:#081827;border:1px solid #294760;border-radius:14px}
      .news-video-head h3{margin:0}.news-video-head p{margin:4px 0 12px;color:#9eb2c9;font-size:12px}
      .news-video-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
      .news-video-result{margin-top:12px}.news-video-result video{display:block;width:min(100%,430px);aspect-ratio:9/16;object-fit:cover;background:#02070c;border-radius:14px}
      .news-video-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.news-video-actions a{display:inline-block;text-decoration:none}
      @media(max-width:640px){.news-video-options{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('newsGenerateVideo').onclick = generateVideo;
  }

  async function generateVideo() {
    if (!latestNews) return;
    const btn = document.getElementById('newsGenerateVideo');
    const status = document.getElementById('newsVideoStatus');
    const result = document.getElementById('newsVideoResult');
    btn.disabled = true;
    result.innerHTML = '';
    status.textContent = 'بدأ توليد الفيديو. قد تستغرق العملية عدة دقائق...';
    try {
      const response = await fetch('/api/news-video', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        headline:latestNews.headline,
        summary:latestNews.summary,
        threat_type:latestNews.threat_type || 'خبر سيبراني',
        visual_brief:latestNews.visual_brief || '',
        style:document.getElementById('newsVideoStyle').value,
        duration:Number(document.getElementById('newsVideoDuration').value)
      })});
      const job = await responseData(response);
      if (!response.ok) throw new Error(job.detail || 'تعذر بدء توليد الفيديو');
      poll(job.id);
    } catch (error) {
      status.textContent = 'خطأ: ' + error.message;
      btn.disabled = false;
    }
  }

  async function poll(jobId) {
    clearTimeout(pollTimer);
    const status = document.getElementById('newsVideoStatus');
    const btn = document.getElementById('newsGenerateVideo');
    try {
      const response = await fetch('/api/news-video/' + encodeURIComponent(jobId));
      const job = await responseData(response);
      if (!response.ok) throw new Error(job.detail || 'تعذر قراءة حالة الفيديو');
      if (job.status === 'processing') {
        status.textContent = 'Bytez يعالج الفيديو الآن... يمكنك إبقاء الصفحة مفتوحة.';
        pollTimer = setTimeout(() => poll(jobId), 5000);
        return;
      }
      btn.disabled = false;
      if (job.status === 'failed') throw new Error(job.detail || 'فشل توليد الفيديو');
      status.textContent = 'تم إنشاء الفيديو بنجاح.';
      const url = String(job.video_url || '');
      const safeUrl = /^https:\/\//i.test(url) || /^data:video\//i.test(url) ? url : '';
      if (!safeUrl) throw new Error('لم يُرجع Bytez رابط فيديو صالحًا');
      document.getElementById('newsVideoResult').innerHTML = `<div class="news-video-result"><video controls playsinline src="${safeUrl.replace(/"/g,'&quot;')}"></video><div class="news-video-actions"><a class="action secondary" href="${safeUrl.replace(/"/g,'&quot;')}" target="_blank" rel="noopener">فتح / تنزيل MP4</a><button class="action secondary" id="newsVideoAgain">إنشاء نسخة أخرى</button></div></div>`;
      document.getElementById('newsVideoAgain').onclick = generateVideo;
    } catch (error) {
      clearTimeout(pollTimer);
      status.textContent = 'خطأ: ' + error.message;
      btn.disabled = false;
    }
  }

  window.addEventListener('cyberpulse:news-ready', event => {
    latestNews = event.detail;
    ensureVideoPanel();
    document.getElementById('newsVideoPanel')?.classList.remove('hidden');
  });
  const observer = new MutationObserver(ensureVideoPanel);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureVideoPanel); else ensureVideoPanel();
})();

/* Cyber Pulse posts: supporting A4 PDF using the existing verified PDF engine */
(() => {
  const q = id => document.getElementById(id);
  async function json(response){
    const raw=await response.text();
    let body={};
    if(raw){try{body=JSON.parse(raw)}catch{throw new Error(`استجابة غير صالحة (HTTP ${response.status})`)}}
    if(!response.ok)throw new Error(body.detail||`HTTP ${response.status}`);
    return body;
  }
  async function request(path,options={}){
    return json(await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options}));
  }
  function bytesFromBase64(value){
    const raw=atob(String(value||''));
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }
  function downloadStored(file){
    const blob=new Blob([bytesFromBase64(file.data_b64)],{type:file.mime_type||'application/pdf'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=file.name||'cyber-pulse-guide.pdf';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),20000);
  }
  async function createPdf(){
    if(typeof pulseCurrent==='undefined'||!pulseCurrent?.id)throw new Error('أنشئ المنشور واحفظه أولًا.');
    const meta=pulseCurrent.meta||pulseCurrent.data?.cyber_pulse_meta||{};
    const shadowId=`pulse-support-${pulseCurrent.id}`.slice(0,190);
    const title=String(pulseCurrent.data?.title||pulseCurrent.topic||'دليل نبض سيبراني');
    const payload={
      id:shadowId,week:1,day:'نبض سيبراني',pillar:meta.pillar||'Guides',objective:meta.objective||'Download',
      post_type:'Carousel',title,status:'REVIEW',text:typeof pulseText==='function'?pulseText(pulseCurrent.data):String(pulseCurrent.data?.caption||''),
      content:{...pulseCurrent.data,cyber_pulse_shadow:true},quality:{}
    };
    await request('/api/linkedin/studio/posts',{method:'POST',body:JSON.stringify(payload)});
    try{
      const generated=await request(`/api/linkedin/studio/posts/${encodeURIComponent(shadowId)}/supporting-file/generate`,{method:'POST',body:JSON.stringify({file_type:'دليل عملي',title})});
      const assets=await request(`/api/linkedin/studio/posts/${encodeURIComponent(shadowId)}/assets`);
      const asset=assets.find(x=>x.id===generated.id&&x.kind==='supporting_file');
      if(!asset?.data_b64)throw new Error('تم إنشاء الملف ولكن تعذر استرجاع بيانات PDF.');
      const file={id:generated.id,name:asset.name||generated.name,mime_type:asset.mime_type||'application/pdf',data_b64:asset.data_b64,size:generated.size,pages:generated.pages,points:generated.points,page_size:generated.page_size,research_mode:generated.research_mode,sources:generated.sources||[]};
      pulseCurrent.data.cyber_pulse_supporting_files=[file];
      if(typeof savePulse==='function')await savePulse();
      if(typeof renderPulseResult==='function')renderPulseResult();
      return file;
    }finally{
      try{await request(`/api/linkedin/studio/posts/${encodeURIComponent(shadowId)}`,{method:'DELETE'})}catch{}
    }
  }
  function enhance(){
    if(typeof pulseCurrent==='undefined'||!pulseCurrent)return;
    const result=q('pulseResult');
    if(!result||result.classList.contains('hidden'))return;
    const meta=pulseCurrent.meta||pulseCurrent.data?.cyber_pulse_meta||{};
    if(meta.format!=='Guide + PDF')return;
    const panel=result.querySelector('.pulse-panel');
    if(!panel||panel.querySelector('[data-pulse-pdf-panel]'))return;
    const box=document.createElement('div');
    box.dataset.pulsePdfPanel='1';box.className='pulse-note';
    const existing=(pulseCurrent.data.cyber_pulse_supporting_files||[])[0];
    box.innerHTML=existing
      ? `<strong>الملف الداعم جاهز</strong><br>${existing.page_size||'A4'} • ${existing.pages||'-'} صفحات • ${existing.points||0} نقطة<div class="row" style="margin-top:10px"><button class="action secondary" data-pulse-download-pdf>تحميل PDF</button><button class="action secondary" data-pulse-regenerate-pdf>إعادة توليد PDF</button></div>`
      : `<strong>ملف Guide + PDF</strong><br>سيتم إنشاء ملف A4 بهوية نبض سيبراني مع التحقق من عدد النقاط قبل الحفظ.<div class="row" style="margin-top:10px"><button class="action" data-pulse-generate-pdf>إنشاء PDF الداعم</button></div>`;
    panel.appendChild(box);
    box.querySelector('[data-pulse-download-pdf]')?.addEventListener('click',()=>downloadStored(existing));
    const build=async button=>{button.disabled=true;q('pulseMsg').textContent='جاري إنشاء ملف A4 والتحقق من عدد النقاط والمصادر...';try{const file=await createPdf();q('pulseMsg').textContent=`تم إنشاء PDF ${file.page_size} من ${file.pages} صفحات ويحتوي على ${file.points} نقطة.`;downloadStored(file)}catch(e){q('pulseMsg').textContent='خطأ في إنشاء PDF: '+e.message}finally{button.disabled=false;setTimeout(enhance,50)}};
    box.querySelector('[data-pulse-generate-pdf]')?.addEventListener('click',e=>build(e.currentTarget));
    box.querySelector('[data-pulse-regenerate-pdf]')?.addEventListener('click',e=>build(e.currentTarget));
  }
  const observer=new MutationObserver(enhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(enhance,1200);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();

/* Cyber Pulse card addon — safe preview + download decoration */
(() => {
  const RIGHTS = 'Cyber Pulse | نبض سيبراني • linkedin.com/company/cyberpulse-me';
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 150" role="img" aria-label="نبض سيبراني Cyber Pulse"><rect width="520" height="150" rx="18" fill="#050B12"/><g transform="translate(22 18)"><path d="M58 5 101 25v34c0 30-18 49-43 61C33 108 15 89 15 59V25L58 5Z" fill="none" stroke="#0A84FF" stroke-width="6"/><path d="M25 60h18l8-19 13 39 11-28 8 8h20" fill="none" stroke="#00D1C7" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g><text x="145" y="66" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#FFFFFF">نبض سيبراني</text><text x="147" y="105" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="7" fill="#00D1C7">CYBER PULSE</text><text x="147" y="132" font-family="Arial,sans-serif" font-size="15" fill="#FFFFFF">معلومة موثوقة .. وحماية تبدأ بالوعي</text></svg>`;
  const LOGO_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);

  function addStyles() {
    if (document.getElementById('cyberPulseCardAddonStyle')) return;
    const style = document.createElement('style');
    style.id = 'cyberPulseCardAddonStyle';
    style.textContent = `
      .pulse-slide .art{position:relative}
      .cp-addon-logo{position:absolute;top:2.6%;left:5%;width:29%;height:auto!important;z-index:6;object-fit:contain!important;filter:drop-shadow(0 2px 10px rgba(0,0,0,.35))}
      .cp-addon-rights{position:absolute;left:15%;right:15%;bottom:1.7%;z-index:6;text-align:center;direction:ltr;color:#b9cfe0;font-size:clamp(7px,.66vw,10px);font-weight:600;white-space:nowrap;text-shadow:0 1px 5px #050B14}
      .pulse-slide .overlay-body{overflow:visible!important;display:block!important;-webkit-line-clamp:unset!important}
      .pulse-slide .overlay-footer{display:none!important}
      .pulse-slide .slide-no{z-index:7}
    `;
    document.head.appendChild(style);
  }

  function decoratePreviews() {
    addStyles();
    document.querySelectorAll('.pulse-slide .art').forEach(art => {
      if (!art.querySelector('.cp-addon-logo')) {
        const logo = document.createElement('img');
        logo.className = 'cp-addon-logo';
        logo.src = LOGO_URL;
        logo.alt = 'نبض سيبراني | Cyber Pulse';
        art.appendChild(logo);
      }
      if (!art.querySelector('.cp-addon-rights')) {
        const rights = document.createElement('div');
        rights.className = 'cp-addon-rights';
        rights.textContent = RIGHTS;
        art.appendChild(rights);
      }
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function roundRect(ctx,x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
  }

  function wrapAll(ctx,text,maxWidth){
    const words=String(text||'').trim().split(/\s+/);const lines=[];let line='';
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth||!line){line=test}else{lines.push(line);line=word}}
    if(line)lines.push(line);return lines;
  }

  function fitLines(ctx,text,maxWidth,maxLines,startSize,minSize,weight){
    for(let size=startSize;size>=minSize;size--){ctx.font=`${weight} ${size}px Cairo, Arial`;const lines=wrapAll(ctx,text,maxWidth);if(lines.length<=maxLines)return {size,lines}}
    ctx.font=`${weight} ${minSize}px Cairo, Arial`;return {size:minSize,lines:wrapAll(ctx,text,maxWidth)};
  }

  async function buildFinalFromCard(index) {
    const cards=[...document.querySelectorAll('.pulse-slide')];
    const card=cards[index]; if(!card) throw new Error('تعذر العثور على الشريحة.');
    const art=card.querySelector('.art');
    const raw=art?.querySelector('img:not(.cp-addon-logo)');
    if(!raw?.src) throw new Error('أنشئ الصورة أولاً ثم أعد التحميل.');
    await document.fonts?.ready;
    const headline=(card.querySelector('.slide-info h4')?.textContent||card.querySelector('.overlay-head')?.textContent||'').trim();
    const body=(card.querySelector('.slide-info p')?.textContent||card.querySelector('.overlay-body')?.textContent||'').trim();
    const number=(card.querySelector('.slide-no')?.textContent||String(index+1)).trim();
    const active=document.querySelector('.pulse-pillar.active b')?.textContent||'رؤى';
    const badge=(active.split('|')[0]||'رؤى').trim();

    const W=1080,H=1350,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    const img=await loadImage(raw.src);const scale=Math.max(W/img.naturalWidth,H/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);

    const top=ctx.createLinearGradient(0,0,0,430);top.addColorStop(0,'rgba(5,11,20,.90)');top.addColorStop(1,'rgba(5,11,20,0)');ctx.fillStyle=top;ctx.fillRect(0,0,W,430);
    const bottom=ctx.createLinearGradient(0,900,0,1350);bottom.addColorStop(0,'rgba(5,11,20,0)');bottom.addColorStop(.35,'rgba(5,11,20,.74)');bottom.addColorStop(1,'rgba(5,11,20,.97)');ctx.fillStyle=bottom;ctx.fillRect(0,900,W,450);

    const logo=await loadImage(LOGO_URL);ctx.drawImage(logo,55,36,300,87);
    ctx.fillStyle='rgba(5,11,20,.82)';roundRect(ctx,835,48,190,58,29);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.45)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#BFEFFF';ctx.font='700 22px Cairo, Arial';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(badge,930,62);

    ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#F7FBFF';const titleFit=fitLines(ctx,headline,900,2,47,36,800);const titleLH=Math.round(titleFit.size*1.3);titleFit.lines.slice(0,2).forEach((line,n)=>ctx.fillText(line,1025,155+n*titleLH));ctx.fillStyle='#00D4FF';ctx.fillRect(825,292,200,4);

    const box={x:55,y:1010,w:970,h:195,pad:30};ctx.fillStyle='rgba(5,11,20,.84)';roundRect(ctx,box.x,box.y,box.w,box.h,18);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.28)';ctx.stroke();
    const bodyFit=fitLines(ctx,body,box.w-box.pad*2,4,29,20,600);const bodyLH=Math.round(bodyFit.size*1.5);ctx.fillStyle='#F2FBFF';ctx.textAlign='right';ctx.textBaseline='top';bodyFit.lines.forEach((line,n)=>ctx.fillText(line,box.x+box.w-box.pad,box.y+22+n*bodyLH));

    ctx.direction='ltr';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 17px Cairo, Arial';ctx.fillStyle='#B9CFE0';ctx.fillText(RIGHTS,W/2,1288);
    ctx.fillStyle='#00D4FF';ctx.beginPath();ctx.arc(82,1288,29,0,Math.PI*2);ctx.fill();ctx.fillStyle='#03121A';ctx.font='800 24px Cairo, Arial';ctx.fillText(number,82,1288);
    return canvas.toDataURL('image/jpeg',0.95);
  }

  function downloadDataUrl(dataUrl,name){const a=document.createElement('a');a.href=dataUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();}

  document.addEventListener('click', async (event) => {
    const btn=event.target.closest?.('[data-pulse-download]');
    if(!btn) return;
    event.preventDefault();event.stopImmediatePropagation();
    const index=Number(btn.dataset.pulseDownload||0);const old=btn.textContent;btn.disabled=true;btn.textContent='جاري تجهيز الصورة...';
    try{const data=await buildFinalFromCard(index);downloadDataUrl(data,`cyber-pulse-${String(index+1).padStart(2,'0')}-final.jpg`);btn.textContent='تم التحميل ✓';}
    catch(e){console.error(e);btn.textContent='تعذر التحميل';alert('تعذر تجهيز الصورة النهائية: '+e.message);}
    finally{setTimeout(()=>{btn.disabled=false;btn.textContent=old},1400)}
  }, true);

  const obs=new MutationObserver(decoratePreviews);obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decoratePreviews);else decoratePreviews();
})();

/* Cyber Pulse copy addon — preserve post formatting, symbols and line breaks */
(() => {
  const MARKER_ID = 'cyberPulseCopyAddonStyle';

  function addStyles(){
    if(document.getElementById(MARKER_ID)) return;
    const style=document.createElement('style');
    style.id=MARKER_ID;
    style.textContent=`
      .cp-copy-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:18px}
      .cp-copy-head h3{margin:0}
      .cp-copy-btn{border:1px solid #00D4FF55;border-radius:9px;padding:8px 12px;background:#0d2940;color:#eaf8ff;cursor:pointer;font-weight:700}
      .cp-copy-btn:hover{border-color:#00D4FF;background:#12364f}
      .cp-copy-btn:disabled{opacity:.65;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function exactPostText(){
    const caption=document.querySelector('#pulseResult .pulse-caption');
    if(!caption) return '';
    return String(caption.textContent || '').replace(/\r\n/g,'\n').trim();
  }

  async function copyExact(text){
    if(!text) throw new Error('لا يوجد محتوى جاهز للنسخ.');
    if(navigator.clipboard && window.isSecureContext){
      try{await navigator.clipboard.writeText(text);return;}catch(_){ }
    }
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.position='fixed';
    ta.style.top='-9999px';
    ta.style.opacity='0';
    ta.style.direction='rtl';
    document.body.appendChild(ta);
    ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);
    const ok=document.execCommand && document.execCommand('copy');
    ta.remove();
    if(!ok) throw new Error('تعذر الوصول إلى الحافظة.');
  }

  function setStatus(message){
    const status=document.getElementById('pulseMsg');
    if(status) status.textContent=message;
  }

  function decorateCopy(){
    addStyles();
    const result=document.getElementById('pulseResult');
    if(!result || result.classList.contains('hidden')) return;
    const caption=result.querySelector('.pulse-caption');
    if(!caption) return;
    const heading=[...result.querySelectorAll('h3')].find(h=>h.textContent.trim()==='النص الجاهز للنشر');
    if(!heading) return;
    let toolbar=heading.closest('.cp-copy-head');
    if(toolbar) return;
    toolbar=document.createElement('div');
    toolbar.className='cp-copy-head';
    heading.parentNode.insertBefore(toolbar,heading);
    toolbar.appendChild(heading);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='cp-copy-btn';
    btn.setAttribute('data-cp-copy-content','1');
    btn.textContent='📋 نسخ المحتوى بنفس التنسيق';
    toolbar.appendChild(btn);
  }

  document.addEventListener('click',async(event)=>{
    const btn=event.target.closest?.('[data-cp-copy-content]');
    if(!btn) return;
    event.preventDefault();
    const old=btn.textContent;
    btn.disabled=true;
    btn.textContent='جاري النسخ...';
    try{
      const text=exactPostText();
      await copyExact(text);
      btn.textContent='تم النسخ ✓';
      setStatus('تم نسخ المحتوى كاملًا بنفس ترتيب الفقرات، فواصل الأسطر، الرموز والهاشتاقات.');
    }catch(e){
      btn.textContent='تعذر النسخ';
      setStatus('تعذر نسخ المحتوى: '+e.message);
    }finally{
      setTimeout(()=>{btn.disabled=false;btn.textContent=old;},1400);
    }
  },true);

  const obs=new MutationObserver(decorateCopy);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',decorateCopy); else decorateCopy();
})();

/* Cyber Pulse dual image comparison — Nano Banana + OpenAI */
(() => {
  const MARK='cp-dual-image-panel';
  async function api(path, options={}){
    const r=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const raw=await r.text(); let d={}; try{d=raw?JSON.parse(raw):{}}catch{}
    if(!r.ok) throw new Error(d.detail||`HTTP ${r.status}`); return d;
  }
  function payloadFor(card,index){
    const headline=(card.querySelector('.slide-info h4')?.textContent||card.querySelector('.overlay-head')?.textContent||'').trim();
    const body=(card.querySelector('.slide-info p')?.textContent||card.querySelector('.overlay-body')?.textContent||'').trim();
    const meta=(typeof pulseCurrent!=='undefined'&&pulseCurrent?.meta)||{};
    return {title:headline||'Cyber Pulse',body,slide_number:index+1,post_type:meta.format==='Single Image'?'Single Post':'Carousel',domain:meta.domain||'GRC',visual_style:'Cyber Pulse Editorial',visual_direction:'',variant_index:1};
  }
  function ensure(){
    if(typeof pulseCurrent==='undefined'||!pulseCurrent)return;
    const result=document.getElementById('pulseResult'); if(!result||result.classList.contains('hidden'))return;
    const panel=result.querySelector('.pulse-panel'); if(!panel||panel.querySelector('.'+MARK))return;
    const box=document.createElement('div'); box.className=`pulse-note ${MARK}`;
    box.innerHTML=`<strong>مقارنة مولدات الصور</strong><br><span>أنشئ نفس المشهد مرتين بنفس المحتوى: Nano Banana وOpenAI، ثم اختر النتيجة الأفضل.</span><div class="row" style="margin-top:10px"><button class="action" data-dual-generate>توليد صورتين للمقارنة</button></div><div data-dual-status style="margin-top:8px"></div><div data-dual-results style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:12px"></div>`;
    panel.appendChild(box);
    box.querySelector('[data-dual-generate]').onclick=async e=>{
      const btn=e.currentTarget,status=box.querySelector('[data-dual-status]'),out=box.querySelector('[data-dual-results]');
      const cards=[...document.querySelectorAll('.pulse-slide')]; if(!cards.length){status.textContent='أنشئ محتوى الشرائح أولاً.';return}
      btn.disabled=true; out.innerHTML=''; status.textContent='جاري توليد Nano Banana وOpenAI لنفس الشريحة...';
      try{
        const d=await api('/api/generate-image-dual',{method:'POST',body:JSON.stringify(payloadFor(cards[0],0))});
        for(const item of d.images||[]){
          const card=document.createElement('div'); card.style.cssText='border:1px solid #16415d;border-radius:14px;padding:10px;background:#07131f';
          const label=item.provider==='google_nano_banana_2'?'Nano Banana':'OpenAI';
          card.innerHTML=`<div style="font-weight:800;margin-bottom:8px">${label} <small style="opacity:.7">${item.model||''}</small></div><img src="data:${item.mime_type||'image/jpeg'};base64,${item.b64_json}" style="width:100%;border-radius:10px;display:block"><button class="action secondary" style="margin-top:8px;width:100%" data-use>استخدام هذه الصورة للشريحة الأولى</button>`;
          card.querySelector('[data-use]').onclick=()=>{const raw=cards[0].querySelector('.art img:not(.cp-addon-logo)');if(raw){raw.src=`data:${item.mime_type||'image/jpeg'};base64,${item.b64_json}`;status.textContent=`تم اختيار ${label} للشريحة الأولى.`;setTimeout(()=>window.dispatchEvent(new Event('resize')),50)}};
          out.appendChild(card);
        }
        const errs=d.errors||[]; status.textContent=errs.length?`اكتملت المقارنة مع ملاحظة: ${errs.join(' | ')}`:'تم توليد الصورتين. اختر الصورة الأفضل.';
      }catch(err){status.textContent='خطأ: '+err.message}finally{btn.disabled=false}
    };
  }
  new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(ensure,1200); if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
