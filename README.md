# GPT Cyber Content

AI content studio for cybersecurity, GRC, AI governance and privacy content.

## Architecture

- FastAPI backend on Railway
- OpenAI Responses API for content generation
- Optional OpenAI web search for current official sources
- OpenAI Image API endpoint for background visuals
- Standalone `index.html` client that can be opened locally

## Railway deployment

1. In Railway choose **New Project → Deploy from GitHub repo**.
2. Select `Hussain-shj/GPT_cyber_content`.
3. Add Railway variable `OPENAI_API_KEY`.
4. Optional variables:
   - `OPENAI_MODEL=gpt-5`
   - `OPENAI_IMAGE_MODEL=gpt-image-1`
   - `BYTEZ_API_KEY` to enable cybersecurity news video generation
   - `BYTEZ_VIDEO_MODEL=ali-vilab/text-to-video-ms-1.7b` to override the default Bytez model
5. Deploy and generate a public Railway domain.
6. Test `/health` on the Railway domain.

Railway uses `railway.toml` and starts:

`uvicorn main:app --host 0.0.0.0 --port $PORT`

## Local HTML

Download `index.html` and open it in Chrome, Edge, Safari, or another modern browser. Paste your Railway public domain in the **Railway API URL** field and click save. The domain is stored only in the browser's local storage.

The OpenAI API key must never be placed in `index.html`. Keep it in Railway Variables.

## API

- `GET /health`
- `POST /api/generate-content`
- `POST /api/generate-image`
- `POST /api/news-video`
- `GET /api/news-video/{job_id}`

If `OPENAI_API_KEY` is missing, content generation returns Demo Mode so the UI can still be tested.
