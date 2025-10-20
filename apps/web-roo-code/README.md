# Roo Code Web版本

基于Next.js 15构建的Roo Code Web应用，提供与VSCode扩展相同的AI辅助编程体验。

## 功能特性

### 核心功能

- 🤖 **AI对话助手** - 与AI进行自然语言交互
- 📁 **文件管理** - 浏览、读取、编辑项目文件
- ⚙️ **任务管理** - 创建、执行、跟踪开发任务
- 🔄 **实时同步** - WebSocket实时消息传递
- 🎨 **VSCode风格UI** - 熟悉的界面设计

### 技术特性

- ✅ Next.js 15 + React 19
- ✅ TypeScript 全类型支持
- ✅ Prisma ORM + PostgreSQL
- ✅ NextAuth.js 认证系统
- ✅ Tailwind CSS + shadcn/ui
- ✅ Docker 容器化部署

## 快速开始

### 前置要求

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Docker & Docker Compose (可选)

### 本地开发

1. **克隆项目**

```bash
git clone <repository-url>
cd apps/web-roo-code
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

4. **初始化数据库**

```bash
npx prisma migrate dev
npx prisma generate
```

5. **启动开发服务器**

```bash
pnpm dev
```

访问 http://localhost:3000

### Docker部署

1. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件
```

2. **启动所有服务**

```bash
docker-compose up -d
```

3. **查看日志**

```bash
docker-compose logs -f web
```

4. **停止服务**

```bash
docker-compose down
```

## 环境变量配置

### 必需配置

```env
# 数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/roo_code"

# NextAuth配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# AI API密钥
ANTHROPIC_API_KEY="your-api-key"
OPENAI_API_KEY="your-api-key"
```

### 可选配置

```env
# GitHub OAuth
GITHUB_ID="your-github-oauth-id"
GITHUB_SECRET="your-github-oauth-secret"

# Redis缓存
REDIS_URL="redis://localhost:6379"
```

## 项目结构

```
apps/web-roo-code/
├── prisma/              # 数据库Schema和迁移
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── api/        # API路由
│   │   ├── auth/       # 认证页面
│   │   └── page.tsx    # 主页面
│   ├── components/     # React组件
│   │   ├── chat/       # 聊天界面组件
│   │   └── ui/         # 基础UI组件
│   ├── lib/            # 工具库
│   │   ├── prisma.ts   # Prisma客户端
│   │   └── auth.ts     # NextAuth配置
│   ├── services/       # 业务逻辑层
│   │   ├── WebTaskProvider.ts
│   │   ├── WebConfigManager.ts
│   │   └── FileProxyClient.ts
│   └── types/          # TypeScript类型定义
├── public/             # 静态资源
├── Dockerfile          # Docker镜像配置
├── docker-compose.yml  # Docker Compose配置
└── README.md          # 项目文档
```

## API接口

### 任务管理

- `POST /api/tasks` - 创建新任务
- `GET /api/tasks/:id` - 获取任务详情
- `PUT /api/tasks/:id` - 更新任务状态
- `GET /api/tasks/:id/messages` - 获取任务消息（支持SSE流式传输）

### 文件操作

- `GET /api/files/read` - 读取文件内容
- `POST /api/files/write` - 写入文件内容
- `GET /api/files/list` - 列出目录内容

### 配置管理

- `GET /api/config` - 获取用户配置
- `PUT /api/config` - 更新用户配置

## 开发指南

### 数据库迁移

```bash
# 创建新迁移
npx prisma migrate dev --name migration_name

# 应用迁移
npx prisma migrate deploy

# 重置数据库
npx prisma migrate reset
```

### 代码规范

```bash
# 类型检查
pnpm type-check

# 代码格式化
pnpm format

# 代码检查
pnpm lint
```

### 构建生产版本

```bash
# 构建应用
pnpm build

# 启动生产服务器
pnpm start
```

## 部署

### Vercel部署

1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 部署PostgreSQL数据库（推荐使用Vercel Postgres）
4. 自动部署

### 自托管部署

1. 构建Docker镜像

```bash
docker build -t roo-code-web .
```

2. 运行容器

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  roo-code-web
```

### 数据库备份

```bash
# 备份数据库
docker exec roo-code-postgres pg_dump -U roocode roo_code > backup.sql

# 恢复数据库
docker exec -i roo-code-postgres psql -U roocode roo_code < backup.sql
```

## 故障排查

### 数据库连接失败

- 检查DATABASE_URL配置是否正确
- 确认PostgreSQL服务正在运行
- 验证数据库用户权限

### NextAuth认证问题

- 确认NEXTAUTH_SECRET已设置
- 检查NEXTAUTH_URL与实际URL匹配
- 验证OAuth配置（如使用GitHub登录）

### 文件上传失败

- 检查uploads目录权限
- 确认MAX_FILE_SIZE设置合理
- 验证磁盘空间充足

## 性能优化

- 启用Redis缓存提升响应速度
- 配置CDN加速静态资源
- 启用数据库连接池
- 使用Prisma查询优化

## 安全建议

- 定期更新依赖包
- 使用强密码和密钥
- 启用HTTPS加密传输
- 限制API请求频率
- 定期备份数据库

## 贡献指南

欢迎提交Issue和Pull Request！

## 许可证

MIT License

## 支持

如有问题，请提交Issue或联系维护团队。
