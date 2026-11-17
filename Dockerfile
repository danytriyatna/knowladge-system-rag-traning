# Multi-stage Dockerfile untuk JP-Insight (Next.js + pgvector + ONNX local embeddings)
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /app/storage/documents-pdfs /app/storage/models \
  && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
     AUTH_SECRET="build-placeholder-32-chars-minimum-0123456" \
     NODE_OPTIONS="--max-old-space-size=2048" \
     npm run build \
  && rm -rf .next/cache

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libgomp1 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/storage/documents-pdfs /app/storage/models

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/db ./db

EXPOSE 3000

CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
