from pathlib import Path
import re

p=Path('index.html')
t=p.read_text(encoding='utf-8')

start=t.find('async function buildPulseFinalImage(i){')
end=t.find('function downloadPulseImage', start)
if start < 0 or end < 0:
    raise SystemExit('buildPulseFinalImage block not found')

new=r'''async function buildPulseFinalImage(i){if(!pulseCurrent)return null;const s=pulseCurrent.data.slides[i];if(!s?.image_b64)return null;await document.fonts?.ready;const W=1080,H=1350,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const im=await pulseLoadImage(`data:${s.image_mime_type||'image/jpeg'};base64,${s.image_b64}`);const scale=Math.max(W/im.naturalWidth,H/im.naturalHeight),dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;ctx.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='top';
let g=ctx.createLinearGradient(0,0,0,430);g.addColorStop(0,'rgba(5,11,20,.88)');g.addColorStop(1,'rgba(5,11,20,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,430);let gb=ctx.createLinearGradient(0,900,0,1350);gb.addColorStop(0,'rgba(5,11,20,0)');gb.addColorStop(.35,'rgba(5,11,20,.72)');gb.addColorStop(1,'rgba(5,11,20,.96)');ctx.fillStyle=gb;ctx.fillRect(0,900,W,450);
// Approved logo: wait for the SVG to load; if it fails, omit rather than invent a replacement.
try{const logo=await pulseLoadImage(new URL('/cyberpulse-logo-dark.svg',window.location.origin).href);const ratio=(logo.naturalWidth||280)/(logo.naturalHeight||80);const lh=76,lw=Math.min(300,lh*ratio);ctx.drawImage(logo,55,38,lw,lh)}catch(e){console.warn('Cyber Pulse logo could not be loaded',e)}
const badge=({Insights:'رؤى',Guides:'دليل',Tools:'أداة',Awareness:'توعية'}[pulseCurrent?.meta?.pillar]||'نبض سيبراني');ctx.fillStyle='rgba(5,11,20,.82)';pulseRoundRect(ctx,835,48,190,58,29);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.45)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#BFEFFF';ctx.font='700 22px Cairo, Arial';ctx.textAlign='center';ctx.fillText(badge,930,62);
ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#F7FBFF';ctx.font='800 47px Cairo, Arial';pulseWrapLines(ctx,s.headline,900,2).forEach((line,n)=>ctx.fillText(line,1025,155+n*61));ctx.fillStyle='#00D4FF';ctx.fillRect(825,292,200,4);
// Dynamic body fitting: never truncate with ellipsis. Reduce font until all text fits, up to 4 lines.
const bodyBox={x:55,y:1015,w:970,h:190,pad:30};ctx.fillStyle='rgba(5,11,20,.84)';pulseRoundRect(ctx,bodyBox.x,bodyBox.y,bodyBox.w,bodyBox.h,18);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.28)';ctx.stroke();let bodySize=29,bodyLines=[];while(bodySize>=22){ctx.font=`600 ${bodySize}px Cairo, Arial`;bodyLines=pulseWrapLines(ctx,s.body,bodyBox.w-bodyBox.pad*2,99);if(bodyLines.length<=4)break;bodySize-=1}ctx.fillStyle='#F2FBFF';ctx.textAlign='right';ctx.textBaseline='top';const lineH=Math.round(bodySize*1.48);bodyLines.forEach((line,n)=>ctx.fillText(line,bodyBox.x+bodyBox.w-bodyBox.pad,bodyBox.y+24+n*lineH));
// Rights footer with the official LinkedIn public URL.
ctx.direction='ltr';ctx.textBaseline='middle';ctx.font='600 17px Cairo, Arial';ctx.fillStyle='#B9CFE0';ctx.textAlign='center';ctx.fillText('Cyber Pulse | نبض سيبراني  •  linkedin.com/company/cyberpulse-me',W/2,1288);ctx.fillStyle='#00D4FF';ctx.beginPath();ctx.arc(82,1288,29,0,Math.PI*2);ctx.fill();ctx.fillStyle='#03121A';ctx.textAlign='center';ctx.font='800 24px Cairo, Arial';ctx.fillText(String(s.number||i+1),82,1288);return canvas.toDataURL('image/jpeg',0.95)}
'''
t=t[:start]+new+t[end:]

# Preview: show official logo and the same rights footer, without duplicate brand wordmark.
old='''<div class="slide-no">${esc(s.number)}</div></div></div><div class="slide-info">'''
newfrag='''<div class="pulse-rights">Cyber Pulse | نبض سيبراني • linkedin.com/company/cyberpulse-me</div><div class="slide-no">${esc(s.number)}</div></div></div><div class="slide-info">'''
if old in t:t=t.replace(old,newfrag,1)

css='''.pulse-rights{position:absolute;bottom:2.2%;left:16%;right:16%;text-align:center;direction:ltr;color:#b9cfe0;font-size:clamp(7px,.65vw,10px);font-weight:600;white-space:nowrap}.pulse-slide .overlay-body{overflow:visible!important;display:block!important;-webkit-line-clamp:unset!important}.pulse-card-logo{max-height:9%!important;object-fit:contain!important;object-position:left top!important}'''
if '.pulse-rights{' not in t:t=t.replace('</style></head>',css+'\n</style></head>',1)
p.write_text(t,encoding='utf-8')
print('Applied official logo, LinkedIn rights footer and non-truncating body fit')
