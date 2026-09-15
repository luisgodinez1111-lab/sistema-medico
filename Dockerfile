FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY . .
CMD ["node","release/v15/self-check.mjs"]
