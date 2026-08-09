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

app = FastAPI(title="GPT Cyber Content API", version="0.5.0")
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
    domain: str = "GRC"
    visual_style: Literal["GRC Professional", "Cyber Pulse", "Executive Minimal", "Infographic"] = "GRC Professional"
    visual_direction: str = ""

class ArchivePost(BaseModel):
    id: str | None = None
    topic_id: int | None = None
    topic: str
    domain: str = "GRC"
    post_type: str = "Carousel"
    platform: str = "Both"
    content: dict[str, Any]

def database_url(): return os.getenv("DATABASE_URL")
def db_conn():
    if not database_url(): raise HTTPException(503,"DATABASE_URL is not configured")
    return psycopg.connect(database_url(),row_factory=dict_row)
def init_db():
    if not database_url(): return
    with psycopg.connect(database_url()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,topic_id INTEGER,topic TEXT NOT NULL,domain TEXT NOT NULL,post_type TEXT NOT NULL,platform TEXT NOT NULL,content JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)");conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)");conn.commit()
@app.on_event("startup")
def startup():
    try:init_db()
    except Exception as exc:print(f"Database startup warning: {exc}")

def demo_payload(req):
    n=req.slides if req.post_type=="Carousel" else 1
    return {"mode":"demo","title":req.topic,"hook":f"كيف يؤثر {req.topic} على الحوكمة والمخاطر والامتثال؟","caption":"محتوى تجريبي.","recommendations":["حدد مالكًا واضحًا للمخاطر.","اربط المتطلبات بضوابط قابلة للقياس."],"cta":"شارك رأيك في التعليقات.","keywords":["GRC","Cybersecurity"],"hashtags":["#GRC","#CyberSecurity"],"slides":[{"number":i+1,"headline":req.topic if i==0 else f"النقطة {i+1}","body":"نص تجريبي."} for i in range(n)],"sources":[]}
def extract_json(text):return json.loads(re.sub(r"^```json\s*|^```\s*|\s*```$","",text.strip(),flags=re.I|re.S))

@app.get("/",include_in_schema=False)
def web_app():return FileResponse(INDEX_FILE,media_type="text/html")
@app.get("/health")
def health():
    db_ok=False
    if database_url():
        try:init_db();db_ok=True
        except:pass
    return {"status":"ok","openai_configured":bool(os.getenv("OPENAI_API_KEY")),"database_configured":bool(database_url()),"database_connected":db_ok,"version":"0.5.0","web_ui":INDEX_FILE.exists()}
@app.get("/api/archive")
def archive_list():
    init_db()
    with db_conn() as conn:return conn.execute("SELECT id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at FROM posts ORDER BY created_at DESC").fetchall()
@app.get("/api/archive/used-topic-ids")
def used_topic_ids():
    init_db()
    with db_conn() as conn:rows=conn.execute("SELECT DISTINCT topic_id FROM posts WHERE topic_id IS NOT NULL").fetchall()
    return {"topic_ids":[r["topic_id"] for r in rows]}
@app.get("/api/archive/{post_id}")
def archive_get(post_id:str):
    with db_conn() as conn:row=conn.execute("SELECT * FROM posts WHERE id=%s",(post_id,)).fetchone()
    if not row:raise HTTPException(404,"Post not found")
    return row
@app.post("/api/archive")
def archive_save(post:ArchivePost):
    init_db();post_id=post.id or str(uuid.uuid4());now=datetime.now(timezone.utc)
    with db_conn() as conn:
        conn.execute("""INSERT INTO posts(id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at) VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s) ON CONFLICT(id) DO UPDATE SET topic_id=EXCLUDED.topic_id,topic=EXCLUDED.topic,domain=EXCLUDED.domain,post_type=EXCLUDED.post_type,platform=EXCLUDED.platform,content=EXCLUDED.content,updated_at=EXCLUDED.updated_at""",(post_id,post.topic_id,post.topic,post.domain,post.post_type,post.platform,json.dumps(post.content,ensure_ascii=False),now,now));conn.commit()
    return {"id":post_id,"saved":True}
@app.delete("/api/archive/{post_id}")
def archive_delete(post_id:str):
    with db_conn() as conn:cur=conn.execute("DELETE FROM posts WHERE id=%s",(post_id,));conn.commit()
    return {"deleted":cur.rowcount>0}

@app.post("/api/generate-content")
def generate_content(req:ContentRequest):
    if not os.getenv("OPENAI_API_KEY"):return demo_payload(req)
    client=OpenAI(api_key=os.getenv("OPENAI_API_KEY"));model=os.getenv("OPENAI_MODEL","gpt-5")
    prompt=f"""You are a senior cybersecurity GRC content strategist. Create a publish-ready {req.post_type} about {req.topic}. Domain:{req.domain}. Platform:{req.platform}. Audience:{req.audience}. Language:{req.language}. Slides:{req.slides}. Use accurate current sources from NIST,CISA,ENISA,ISACA,ISO,OECD,European Commission and official regulators. Do not invent facts or citations. Include hook,caption,recommendations,CTA,SEO keywords,hashtags,sources. For Carousel create exactly {req.slides} slides. Return ONLY JSON: {{"title":"...","hook":"...","caption":"...","recommendations":["..."],"cta":"...","keywords":["..."],"hashtags":["#..."],"slides":[{{"number":1,"headline":"...","body":"..."}}],"sources":[{{"name":"...","url":"...","why_relevant":"..."}}]}}"""
    kwargs={"model":model,"input":prompt,"store":False}
    if req.use_web_search:kwargs["tools"]=[{"type":"web_search"}]
    try:
        response=client.responses.create(**kwargs);data=extract_json(response.output_text);data["mode"]="openai";return data
    except Exception as exc:raise HTTPException(500,f"Generation failed: {exc}")

def visual_prompt(req:ImageRequest):
    common=f"""CURRENT SLIDE: slide {req.slide_number}. Topic/headline: {req.title}. Supporting meaning: {req.body}. Domain: {req.domain}. Analyze the slide and create a unique visual concept that explains this exact business/GRC idea. Social media 4:5 vertical composition, premium government-enterprise quality. Arabic RTL layout zones. Typography direction for later application overlay: Cairo font family, Cairo Bold for headlines and Cairo Regular/Medium for supporting Arabic text. IMPORTANT: do not render any readable text, fake Arabic, letters, logos, watermarks or brand marks inside the generated artwork; the application will overlay all Arabic text in Cairo separately. Leave intentional clean text-safe areas."""
    if req.visual_style=="Cyber Pulse":
        style="""CYBER PULSE style: premium Arabic cybersecurity intelligence newsroom/advisory. Deep navy and near-black background, electric cyan/blue highlights, subtle digital grid, network nodes and data signals. One dominant central visual representing the actual story, restrained threat-intelligence indicators, severity-style accent areas when relevant, authoritative not sensational. Avoid generic hooded hackers unless genuinely required. Modern SOC/intelligence report aesthetic with strong headline-safe zone and clean footer-safe zone."""
    elif req.visual_style=="Executive Minimal":
        style="""EXECUTIVE MINIMAL style: white/light background, extremely clean executive consulting-report aesthetic, one strong central metaphor, 2-4 restrained supporting elements, navy and blue palette, generous whitespace, refined vector icons, minimal clutter."""
    elif req.visual_style=="Infographic":
        style="""INFOGRAPHIC style: clean structured editorial infographic, light background, central concept with 3-5 supporting cards, professional vector icons, thin connector lines, navy primary with limited orange/green/red status accents, strong information hierarchy and generous whitespace."""
    else:
        style="""GRC PROFESSIONAL style: clean modern corporate cybersecurity/GRC infographic inspired by premium consulting reports. White or very light background with subtle geometric patterns and generous whitespace. Deep navy primary, cyber blue secondary, limited orange for warning/risk, green for compliance/success and red for critical exposure. Use flat/vector illustrations and refined infographic elements. Layout should visually support a large headline area, short supporting statement, one central GRC concept, and 3-5 surrounding information-card zones with simple professional icons and thin relationship lines. Translate concepts intelligently: Governance = hierarchy/policy/leadership/oversight/accountability; Risk = matrix/warning/assessment/prioritization; Compliance = checklist/shield/verified controls/regulation; Third Party = organization connected to vendors; Audit = evidence/documents/magnifier/control verification; AI Governance = AI system surrounded by policy/controls/oversight; BCM = interconnected services/resilience/recovery. Avoid dark hacker imagery, hooded figures, Matrix code, dramatic attacks and gaming visuals. The image must explain the GRC concept rather than merely decorate it."""
    return f"{style}\n{common}\nAdditional direction: {req.visual_direction}".strip()

@app.post("/api/generate-image")
def generate_image(req:ImageRequest):
    if not os.getenv("OPENAI_API_KEY"):raise HTTPException(400,"OPENAI_API_KEY is not configured")
    client=OpenAI(api_key=os.getenv("OPENAI_API_KEY"));image_model=os.getenv("OPENAI_IMAGE_MODEL","gpt-image-1")
    try:
        result=client.images.generate(model=image_model,prompt=visual_prompt(req),size="1024x1536");return {"b64_json":result.data[0].b64_json,"slide_number":req.slide_number,"visual_style":req.visual_style,"font":"Cairo"}
    except Exception as exc:raise HTTPException(500,f"Image generation failed: {exc}")
