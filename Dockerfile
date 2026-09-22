# Auditoría 2026-09-19 (P-15): antes esta imagen no instalaba dependencias ni compilaba y su CMD ejecutaba un
# "self-check" heredado. Ahora construye apps/web en modo standalone y sirve la aplicación.
# Las migraciones NO se aplican aquí: `pnpm db:migrate -- up --yes` con la DATABASE_URL del propietario del esquema
# (docs/runbooks/db-migrate.md). En producción el verificador de identidad "dev" está deshabilitado por código y por
# NODE_ENV=production (nunca definir ALLOW_DEV_IDENTITY en la imagen).

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# Variables públicas de build (entran en la CSP y en el login); se pasan con --build-arg.
ARG NEXT_PUBLIC_AUTH0_DOMAIN=
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID=
ARG NEXT_PUBLIC_OIDC_AUDIENCE=medical-os
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID NEXT_PUBLIC_OIDC_AUDIENCE=$NEXT_PUBLIC_OIDC_AUDIENCE
RUN pnpm build:web && mkdir -p apps/web/public

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --home /app app
# Salida standalone: server.js + node_modules trazados, con la raíz del monorepo como raíz de trazado.
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","apps/web/server.js"]
