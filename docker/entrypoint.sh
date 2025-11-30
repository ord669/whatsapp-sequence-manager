#!/bin/sh
set -e

if [ "${RUN_DB_MIGRATION:-false}" = "true" ]; then
  echo "Applying Prisma schema to database..."
  until npx prisma db push --skip-generate; do
    echo "Prisma schema push failed, retrying in 5 seconds..."
    sleep 5
  done
  echo "Prisma schema applied successfully."
else
  echo "Skipping Prisma schema sync (RUN_DB_MIGRATION=${RUN_DB_MIGRATION:-false})."
fi

exec "$@"

