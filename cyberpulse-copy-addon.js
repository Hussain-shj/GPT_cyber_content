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
