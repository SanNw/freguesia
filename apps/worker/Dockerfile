FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
  wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Install Playwright browser
RUN npx playwright install chromium --with-deps

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production
ENV APP_ENV=production
ENV PLAYWRIGHT_HEADLESS=true

EXPOSE 3001

CMD ["node", "dist/server.js"]
