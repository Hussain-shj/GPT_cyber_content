from pathlib import Path

main = Path('main.py')
index = Path('index.html')

text = main.read_text(encoding='utf-8')
old_literal = 'visual_style: Literal["GRC Professional", "Cyber Pulse", "Executive Minimal", "Infographic"] = "GRC Professional"'
new_literal = 'visual_style: Literal["GRC Professional", "Cyber Pulse", "Cyber Pulse Editorial", "Executive Minimal", "Infographic"] = "GRC Professional"'
if old_literal in text:
    text = text.replace(old_literal, new_literal, 1)
elif new_literal not in text:
    raise SystemExit('ImageRequest visual_style Literal was not found')

start = text.find('def review_artwork(client: OpenAI, req: ImageRequest, image_b64: str):')
end = text.find('\ndef _find_gemini_image_data', start)
if start < 0 or end < 0:
    raise SystemExit('review_artwork function boundaries not found')

new_review = r"""def review_artwork(client: OpenAI, req: ImageRequest, image_b64: str):
    if req.visual_style == "Cyber Pulse Editorial":
        review_prompt = f'''You are the visual quality-control reviewer for the Arabic cybersecurity knowledge platform "نبض سيبراني | CYBER PULSE".
Evaluate the supplied generated artwork as a KNOWLEDGE/EDITORIAL visual, not as breaking news.

TOPIC TITLE: {req.title}
SUPPORTING CONTEXT: {req.body}
DOMAIN: {req.domain}

Score these criteria:
1. Concept fidelity: the scene communicates the exact governance/risk/compliance/cybersecurity concept rather than generic cyber decoration.
2. Practical meaning: a professional viewer can infer the relationship, decision, process, dependency, control, resilience, or risk idea without relying on generated text.
3. Cyber Pulse identity: premium deep navy #050B14/#0B2340 with cyan #00D4FF and blue #1565C0, sophisticated enterprise editorial quality.
4. Composition: one dominant visual idea with hierarchy and depth; no collage, dense infographic, generic dashboard wall, or stock-photo feeling.
5. Text-safe layout: the upper 35-40% is genuinely dark, low-detail and usable for the application's Arabic headline; top-right logo/badge space is clear.
6. No generated readable text, pseudo-text, watermarks, framework names, labels, captions, or typographic logos.
7. No unrelated hacker/SOC clichés, masks, skulls, Matrix code, random binary rain, giant generic padlock/shield as the sole concept, or excessive holograms.
8. Domain semantics are appropriate: GRC is integrated rather than three disconnected icons; governance shows direction/accountability; risk shows prioritization/exposure/treatment; compliance shows evidence/assurance/traceability; resilience shows continuity/recovery; third-party risk shows dependencies.

Return ONLY valid JSON:
{{"semantic_match":true,"score":0,"technology_visible":true,"mechanism_visible":true,"composition_ok":true,"issues":["concise issue"],"retry_direction":"specific English correction prompt for the image generator","summary_ar":"سطر عربي مختصر يشرح نتيجة المراجعة"}}
For this editorial mode, technology_visible means the SUBJECT/DOMAIN concept is visibly identifiable, and mechanism_visible means the relationship/process/decision logic is visually understandable. Set semantic_match=true only when score is at least 82 and technology_visible, mechanism_visible, and composition_ok are all true.'''
    else:
        review_prompt = f'''You are the visual quality-control reviewer for the Arabic cybersecurity publication "نبض سيبراني | CYBER PULSE".
Evaluate the supplied generated artwork against the factual news context. Review the IMAGE itself, not merely the prompt.
Use ONLY the supplied news title, factual context, and required visual direction. Never require an object, screen, feature, update window, download, patch, vendor, or attack step that is not supported by this specific story. Do not carry requirements from another cybersecurity story.

NEWS TITLE: {req.title}
FACTUAL CONTEXT: {req.body}
REQUIRED VISUAL DIRECTION: {req.visual_direction}

Score these criteria:
1. The affected technology/vendor/product category is immediately identifiable without headline text.
2. The reported event or attack mechanism is visually clear and technically relevant.
3. Every prominent object is traceable to the supplied story; there are no loose or misleading metaphors.
4. The scene has premium Cyber Pulse editorial quality: dark navy, cyan/teal, restrained risk red, clean and professional.
5. The upper 35-40% remains usable for Arabic headline and metadata, and the top-right has safe logo space.
6. There is no readable generated text, pseudo-text, watermark, distorted typography, hacker hoodie, or unrelated clutter.
7. The image explains a causal story, not merely a collection of relevant objects: the origin/action, path or mechanism, and impact are visually connected.
8. The composition has editorial hierarchy and cinematic depth comparable to a premium technology-news cover: one dominant focal point, supporting context, and no stock-photo/generic-dashboard feeling.

For Zoom Annotation / screen-sharing takeover stories specifically, a strong image should clearly show a video meeting with several participants, a shared-screen canvas, an annotation pen/drawing stroke/cursor acting on that shared screen, and unauthorized control spreading from the annotated screen toward two or more participant devices. A generic laptop, generic meeting grid, arrow, user icon, software-update window, or download screen is insufficient and must not be requested.

Return ONLY valid JSON:
{{"semantic_match":true,"score":0,"technology_visible":true,"mechanism_visible":true,"composition_ok":true,"issues":["concise issue"],"retry_direction":"specific English correction prompt for the image generator","summary_ar":"سطر عربي مختصر يشرح نتيجة المراجعة"}}
Set semantic_match=true only when score is at least 82 and technology_visible, mechanism_visible, and composition_ok are all true. A visually generic image cannot pass even if it contains the correct platform and objects.'''
    response = client.responses.create(
        model=os.getenv("OPENAI_VISION_MODEL", os.getenv("OPENAI_MODEL", "gpt-5")),
        input=[{"role":"user","content":[
            {"type":"input_text","text":review_prompt},
            {"type":"input_image","image_url":f"data:image/jpeg;base64,{image_b64}"},
        ]}],
        store=False,
    )
    review = extract_json(response.output_text)
    score = max(0, min(100, int(review.get("score", 0))))
    review["score"] = score
    review["semantic_match"] = bool(
        review.get("semantic_match") and score >= 82
        and review.get("technology_visible") and review.get("mechanism_visible")
        and review.get("composition_ok")
    )
    return review
"""
text = text[:start] + new_review + text[end:]
main.write_text(text, encoding='utf-8')

html = index.read_text(encoding='utf-8')
html = html.replace(
    "domain:pulseMappedDomain(pulseCurrent.meta.domain),visual_style:'Cyber Pulse Editorial'",
    "domain:pulseCurrent.meta.domain,visual_style:'Cyber Pulse Editorial'",
    1,
)
html = html.replace(
    '<select id="pulseObjective"><option>Authority</option><option>Awareness</option><option>Engagement</option><option>Download</option></select>',
    '<select id="pulseObjective"><option value="Authority">بناء المصداقية | Authority</option><option value="Awareness">التوعية | Awareness</option><option value="Engagement">التفاعل | Engagement</option><option value="Download">تحميل ملف/أداة | Download</option></select>',
    1,
)
index.write_text(html, encoding='utf-8')
print('Cyber Pulse Editorial compatibility and QC fixes applied.')
