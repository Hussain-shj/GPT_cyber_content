import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Any
from urllib.parse import urlparse

import psycopg
import httpx
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI(title="GPT Cyber Content API", version="0.15.1")
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

class NewsVideoRequest(BaseModel):
    headline: str = Field(min_length=3, max_length=500)
    summary: str = Field(min_length=10, max_length=3000)
    threat_type: str = Field(default="خبر سيبراني", max_length=200)
    visual_brief: str = Field(default="", max_length=2000)
    style: Literal["Breaking News", "Cyber Awareness", "GRC"] = "Breaking News"
    duration: Literal[5, 10, 15] = 5

class ArchivePost(BaseModel):
    id: str | None = None
    topic_id: int | None = None
    topic: str
    domain: str = "GRC"
    post_type: str = "Carousel"
    platform: str = "Both"
    content: dict[str, Any]

def database_url(): return os.getenv("DATABASE_URL")

VIDEO_JOBS: dict[str, dict[str, Any]] = {}
VIDEO_JOBS_LOCK = threading.Lock()
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
        "status":"ok", "version":"0.15.1", "openai_configured":bool(os.getenv("OPENAI_API_KEY")),
        "database_connected":bool(database_url()), "active_users":user_count(), "news_parser":"structured-v3",
        "news_artwork":"vision-reviewed-v6", "news_search":"approved-sources-v1", "news_sources":len(load_cyber_sources()),
        "bytez_video_configured":bool(os.getenv("BYTEZ_API_KEY")),
        "bytez_video_model":os.getenv("BYTEZ_VIDEO_MODEL", "automatic")
    }

def _video_url(output: Any) -> str:
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        return _video_url(output[0])
    if isinstance(output, dict):
        for key in ("url", "video_url", "video", "output"):
            if output.get(key):
                return _video_url(output[key])
    raise ValueError("Bytez returned no playable video URL")

def _available_bytez_video_models(client: httpx.Client) -> list[str]:
    url = "https://api.bytez.com/models/v2/list/models"
    headers = {"Authorization": os.environ["BYTEZ_API_KEY"]}
    response = client.get(url, headers=headers, params={"task": "text-to-video"})
    if response.status_code >= 500:
        response = client.get(url, headers=headers, params={"task": "text-to-video"})
    if response.status_code >= 500:
        response = client.get(url, headers=headers)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and payload.get("error"):
        raise ValueError(str(payload["error"]))
    rows = payload.get("output", payload.get("models", [])) if isinstance(payload, dict) else payload
    if isinstance(rows, dict):
        rows = rows.get("models", rows.get("items", rows.get("data", [])))
    if not isinstance(rows, list):
        rows = []
    models = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        task = row.get("task", row.get("tasks", ""))
        tasks = task if isinstance(task, list) else [task]
        model_id = row.get("modelId", row.get("id", row.get("model")))
        if model_id and "text-to-video" in tasks:
            models.append(str(model_id).strip())
    return models

UNAVAILABLE_BYTEZ_VIDEO_MODELS = {"ali-vilab/text-to-video-ms-1.7b"}

def _bytez_video_candidates(client: httpx.Client) -> list[str]:
    configured = os.getenv("BYTEZ_VIDEO_MODEL", "").strip()
    models = _available_bytez_video_models(client)
    configured_is_usable = configured and configured not in UNAVAILABLE_BYTEZ_VIDEO_MODELS
    candidates = ([configured] if configured_is_usable else []) + models
    unique = []
    for model in candidates:
        if model and model not in UNAVAILABLE_BYTEZ_VIDEO_MODELS and model not in unique:
            unique.append(model)
    if unique:
        return unique
    raise ValueError(
        "لم يعثر Bytez على أي نموذج text-to-video متاح لهذا المفتاح. "
        "تحقق من توفر نماذج الفيديو والرصيد في حساب Bytez."
    )

def _run_video_job(job_id: str, req: NewsVideoRequest):
    model = os.getenv("BYTEZ_VIDEO_MODEL", "automatic").strip() or "automatic"
    prompt = f'''Create a premium vertical 9:16 editorial cybersecurity video for CYBER PULSE.
Topic: {req.headline}
Factual context: {req.summary}
Threat category: {req.threat_type}
Visual direction: {req.visual_brief or "abstract digital security environment"}
Style: {req.style}. Target duration: approximately {req.duration} seconds.
SEMANTIC RULE: show the affected technology and reported action/risk directly. Every prominent object must be traceable to the topic. Never replace a technical term with an unrelated physical metaphor. Software patches and updates must look like software update/patch deployment, not plumbing, water leaks, bandages, construction, or hand tools. Simplified non-readable interfaces are allowed only when they clarify the story.
Use dark navy and black with cyan and cyber blue highlights. Use elegant cinematic movement, realistic lighting, and one coherent scene. Do not show readable text, letters, numbers, captions, logos, watermarks, unrelated dashboards, or distorted interfaces. Do not depict graphic violence or panic.'''
    try:
        with httpx.Client(timeout=httpx.Timeout(300.0, connect=20.0)) as client:
            payload = None
            failures = []
            for model in _bytez_video_candidates(client):
                response = client.post(
                    f"https://api.bytez.com/models/v2/{model}",
                    headers={"Authorization": os.environ["BYTEZ_API_KEY"], "Content-Type":"application/json"},
                    json={"text": prompt},
                )
                if response.status_code == 404:
                    failures.append(model)
                    continue
                response.raise_for_status()
                payload = response.json()
                break
            if payload is None:
                raise ValueError(
                    "نماذج Bytez التالية غير متاحة (404): " + ", ".join(failures)
                    + ". اختر نموذج text-to-video متاحًا من لوحة Bytez."
                )
        error = payload.get("error") if isinstance(payload, dict) else None
        if error: raise ValueError(str(error))
        output = payload.get("output", payload) if isinstance(payload, dict) else payload
        result = {"status":"completed", "video_url":_video_url(output), "model":model, "completed_at":datetime.now(timezone.utc).isoformat()}
    except Exception as exc:
        result = {"status":"failed", "detail":str(exc)[:1000], "model":model, "completed_at":datetime.now(timezone.utc).isoformat()}
    with VIDEO_JOBS_LOCK:
        VIDEO_JOBS[job_id].update(result)

@app.post("/api/news-video", status_code=202)
def create_news_video(req: NewsVideoRequest):
    if not os.getenv("BYTEZ_API_KEY"): raise HTTPException(400, "BYTEZ_API_KEY is not configured")
    job_id = str(uuid.uuid4())
    with VIDEO_JOBS_LOCK:
        VIDEO_JOBS[job_id] = {"id":job_id, "status":"processing", "created_at":datetime.now(timezone.utc).isoformat()}
    threading.Thread(target=_run_video_job, args=(job_id, req), daemon=True).start()
    return VIDEO_JOBS[job_id]

@app.get("/api/news-video/{job_id}")
def news_video_status(job_id: str):
    with VIDEO_JOBS_LOCK:
        job = VIDEO_JOBS.get(job_id)
        if not job: raise HTTPException(404, "Video job not found or the service was restarted")
        return dict(job)

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
Return ONLY valid JSON with: headline, severity (حرج/عالي/متوسط/منخفض/or empty), date, cve, summary (2-3 concise Arabic sentences), recommendations (only supplied), source, entities, threat_type, visual_brief, caption, hashtags.
For visual_brief, describe ONE direct, literal editorial scene that immediately identifies the affected technology, vendor/product category, and the reported action or risk. Prefer recognizable product geometry, device/server context, patch/update objects, cloud/email/browser/mobile cues, or incident-specific objects that are explicitly supported by the supplied news. Do NOT replace the subject with a loose metaphor. For example, software patches must look like software update/patch deployment, never plumbing, water leaks, bandages, construction, tools, or physical repair. The brief MUST NOT request readable words, interface labels, captions, diagrams, flowcharts, logos containing text, letters or numbers. It may request simplified non-readable interface shapes only when the story is specifically about software, updates, identity, cloud, email, browsers, or mobile apps.
Caption must be one polished, self-contained Arabic post ready to paste into BOTH LinkedIn and Instagram. Use 140-260 words and rely only on supplied facts.
Format the caption as readable social copy using plain text and intentional line breaks:
1. Open with a strong, factual hook or headline (no clickbait).
2. Add a short paragraph explaining what happened and why it matters.
3. Break key facts into 2-5 short lines beginning with 🔹 when the supplied material supports distinct facts such as the affected product/sector, vulnerability or attack method, impact, severity, CVE, or date. Never create a bullet merely to fill the structure.
4. If recommendations were supplied, introduce them with "ما الذي يجب فعله؟" and list each action on a separate line beginning with ✅. If none were supplied, omit this section completely.
5. Add "الخلاصة:" followed by one concise practical takeaway based only on the supplied facts.
6. End with one natural engagement question or call to action, then place @cyberpulse_ar on its own line.
Keep paragraphs short, professional, direct, RTL-friendly, and easy to scan on mobile. Do not use Markdown headings, asterisks, numbered lists, excessive emojis, or hashtags inside caption.
Hashtags must be a JSON array of 6-10 concise Arabic or English hashtags relevant to the supplied story, each beginning with #. Always include #نبض_سيبراني and #الأمن_السيبراني.'''
    try: return extract_json(client.responses.create(model=model, input=prompt, store=False).output_text)
    except Exception as e: raise HTTPException(500, f"News parsing failed: {e}")

def visual_prompt(req: ImageRequest):
    if req.visual_style == "Cyber Pulse":
        story = f"{req.title} {req.body} {req.visual_direction}".lower()
        zoom_contract = ""
        if "zoom" in story or "زووم" in story:
            zoom_contract = '''\nMANDATORY ZOOM ANNOTATION VISUAL CONTRACT: show a recognizable modern video-meeting scene with several participant tiles; a shared-screen canvas; a clearly visible annotation pen/drawing stroke/cursor acting on that shared canvas; and an unauthorized-control path spreading from the annotated shared screen toward two or more participant laptops/devices. Use red only for the hostile control path and cyan/blue for the legitimate meeting. A generic laptop, generic participant grid, large arrow, isolated user icon, update window, download screen, or single-device warning is NOT sufficient. Do not generate readable Zoom text or logos; communicate the platform through its familiar blue video-meeting visual language and meeting layout.\n'''
        return f'''Create ONLY the visual background artwork for a premium cybersecurity news post. Before composing, identify the exact subject, affected technology/vendor category, event, and risk mechanism from the supplied title, context, and visual direction.
FORMAT: vertical Instagram 4:5 portrait.
BRAND VISUAL SYSTEM: deep black/dark navy #050B12, Cyber Blue #0A84FF, Cyan #00D1C7. Red only when the supplied risk is high/critical. Subtle circuit patterns, restrained digital grid, soft blue/cyan atmospheric glow. Premium enterprise cybersecurity media publication quality, sophisticated and minimal, never gaming-like.
SEMANTIC ACCURACY IS THE HIGHEST PRIORITY: represent the news subject directly and literally. Every prominent object must be traceable to the supplied story. Show the affected technology and the reported action/risk in one coherent scene. Do not invent an unrelated visual metaphor. If the story is about software updates or security patches, show an update/patch deployment environment, recognizable software/platform geometry, prioritized critical update objects, protected enterprise devices or servers, and security status cues. Never translate "patch", "leak", "bug", "cloud", "virus", "worm", "gateway", or similar technical terms into unrelated physical objects unless the supplied story is actually about those physical objects.
STRICT COMPOSITION: Create one strong topic-specific editorial hero scene across the canvas, with the most informative visual concentrated in the center/lower half. Preserve clean dark text-safe space across the upper 35-40% for an Arabic headline and small metadata badges. Keep safe space at the top-right for the Cyber Pulse logo.
ABSOLUTE NO-TEXT RULE: ZERO readable Arabic or English, words, letters, numbers, CVEs, product names, UI labels, captions, headlines, hashtags, watermarks, signatures, brand names, pseudo-text or typographic logo marks.
Simplified non-readable interface panels, update progress shapes, product geometry, patch tiles, device screens, and security-status cards are allowed only when they directly clarify the supplied story. They must contain no text or pseudo-text.
DO NOT CREATE flowcharts, generic dashboards unrelated to the story, browser directory lists, dense tables, hacker hoodies, masks, skulls, Matrix code, random binary streams, plumbing, water leaks, bandages, construction tools, repair tools, or clutter unless explicitly required by the factual story.
DIRECT VISUAL BRIEF: {req.visual_direction}
NEWS TITLE: {req.title}
FACTUAL CONTEXT: {req.body}
{zoom_contract}
Final self-check before rendering: would a viewer identify the technology and event without reading the headline? If not, revise the scene to be more direct and topic-specific.'''
    common = f"Artwork only, 4:5 portrait. Concept: {req.title}. Context: {req.body}. ABSOLUTE: zero readable text, letters, numbers, labels, hashtags, watermarks or pseudo-text. Leave typography zones empty. {req.visual_direction}"
    if req.domain.strip().upper() == "GRC": style = "Premium light government/enterprise GRC infographic artwork; white/cool-gray; navy/royal blue; restrained green/orange/red status accents; polished enterprise vector/semi-3D icons; generous whitespace; no hacker clichés."
    elif req.visual_style == "Executive Minimal": style = "Executive minimal artwork, white background, navy/blue, strong central metaphor, whitespace."
    else: style = "Structured professional infographic artwork, light background, central concept and restrained supporting visuals."
    return style + "\n" + common

def review_artwork(client: OpenAI, req: ImageRequest, image_b64: str):
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

For Zoom Annotation / screen-sharing takeover stories specifically, a strong image should clearly show a video meeting with several participants, a shared-screen canvas, an annotation pen/drawing stroke/cursor acting on that shared screen, and unauthorized control spreading from the annotated screen toward two or more participant devices. A generic laptop, generic meeting grid, arrow, user icon, software-update window, or download screen is insufficient and must not be requested.

Return ONLY valid JSON:
{{"semantic_match":true,"score":0,"technology_visible":true,"mechanism_visible":true,"composition_ok":true,"issues":["concise issue"],"retry_direction":"specific English correction prompt for the image generator","summary_ar":"سطر عربي مختصر يشرح نتيجة المراجعة"}}
Set semantic_match=true only when score is at least 78 and both technology_visible and mechanism_visible are true.'''
    response = client.responses.create(
        model=os.getenv("OPENAI_VISION_MODEL", os.getenv("OPENAI_MODEL", "gpt-5")),
        input=[{"role":"user","content":[
            {"type":"input_text","text":review_prompt},
            {"type":"input_image","image_url":f"data:image/png;base64,{image_b64}"},
        ]}],
        store=False,
    )
    review = extract_json(response.output_text)
    score = max(0, min(100, int(review.get("score", 0))))
    review["score"] = score
    review["semantic_match"] = bool(
        review.get("semantic_match") and score >= 78
        and review.get("technology_visible") and review.get("mechanism_visible")
    )
    return review

@app.post("/api/generate-image")
def generate_image(req: ImageRequest):
    if not os.getenv("OPENAI_API_KEY"): raise HTTPException(400, "OPENAI_API_KEY is not configured")
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        base_prompt = visual_prompt(req)
        image_model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
        max_attempts = max(1, min(4, int(os.getenv("IMAGE_MAX_ATTEMPTS", "3"))))
        generation_prompt = base_prompt
        image_b64 = ""
        attempts = 0
        try:
            review = None
            while attempts < max_attempts:
                image_b64 = client.images.generate(model=image_model, prompt=generation_prompt, size="1024x1536").data[0].b64_json
                attempts += 1
                review = review_artwork(client, req, image_b64)
                if review["semantic_match"] or attempts >= max_attempts:
                    break
                correction = str(review.get("retry_direction", "")).strip()
                generation_prompt = base_prompt + f'''\n\nTHE PREVIOUS IMAGE WAS REJECTED BY VISUAL QUALITY CONTROL.
REVIEW SCORE: {review['score']}/100.
REJECTION ISSUES: {json.dumps(review.get('issues', []), ensure_ascii=False)}
MANDATORY CORRECTION: {correction or "Make the affected technology and exact attack mechanism unmistakable; remove generic or unrelated elements."}
Create a substantially different and improved composition, not a minor variation. Follow only the current story; do not introduce update or download imagery unless explicitly present in the news.'''
        except Exception as review_error:
            if not image_b64:
                image_b64 = client.images.generate(model=image_model, prompt=base_prompt, size="1024x1536").data[0].b64_json
                attempts += 1
            review = {"semantic_match":None,"score":None,"issues":[],"retry_direction":"","summary_ar":"تعذر تنفيذ المراجعة البصرية، وتم الاحتفاظ بالصورة المولدة.","review_error":str(review_error)[:300]}
        return {"b64_json":image_b64,"slide_number":req.slide_number,"visual_style":req.visual_style,"font":"Cairo","overlay_required":True,"hashtags_in_image":False,"artwork_version":"vision-reviewed-v6","generation_attempts":attempts,"semantic_review":review}
    except Exception as e: raise HTTPException(500, f"Image generation failed: {e}")
