from pathlib import Path
import re

index=Path('index.html')
main=Path('main.py')
text=index.read_text(encoding='utf-8')

# Use the approved repository logo as a fixed layer, never a generated wordmark.
old_visual = '''function pulseVisual(s,i){return `<article class="slide pulse-slide"><div class="art" id="pulseArt-${i}">${s.image_b64?`<img src="data:${esc(s.image_mime_type||'image/jpeg')};base64,${s.image_b64}" alt="Cyber Pulse artwork">`:'<div class="placeholder">المشهد البصري بدون نص — اضغط إنشاء الصور</div>'}<div class="overlay"><div class="overlay-head">${esc(s.headline)}</div><div class="overlay-body">${esc(s.body)}</div><div class="overlay-footer">نبض سيبراني | Cyber Pulse</div><div class="slide-no">${esc(s.number)}</div></div></div><div class="slide-info"><h4>${esc(s.headline)}</h4><p>${esc(s.body)}</p><div class="slide-actions"><button data-pulse-img="${i}">إنشاء/إعادة الصورة</button>${s.image_b64?`<button data-pulse-download="${i}" title="تحميل الصورة النهائية مع النص">⬇ تحميل الصورة</button>`:''}</div></div></article>`}'''
new_visual = '''function pulseVisual(s,i){const badge=({Insights:'رؤى',Guides:'دليل',Tools:'أداة',Awareness:'توعية'}[pulseCurrent?.meta?.pillar]||'نبض سيبراني');return `<article class="slide pulse-slide"><div class="art" id="pulseArt-${i}">${s.image_b64?`<img src="data:${esc(s.image_mime_type||'image/jpeg')};base64,${s.image_b64}" alt="Cyber Pulse artwork">`:'<div class="placeholder">المشهد البصري بدون نص — اضغط إنشاء الصور</div>'}<div class="overlay"><img class="pulse-card-logo" src="/cyberpulse-logo-dark.svg" alt="نبض سيبراني"><div class="pulse-card-badge">${esc(badge)}</div><div class="overlay-head">${esc(s.headline)}</div><div class="overlay-body">${esc(s.body)}</div><div class="slide-no">${esc(s.number)}</div></div></div><div class="slide-info"><h4>${esc(s.headline)}</h4><p>${esc(s.body)}</p><div class="slide-actions"><button data-pulse-img="${i}">إنشاء/إعادة الصورة</button>${s.image_b64?`<button data-pulse-download="${i}" title="تحميل الصورة النهائية مع النص">⬇ تحميل الصورة</button>`:''}</div></div></article>`}'''
if old_visual in text:
    text=text.replace(old_visual,new_visual,1)

# Replace the downloaded-image renderer with the same clean visual system.
pattern=r"async function buildPulseFinalImage\(i\)\{.*?return canvas\.toDataURL\('image/jpeg',0\.95\)\}"
new_build=r'''async function buildPulseFinalImage(i){if(!pulseCurrent)return null;const s=pulseCurrent.data.slides[i];if(!s?.image_b64)return null;await document.fonts?.ready;const W=1080,H=1350,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const im=await pulseLoadImage(`data:${s.image_mime_type||'image/jpeg'};base64,${s.image_b64}`);const scale=Math.max(W/im.naturalWidth,H/im.naturalHeight),dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;ctx.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);
ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='top';
// subtle readability gradient; preserve the artwork instead of covering it with oversized boxes
let g=ctx.createLinearGradient(0,0,0,430);g.addColorStop(0,'rgba(5,11,20,.88)');g.addColorStop(1,'rgba(5,11,20,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,430);
let gb=ctx.createLinearGradient(0,930,0,1350);gb.addColorStop(0,'rgba(5,11,20,0)');gb.addColorStop(.35,'rgba(5,11,20,.72)');gb.addColorStop(1,'rgba(5,11,20,.94)');ctx.fillStyle=gb;ctx.fillRect(0,900,W,450);
// approved Cyber Pulse logo asset
try{const logo=await pulseLoadImage('/cyberpulse-logo-dark.svg');ctx.drawImage(logo,55,38,300,87)}catch(_){/* never substitute an invented logo */}
// category badge
const badge=({Insights:'رؤى',Guides:'دليل',Tools:'أداة',Awareness:'توعية'}[pulseCurrent?.meta?.pillar]||'نبض سيبراني');ctx.fillStyle='rgba(5,11,20,.82)';pulseRoundRect(ctx,835,48,190,58,29);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.45)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#BFEFFF';ctx.font='700 22px Cairo, Arial';ctx.textAlign='center';ctx.fillText(badge,930,62);
// title: compact, max two lines, no oversized title panel
ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#F7FBFF';ctx.font='800 47px Cairo, Arial';pulseWrapLines(ctx,s.headline,900,2).forEach((line,n)=>ctx.fillText(line,1025,155+n*61));ctx.fillStyle='#00D4FF';ctx.fillRect(825,292,200,4);
// body: concise 2-3 lines in a slim lower panel
ctx.fillStyle='rgba(5,11,20,.82)';pulseRoundRect(ctx,55,1040,970,170,18);ctx.fill();ctx.strokeStyle='rgba(0,212,255,.28)';ctx.stroke();ctx.fillStyle='#F2FBFF';ctx.font='600 28px Cairo, Arial';ctx.textAlign='right';pulseWrapLines(ctx,s.body,900,3).forEach((line,n)=>ctx.fillText(line,985,1070+n*42));
// slide number only; the approved logo already carries the brand name
ctx.fillStyle='#00D4FF';ctx.beginPath();ctx.arc(82,1278,29,0,Math.PI*2);ctx.fill();ctx.fillStyle='#03121A';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 24px Cairo, Arial';ctx.fillText(String(s.number||i+1),82,1278);
return canvas.toDataURL('image/jpeg',0.95)}'''
text,n=re.subn(pattern,new_build,text,count=1,flags=re.S)
if n!=1: raise SystemExit('buildPulseFinalImage block not found')

# CSS override for preview to match the exported JPEG.
css='''.pulse-slide .overlay-head{top:11%;right:5%;left:5%;padding:0;background:transparent!important;border:0!important;font-size:clamp(20px,2vw,30px);text-shadow:0 2px 14px #050B14;line-height:1.35}.pulse-slide .overlay-body{right:5%;left:5%;bottom:7%;padding:11px 14px;background:rgba(5,11,20,.80)!important;border:1px solid #00D4FF44!important;font-size:clamp(11px,1vw,15px);line-height:1.55;-webkit-line-clamp:3}.pulse-slide .overlay-footer{display:none}.pulse-card-logo{position:absolute!important;top:2.6%;left:5%;width:28%!important;height:auto!important;object-fit:contain!important;z-index:3}.pulse-card-badge{position:absolute;top:3%;right:5%;padding:6px 13px;border:1px solid #00D4FF66;border-radius:999px;background:rgba(5,11,20,.82);color:#bfefff;font-size:12px;font-weight:700}.pulse-slide .slide-no{left:5%;bottom:2%;width:34px;height:34px}.pulse-slide .art:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(5,11,20,.55),transparent 30%,transparent 68%,rgba(5,11,20,.45));z-index:0}.pulse-slide .overlay{z-index:2}.pulse-slide .overlay>*{z-index:3}'''
if '.pulse-card-logo{' not in text:
    text=text.replace('</style></head>',css+'\n</style></head>',1)
index.write_text(text,encoding='utf-8')

# Tighten Cyber Pulse slide copy for image readability and improve GRC wording.
m=main.read_text(encoding='utf-8')
m=m.replace('Each slide headline MUST be concise: maximum 9 words and maximum 2 visual lines. Each slide body MUST be maximum 32 words, written as one compact idea suitable for no more than 4 visual lines.', 'Each slide headline MUST be concise: maximum 8 words and maximum 2 visual lines. Each slide body MUST be maximum 24 words, written as one compact idea suitable for no more than 3 visual lines.')
needle='- Authority objective: demonstrate expertise through clarity, reasoning, and practical value; never through first-person status claims or excessive framework-name dropping.'
addition=needle+'''\n- For GRC relationship topics, prefer precise language such as: governance sets direction and accountability; risk prioritizes uncertainty and treatment; compliance demonstrates adherence through evidence. Avoid vague phrases like "three boxes" unless the contrast is immediately clarified as "three separate boxes".\n- Keep slide copy natural Arabic. Prefer "ترتّب الأولويات" over vague literal translations such as "تعطي الأولويات", and prefer "قرارات أكثر وعيًا بالمخاطر" when that is the intended meaning.'''
if addition not in m and needle in m:m=m.replace(needle,addition,1)
main.write_text(m,encoding='utf-8')
print('Cyber Pulse card v2 applied')
