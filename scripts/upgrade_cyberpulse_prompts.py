from pathlib import Path


def replace_once(path: Path, old: str, new: str):
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"{path}: already upgraded")
        return False
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"{path}: upgraded")
    return True


main = Path("main.py")
index = Path("index.html")

old_prompt = '''    prompt = f"Create publish-ready Arabic {req.post_type} about {req.topic} for government/enterprise cybersecurity professionals. Exactly {req.slides} slides if carousel. Each slide headline MUST be concise: maximum 9 words and maximum 2 visual lines. Each slide body MUST be maximum 32 words, written as one compact idea suitable for no more than 4 visual lines. Put extended explanations in the caption, never in slide body. Return ONLY JSON with title,hook,caption,recommendations,cta,keywords,hashtags,slides(number,headline,body),sources. Never invent citations. Hashtags never belong in slides. {carousel_style} {grounding}"'''

new_prompt = '''    prompt = f"""Create publish-ready Arabic {req.post_type} about {req.topic} for government/enterprise cybersecurity professionals.

EDITORIAL QUALITY:
- Write as a practical cybersecurity/GRC knowledge publication: clear, analytical, useful, and easy to scan. Do not sound like a policy memo, academic paper, sales copy, or generic AI prose.
- Lead with the practical idea and decision value. Prefer concrete explanations, cause/effect, examples, checks, and actionable distinctions over jargon.
- Do NOT stack framework or standard names to signal expertise. Mention ISO, NIST, COSO, COBIT, or another framework ONLY when it is materially necessary to explain the topic or explicitly supported by the supplied reference.
- Never invent statistics, legal requirements, framework claims, citations, downloads, templates, checklists, files, or resources.
- A CTA may invite discussion, reflection, saving, sharing, or following. A CTA may promise a file/template/checklist/download ONLY when the supplied topic or grounding explicitly confirms that resource exists.

CYBER PULSE MODE:
If the topic begins with metadata like [Insights | Authority], [Guides | Awareness], [Tools | Download], or [Awareness | Engagement], treat the bracketed values as editorial instructions and NEVER reproduce them in the title, hook, caption, or slides.
- Insights: explain one important idea, misconception, relationship, or decision implication with depth but without unnecessary complexity.
- Guides: teach a practical sequence, method, checklist, or decision path. Keep it neutral and instructional.
- Tools: focus on how a practical artifact, assessment, register, matrix, checklist, or template is used; do not claim an artifact exists unless confirmed.
- Awareness: make the risk and desired behavior immediately understandable without fearmongering.
- Authority objective: demonstrate expertise through clarity, reasoning, and practical value; never through first-person status claims or excessive framework-name dropping.
- Engagement objective: end with one specific professional question, not a generic 'what do you think?'.
- Download objective: only use a download/resource CTA when the input explicitly confirms the resource exists; otherwise use a non-download CTA.

FORMAT:
Exactly {req.slides} slides if carousel. Each slide headline MUST be concise: maximum 9 words and maximum 2 visual lines. Each slide body MUST be maximum 32 words, written as one compact idea suitable for no more than 4 visual lines. Put extended explanations in the caption, never in slide body.
Return ONLY JSON with title,hook,caption,recommendations,cta,keywords,hashtags,slides(number,headline,body),sources. Never invent citations. Hashtags never belong in slides.
{carousel_style}
{grounding}"""'''
replace_once(main, old_prompt, new_prompt)

marker = '''def visual_prompt(req: ImageRequest):\n    if req.visual_style == "Cyber Pulse":'''
editorial = '''def visual_prompt(req: ImageRequest):\n    if req.visual_style == "Cyber Pulse Editorial":\n        pillar = str(getattr(req, "pillar", "") or "").strip()\n        domain = str(req.domain or "").strip()\n        return f\"\"\"Create ONLY the background artwork for a premium Cyber Pulse knowledge/editorial post. This is NOT breaking news, NOT an incident alert, and NOT a SOC/hacker scene.\nFORMAT: vertical 4:5 portrait, designed for a final 1080x1350 social post.\n\nSUBJECT:\nTitle concept: {req.title}\nSupporting context: {req.body}\nDomain: {domain}\n\nVISUAL GOAL:\nTranslate the exact knowledge concept into ONE clear executive/editorial visual metaphor that a cybersecurity, GRC, risk, governance, compliance, resilience, or enterprise audience can understand at a glance. The image must explain the relationship or decision concept, not merely decorate it. Every prominent object must be traceable to the supplied subject.\n\nCYBER PULSE IDENTITY:\n- Deep near-black navy #050B14 grading into #0B2340.\n- Electric cyan #00D4FF and blue #1565C0 as the primary luminous accents.\n- Premium modern isometric/semi-3D enterprise cybersecurity editorial aesthetic.\n- Subtle radar/orbit, network, circuit, or data-line texture at very low visual intensity.\n- Clean, sophisticated, institutional, credible, modern; never gaming-like.\n- Use ONE restrained semantic accent only when useful: amber for warning/attention, red only for genuine threat/critical risk, teal/green for healthy/compliant state.\n\nCOMPOSITION:\n- One dominant visual idea, not a collage and not a multi-panel infographic.\n- Keep the explanatory visual concentrated in the center/lower area with strong depth and hierarchy.\n- Preserve generous clean negative space for the application's Arabic overlay. Keep the upper 35-40% dark and low-detail; do not place faces, bright objects, dashboards, or important details there.\n- Keep additional safe space for the fixed Cyber Pulse logo and category badge.\n- For a Single Image, create one memorable hero concept. For carousel artwork, represent ONLY this slide's specific idea while maintaining the same visual language across the series.\n\nCONCEPT MAPPING:\n- Governance: direction, accountability, decision rights, ownership, executive alignment, controlled pathways.\n- Risk: assets/exposure, uncertainty, prioritization, treatment choices, risk ownership, decision impact.\n- Compliance: obligations, evidence, assurance, control verification, traceability; avoid generic checkmark wallpaper.\n- GRC: show governance, risk, and compliance as an integrated decision system rather than three disconnected icons.\n- ISO 27001: show an operating management system, control/evidence/risk linkage, and continuous improvement; do not make a certificate the hero.\n- Third-Party Risk: show dependency and risk propagation across a supplier ecosystem.\n- Cyber Resilience: show continuity, recovery, redundancy, and service restoration rather than backup alone.\n- Data Protection: show controlled data flow, classification/protection boundaries, and authorized use.\n- Incident Response: show coordinated response stages and containment/recovery only when the subject is actually incident response.\n\nABSOLUTE NO-TEXT RULE:\nZERO readable Arabic or English. No words, letters, numbers, framework names, UI labels, captions, headlines, hashtags, watermarks, signatures, pseudo-text, typographic logos, or fake interface copy. The application adds Arabic RTL text, logo, badge, divider, footer, and border after generation.\n\nDO NOT CREATE:\nGeneric hooded hackers, masks, skulls, Matrix code, random binary rain, generic SOC rooms, unrelated dashboards, floating padlocks as the sole idea, giant shields as the sole idea, dense flowcharts, labeled diagrams, text-bearing UI, excessive holograms, stock-photo poses, or unrelated cyber clichés. Do not turn abstract technical words into literal physical objects unless the topic genuinely requires them.\n\nFINAL SELF-CHECK BEFORE RENDERING:\n1) Does the scene communicate this exact slide/topic without relying on generated text?\n2) Is the concept useful and executive/editorial rather than generic cybersecurity decoration?\n3) Is the Cyber Pulse navy/cyan identity unmistakable?\n4) Is the text-safe area genuinely clean?\nIf any answer is no, revise the composition before rendering.\"\"\"\n    if req.visual_style == "Cyber Pulse":'''
replace_once(main, marker, editorial)

old_image_call = "visual_style:'Cyber Pulse'"
new_image_call = "visual_style:'Cyber Pulse Editorial'"
replace_once(index, old_image_call, new_image_call)

print("Cyber Pulse content and editorial image prompts upgraded successfully.")
