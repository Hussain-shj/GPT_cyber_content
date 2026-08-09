import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Any

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="GPT Cyber Content API", version="0.4.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"

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
    body: str = ""
    slide_number: int = 1
    post_type: Literal["Carousel", "Infographic", "Single Post"] = "Single Post"
    visual_direction: str = "Modern premium cybersecurity visual, dark navy, cyan accents, clean government-enterprise aesthetic"

class ArchivePost(BaseModel):
    id: str | None = None
    topic_id: int | None = None
    topic: str
    domain: str = "GRC"
    post_type: str = "Carousel"
    platform: str = "Both"
    content: dict[str, Any]


def database_url():
    return os.getenv("DATABASE_URL")

def db_conn():
    url = database_url()
    if not url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured. Add Railway PostgreSQL and reference DATABASE_URL in this service.")
    return psycopg.connect(url, row_factory=dict_row)

def init_db():
    if not database_url(): return
    with psycopg.connect(database_url()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            topic_id INTEGER,
            topic TEXT NOT NULL,
            domain TEXT NOT NULL,
            post_type TEXT NOT NULL,
            platform TEXT NOT NULL,
            content JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)")
        conn.commit()

@app.on_event("startup")
def startup():
    try: init_db()
    except Exception as exc: print(f"Database startup warning: {exc}")

def demo_payload(req: ContentRequest):
    n = req.slides if req.post_type == "Carousel" else 1
    return {"mode":"demo","title":req.topic,"hook":f"كيف يؤثر {req.topic} على الحوكمة والمخاطر والامتثال؟","caption":"هذا محتوى تجريبي. أضف OPENAI_API_KEY في Railway لتفعيل التوليد المباشر والبحث من المصادر العالمية.","recommendations":["حدد مالكًا واضحًا للمخاطر والضوابط.","اربط المتطلبات التنظيمية بضوابط قابلة للقياس.","راجع الأدلة والاستثناءات بشكل دوري."],"cta":"ما التحدي الأكبر الذي تواجهه مؤسستك في تطبيق هذا الموضوع؟ شارك رأيك في التعليقات.","keywords":["GRC","Cybersecurity Governance","Risk Management","Compliance"],"hashtags":["#GRC","#CyberSecurity","#Governance","#RiskManagement","#Compliance"],"slides":[{"number":i+1,"headline":req.topic if i==0 else f"النقطة {i+1}","body":"نص تجريبي للمعاينة."} for i in range(n)],"sources":[]}

def extract_json(text: str):
    return json.loads(re.sub(r"^```json\s*|^```\s*|\s*```$", "", text.strip(), flags=re.I|re.S))

@app.get("/", include_in_schema=False)
def web_app():
    if not INDEX_FILE.exists(): raise HTTPException(404, "index.html not found")
    return FileResponse(INDEX_FILE, media_type="text/html")

@app.get("/health")
def health():
    db_ok = False
    if database_url():
        try:
            init_db()
            with psycopg.connect(database_url()) as conn: conn.execute("SELECT 1")
            db_ok = True
        except Exception: db_ok = False
    return {"status":"ok","openai_configured":bool(os.getenv("OPENAI_API_KEY")),"database_configured":bool(database_url()),"database_connected":db_ok,"version":"0.4.0","web_ui":INDEX_FILE.exists()}

@app.get("/api/archive")
def archive_list():
    init_db()
    with db_conn() as conn:
        rows = conn.execute("SELECT id, topic_id, topic, domain, post_type, platform, content, created_at, updated_at FROM posts ORDER BY created_at DESC").fetchall()
    return rows

@app.get("/api/archive/used-topic-ids")
def used_topic_ids():
    init_db()
    with db_conn() as conn:
        rows = conn.execute("SELECT DISTINCT topic_id FROM posts WHERE topic_id IS NOT NULL").fetchall()
    return {"topic_ids":[r["topic_id"] for r in rows]}

@app.get("/api/archive/{post_id}")
def archive_get(post_id: str):
    init_db()
    with db_conn() as conn:
        row = conn.execute("SELECT * FROM posts WHERE id=%s", (post_id,)).fetchone()
    if not row: raise HTTPException(404, "Post not found")
    return row

@app.post("/api/archive")
def archive_save(post: ArchivePost):
    init_db()
    post_id = post.id or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    with db_conn() as conn:
        conn.execute("""INSERT INTO posts(id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at)
        VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
        ON CONFLICT(id) DO UPDATE SET topic_id=EXCLUDED.topic_id,topic=EXCLUDED.topic,domain=EXCLUDED.domain,post_type=EXCLUDED.post_type,platform=EXCLUDED.platform,content=EXCLUDED.content,updated_at=EXCLUDED.updated_at""",
        (post_id,post.topic_id,post.topic,post.domain,post.post_type,post.platform,json.dumps(post.content,ensure_ascii=False),now,now))
        conn.commit()
    return {"id":post_id,"saved":True}

@app.delete("/api/archive/{post_id}")
def archive_delete(post_id: str):
    init_db()
    with db_conn() as conn:
        cur=conn.execute("DELETE FROM posts WHERE id=%s",(post_id,)); conn.commit()
    return {"deleted":cur.rowcount>0}

@app.post("/api/generate-content")
def generate_content(req: ContentRequest):
    api_key=os.getenv("OPENAI_API_KEY")
    if not api_key:return demo_payload(req)
    client=OpenAI(api_key=api_key); model=os.getenv("OPENAI_MODEL","gpt-5")
    prompt=f"""You are a senior cybersecurity GRC content strategist writing for professionals and government-sector employees.
Create a publish-ready {req.post_type} about: {req.topic}
Domain: {req.domain}; Platform: {req.platform}; Audience: {req.audience}; Language: {req.language}; Tone: {req.tone}; Number of slides: {req.slides}
Prioritize accurate current internationally recognized sources such as NIST, CISA, ENISA, ISACA, ISO, OECD, European Commission and official regulators. Do not invent standards, dates, statistics or citations. Make it practical for Instagram and LinkedIn. Include hook, caption, recommendations, CTA, SEO keywords, hashtags and sources. For Carousel create exactly {req.slides} slides; otherwise one visual block. Each slide needs a distinct visual idea and concise text.
Return ONLY valid JSON: {{"title":"...","hook":"...","caption":"...","recommendations":["..."],"cta":"...","keywords":["..."],"hashtags":["#..."],"slides":[{{"number":1,"headline":"...","body":"..."}}],"sources":[{{"name":"...","url":"...","why_relevant":"..."}}]}}"""
    kwargs={"model":model,"input":prompt,"store":False}
    if req.use_web_search:kwargs["tools"]=[{"type":"web_search"}]
    try:
        response=client.responses.create(**kwargs); data=extract_json(response.output_text); data["mode"]="openai"; return data
    except Exception as exc: raise HTTPException(500,f"Generation failed: {exc}")

@app.post("/api/generate-image")
def generate_image(req: ImageRequest):
    api_key=os.getenv("OPENAI_API_KEY")
    if not api_key:raise HTTPException(400,"OPENAI_API_KEY is not configured")
    client=OpenAI(api_key=api_key); image_model=os.getenv("OPENAI_IMAGE_MODEL","gpt-image-1")
    prompt=f"Create visual artwork for slide {req.slide_number} of a cybersecurity/GRC {req.post_type}. Headline concept: {req.title}. Supporting meaning: {req.body}. {req.visual_direction}. Sophisticated editorial cybersecurity visual directly related to this slide, not generic hacker imagery. UAE-appropriate institutional cues when people/environments appear. No readable text, letters, logos, watermarks, UI screenshots or brand marks. Leave clean negative space for Arabic RTL text overlay."
    try:
        result=client.images.generate(model=image_model,prompt=prompt,size="1024x1024"); return {"b64_json":result.data[0].b64_json,"slide_number":req.slide_number}
    except Exception as exc:raise HTTPException(500,f"Image generation failed: {exc}")
