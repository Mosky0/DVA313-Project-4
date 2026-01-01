# ---------- Stage 1: Build frontend ----------
FROM node:20-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend .
RUN npm run build

# ---------- Stage 2: Backend + frontend ----------
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app ./app
COPY run.py .
COPY gunicorn_config.py .
COPY config.py .
# Copy frontend build into backend
COPY --from=frontend-build /frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["gunicorn", "--config", "gunicorn_config.py", "app:create_app()"]
