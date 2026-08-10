import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Any

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="GPT Cyber Content API", version="0.8.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"
MOBILE_JS = BASE_DIR / "mobile-download.js"
AUTH_EXEMPT_PATHS = {"/health"}

class ContentRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    domain: Literal["GRC", "Cybersecurity", "AI Governance", "Privacy"] = "GRC"
    post_type: Literal["Carousel", "Infographic", "Single Post"] = "Carousel"
    platform: Literal["Instagram", "LinkedIn", "Both"] = "Both"
    audience: str = "Government and enterprise cybersecurity professionals"
    language: Literal["Arabic", "English"] = "Arabic"
    slides: int = Field(default=6, ge=1, le=10)
    tone: str = "Professional, practical, executive-friendly"
    use_web_search: bool = False

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

def hash_password(password: str, salt: bytes | None = None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(digest).decode("ascii")

def verify_password(password: str, salt_b64: str, hash_b64: str):
    try:
        salt=base64.b64decode(salt_b64); expected=base64.b64decode(hash_b64)
        actual=hashlib.pbkdf2_hmac("sha256",password.encode("utf-8"),salt,310000)
        return hmac.compare_digest(actual,expected)
    except Exception:return False

def init_db():
    if not database_url(): return
    with psycopg.connect(database_url()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,topic_id INTEGER,topic TEXT NOT NULL,domain TEXT NOT NULL,post_type TEXT NOT NULL,platform TEXT NOT NULL,content JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)")
        conn.execute("""CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.commit()

def bootstrap_user():
    if not database_url(): return
    username=os.getenv("AUTH_BOOTSTRAP_USERNAME","").strip(); password=os.getenv("AUTH_BOOTSTRAP_PASSWORD","")
    if not username or not password:return
    with psycopg.connect(database_url(),row_factory=dict_row) as conn:
        count=conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
        if count==0:
            salt,password_hash=hash_password(password)
            conn.execute("INSERT INTO users(id,username,password_salt,password_hash,is_active) VALUES(%s,%s,%s,%s,TRUE)",(str(uuid.uuid4()),username,salt,password_hash));conn.commit()

def user_count():
    if not database_url():return 0
    try:
        with psycopg.connect(database_url(),row_factory=dict_row) as conn:return conn.execute("SELECT COUNT(*) AS total FROM users WHERE is_active=TRUE").fetchone()["total"]
    except Exception:return 0

def authenticate_basic(auth_header):
    if not auth_header or not auth_header.startswith("Basic "):return False
    try:
        raw=base64.b64decode(auth_header.split(" ",1)[1]).decode("utf-8");username,password=raw.split(":",1)
        with psycopg.connect(database_url(),row_factory=dict_row) as conn:user=conn.execute("SELECT username,password_salt,password_hash,is_active FROM users WHERE username=%s",(username,)).fetchone()
        return bool(user and user["is_active"] and verify_password(password,user["password_salt"],user["password_hash"]))
    except Exception:return False

@app.middleware("http")
async def database_basic_auth(request:Request,call_next):
    if request.url.path in AUTH_EXEMPT_PATHS:return await call_next(request)
    if not database_url():return JSONResponse({"detail":"DATABASE_URL is not configured"},status_code=503)
    if user_count()==0:return JSONResponse({"detail":"No active users found. Set AUTH_BOOTSTRAP_USERNAME and AUTH_BOOTSTRAP_PASSWORD in Railway Variables, then redeploy."},status_code=503)
    if not authenticate_basic(request.headers.get("Authorization")):return Response(status_code=401,headers={"WWW-Authenticate":"Basic realm=\"GPT Cyber Content\", charset=\"UTF-8\""})
    return await call_next(request)

@app.on_event("startup")
def startup():
    try:init_db();bootstrap_user()
    except Exception as exc:print(f"Database startup warning: {exc}")

def demo_payload(req):
    n=req.slides if req.post_type=="Carousel" else 1
    return {"mode":"demo","title":req.topic,"hook":f"كيف يؤثر {req.topic} على الحوكمة والمخاطر والامتثال؟","caption":"محتوى تجريبي.","recommendations":["حدد مالكًا واضحًا للمخاطر.","اربط المتطلبات بضوابط قابلة للقياس."],"cta":"شارك رأيك في التعليقات.","keywords":["GRC","Cybersecurity"],"hashtags":["#GRC","#CyberSecurity"],"slides":[{"number":i+1,"headline":req.topic if i==0 else f"النقطة {i+1}","body":"نص تجريبي."} for i in range(n)],"sources":[]}
def extract_json(text):return json.loads(re.sub(r"^```json\s*|^```\s*|\s*```$","",text.strip(),flags=re.I|re.S))

@app.get("/",include_in_schema=False)
def web_app():return FileResponse(INDEX_FILE,media_type="text/html")

@app.get("/mobile-download.js", include_in_schema=False)
def mobile_download_script():
    if not MOBILE_JS.exists(): raise HTTPException(404,"mobile-download.js not found")
    return FileResponse(MOBILE_JS,media_type="application/javascript")

@app.get("/health")
def health():
    db_ok=False;users=0
    if database_url():
        try:init_db();users=user_count();db_ok=True
        except:pass
    return {"status":"ok","openai_configured":bool(os.getenv("OPENAI_API_KEY")),"database_configured":bool(database_url()),"database_connected":db_ok,"auth_enabled":users>0,"active_users":users,"version":"0.8.1","web_ui":INDEX_FILE.exists(),"mobile_download":MOBILE_JS.exists(),"grc_template":"Cyber Pulse GRC","image_text_mode":"overlay-only"}
@app.get("/api/archive")
def archive_list():
    with db_conn() as conn:return conn.execute("SELECT id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at FROM posts ORDER BY created_at DESC").fetchall()
@app.get("/api/archive/used-topic-ids")
def used_topic_ids():
    with db_conn() as conn:rows=conn.execute("SELECT DISTINCT topic_id FROM posts WHERE topic_id IS NOT NULL").fetchall()
    return {"topic_ids":[r["topic_id"] for r in rows]}
@app.get("/api/archive/{post_id}")
def archive_get(post_id:str):
    with db_conn() as conn:row=conn.execute("SELECT * FROM posts WHERE id=%s",(post_id,)).fetchone()
    if not row:raise HTTPException(404,"Post not found")
    return row
@app.post("/api/archive")
def archive_save(post:ArchivePost):
    post_id=post.id or str(uuid.uuid4());now=datetime.now(timezone.utc)
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
    prompt=f"""You are a senior cybersecurity GRC content strategist. Create a publish-ready {req.post_type} about {req.topic}. Domain:{req.domain}. Platform:{req.platform}. Audience:{req.audience}. Language:{req.language}. Slides:{req.slides}. Write polished Arabic suitable for government and enterprise cybersecurity professionals. Include a strong hook, substantive caption, practical recommendations, CTA, SEO keywords, hashtags and sources when available. For Carousel create exactly {req.slides} slides. Each slide: one concise headline and short body. Hashtags belong only in caption metadata, never slide text. Do not invent standards, dates, statistics or citations. Return ONLY JSON: {{"title":"...","hook":"...","caption":"...","recommendations":["..."],"cta":"...","keywords":["..."],"hashtags":["#..."],"slides":[{{"number":1,"headline":"...","body":"..."}}],"sources":[{{"name":"...","url":"...","why_relevant":"..."}}]}}"""
    kwargs={"model":model,"input":prompt,"store":False}
    if req.use_web_search:
        kwargs["tools"]=[{"type":"web_search"}]
        prompt += "\nUse current authoritative sources such as NIST, CISA, ENISA, ISACA, ISO, OECD, European Commission and official regulators."
        kwargs["input"]=prompt
    try:
        response=client.responses.create(**kwargs);data=extract_json(response.output_text);data["mode"]="openai";data["web_verified"]=req.use_web_search;return data
    except Exception as exc:raise HTTPException(500,f"Generation failed: {exc}")

def visual_prompt(req:ImageRequest):
    common=f"""This is ONLY the background/artwork layer for slide {req.slide_number}. Concept to visualize: {req.title}. Supporting meaning: {req.body}. Create one standalone 4:5 vertical social-media artwork. ABSOLUTE RULE: ZERO TEXT OF ANY KIND. Do not draw Arabic, English, letters, numbers, symbols that resemble typography, logos, social handles, hashtags, labels, captions, UI text, signs, document text, watermark text, or pseudo-text. Any documents/charts shown must use abstract lines/shapes only. The website will add ALL typography separately as a Cairo-font overlay. Leave clean empty areas for headline, body, footer identity and slide number."""
    if req.domain.strip().upper()=="GRC":
        style="""LOCKED CYBER PULSE GRC ARTWORK TEMPLATE: premium government/enterprise GRC infographic; white or very light cool-gray background; subtle pale-blue dotted corner geometry; generous whitespace; deep navy and royal blue primary palette; green only for positive/accept/compliance, orange for transfer/warning, red for avoid/critical. Clean flat/vector plus polished semi-3D enterprise icons such as shields, governance building, clipboard without text, magnifier, abstract charts, target, risk indicators. One dominant concept illustration plus optional 2–5 rounded blank card shapes and thin connectors. Consistent spacing, rounded corners and visual weight across the carousel. No hacker imagery, no people in hoodies, no Matrix code, no dark neon gaming aesthetic, no hashtags. Reserve blank footer zone and bottom-left circular slide-number zone; slide 1 also reserves a clean top brand zone. Do not place brand text inside artwork."""
    elif req.visual_style=="Cyber Pulse":style="""Cybersecurity intelligence artwork: deep navy background, cyan highlights, abstract network/data visuals, one dominant story metaphor, no text or pseudo-text, clean RTL text-safe zones."""
    elif req.visual_style=="Executive Minimal":style="""Executive minimal artwork: white background, one strong central metaphor, 2–4 restrained visual elements, navy/blue palette, large whitespace, no text or pseudo-text."""
    else:style="""Structured infographic artwork: light background, central concept, 3–5 blank supporting cards, professional vector icons, thin connectors, no text or pseudo-text."""
    return f"{style}\n{common}\n{req.visual_direction}".strip()

@app.post("/api/generate-image")
def generate_image(req:ImageRequest):
    if not os.getenv("OPENAI_API_KEY"):raise HTTPException(400,"OPENAI_API_KEY is not configured")
    client=OpenAI(api_key=os.getenv("OPENAI_API_KEY"));image_model=os.getenv("OPENAI_IMAGE_MODEL","gpt-image-1")
    try:
        result=client.images.generate(model=image_model,prompt=visual_prompt(req),size="1024x1536")
        return {"b64_json":result.data[0].b64_json,"slide_number":req.slide_number,"visual_style":"Cyber Pulse GRC" if req.domain.strip().upper()=="GRC" else req.visual_style,"font":"Cairo","overlay_required":True,"hashtags_in_image":False}
    except Exception as exc:raise HTTPException(500,f"Image generation failed: {exc}")
