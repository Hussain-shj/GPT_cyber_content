import os
import tempfile
import time
from typing import Literal

import cloudinary
import cloudinary.uploader
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Mobile Video Editor API", version="0.1.0")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
    secure=True,
)

SHOTSTACK_API_KEY = os.getenv("SHOTSTACK_API_KEY", "")
SHOTSTACK_ENV = os.getenv("SHOTSTACK_ENV", "stage")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "mobile-video-editor")

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: str | None = None
    stability: float = Field(default=0.45, ge=0, le=1)
    similarity_boost: float = Field(default=0.75, ge=0, le=1)
    style: float = Field(default=0.2, ge=0, le=1)

class VideoClip(BaseModel):
    src: str
    length: float = Field(gt=0, le=3600)
    trim: float = Field(default=0, ge=0)
    volume: float = Field(default=1, ge=0, le=1)
    speed: float = Field(default=1, gt=0, le=10)
    filter: Literal["none", "blur", "boost", "contrast", "darken", "greyscale", "lighten", "muted", "negative"] = "none"
    effect: Literal["none", "zoomIn", "zoomOut", "slideLeft", "slideRight", "slideUp", "slideDown"] = "none"
    transition: Literal["none", "fade", "wipeLeft", "wipeRight", "slideLeft", "slideRight", "slideUp", "slideDown"] = "fade"

class AudioTrack(BaseModel):
    src: str
    volume: float = Field(default=0.45, ge=0, le=1)
    effect: Literal["none", "fadeIn", "fadeOut", "fadeInFadeOut"] = "fadeInFadeOut"

class TextOverlay(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    start: float = Field(default=0, ge=0)
    length: float = Field(default=3, gt=0, le=120)
    position: Literal["top", "center", "bottom"] = "bottom"
    size: int = Field(default=42, ge=14, le=160)
    color: str = "#ffffff"

class RenderRequest(BaseModel):
    clips: list[VideoClip] = Field(min_length=1, max_length=50)
    audio: AudioTrack | None = None
    texts: list[TextOverlay] = Field(default_factory=list, max_length=30)
    aspect_ratio: Literal["9:16", "16:9", "1:1", "4:5"] = "9:16"
    resolution: Literal["sd", "hd", "1080"] = "hd"
    fps: Literal[24, 25, 30, 50, 60] = 30

def require_env(name: str, value: str):
    if not value:
        raise HTTPException(status_code=503, detail=f"Missing environment variable: {name}")

@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True, "shotstack": bool(SHOTSTACK_API_KEY), "elevenlabs": bool(ELEVENLABS_API_KEY), "cloudinary": bool(os.getenv("CLOUDINARY_CLOUD_NAME"))}

@app.get("/api/cloudinary-signature")
def cloudinary_signature():
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    api_key = os.getenv("CLOUDINARY_API_KEY", "")
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
    require_env("CLOUDINARY_CLOUD_NAME", cloud_name)
    require_env("CLOUDINARY_API_KEY", api_key)
    require_env("CLOUDINARY_API_SECRET", api_secret)
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": CLOUDINARY_FOLDER}
    signature = cloudinary.utils.api_sign_request(params, api_secret)
    return {"cloud_name": cloud_name, "api_key": api_key, "timestamp": timestamp, "folder": CLOUDINARY_FOLDER, "signature": signature}

@app.post("/api/tts")
async def create_tts(req: TTSRequest):
    require_env("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY)
    require_env("CLOUDINARY_CLOUD_NAME", os.getenv("CLOUDINARY_CLOUD_NAME", ""))
    voice_id = req.voice_id or ELEVENLABS_VOICE_ID
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {"text": req.text, "model_id": ELEVENLABS_MODEL_ID, "voice_settings": {"stability": req.stability, "similarity_boost": req.similarity_boost, "style": req.style, "use_speaker_boost": True}}
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, json=payload, headers=headers)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"ElevenLabs error: {response.text[:500]}")
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=True) as tmp:
        tmp.write(response.content)
        tmp.flush()
        uploaded = cloudinary.uploader.upload(tmp.name, resource_type="video", folder=CLOUDINARY_FOLDER, format="mp3")
    return {"url": uploaded["secure_url"], "public_id": uploaded.get("public_id")}

def build_shotstack_payload(req: RenderRequest):
    cursor = 0.0
    video_clips = []
    total_length = 0.0
    for clip in req.clips:
        play_length = round(clip.length / clip.speed, 3)
        item = {
            "asset": {"type": "video", "src": clip.src, "trim": clip.trim, "volume": clip.volume, "speed": clip.speed, "transcode": True},
            "start": round(cursor, 3),
            "length": play_length,
            "fit": "cover",
        }
        if clip.filter != "none": item["filter"] = clip.filter
        if clip.effect != "none": item["effect"] = clip.effect
        if clip.transition != "none": item["transition"] = {"in": clip.transition, "out": clip.transition}
        video_clips.append(item)
        cursor += play_length
        total_length += play_length
    tracks = []
    if req.texts:
        text_clips = []
        for t in req.texts:
            offset = {"x": 0, "y": 0.32 if t.position == "top" else (-0.32 if t.position == "bottom" else 0)}
            text_clips.append({
                "asset": {
                    "type": "rich-text",
                    "text": t.text,
                    "font": {"family": "Open Sans", "color": t.color, "size": t.size, "weight": 700},
                    "padding": 18,
                    "background": {"color": "#000000", "opacity": 0.35, "borderRadius": 14, "wrap": True},
                    "align": {"horizontal": "center", "vertical": "middle"},
                },
                "start": t.start,
                "length": min(t.length, max(total_length - t.start, 0.1)),
                "width": 920,
                "height": 220,
                "position": "center",
                "offset": offset,
                "transition": {"in": "fade", "out": "fade"},
            })
        tracks.append({"clips": text_clips})
    if req.audio:
        tracks.append({"clips": [{"asset": {"type": "audio", "src": req.audio.src, "volume": req.audio.volume, "effect": req.audio.effect}, "start": 0, "length": round(total_length, 3)}]})
    tracks.append({"clips": video_clips})
    return {"timeline": {"background": "#000000", "tracks": tracks}, "output": {"format": "mp4", "resolution": req.resolution, "aspectRatio": req.aspect_ratio, "fps": req.fps, "quality": "high"}}

@app.post("/api/render")
async def render(req: RenderRequest):
    require_env("SHOTSTACK_API_KEY", SHOTSTACK_API_KEY)
    url = f"https://api.shotstack.io/edit/{SHOTSTACK_ENV}/render"
    headers = {"x-api-key": SHOTSTACK_API_KEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=build_shotstack_payload(req), headers=headers)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Shotstack error: {response.text[:1000]}")
    body = response.json()
    return {"render_id": body.get("response", {}).get("id"), "raw": body}

@app.get("/api/render/{render_id}")
async def render_status(render_id: str):
    require_env("SHOTSTACK_API_KEY", SHOTSTACK_API_KEY)
    url = f"https://api.shotstack.io/edit/{SHOTSTACK_ENV}/render/{render_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers={"x-api-key": SHOTSTACK_API_KEY})
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Shotstack error: {response.text[:500]}")
    data = response.json().get("response", {})
    return {"status": data.get("status"), "url": data.get("url"), "error": data.get("error")}

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")
