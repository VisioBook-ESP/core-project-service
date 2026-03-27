# Stage 1 — Builder
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma/ ./prisma/
RUN pnpm prisma:generate

COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm build && ls dist/generated/prisma/internal/class.js

# Stage 2 — Production
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

ENV NODE_ENV=production
EXPOSE 8086

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "dist/main.js"]
