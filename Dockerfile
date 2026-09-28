# Multi-stage Dockerfile for SecureLink Cyber-Secure Tactical Datalink System

# ==========================================
# Stage 1: Build Frontend Assets
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig*.json ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# ==========================================
# Stage 2: Production Python Backend Runtime
# ==========================================
FROM python:3.11-slim AS runtime

WORKDIR /app

# Create unprivileged system user and group for runtime security
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app

# Install Python production requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application, configuration, sample data, and compiled frontend
COPY app/ ./app/
COPY data/samples/ ./data/samples/
COPY run.py .
COPY --from=frontend-builder /build/dist/ ./dist/

# Ensure directory permissions for persistent data storage
RUN mkdir -p /app/data/incoming /app/data/processed /app/data/archive /app/data/samples && \
    chown -R app:app /app

USER app

# Environment configuration
ENV PORT=10000
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

EXPOSE 10000 9871/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/health').read()" || exit 1

CMD ["python", "run.py"]
