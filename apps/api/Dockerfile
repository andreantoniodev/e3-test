FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

COPY package.json ./
RUN pnpm install

COPY . .
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mini_crm?schema=public
RUN pnpm prisma generate && pnpm exec nest build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache wget openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
RUN pnpm install --prod && pnpm store prune

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/src/generated ./src/generated
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
