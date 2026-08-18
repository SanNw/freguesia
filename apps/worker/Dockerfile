# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run typecheck
RUN npm run build

# Stage 2: Production
FROM node:22-slim AS production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
RUN npx playwright install chromium --with-deps
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data/auth /app/data/screenshots /app/data/traces && chown -R node:node /app/data

ENV NODE_ENV=production
ENV APP_ENV=production
ENV PLAYWRIGHT_HEADLESS=true
EXPOSE 3001
USER node
CMD ["node", "dist/server.js"]
