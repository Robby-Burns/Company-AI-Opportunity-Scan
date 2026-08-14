# syntax=docker/dockerfile:1
#
# Company AI Opportunity Scan — production image for Railway (or any container host).
#
# Why this exists: the research-scraper uses Playwright (chromium) in-process.
# Railway's default nixpacks Node build does NOT install chromium's system
# dependencies, so without this image every scrape silently degrades to zero
# evidence (the app's graceful-degradation path). This Dockerfile installs
# chromium + its shared libs via Playwright's own `install-deps` command so the
# scraper actually works.
#
# Browser/library version matching: `playwright` is pinned to an exact version
# in package.json so the browser downloaded at build time matches the library
# at run time. Update both together.

# ─── 1. Build stage ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app
# Keep the browser binary inside /app so it is copied to the runtime stage.
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.pw-browsers

# Install deps (incl. devDeps for the build toolchain + playwright).
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the Next app.
COPY . .
RUN npm run build

# Download the chromium browser binary (matches the pinned playwright version).
# No --with-deps here: the build stage does not launch chromium, so system
# libraries are only needed in the runtime stage.
RUN npx playwright install chromium

# ─── 2. Runtime stage ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.pw-browsers

# Copy the built app (node_modules + the browser binary in .pw-browsers).
COPY --from=build /app ./

# Install chromium's shared-library dependencies via Playwright's own list
# (more reliable than hand-maintaining apt package names across Debian revs).
RUN apt-get update && npx playwright install-deps chromium && rm -rf /var/lib/apt/lists/*

# Railway injects PORT; Next's `next start` honors it (default 3000).
ENV PORT=3000
EXPOSE 3000

# Lightweight readiness probe (see src/app/api/health/route.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
