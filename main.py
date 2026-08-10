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

app = FastAPI(title="GPT Cyber Content API", version="0.9.1")
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
    title: str; body: str = ""; slide_number: int = 1
    post_type: Literal["Carousel", "Infographic", "Single Post"] = "Single Post"
    domain: str = "GRC"
    visual_style: Literal["GRC Professional", "Cyber Pulse", "Executive Minimal", "Infographic"] = "GRC Professional"
    visual_direction: str = ""
class NewsParseRequest(BaseModel):
    title: str = Field(min_length=3,max_length=500)
    news: str = Field(min_length=10,max_length=12000)
class ArchivePost(BaseModel):
    id: str | None = None; topic_id: int | None = None; topic: str; domain: str = "GRC"; post_type: str = "Carousel"; platform: str = "Both"; content: dict[str, Any]

def database_url(): return os.getenv("DATABASE_URL")
def db_conn():
    if not database_url(): raise HTTPException(503,"DATABASE_URL is not configured")
    return psycopg.connect(database_url(),row_factory=dict_row)
def hash_password(password,salt=None):
    salt=salt or secrets.token_bytes(16);digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,310000);return base64.b64encode(salt).decode(),base64.b64encode(digest).decode()
def verify_password(password,salt_b64,hash_b64):
    try:return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256",password.encode(),base64.b64decode(salt_b64),310000),base64.b64decode(hash_b64))
    except:return False
def init_db():
    if not database_url():return
    with psycopg.connect(database_url()) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,topic_id INTEGER,topic TEXT NOT NULL,domain TEXT NOT NULL,post_type TEXT NOT NULL,platform TEXT NOT NULL,content JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)");conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)")
        conn.execute("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");conn.commit()
def bootstrap_user():
    if not database_url():return
    username=os.getenv("AUTH_BOOTSTRAP_USERNAME","").strip();password=os.getenv("AUTH_BOOTSTRAP_PASSWORD","")
    if not username or not password:return
    with psycopg.connect(database_url(),row_factory=dict_row) as conn:
        if conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]==0:
            salt,pwh=hash_password(password);conn.execute("INSERT INTO users(id,username,password_salt,password_hash,is_active) VALUES(%s,%s,%s,%s,TRUE)",(str(uuid.uuid4()),username,salt,pwh));conn.commit()
def user_count():
    if not database_url():return 0
    try:
        with psycopg.connect(database_url(),row_factory=dict_row) as conn:return conn.execute("SELECT COUNT(*) AS total FROM users WHERE is_active=TRUE").fetchone()["total"]
    except:return 0
def authenticate_basic(header):
    if not header or not header.startswith("Basic "):return False
    try:
        username,password=base64.b64decode(header.split(" ",1)[1]).decode().split(":",1)
        with psycopg.connect(database_url(),row_factory=dict_row) as conn:u=conn.execute("SELECT * FROM users WHERE username=%s",(username,)).fetchone()
        return bool(u and u["is_active"] and verify_password(password,u["password_salt"],u["password_hash"]))
    except:return False
@app.middleware("http")
async def auth(request:Request,call_next):
    if request.url.path in AUTH_EXEMPT_PATHS:return await call_next(request)
    if not database_url():return JSONResponse({"detail":"DATABASE_URL is not configured"},503)
    if user_count()==0:return JSONResponse({"detail":"No active users found. Set AUTH_BOOTSTRAP_USERNAME and AUTH_BOOTSTRAP_PASSWORD in Railway Variables, then redeploy."},503)
    if not authenticate_basic(request.headers.get("Authorization")):return Response(status_code=401,headers={"WWW-Authenticate":"Basic realm=\"GPT Cyber Content\", charset=\"UTF-8\""})
    return await call_next(request)
@app.on_event("startup")
def startup():
    try:init_db();bootstrap_user()
    except Exception as e:print("Database startup warning:",e)
def extract_json(text):return json.loads(re.sub(r"^```json\s*|^```\s*|\s*```$","",text.strip(),flags=re.I|re.S))
@app.get("/",include_in_schema=False)
def web_app():return FileResponse(INDEX_FILE,media_type="text/html")
@app.get("/mobile-download.js",include_in_schema=False)
def mobile_js():return FileResponse(MOBILE_JS,media_type="application/javascript")
@app.get("/health")
def health():return {"status":"ok","version":"0.9.1","openai_configured":bool(os.getenv("OPENAI_API_KEY")),"database_connected":bool(database_url()),"active_users":user_count(),"news_parser":"structured-v3","news_artwork":"text-free-editorial-v4"}
@app.get("/api/archive")
def archive_list():
    with db_conn() as c:return c.execute("SELECT id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at FROM posts ORDER BY created_at DESC").fetchall()
@app.get("/api/archive/used-topic-ids")
def used_ids():
    with db_conn() as c:return {"topic_ids":[r["topic_id"] for r in c.execute("SELECT DISTINCT topic_id FROM posts WHERE topic_id IS NOT NULL").fetchall()]}
@app.post("/api/archive")
def archive_save(p:ArchivePost):
    pid=p.id or str(uuid.uuid4());now=datetime.now(timezone.utc)
    with db_conn() as c:c.execute("INSERT INTO posts(id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at) VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content,updated_at=EXCLUDED.updated_at",(pid,p.topic_id,p.topic,p.domain,p.post_type,p.platform,json.dumps(p.content,ensure_ascii=False),now,now));c.commit()
    return {"id":pid,"saved":True}
@app.delete("/api/archive/{post_id}")
def archive_delete(post_id:str):
    with db_conn() as c:cur=c.execute("DELETE FROM posts WHERE id=%s",(post_id,));c.commit();return {"deleted":cur.rowcount>0}

def demo_payload(req):
    n=req.slides if req.post_type=="Carousel" else 1;return {"mode":"demo","title":req.topic,"hook":req.topic,"caption":"محتوى تجريبي.","recommendations":[],"cta":"شارك رأيك.","keywords":["GRC"],"hashtags":["#GRC"],"slides":[{"number":i+1,"headline":req.topic,"body":"نص تجريبي."} for i in range(n)],"sources":[]}
@app.post("/api/generate-content")
def generate_content(req:ContentRequest):
    if not os.getenv("OPENAI_API_KEY"):return demo_payload(req)
    client=OpenAI(api_key=os.getenv("OPENAI_API_KEY"));model=os.getenv("OPENAI_MODEL","gpt-5")
    prompt=f"Create publish-ready Arabic {req.post_type} about {req.topic} for government/enterprise cybersecurity professionals. Exactly {req.slides} slides if carousel. Return ONLY JSON with title,hook,caption,recommendations,cta,keywords,hashtags,slides(number,headline,body),sources. Never invent citations. Hashtags never belong in slides."
    kw={"model":model,"input":prompt,"store":False}
    if req.use_web_search:kw["tools"]=[{"type":"web_search"}]
    try:d=extract_json(client.responses.create(**kw).output_text);d["mode"]="openai";return d
    except Exception as e:raise HTTPException(500,f"Generation failed: {e}")

@app.post("/api/parse-news")
def parse_news(req:NewsParseRequest):
    if not os.getenv("OPENAI_API_KEY"):raise HTTPException(400,"OPENAI_API_KEY is not configured")
    client=OpenAI(api_key=os.getenv("OPENAI_API_KEY"));model=os.getenv("OPENAI_MODEL","gpt-5")
    prompt=f'''You are the editorial intelligence engine for the Arabic cybersecurity publication "نبض سيبراني | CYBER PULSE".
Parse ONLY supplied facts. Never invent or silently correct CVEs, dates, severity, vendors, sources or recommendations.
HEADLINE:\n{req.title}\n\nPASTED NEWS:\n{req.news}
Return ONLY valid JSON with: headline, severity (حرج/عالي/متوسط/منخفض/or empty), date, cve, summary (2-3 concise Arabic sentences), recommendations (only supplied), source, entities, threat_type, visual_brief, caption.
For visual_brief, describe ONE simple editorial metaphor specific to the affected technology and risk mechanism. The brief MUST NOT request or mention any visible words, product names, interface labels, UI screens, dashboards, diagrams, flowcharts, logos with text, letters or numbers. It should describe only visual objects and relationships. For privilege escalation use an abstract enterprise identity-access environment with a digital identity shield and a clear standard-access-to-elevated-access metaphor. Caption must use only supplied facts and include @cyberpulse_ar.'''
    try:return extract_json(client.responses.create(model=model,input=prompt,store=False).output_text)
    except Exception as e:raise HTTPException(500,f"News parsing failed: {e}")

def visual_prompt(req:ImageRequest):
    if req.visual_style=="Cyber Pulse":
        return f'''Create ONLY the visual background artwork for a premium cybersecurity news post.
FORMAT: vertical Instagram 4:5 portrait.
BRAND VISUAL SYSTEM: deep black/dark navy #050B12, Cyber Blue #0A84FF, Cyan #00D1C7. Red only when the supplied risk is high/critical. Subtle circuit patterns, restrained digital grid, soft blue/cyan atmospheric glow. Premium enterprise cybersecurity media publication quality, sophisticated and minimal, never gaming-like.

STRICT COMPOSITION:
LEFT 35-40% ONLY: ONE large topic-specific editorial hero visual. Keep the important hero objects entirely on the left side.
RIGHT 60-65%: intentionally EMPTY, clean, dark text-safe area. It must remain visually quiet for Arabic typography that the application overlays later. Do not put objects, icons, interfaces, diagrams, bright effects, decoration or focal details in this right-side text area. A very subtle dark background texture is acceptable.

ABSOLUTE NO-TEXT RULE:
Generate ZERO readable text. ZERO Arabic. ZERO English. ZERO words, letters, numbers, CVE identifiers, product names, UI labels, captions, headlines, hashtags, watermarks, signatures, brand names, pseudo-text or typographic logo marks. Do not write "Cyber Pulse". Do not write the affected vendor/product name. The application adds ALL typography and branding later.

DO NOT CREATE:
technical diagrams, flowcharts, dashboards, software interfaces, screenshots, browser windows, directory/user lists, tables, cards containing text, hacker hoodies, masks, skulls, Matrix code, random binary streams, generic warning posters, or cluttered compositions.

STORY CONCEPT:
{req.visual_direction}
Concept context for visual understanding only: {req.title}. {req.body}
Represent the story through ONE simple editorial visual metaphor, not a literal software UI. If the story involves identity or privilege escalation, visualize abstract enterprise identity nodes, a security/identity shield, and a clear visual transition from standard access to elevated privileged access using shapes, light, hierarchy or position — never usernames, role labels, directory screens or written UI.

FINAL CHECK BEFORE RENDERING:
The left side contains the editorial hero. The right side is mostly empty dark negative space. There is no readable text anywhere in the generated artwork. The result looks like a professional cybersecurity media background ready for separately overlaid Arabic news typography.'''
    common=f"Artwork only, 4:5 portrait. Concept: {req.title}. Context: {req.body}. ABSOLUTE: zero readable text, letters, numbers, labels, hashtags, watermarks or pseudo-text. Leave typography zones empty. {req.visual_direction}"
    if req.domain.strip().upper()=="GRC":style="Premium light government/enterprise GRC infographic artwork; white/cool-gray; navy/royal blue; restrained green/orange/red status accents; polished enterprise vector/semi-3D icons; generous whitespace; no hacker clichés."
    elif req.visual_style=="Executive Minimal":style="Executive minimal artwork, white background, navy/blue, strong central metaphor, whitespace."
    else:style="Structured professional infographic artwork, light background, central concept and restrained supporting visuals."
    return style+"\n"+common
@app.post("/api/generate-image")
def generate_image(req:ImageRequest):
    if not os.getenv("OPENAI_API_KEY"):raise HTTPException(400,"OPENAI_API_KEY is not configured")
    try:
        r=OpenAI(api_key=os.getenv("OPENAI_API_KEY")).images.generate(model=os.getenv("OPENAI_IMAGE_MODEL","gpt-image-1"),prompt=visual_prompt(req),size="1024x1536")
        return {"b64_json":r.data[0].b64_json,"slide_number":req.slide_number,"visual_style":req.visual_style,"font":"Cairo","overlay_required":True,"hashtags_in_image":False,"artwork_version":"text-free-editorial-v4"}
    except Exception as e:raise HTTPException(500,f"Image generation failed: {e}")
