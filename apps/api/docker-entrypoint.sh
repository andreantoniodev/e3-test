#!/bin/sh
set -e

pnpm exec prisma migrate deploy

if [ "${RUN_SEED}" = "true" ]; then
  pnpm exec prisma db seed
fi

exec node dist/main.js
