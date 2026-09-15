#!/usr/bin/env bash
set -euo pipefail
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:all
