/* Latest Cybersecurity News Search — sources from uploaded Global Cybersecurity Resources */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
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
      const d = await r.json();
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
