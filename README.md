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
   - `OPENAI_IMAGE_MODEL=gpt-image-1` (automatic fallback when Gemini image quota is unavailable)
   - `GEMINI_API_KEY` for Nano Banana images and Visual Alert Editor voice-over
   - `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` (optional and replaceable)
   - `GEMINI_TTS_VOICE=Charon` (optional)
   - `BYTEZ_API_KEY` to enable cybersecurity news video generation
   - `BYTEZ_VIDEO_MODEL` is optional. If omitted, the app automatically selects an available Bytez `text-to-video` model. Set it only to a model ID returned for your Bytez account.
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

## LinkedIn personal publishing

Create a LinkedIn Developer application, add the **Share on LinkedIn** and
**Sign In with LinkedIn using OpenID Connect** products, then configure:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI=https://gptcontent-production.up.railway.app/auth/linkedin/callback`
- `LINKEDIN_API_VERSION=202608` (optional)

The OAuth access token is encrypted before it is stored in PostgreSQL. The UI
always shows an editable preview before publishing and supports text, one
JPEG/PNG image, or up to 20 ordered images through LinkedIn MultiImage posts.

### LinkedIn supporting files

LinkedIn AI Studio can generate an Arabic supporting file for any post as a
practical guide, checklist, executive brief, or working template. The draft is
editable, stored centrally in PostgreSQL, and downloaded as a branded RTL PDF
using the bundled Cairo font. A post that promises readers a supporting file is
blocked from publishing until the file has been generated.

### LinkedIn analytics dashboard

The dashboard is delivered in two phases:

1. Upload the `.xlsx` file exported from LinkedIn combined post analytics. The
   importer detects common English and Arabic column labels, stores the latest
   dataset in PostgreSQL, and produces KPIs, trends, top posts, content-format
   comparisons, weekday comparisons, and practical recommendations.
2. Automatic synchronization is already implemented with LinkedIn's
   `memberCreatorPostAnalytics` API. Keep
   `LINKEDIN_ANALYTICS_APPROVED=false` while the application is under review.
   After LinkedIn grants `r_member_postAnalytics`, set the variable to `true`,
   redeploy, and reconnect the LinkedIn account once to grant the new scope.

Analytics endpoints:

- `POST /api/linkedin/analytics/import`
- `GET /api/linkedin/analytics/dashboard`
- `POST /api/linkedin/analytics/sync?days=90`

GRC slides are rendered with their Arabic text and brand logo before upload.
- `POST /api/visual-alert/render`
- `GET /api/visual-alert/status/{job_id}`
- `GET /api/visual-alert/video/{job_id}`

If `OPENAI_API_KEY` is missing, content generation returns Demo Mode so the UI can still be tested.
