# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY package.json ./

# 安装依赖（仅生产依赖）
RUN pnpm install --prod --no-frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY package.json ./

# 安装所有依赖（包括开发依赖）
RUN pnpm install --no-frozen-lockfile

# 复制源代码和配置文件
COPY tsconfig.json ./
COPY src ./src

# 构建 TypeScript
RUN pnpm build

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner

# 安装 dumb-init（用于正确处理信号）
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000

# 从 deps 阶段复制 node_modules
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# 从 builder 阶段复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 dumb-init 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]