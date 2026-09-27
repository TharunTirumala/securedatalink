# Dockerfile for SecureLink Cyber-Secure Tactical Datalink System
FROM python:3.11-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files, pre-built static frontend, and data samples
COPY app/ ./app/
COPY data/ ./data/
COPY dist/ ./dist/
COPY run.py .

# Environment configuration
ENV PORT=10000
ENV HOST=0.0.0.0

EXPOSE 10000

CMD ["python", "run.py"]
