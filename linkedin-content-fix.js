/* LinkedIn AI Studio content completeness guard */
(() => {
  const STORAGE = "cyberpulse_linkedin_ai_studio_v2";
  const readState = () => { try { return JSON.parse(localStorage.getItem(STORAGE)) || {posts:[]}; } catch { return {posts:[]}; } };
  const writeState = s => localStorage.setItem(STORAGE, JSON.stringify(s));
  const clean = v => String(v ?? "").replace(/\r\n?/g,"\n").replace(/[\u200e\u200f]/g,"").trim();
  const normalizeTag = t => { const v=clean(t).replace(/\s+/g,""); return v ? (v.startsWith("#")?v:`#${v}`) : ""; };

  function compose(content={}) {
    const hook = clean(content.hook || content.title);
    const caption = clean(content.caption);
    const recommendations = (content.recommendations || []).map(clean).filter(Boolean).slice(0,5);
    const cta = clean(content.cta);
    const tags = (content.hashtags || []).map(normalizeTag).filter(Boolean).slice(0,5);
    const suffix = [
      recommendations.length ? `إجراءات عملية:\n${recommendations.map(x=>`• ${x}`).join("\n")}` : "",
      cta,
      tags.length ? tags.join(" ") : ""
    ].filter(Boolean).join("\n\n");
    const fixed = [hook, suffix].filter(Boolean).join("\n\n");
    const max = 2980;
    let body = caption;
    const allowance = Math.max(0, max - fixed.length - (hook&&suffix?4:2));
    if (body.length > allowance) {
      body = body.slice(0, Math.max(0, allowance-1)).replace(/\s+\S*$/,"").trimEnd() + "…";
    }
    return [hook, body, suffix].filter(Boolean).join("\n\n").trim().slice(0,max);
  }

  function validate(content={}, text="") {
    const missing=[];
    if(!clean(content.hook||content.title)) missing.push("Hook");
    if(clean(content.caption).length < 80) missing.push("المتن الكامل");
    if((content.recommendations||[]).filter(Boolean).length < 3) missing.push("3 إجراءات عملية على الأقل");
    if(!clean(content.cta)) missing.push("CTA");
    const tags=(content.hashtags||[]).filter(Boolean);
    if(tags.length < 3) missing.push("3 هاشتاقات على الأقل");
    const rebuilt=compose(content);
    const current=clean(text);
    const looksIncomplete = current.length < Math.min(500, rebuilt.length*0.65) || (rebuilt.includes("إجراءات عملية:") && !current.includes("إجراءات عملية:"));
    return {missing, rebuilt, looksIncomplete};
  }

  function statusFor(card,msg){ const s=card?.querySelector(".lai-post-status"); if(s) s.textContent=msg; }

  function enhanceButtons(){
    document.querySelectorAll(".lai-post").forEach(card=>{
      const row=[...card.querySelectorAll(".row")].find(r=>r.querySelector('[data-act="publish"]'));
      if(!row || row.querySelector('[data-content-rebuild]')) return;
      const b=document.createElement("button");
      b.className="action secondary";
      b.dataset.contentRebuild="1";
      b.textContent="إعادة تجهيز النص للنشر";
      const publish=row.querySelector('[data-act="publish"]');
      row.insertBefore(b,publish);
      b.onclick=(e)=>{
        e.preventDefault();e.stopPropagation();
        const state=readState(), p=state.posts.find(x=>x.id===card.dataset.id); if(!p)return;
        const check=validate(p.content,p.text);
        if(check.missing.length){statusFor(card,`لا يمكن تجهيز نص مكتمل: ${check.missing.join("، ")}. استخدم «إعادة كتابة» أولًا.`);return;}
        p.text=check.rebuilt; writeState(state);
        const field=card.querySelector(".lai-text"); if(field) field.value=p.text;
        statusFor(card,`تم تجهيز النص كاملًا للنشر — ${p.text.length} حرف.`);
      };
    });
  }

  document.addEventListener("click", async e=>{
    const btn=e.target.closest?.('[data-act="publish"]'); if(!btn) return;
    const card=btn.closest(".lai-post"); if(!card) return;
    const state=readState(), p=state.posts.find(x=>x.id===card.dataset.id); if(!p) return;
    const check=validate(p.content,p.text);
    if(check.missing.length){
      e.preventDefault();e.stopImmediatePropagation();
      statusFor(card,`تم إيقاف النشر لأن المحتوى ناقص: ${check.missing.join("، ")}. اضغط «إعادة كتابة».`);
      return;
    }
    if(check.looksIncomplete){
      e.preventDefault();e.stopImmediatePropagation();
      p.text=check.rebuilt; writeState(state);
      const field=card.querySelector(".lai-text"); if(field) field.value=p.text;
      statusFor(card,`تم اكتشاف نص ناقص وإعادة تجهيزه تلقائيًا — ${p.text.length} حرف. اضغط «معاينة ونشر» مرة أخرى لمراجعة النص الكامل.`);
    }
  }, true);

  new MutationObserver(enhanceButtons).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",enhanceButtons); else enhanceButtons();
})();
