(() => {
  const LIGHT='/cyberpulse-logo-light.svg', DARK='/cyberpulse-logo-dark.svg';
  function addPreviewHeaders(){
    document.querySelectorAll('.slide').forEach(card=>{
      if(card.querySelector('.cp-header-logo')) return;
      const art=card.querySelector('.art'); if(!art) return;
      art.style.position='relative';
      const img=document.createElement('img'); img.className='cp-header-logo'; img.src=LIGHT; img.alt='نبض سيبراني | CYBER PULSE';
      Object.assign(img.style,{position:'absolute',top:'18px',right:'18px',width:'190px',height:'auto',zIndex:'8',borderRadius:'8px',boxShadow:'0 4px 18px rgba(0,0,0,.10)'}); art.appendChild(img);
    });
    document.querySelectorAll('.news-stage').forEach(stage=>{
      if(stage.querySelector('.cp-news-header-logo')) return;
      const img=document.createElement('img'); img.className='cp-news-header-logo'; img.src=DARK; img.alt='نبض سيبراني | CYBER PULSE';
      Object.assign(img.style,{position:'absolute',top:'18px',right:'22px',width:'205px',height:'auto',zIndex:'9',borderRadius:'8px'}); stage.appendChild(img);
    });
  }
  new MutationObserver(addPreviewHeaders).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',addPreviewHeaders); setInterval(addPreviewHeaders,1200);
})();