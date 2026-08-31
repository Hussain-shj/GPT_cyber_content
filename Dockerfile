FROM node:22-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ca-certificates ffmpeg \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
    libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
    libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    fonts-noto-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt package.json package-lock.json ./
RUN python3 -m venv /opt/venv && pip install --no-cache-dir -r requirements.txt
RUN npm ci --omit=dev && npx remotion browser ensure

COPY . .

# Keep linkedin.js source readable and append the premium browser-side compositor
# only inside the built container. This preserves existing LinkedIn Studio logic
# while ensuring the approved/persisted/published image is the branded 4:5 JPEG.
RUN cat linkedin-premium-branding.js >> linkedin.js

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
