# --- Stage 1: Build Frontend ---
FROM node:18 AS frontend-builder
WORKDIR /app/frontend

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
# Critical: Copy Tailwind and PostCSS configs so styles are generated!
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY public ./public
COPY src ./src

# Build
RUN npm run build

# --- Stage 2: Backend Runtime ---
FROM python:3.10-slim

WORKDIR /app

# 在 apt-get 之前插入这一行
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# Install system dependencies
# mime-support is CRITICAL for uvicorn/fastapi to guess correct content-types (css/js)
# In newer Debian versions (Trixie/Bookworm), 'media-types' replaces 'mime-support'
RUN apt-get update && apt-get install -y media-types && rm -rf /var/lib/apt/lists/*

# Install Common Dependencies
COPY backend/requirements.txt .
# Add uvicorn if not in requirements (it usually is, but good to ensure)
RUN pip install --no-cache-dir -r requirements.txt uvicorn

# Copy Backend Code
COPY backend ./backend

# Copy Frontend Build Artifacts to Backend Static Folder
# main.py expects them in 'backend/static' (relative to where we run uvicorn)
# We usually run from /app, so backend/static is correct if we run `python -m backend.main`
# But let's verify main.py logic. It checks `os.path.exists("static")`.
# If we run from /app/backend, it checks /app/backend/static.
# Let's align structure.
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Set Workdir to backend so relative paths (like database.db) work easily
WORKDIR /app/backend

# Expose Port
EXPOSE 8000

# Run Application
# Using 'main:app' because we are inside /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
