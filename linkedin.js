/* Personal LinkedIn publishing + LinkedIn AI Studio */
(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  async function json(response){const raw=await response.text();let body={};if(raw){try{body=JSON.parse(raw)}catch{throw new Error(`استجابة غير صالحة (HTTP ${response.status})`)}}if(!response.ok)throw new Error(body.detail||`HTTP ${response.status}`);return body}
  async function api(path,options={}){return json(await fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options}))}
  function prepareText(text){return String(text||"").replace(/\r\n?/g,"\n").replace(/[\u200e\u200f]/g,"")}
  function splitDataUrl(url){const m=String(url||"").match(/^data:(image\/(?:jpeg|png));base64,(.+)$/s);return m?{mime:m[1],b64:m[2]}:{mime:"image/jpeg",b64:""}}

  async function refreshStatus(){
    try{const s=await api("/api/linkedin/status");const box=$("liStatus");if(!box)return s;
      if(!s.configured){box.textContent="أضف متغيرات LinkedIn الثلاثة في Railway ثم أعد النشر.";$("liConnect")?.classList.add("hidden");return s}
      if(s.connected){box.className="li-status connected";box.textContent=`✓ متصل بالحساب: ${s.member_name||"LinkedIn"}`;$("liConnect")?.classList.add("hidden");$("liDisconnect")?.classList.remove("hidden")}
      else{box.className="li-status";box.textContent="الحساب غير متصل أو انتهت صلاحية التفويض.";$("liConnect")?.classList.remove("hidden");$("liDisconnect")?.classList.add("hidden")}
      return s;
    }catch(e){if($("liStatus"))$("liStatus").textContent=`تعذر قراءة الاتصال: ${e.message}`;return{connected:false}}
  }

  async function publish(text,imageData=[]){
    const s=await refreshStatus();if(!s.connected){alert("اربط حساب LinkedIn أولًا من تبويب LinkedIn.");document.querySelector('[data-view="linkedin"]')?.click();return}
    const images=(Array.isArray(imageData)?imageData:imageData?[imageData]:[]).map(x=>typeof x==="string"?{data_url:x,alt_text:""}:x).filter(x=>x?.data_url).slice(0,20);
    const modal=document.createElement("div");modal.className="li-publish-modal";
    const previews=images.length?`<div class="li-publish-images">${images.map((x,i)=>`<figure class="li-publish-image"><img class="li-publish-preview" src="${esc(x.data_url)}"><figcaption>${i+1}. ${esc(x.alt_text||"صورة")}</figcaption></figure>`).join("")}</div>`:"<p>سيتم نشر النص بدون صورة.</p>";
    modal.innerHTML=`<div class="li-publish-card"><div class="section-title"><h3>معاينة منشور LinkedIn</h3><button class="copy-btn" data-close>إغلاق</button></div>${previews}<label>النص القابل للتعديل <span id="liCharacterCount" class="counter"></span></label><textarea id="liPublishText" dir="rtl"></textarea><div class="row"><button class="action" id="liPublishConfirm">نشر الآن</button><button class="action secondary" data-close>إلغاء</button></div><div id="liPublishStatus" class="status"></div></div>`;
    document.body.appendChild(modal);$("liPublishText").value=String(text||"");
    const count=()=>{const n=prepareText($("liPublishText").value).length;$("liCharacterCount").textContent=`${n} / 3000`;$("liCharacterCount").style.color=n>3000?"#ff7777":""};$("liPublishText").oninput=count;count();
    modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>modal.remove());
    $("liPublishConfirm").onclick=async()=>{const btn=$("liPublishConfirm"),content=prepareText($("liPublishText").value.trim());if(!content)return $("liPublishStatus").textContent="النص مطلوب.";if(content.length>3000)return $("liPublishStatus").textContent="النص يتجاوز حد LinkedIn.";btn.disabled=true;$("liPublishStatus").textContent="جاري النشر...";try{const payloadImages=images.map(x=>{const p=splitDataUrl(x.data_url);return{image_b64:p.b64,image_mime_type:p.mime,alt_text:String(x.alt_text||"").slice(0,120)}});const r=await api("/api/linkedin/publish",{method:"POST",body:JSON.stringify({text:content,images:payloadImages})});$("liPublishStatus").innerHTML=`تم النشر بنجاح. <a href="${esc(r.post_url)}" target="_blank">فتح المنشور</a>`;btn.textContent="✓ تم النشر"}catch(e){btn.disabled=false;$("liPublishStatus").textContent=`خطأ: ${e.message}`}}
  }
  window.cyberPulseLinkedIn={publish,refreshStatus};

  function initLinkedIn(){
    if($("linkedin"))return;const tabs=document.querySelector(".tabs"),wrap=document.querySelector(".wrap");if(!tabs||!wrap)return;
    const tab=document.createElement("button");tab.className="tab";tab.dataset.view="linkedin";tab.textContent="LinkedIn";tabs.insertBefore(tab,tabs.querySelector('[data-view="archive"]'));
    const section=document.createElement("section");section.id="linkedin";section.className="card hidden li-section";section.innerHTML=`<div class="section-title"><div><h2>LinkedIn الشخصي</h2><p>اربط حسابك مرة واحدة، ثم انشر بعد المعاينة.</p></div><span class="counter">OAuth 2.0</span></div><div id="liStatus" class="li-status">جاري التحقق...</div><div class="row"><a id="liConnect" class="action" href="/auth/linkedin/start">ربط حساب LinkedIn</a><button id="liDisconnect" class="action danger hidden">فصل الحساب</button></div>`;wrap.appendChild(section);
    tab.onclick=()=>{["studio","archive","news","visual-alert-editor","linkedin-ai-studio"].forEach(id=>$(id)?.classList.add("hidden"));section.classList.remove("hidden");document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===tab));history.replaceState(null,"","#linkedin")};
    $("liDisconnect").onclick=async()=>{if(confirm("فصل حساب LinkedIn؟")){await api("/api/linkedin/disconnect",{method:"POST"});refreshStatus()}};refreshStatus();if(location.hash.startsWith("#linkedin")&&!location.hash.startsWith("#linkedin-ai-studio"))tab.click();
  }

  const STORAGE="cyberpulse_linkedin_ai_studio_v2";
  const PLAN=[
    ["أساسيات الحوكمة السيبرانية","كيف يتحول GRC من أوراق إلى قرارات إدارية؟","ما الذي يجب أن يراه مجلس الإدارة من الأمن السيبراني؟","Checklist: علامات ضعف برنامج GRC"],
    ["إدارة المخاطر","5 أخطاء تجعل Risk Register بلا قيمة","Case Study: عندما لا يكون Risk Owner واضحًا","AI Risk: مخاطر Shadow AI داخل المؤسسة","Checklist: مراجعة سجل المخاطر"],
    ["ISO 27001 والتطبيق","لماذا لا تكفي شهادة ISO 27001 وحدها؟","Case Study: الفرق بين الامتثال والنضج","كيف تربط الضوابط بالمخاطر الفعلية؟","Checklist: ISO 27001 Gap Review"],
    ["مخاطر الموردين","Third-Party Risk: أين تبدأ المشكلة؟","Case Study: مورد صغير وتأثير كبير","AI vendors: ما الذي يجب أن تسأل عنه؟","Checklist: Third-Party Security Review"],
    ["القيادة السيبرانية","ما الذي يجب أن يطلبه CISO من الإدارة؟","Case Study: قرار Risk Acceptance غير موثق","Cyber metrics التي تهم الإدارة العليا","Checklist: Executive Cyber Dashboard"],
    ["AI Governance","من يملك مخاطر الذكاء الاصطناعي داخل المؤسسة؟","Case Study: رفع بيانات حساسة إلى أدوات AI","ISO 42001 من منظور عملي","Checklist: AI Governance Readiness"],
    ["إدارة الثغرات","CVSS العالي ليس المشكلة الوحيدة","Case Study: Patch موجود لكن الأصل مكشوف","كيف تربط Vulnerability Management بالمخاطر؟","Checklist: Vulnerability Governance"],
    ["الاستمرارية والمرونة","Cyber Resilience ليست Backup فقط","Case Study: انقطاع خدمة بسبب هجوم","BCP وIncident Response: أين يلتقيان؟","Checklist: Cyber Resilience Review"],
    ["الثقافة الأمنية","Awareness أم Security Culture؟","Case Study: لماذا لا يغير التدريب السلوك؟","كيف تقيس أثر التوعية؟","Checklist: Security Culture"],
    ["الخصوصية والبيانات","من يقرر ما الذي يمكن رفعه إلى AI؟","Case Study: مشاركة مستندات مع أدوات خارجية","Data Classification كأداة قرار","Checklist: AI/Data Sharing"],
    ["النضج والقياس","كيف تقيس نضج GRC بدون تعقيد؟","Case Study: KPI ممتاز وKRI مفقود","أهم مؤشرات المخاطر للإدارة","Checklist: GRC Maturity"],
    ["التحويل التجاري","7 علامات تحتاج معها GRC Health Check","Case Study: من الملاحظة إلى Roadmap","كيف تبني Cyber Risk Roadmap لـ90 يومًا؟","Checklist: Executive GRC Health Check"]
  ];
  const SLOTS=[{day:"الإثنين",pillar:"GRC / Governance",objective:"Authority",type:"Single Post"},{day:"الثلاثاء",pillar:"Case Study",objective:"Expertise",type:"Single Post"},{day:"الخميس",pillar:"AI / Cyber Risk",objective:"Reach",type:"Single Post"},{day:"السبت",pillar:"Checklist / Carousel",objective:"Leads",type:"Carousel"}];
  const state=()=>{try{return JSON.parse(localStorage.getItem(STORAGE))||{posts:[]}}catch{return{posts:[]}}};
  const save=s=>localStorage.setItem(STORAGE,JSON.stringify(s));
  const week=()=>Math.min(11,Math.max(0,Math.floor((new Date()-new Date(2026,7,24))/604800000)));
  function buildText(c){let t=`${c.hook||c.title||""}\n\n${c.caption||""}`;if((c.recommendations||[]).length)t+=`\n\nإجراءات عملية:\n${c.recommendations.map(x=>`• ${x}`).join("\n")}`;if(c.cta)t+=`\n\n${c.cta}`;const tags=(c.hashtags||[]).filter(Boolean).slice(0,5);if(tags.length)t+=`\n\n${tags.join(" ")}`;return t.trim().slice(0,2980)}
  function score(c,t){const hook=Math.min(100,55+Math.min(35,String(c.hook||"").length)),authority=/إدارة|حوكمة|مخاطر|GRC|CISO|ISO|مجلس|قرار/i.test(t)?90:74,practical=(c.recommendations||[]).length>=3||/Checklist|قائمة|خطوات|إجراءات/i.test(t)?92:80,originality=/Case Study|من واقع|سيناريو|لماذا|كيف/i.test(t)?87:79,readability=t.length>=500&&t.length<=2200?92:t.length<=2800?84:76,commercial=/Health Check|Assessment|Workshop|Checklist|قائمة|تقييم/i.test(t)?84:68;return{hook,authority,practical_value:practical,originality,readability,commercial_intent:commercial,overall:Math.round((hook+authority+practical+originality+readability+commercial)/6)}}
  async function createPost(slot,topic,i){const content=await api("/api/generate-content",{method:"POST",body:JSON.stringify({topic:`${topic}. اكتب من منظور مسؤول أمن معلومات/حوكمة، برأي عملي واضح. اربط الموضوع بالقرار الإداري والمخاطر. لا تستخدم أرقامًا أو أخبارًا حديثة غير موثقة.`,domain:slot.pillar.includes("AI")?"AI Governance":slot.pillar.includes("Cyber")?"Cybersecurity":"GRC",post_type:slot.type,platform:"LinkedIn",audience:"UAE/GCC government and enterprise leaders and cybersecurity/GRC professionals",language:"Arabic",slides:slot.type==="Carousel"?6:1,tone:"Professional, practical, executive-friendly, CISO perspective",use_web_search:slot.pillar.includes("AI")||slot.pillar.includes("Cyber")})});const text=buildText(content);return{id:`lai-${Date.now()}-${i}`,week:week()+1,day:slot.day,pillar:slot.pillar,objective:slot.objective,type:slot.type,title:topic,status:"REVIEW",text,content,quality:score(content,text),assets:[],visual_options:[],selected_visual:null}}

  const PEOPLE_POLICY="PEOPLE / ATTIRE REQUIREMENT: If any people appear, show either professionals in formal business attire or Emirati people in authentic UAE national dress. Emirati men must wear a clean white kandura with white ghutra and black agal. Emirati women must wear a modest black abaya with black shayla/headscarf covering the hair. Keep the styling contemporary, respectful, realistic and appropriate for UAE government/enterprise settings. Do not use casual clothing for Emirati subjects, uncovered hair for Emirati women, generic or inaccurate Gulf costumes, theatrical stereotypes, or mixed regional dress.";

  async function imageOption(post,variant){
    const editorial=variant===1;
    const direction=(editorial
      ? "EXECUTIVE EDITORIAL: realistic premium boardroom or executive decision-making scene. Show cyber risk and governance through leadership context, dashboards without readable text, realistic UAE/GCC enterprise setting where appropriate. Strong cinematic photography, restrained navy/cyan palette. No generic shields, gears, floating icons, stock infographic layouts, hacker clichés, pseudo text or clutter. One dominant focal scene."
      : "CONCEPTUAL 3D: premium sophisticated 3D governance/risk concept. Use an elegant central decision/risk structure, connected business and technology elements, restrained navy/cyan with subtle metallic tones. No generic shield-and-gears collage, no tiny stock people, no text labels, no pseudo text, no hacker imagery, no clutter. One coherent symbolic composition with executive consulting quality.")+" "+PEOPLE_POLICY;
    const r=await api("/api/generate-image",{method:"POST",body:JSON.stringify({title:post.title,body:`${post.content.hook||""}\n${post.content.caption||""}`.slice(0,1600),slide_number:1,post_type:"Single Post",domain:post.pillar.includes("AI")?"AI Governance":post.pillar.includes("Cyber")?"Cybersecurity":"GRC",visual_style:editorial?"Cyber Pulse":"Executive Minimal",visual_direction:direction,variant_index:variant})});
    return{data_url:`data:${r.mime_type||"image/jpeg"};base64,${r.b64_json}`,alt_text:post.title,label:editorial?"التصميم 1 — Executive Editorial":"التصميم 2 — Conceptual 3D"}
  }

  async function renderCarousel(post){if(document.fonts?.ready)await document.fonts.ready;const slides=post.content.slides||[];const out=[];for(let i=0;i<slides.length;i++){const c=document.createElement("canvas");c.width=1080;c.height=1350;const x=c.getContext("2d");x.fillStyle="#f6f9fc";x.fillRect(0,0,1080,1350);x.fillStyle="#0a56a8";x.fillRect(0,0,1080,18);x.direction="rtl";x.textAlign="right";x.fillStyle="#0a56a8";x.font="700 28px Cairo,Arial";x.fillText(`${post.pillar} • ${i+1}/${slides.length}`,960,100);x.fillStyle="#102b45";x.font="800 56px Cairo,Arial";wrap(x,slides[i].headline||post.title,860).slice(0,3).forEach((l,j)=>x.fillText(l,960,250+j*78));x.fillStyle="#334e68";x.font="500 36px Cairo,Arial";wrap(x,slides[i].body||"",860).slice(0,8).forEach((l,j)=>x.fillText(l,960,560+j*58));x.fillStyle="#0a56a8";x.font="600 26px Cairo,Arial";x.fillText("Hussain Alblooshi",960,1290);out.push({data_url:c.toDataURL("image/jpeg",.92),alt_text:`${post.title} — ${i+1}`})}return out}
  function wrap(ctx,text,width){const words=String(text||"").split(/\s+/),lines=[];let line="";for(const w of words){const test=line?`${line} ${w}`:w;if(ctx.measureText(test).width>width&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);return lines}

  function visualHtml(post){
    if(post.type==="Carousel")return post.assets.length?post.assets.map(a=>`<img src="${esc(a.data_url)}">`).join(""):`<div class="lai-empty-visual">لا توجد صور بعد</div>`;
    if(post.visual_options?.length)return `<div class="lai-options">${post.visual_options.map((a,i)=>`<div class="lai-option ${post.selected_visual===i?"selected":""}"><img src="${esc(a.data_url)}"><strong>${esc(a.label)}</strong><button class="action ${post.selected_visual===i?"":"secondary"}" data-select="${i}">${post.selected_visual===i?"✓ التصميم المختار":"اعتماد هذا التصميم"}</button></div>`).join("")}</div>`;
    return`<div class="lai-empty-visual">اضغط «إنشاء تصميمين» لعرض المقترحين</div>`
  }

  function postCard(p){return`<article class="lai-post" data-id="${esc(p.id)}"><div class="lai-post-head"><div><span class="lai-badge">${esc(p.day)}</span><span class="lai-badge">${esc(p.pillar)}</span><span class="lai-badge">${esc(p.objective)}</span></div><strong>${p.quality.overall}/100</strong></div><h3>${esc(p.title)}</h3><textarea class="lai-text" dir="rtl">${esc(p.text)}</textarea><div class="lai-scores">Hook ${p.quality.hook} · Authority ${p.quality.authority} · Value ${p.quality.practical_value} · Readability ${p.quality.readability}</div><div class="lai-assets">${visualHtml(p)}</div><div class="row"><button class="action" data-act="approve">${p.status==="APPROVED"?"✓ معتمد":"اعتماد المنشور"}</button><button class="action secondary" data-act="visual">${p.type==="Carousel"?(p.assets.length?"إعادة تصميم Carousel":"إنشاء Carousel"):(p.visual_options?.length?"توليد تصميمين جديدين":"إنشاء تصميمين")}</button><button class="action secondary" data-act="regenerate">إعادة كتابة</button><button class="action secondary" data-act="publish" ${p.status!=="APPROVED"?"disabled":""}>معاينة ونشر</button><button class="action danger" data-act="reject">رفض</button></div><div class="status lai-post-status"></div></article>`}

  function renderStudio(){const s=state(),posts=s.posts.filter(p=>p.week===week()+1);if(!$("laiPosts"))return;$("laiWeek").textContent=`الأسبوع ${week()+1} من 12`;$("laiCount").textContent=`${posts.length}/4`;$("laiPosts").innerHTML=posts.length?posts.map(postCard).join(""):`<div class="empty">لم يتم توليد محتوى هذا الأسبوع بعد.</div>`;bindCards()}

  function bindCards(){
    document.querySelectorAll(".lai-post").forEach(card=>{
      const id=card.dataset.id,field=card.querySelector(".lai-text");
      field.onchange=()=>{const s=state(),p=s.posts.find(x=>x.id===id);p.text=field.value;p.quality=score(p.content,p.text);save(s);renderStudio()};
      card.querySelectorAll("[data-select]").forEach(b=>b.onclick=()=>{
        const s=state(),p=s.posts.find(x=>x.id===id);const idx=Number(b.dataset.select);
        if(!p?.visual_options?.[idx])return;
        p.selected_visual=idx;
        // Keep only the index in localStorage; duplicating base64 in assets can exceed browser storage quota.
        p.assets=[];
        save(s);
        renderStudio();
      });
      card.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>act(id,b.dataset.act,card))
    })
  }

  async function act(id,action,card){
    const s=state(),p=s.posts.find(x=>x.id===id),status=card.querySelector(".lai-post-status");
    try{
      if(action==="approve"){p.status="APPROVED";save(s);renderStudio();return}
      if(action==="reject"){p.status="REJECTED";save(s);renderStudio();return}
      if(action==="visual"){
        if(p.type==="Carousel"){status.textContent="جاري إنشاء Carousel...";p.assets=await renderCarousel(p)}
        else{status.textContent="جاري إنشاء التصميم 1 من 2...";const a=await imageOption(p,1);status.textContent="جاري إنشاء التصميم 2 من 2...";const b=await imageOption(p,2);p.visual_options=[a,b];p.selected_visual=null;p.assets=[]}
        save(s);renderStudio();return
      }
      if(action==="regenerate"){status.textContent="جاري إعادة الكتابة...";const slot=SLOTS.find(x=>x.day===p.day)||SLOTS[0],r=await createPost(slot,p.title,0);p.content=r.content;p.text=r.text;p.quality=r.quality;p.status="REVIEW";p.assets=[];p.visual_options=[];p.selected_visual=null;save(s);renderStudio();return}
      if(action==="publish"){
        if(p.status!=="APPROVED")throw new Error("اعتمد المنشور أولًا.");
        if(p.type==="Carousel"){
          if(!p.assets.length)throw new Error("أنشئ الـCarousel أولًا.");
          await publish(p.text,p.assets);return;
        }
        const idx=Number.isInteger(p.selected_visual)?p.selected_visual:Number(p.selected_visual);
        const chosen=p.visual_options?.[idx];
        if(!chosen?.data_url)throw new Error("اختر أحد التصميمين أولًا.");
        await publish(p.text,[chosen]);
      }
    }catch(e){status.textContent=`خطأ: ${e.message}`}
  }

  async function generateWeek(){const btn=$("laiGenerate"),msg=$("laiStatus"),w=week(),topics=PLAN[w];btn.disabled=true;try{const s=state();if(s.posts.some(p=>p.week===w+1)&&!confirm("يوجد محتوى لهذا الأسبوع. هل تريد استبداله؟"))return;s.posts=s.posts.filter(p=>p.week!==w+1);save(s);for(let i=0;i<4;i++){msg.textContent=`جاري إنشاء المنشور ${i+1} من 4...`;const p=await createPost(SLOTS[i],topics[i],i),fresh=state();fresh.posts.push(p);save(fresh);renderStudio()}msg.textContent="اكتمل تجهيز محتوى الأسبوع. للمنشور الفردي اضغط «إنشاء تصميمين» ثم اختر واحدًا."}catch(e){msg.textContent=`خطأ: ${e.message}`}finally{btn.disabled=false}}

  function initStudio(){
    if($("linkedin-ai-studio"))return;const tabs=document.querySelector(".tabs"),wrapEl=document.querySelector(".wrap");if(!tabs||!wrapEl)return;
    const tab=document.createElement("button");tab.className="tab";tab.dataset.view="linkedin-ai-studio";tab.textContent="LinkedIn AI Studio";tabs.insertBefore(tab,tabs.querySelector('[data-view="archive"]'));
    const sec=document.createElement("section");sec.id="linkedin-ai-studio";sec.className="card hidden";sec.innerHTML=`<div class="section-title"><div><h2>LinkedIn AI Studio</h2><p>خطة 90 يوم → محتوى → تصميمان مقترحان → اختيارك → اعتماد → نشر.</p></div><span id="laiWeek" class="counter"></span></div><div class="lai-strategy"><div><strong>التمركز</strong><p>Cybersecurity Governance + GRC + Risk + AI Governance</p></div><div><strong>الصور</strong><p>تصميمان فقط: Executive Editorial وConceptual 3D</p></div><div><strong>الهوية البشرية</strong><p>رسمي أو زي إماراتي؛ المرأة بالعباية والشيلة.</p></div></div><div class="row"><button id="laiGenerate" class="action">توليد محتوى الأسبوع</button><span id="laiCount" class="counter">0/4</span></div><div id="laiStatus" class="status"></div><div id="laiPosts" class="lai-posts"></div>`;wrapEl.appendChild(sec);
    tab.onclick=()=>{["studio","archive","news","visual-alert-editor","linkedin"].forEach(id=>$(id)?.classList.add("hidden"));sec.classList.remove("hidden");document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===tab));history.replaceState(null,"","#linkedin-ai-studio");renderStudio()};
    document.querySelectorAll('.tab:not([data-view="linkedin-ai-studio"])').forEach(b=>b.addEventListener("click",()=>sec.classList.add("hidden")));
    $("laiGenerate").onclick=generateWeek;if(location.hash.startsWith("#linkedin-ai-studio"))tab.click();else renderStudio()
  }

  function injectStyles(){const s=document.createElement("style");s.textContent=`.li-section{max-width:820px;margin:auto}.li-status{margin:18px 0;padding:14px;border:1px solid #294760;border-radius:12px;background:#081827}.li-status.connected{border-color:#1bd3cf;color:#77f2ee}.li-publish-modal{position:fixed;inset:0;z-index:9999;background:#020914d9;display:flex;align-items:center;justify-content:center;padding:18px}.li-publish-card{width:min(760px,100%);max-height:90vh;overflow:auto;background:#0d1a2b;border:1px solid #294760;border-radius:18px;padding:18px;direction:rtl}.li-publish-card textarea{min-height:220px;direction:rtl}.li-publish-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:9px}.li-publish-preview{width:100%;max-height:240px;object-fit:contain}.lai-strategy{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0}.lai-strategy>div,.lai-post{background:#091625;border:1px solid #294760;border-radius:14px;padding:14px}.lai-strategy p,.lai-scores{color:#9eb2c9}.lai-posts{display:grid;gap:16px;margin-top:18px}.lai-post-head{display:flex;justify-content:space-between}.lai-badge{display:inline-block;background:#10283a;color:#77f2ee;border-radius:999px;padding:4px 8px;margin-left:5px;font-size:.78rem}.lai-text{min-height:250px;line-height:1.8}.lai-assets{margin:12px 0}.lai-options{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.lai-option{padding:10px;border:1px solid #294760;border-radius:14px;display:grid;gap:8px}.lai-option.selected{border-color:#1bd3cf;box-shadow:0 0 0 2px #1bd3cf33}.lai-option img,.lai-assets>img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px}.lai-empty-visual{padding:28px;border:1px dashed #294760;border-radius:10px;color:#9eb2c9;text-align:center}@media(max-width:800px){.lai-strategy,.lai-options{grid-template-columns:1fr}}`;document.head.appendChild(s)}
  function start(){injectStyles();initLinkedIn();initStudio()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
