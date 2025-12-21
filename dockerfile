FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
ENV VITE_API_BASE_URL=http://localhost:8000/api
RUN npm run build

FROM node:20-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN npm install -g serve

COPY . .

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000 3000

CMD sh -c "\
gunicorn -b 0.0.0.0:8000 run:app & \
serve -s frontend/dist -l 3000"
