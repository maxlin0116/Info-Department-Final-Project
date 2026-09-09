FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

RUN npm install --global pnpm@11.19.0
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/backend

RUN npm install --global pnpm@11.19.0
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim
WORKDIR /app/backend

# The web image is also used by the optional Linux slicing worker. Bambu Studio
# requires glibc and desktop runtime libraries even when invoked through its CLI.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates xvfb xauth libgtk-3-0 libgl1 libegl1 libglu1-mesa libwebkit2gtk-4.1-0 \
    libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 \
  && rm -rf /var/lib/apt/lists/*
RUN install -d -m 700 /tmp/bambu-runtime

ENV NODE_ENV=production
ENV PORT=4000
ENV GDK_BACKEND=x11
ENV XDG_SESSION_TYPE=x11
ENV XDG_RUNTIME_DIR=/tmp/bambu-runtime

COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 4000

CMD ["npm", "run", "prod"]
