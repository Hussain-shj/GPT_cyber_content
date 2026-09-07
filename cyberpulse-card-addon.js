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
