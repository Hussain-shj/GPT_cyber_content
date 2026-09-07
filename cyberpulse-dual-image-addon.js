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
