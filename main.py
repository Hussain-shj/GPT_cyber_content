import json
import os
import re
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="GPT Cyber Content API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContentRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    domain: Literal["GRC", "Cybersecurity", "AI Governance", "Privacy"] = "GRC"
    post_type: Literal["Carousel", "Infographic", "Single Post"] = "Carousel"
    platform: Literal["Instagram", "LinkedIn", "Both"] = "Both"
    audience: str = "Government and enterprise cybersecurity professionals"
    language: Literal["Arabic", "English"] = "Arabic"
    slides: int = Field(default=6, ge=1, le=10)
    tone: str = "Professional, practical, executive-friendly"
    use_web_search: bool = True


class ImageRequest(BaseModel):
    title: str
    post_type: Literal["Carousel", "Infographic", "Single Post"] = "Single Post"
    visual_direction: str = "Modern premium cybersecurity visual, dark navy, cyan accents, clean government-enterprise aesthetic"


def demo_payload(req: ContentRequest):
    n = req.slides if req.post_type == "Carousel" else 1
    return {
        "mode": "demo",
        "title": req.topic,
        "hook": f"كيف يؤثر {req.topic} على الحوكمة والمخاطر والامتثال؟",
        "caption": "هذا محتوى تجريبي. أضف OPENAI_API_KEY في Railway لتفعيل التوليد المباشر والبحث من المصادر العالمية.",
        "recommendations": [
            "حدد مالكًا واضحًا للمخاطر والضوابط.",
            "اربط المتطلبات التنظيمية بضوابط قابلة للقياس.",
            "راجع الأدلة والاستثناءات بشكل دوري.",
        ],
        "cta": "ما التحدي الأكبر الذي تواجهه مؤسستك في تطبيق هذا الموضوع؟ شارك رأيك في التعليقات.",
        "keywords": ["GRC", "Cybersecurity Governance", "Risk Management", "Compliance"],
        "hashtags": ["#GRC", "#CyberSecurity", "#Governance", "#RiskManagement", "#Compliance"],
        "slides": [
            {"number": i + 1, "headline": req.topic if i == 0 else f"النقطة {i + 1}", "body": "نص تجريبي للمعاينة."}
            for i in range(n)
        ],
        "sources": [],
    }


def extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```json\s*|^```\s*|\s*```$", "", text, flags=re.I | re.S)
    return json.loads(text)


@app.get("/")
def root():
    return {"service": "GPT Cyber Content API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok", "openai_configured": bool(os.getenv("OPENAI_API_KEY"))}


@app.post("/api/generate-content")
def generate_content(req: ContentRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return demo_payload(req)

    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", "gpt-5")

    prompt = f"""
You are a senior cybersecurity GRC content strategist writing for professionals and government-sector employees.
Create a publish-ready {req.post_type} about: {req.topic}
Domain: {req.domain}
Platform: {req.platform}
Audience: {req.audience}
Language: {req.language}
Tone: {req.tone}
Number of slides: {req.slides}

Requirements:
- Prioritize accurate, current, internationally recognized sources such as NIST, CISA, ENISA, ISACA, ISO, OECD, European Commission, and official regulators.
- Do not invent standards, regulations, dates, statistics, or citations.
- Make the writing practical and suitable for Instagram and LinkedIn.
- Include a strong hook, concise caption, practical recommendations, CTA, SEO keywords, hashtags, and sources.
- For Carousel, create exactly {req.slides} slides. For other formats create one visual block.
- Keep slide text concise enough for a social design.

Return ONLY valid JSON in this exact structure:
{{
  "title": "...",
  "hook": "...",
  "caption": "...",
  "recommendations": ["..."],
  "cta": "...",
  "keywords": ["..."],
  "hashtags": ["#..."],
  "slides": [{{"number": 1, "headline": "...", "body": "..."}}],
  "sources": [{{"name": "...", "url": "...", "why_relevant": "..."}}]
}}
"""

    kwargs = {
        "model": model,
        "input": prompt,
        "store": False,
    }
    if req.use_web_search:
        kwargs["tools"] = [{"type": "web_search"}]

    try:
        response = client.responses.create(**kwargs)
        data = extract_json(response.output_text)
        data["mode"] = "openai"
        return data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}")


@app.post("/api/generate-image")
def generate_image(req: ImageRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=api_key)
    image_model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
    prompt = (
        f"Create a social-media background visual for a {req.post_type}. "
        f"Topic: {req.title}. {req.visual_direction}. "
        "Do not include readable text, logos, watermarks, or UI. Leave clear negative space for Arabic RTL headline overlay."
    )
    try:
        result = client.images.generate(model=image_model, prompt=prompt, size="1024x1024")
        return {"b64_json": result.data[0].b64_json}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {exc}")
