FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# 依存関係インストール（package.json のみ先にコピーしてキャッシュを活用）
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ビルド
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @apps/api build

# プロダクション用依存関係のみを分離
FROM base AS prod-deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
RUN pnpm --filter @apps/api deploy --prod /deploy/api

# 最終イメージ
FROM node:20-alpine AS runner
WORKDIR /app
# better-sqlite3 (ネイティブアドオン) に必要
RUN apk add --no-cache libc6-compat
COPY --from=prod-deps /deploy/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
