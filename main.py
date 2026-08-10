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
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="GPT Cyber Content API", version="0.10.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"
MOBILE_JS = BASE_DIR / "mobile-download.js"
NEWS_SEARCH_JS = BASE_DIR / "news-search.js"
CYBER_SOURCES_FILE = BASE_DIR / "cyber_sources.json"
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

class NewsParseRequest(BaseModel):
    title: str = Field(min_length=3, max_length=500)
    news: str = Field(min_length=10, max_length=12000)

class NewsSearchRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=30)
    limit: int = Field(default=8, ge=1, le=12)

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
    if not database_url(): raise HTTPException(503, "DATABASE_URL is not configured")
    return psycopg.connect(database_url(), row_factory=dict_row)

def load_cyber_sources():
    try:
        return json.loads(CYBER_SOURCES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

def source_hosts():
    hosts = set()
    for src in load_cyber_sources():
        host = urlparse(src.get("url", "")).hostname
        if host:
            hosts.add(host.lower().removeprefix("www."))
    return hosts

def url_is_approved(url: str):
    try:
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
        return any(host == allowed or host.endswith("." + allowed) for allowed in source_hosts())
    except Exception:
        return False

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310000)
    return base64.b64encode(salt).decode(), base64.b64encode(digest).decode()

def verify_password(password, salt_b64, hash_b64):
    try:
        return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), 310000), base64.b64decode(hash_b64))
    except Exception:
        return False

def init_db():
    if not database_url(): return
    with psycopg.connect(database_url()) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,topic_id INTEGER,topic TEXT NOT NULL,domain TEXT NOT NULL,post_type TEXT NOT NULL,platform TEXT NOT NULL,content JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)")
        conn.execute("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        conn.commit()

def bootstrap_user():
    if not database_url(): return
    username = os.getenv("AUTH_BOOTSTRAP_USERNAME", "").strip()
    password = os.getenv("AUTH_BOOTSTRAP_PASSWORD", "")
    if not username or not password: return
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        if conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"] == 0:
            salt, pwh = hash_password(password)
            conn.execute("INSERT INTO users(id,username,password_salt,password_hash,is_active) VALUES(%s,%s,%s,%s,TRUE)", (str(uuid.uuid4()), username, salt, pwh))
            conn.commit()

def user_count():
    if not database_url(): return 0
    try:
        with psycopg.connect(database_url(), row_factory=dict_row) as conn:
            return conn.execute("SELECT COUNT(*) AS total FROM users WHERE is_active=TRUE").fetchone()["total"]
    except Exception:
        return 0

def authenticate_basic(header):
    if not header or not header.startswith("Basic "): return False
    try:
        username, password = base64.b64decode(header.split(" ", 1)[1]).decode().split(":", 1)
        with psycopg.connect(database_url(), row_factory=dict_row) as conn:
            u = conn.execute("SELECT * FROM users WHERE username=%s", (username,)).fetchone()
        return bool(u and u["is_active"] and verify_password(password, u["password_salt"], u["password_hash"]))
    except Exception:
        return False

@app.middleware("http")
async def auth(request: Request, call_next):
    if request.url.path in AUTH_EXEMPT_PATHS: return await call_next(request)
    if not database_url(): return JSONResponse({"detail":"DATABASE_URL is not configured"}, status_code=503)
    if user_count() == 0: return JSONResponse({"detail":"No active users found. Set AUTH_BOOTSTRAP_USERNAME and AUTH_BOOTSTRAP_PASSWORD in Railway Variables, then redeploy."}, status_code=503)
    if not authenticate_basic(request.headers.get("Authorization")):
        return Response(status_code=401, headers={"WWW-Authenticate":"Basic realm=\"GPT Cyber Content\", charset=\"UTF-8\""})
    return await call_next(request)

@app.on_event("startup")
def startup():
    try: init_db(); bootstrap_user()
    except Exception as e: print("Database startup warning:", e)

def extract_json(text):
    cleaned = re.sub(r"^```json\s*|^```\s*|\s*```$", "", text.strip(), flags=re.I|re.S)
    return json.loads(cleaned)

@app.get("/", include_in_schema=False)
def web_app(): return FileResponse(INDEX_FILE, media_type="text/html")

@app.get("/mobile-download.js", include_in_schema=False)
def mobile_js():
    base = MOBILE_JS.read_text(encoding="utf-8") if MOBILE_JS.exists() else ""
    search = NEWS_SEARCH_JS.read_text(encoding="utf-8") if NEWS_SEARCH_JS.exists() else ""
    return Response(content=base + "\n\n" + search, media_type="application/javascript", headers={"Cache-Control":"no-store, max-age=0"})

@app.get("/health")
def health():
    return {
        "status":"ok", "version":"0.10.0", "openai_configured":bool(os.getenv("OPENAI_API_KEY")),
        "database_connected":bool(database_url()), "active_users":user_count(), "news_parser":"structured-v3",
        "news_artwork":"text-free-editorial-v4", "news_search":"approved-sources-v1", "news_sources":len(load_cyber_sources())
    }

@app.get("/api/news-sources")
def news_sources(): return {"count":len(load_cyber_sources()), "sources":load_cyber_sources()}

@app.post("/api/search-news")
def search_news(req: NewsSearchRequest):
    if not os.getenv("OPENAI_API_KEY"): raise HTTPException(400, "OPENAI_API_KEY is not configured")
    sources = load_cyber_sources()
    if not sources: raise HTTPException(500, "Cybersecurity source list is not available")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    source_lines = "\n".join(f"- {s['name']}: {s['url']}" for s in sources)
    prompt = f'''You are the live news discovery engine for the Arabic cybersecurity publication "نبض سيبراني | CYBER PULSE".
Today is {today}. Search the web for the newest meaningful cybersecurity news published within the last {req.days} days.

STRICT SOURCE POLICY:
Use ONLY the approved source list below. Do not return an article from any other domain. Prefer primary official advisories and vendor research when they are the original source; use established cybersecurity media for major breaking stories. Exclude generic evergreen pages, old articles, duplicate syndications, opinion-only pieces, and items without a publication date.

APPROVED SOURCES:
{source_lines}

Select up to {req.limit} distinct, high-value items relevant to cybersecurity professionals and government/enterprise organizations. Prioritize: active exploitation, significant vulnerabilities, breaches/incidents, ransomware, threat campaigns, identity/cloud/security platform issues, critical infrastructure, major regulatory/operational cyber developments.

Return ONLY valid JSON with this exact shape:
{{"items":[{{
"title_ar":"concise Arabic headline",
"title_original":"original article/advisory title",
"date":"exact publication date from source",
"content_type":"خبر or ثغرة أمنية or تنبيه أمني or اختراق/تسريب or بحث أمني",
"severity":"حرج or عالي or متوسط or منخفض or empty if the source does not state it",
"cve":"exact CVE identifier(s) or empty",
"source":"approved source name",
"source_url":"approved source home/advisory URL",
"url":"direct URL to the exact article/advisory on an approved domain",
"summary_ar":"2-3 factual Arabic sentences",
"news_text_ar":"a self-contained factual Arabic news text of 100-220 words based only on the source, preserving date, affected product/sector, attack/vulnerability details and impact; do not invent recommendations",
"recommendations":["only recommendations explicitly stated by the source"],
"relevance":"one short Arabic sentence explaining why this matters"
}}]}}
Do not fabricate a CVE, severity, date, recommendation, or URL.'''
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-5")
        response = client.responses.create(model=model, input=prompt, tools=[{"type":"web_search"}], store=False)
        data = extract_json(response.output_text)
        valid, seen = [], set()
        for item in data.get("items", []):
            url = str(item.get("url", "")).strip()
            key = (url.lower(), str(item.get("title_original", item.get("title_ar", ""))).strip().lower())
            if not url or not url_is_approved(url) or key in seen: continue
            seen.add(key)
            valid.append(item)
            if len(valid) >= req.limit: break
        return {"searched_at":datetime.now(timezone.utc).isoformat(), "days":req.days, "source_count":len(sources), "items":valid}
    except Exception as e:
        raise HTTPException(500, f"News search failed: {e}")

@app.get("/api/archive")
def archive_list():
    with db_conn() as c: return c.execute("SELECT id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at FROM posts ORDER BY created_at DESC").fetchall()

@app.get("/api/archive/used-topic-ids")
def used_ids():
    with db_conn() as c: return {"topic_ids":[r["topic_id"] for r in c.execute("SELECT DISTINCT topic_id FROM posts WHERE topic_id IS NOT NULL").fetchall()]}

@app.post("/api/archive")
def archive_save(p: ArchivePost):
    pid = p.id or str(uuid.uuid4()); now = datetime.now(timezone.utc)
    with db_conn() as c:
        c.execute("INSERT INTO posts(id,topic_id,topic,domain,post_type,platform,content,created_at,updated_at) VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content,updated_at=EXCLUDED.updated_at", (pid,p.topic_id,p.topic,p.domain,p.post_type,p.platform,json.dumps(p.content,ensure_ascii=False),now,now)); c.commit()
    return {"id":pid,"saved":True}

@app.delete("/api/archive/{post_id}")
def archive_delete(post_id: str):
    with db_conn() as c:
        cur = c.execute("DELETE FROM posts WHERE id=%s", (post_id,)); c.commit(); return {"deleted":cur.rowcount>0}

def demo_payload(req):
    n = req.slides if req.post_type == "Carousel" else 1
    return {"mode":"demo","title":req.topic,"hook":req.topic,"caption":"محتوى تجريبي.","recommendations":[],"cta":"شارك رأيك.","keywords":["GRC"],"hashtags":["#GRC"],"slides":[{"number":i+1,"headline":req.topic,"body":"نص تجريبي."} for i in range(n)],"sources":[]}

@app.post("/api/generate-content")
def generate_content(req: ContentRequest):
    if not os.getenv("OPENAI_API_KEY"): return demo_payload(req)
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")); model = os.getenv("OPENAI_MODEL", "gpt-5")
    prompt = f"Create publish-ready Arabic {req.post_type} about {req.topic} for government/enterprise cybersecurity professionals. Exactly {req.slides} slides if carousel. Return ONLY JSON with title,hook,caption,recommendations,cta,keywords,hashtags,slides(number,headline,body),sources. Never invent citations. Hashtags never belong in slides."
    kw = {"model":model,"input":prompt,"store":False}
    if req.use_web_search: kw["tools"]=[{"type":"web_search"}]
    try:
        d = extract_json(client.responses.create(**kw).output_text); d["mode"]="openai"; return d
    except Exception as e: raise HTTPException(500, f"Generation failed: {e}")

@app.post("/api/parse-news")
def parse_news(req: NewsParseRequest):
    if not os.getenv("OPENAI_API_KEY"): raise HTTPException(400, "OPENAI_API_KEY is not configured")
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")); model = os.getenv("OPENAI_MODEL", "gpt-5")
    prompt = f'''You are the editorial intelligence engine for the Arabic cybersecurity publication "نبض سيبراني | CYBER PULSE".
Parse ONLY supplied facts. Never invent or silently correct CVEs, dates, severity, vendors, sources or recommendations.
HEADLINE:\n{req.title}\n\nPASTED NEWS:\n{req.news}
Return ONLY valid JSON with: headline, severity (حرج/عالي/متوسط/منخفض/or empty), date, cve, summary (2-3 concise Arabic sentences), recommendations (only supplied), source, entities, threat_type, visual_brief, caption.
For visual_brief, describe ONE simple editorial metaphor specific to the affected technology and risk mechanism. The brief MUST NOT request visible words, product names, interface labels, UI screens, dashboards, diagrams, flowcharts, logos with text, letters or numbers. It should describe only visual objects and relationships. Caption must use only supplied facts and include @cyberpulse_ar.'''
    try: return extract_json(client.responses.create(model=model, input=prompt, store=False).output_text)
    except Exception as e: raise HTTPException(500, f"News parsing failed: {e}")

def visual_prompt(req: ImageRequest):
    if req.visual_style == "Cyber Pulse":
        return f'''Create ONLY the visual background artwork for a premium cybersecurity news post.
FORMAT: vertical Instagram 4:5 portrait.
BRAND VISUAL SYSTEM: deep black/dark navy #050B12, Cyber Blue #0A84FF, Cyan #00D1C7. Red only when the supplied risk is high/critical. Subtle circuit patterns, restrained digital grid, soft blue/cyan atmospheric glow. Premium enterprise cybersecurity media publication quality, sophisticated and minimal, never gaming-like.
STRICT COMPOSITION: LEFT 35-40% ONLY contains ONE large topic-specific editorial hero visual. RIGHT 60-65% remains intentionally EMPTY, clean, dark text-safe negative space.
ABSOLUTE NO-TEXT RULE: ZERO readable Arabic or English, words, letters, numbers, CVEs, product names, UI labels, captions, headlines, hashtags, watermarks, signatures, brand names, pseudo-text or typographic logo marks.
DO NOT CREATE technical diagrams, flowcharts, dashboards, software interfaces, screenshots, browser windows, directory lists, tables, cards containing text, hacker hoodies, masks, skulls, Matrix code, random binary streams or clutter.
STORY CONCEPT: {req.visual_direction}
Context only: {req.title}. {req.body}
Represent the story through ONE simple editorial visual metaphor, not a literal software UI. The left side contains the hero; the right side remains mostly empty dark space ready for Arabic typography.'''
    common = f"Artwork only, 4:5 portrait. Concept: {req.title}. Context: {req.body}. ABSOLUTE: zero readable text, letters, numbers, labels, hashtags, watermarks or pseudo-text. Leave typography zones empty. {req.visual_direction}"
    if req.domain.strip().upper() == "GRC": style = "Premium light government/enterprise GRC infographic artwork; white/cool-gray; navy/royal blue; restrained green/orange/red status accents; polished enterprise vector/semi-3D icons; generous whitespace; no hacker clichés."
    elif req.visual_style == "Executive Minimal": style = "Executive minimal artwork, white background, navy/blue, strong central metaphor, whitespace."
    else: style = "Structured professional infographic artwork, light background, central concept and restrained supporting visuals."
    return style + "\n" + common

@app.post("/api/generate-image")
def generate_image(req: ImageRequest):
    if not os.getenv("OPENAI_API_KEY"): raise HTTPException(400, "OPENAI_API_KEY is not configured")
    try:
        r = OpenAI(api_key=os.getenv("OPENAI_API_KEY")).images.generate(model=os.getenv("OPENAI_IMAGE_MODEL","gpt-image-1"), prompt=visual_prompt(req), size="1024x1536")
        return {"b64_json":r.data[0].b64_json,"slide_number":req.slide_number,"visual_style":req.visual_style,"font":"Cairo","overlay_required":True,"hashtags_in_image":False,"artwork_version":"text-free-editorial-v4"}
    except Exception as e: raise HTTPException(500, f"Image generation failed: {e}")
