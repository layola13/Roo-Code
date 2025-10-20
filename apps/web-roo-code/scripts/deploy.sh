#!/bin/bash

# Roo Code Web部署脚本
# 用法: ./scripts/deploy.sh [环境]
# 环境: development, staging, production

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 开始部署 Roo Code Web - 环境: $ENVIRONMENT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要工具
check_requirements() {
    echo "📋 检查部署环境..."
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker未安装${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose未安装${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境检查通过${NC}"
}

# 检查环境变量
check_env() {
    echo "🔐 检查环境变量..."
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        echo -e "${RED}❌ .env文件不存在${NC}"
        echo "请创建 .env 文件并配置必要的环境变量"
        echo "参考: .env.example"
        exit 1
    fi
    
    # 检查必需的环境变量
    source "$PROJECT_ROOT/.env"
    
    required_vars=("DATABASE_URL" "NEXTAUTH_SECRET")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}❌ 缺少必需的环境变量:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境变量检查通过${NC}"
}

# 备份数据库
backup_database() {
    echo "💾 备份数据库..."
    
    BACKUP_DIR="$PROJECT_ROOT/backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if docker ps | grep -q roo-code-postgres; then
        docker exec roo-code-postgres pg_dump -U roocode roo_code > "$BACKUP_FILE" 2>/dev/null || true
        
        if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✅ 数据库备份成功: $BACKUP_FILE${NC}"
        else
            echo -e "${YELLOW}⚠️  数据库备份跳过（可能是首次部署）${NC}"
            rm -f "$BACKUP_FILE"
        fi
    else
        echo -e "${YELLOW}⚠️  数据库容器不存在，跳过备份${NC}"
    fi
}

# 构建镜像
build_image() {
    echo "🔨 构建Docker镜像..."
    
    cd "$PROJECT_ROOT"
    
    docker-compose build --no-cache web
    
    echo -e "${GREEN}✅ 镜像构建成功${NC}"
}

# 停止现有服务
stop_services() {
    echo "🛑 停止现有服务..."
    
    cd "$PROJECT_ROOT"
    
    if docker-compose ps | grep -q "Up"; then
        docker-compose down
        echo -e "${GREEN}✅ 服务已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  没有运行中的服务${NC}"
    fi
}

# 启动服务
start_services() {
    echo "▶️  启动服务..."
    
    cd "$PROJECT_ROOT"
    
    docker-compose up -d
    
    echo "⏳ 等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}✅ 服务启动成功${NC}"
    else
        echo -e "${RED}❌ 服务启动失败${NC}"
        docker-compose logs --tail=50
        exit 1
    fi
}

# 运行数据库迁移
run_migrations() {
    echo "🔄 运行数据库迁移..."
    
    docker-compose exec -T web npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库迁移成功${NC}"
    else
        echo -e "${RED}❌ 数据库迁移失败${NC}"
        exit 1
    fi
}

# 健康检查
health_check() {
    echo "🏥 执行健康检查..."
    
    max_retries=30
    retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            echo -e "${GREEN}✅ 健康检查通过${NC}"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo "⏳ 等待服务响应... ($retry_count/$max_retries)"
        sleep 2
    done
    
    echo -e "${RED}❌ 健康检查失败${NC}"
    docker-compose logs --tail=100 web
    exit 1
}

# 清理旧数据
cleanup() {
    echo "🧹 清理旧数据..."
    
    # 清理旧的Docker镜像
    docker image prune -f
    
    # 清理旧的备份文件（保留最近7天）
    find "$PROJECT_ROOT/backups" -type f -mtime +7 -delete 2>/dev/null || true
    
    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 显示部署信息
show_info() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🎉 部署成功！${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 服务状态:"
    docker-compose ps
    echo ""
    echo "🌐 访问地址: http://localhost:3000"
    echo ""
    echo "📝 常用命令:"
    echo "  查看日志: docker-compose logs -f web"
    echo "  重启服务: docker-compose restart web"
    echo "  停止服务: docker-compose down"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 主流程
main() {
    cd "$PROJECT_ROOT"
    
    check_requirements
    check_env
    backup_database
    stop_services
    build_image
    start_services
    run_migrations
    health_check
    cleanup
    show_info
}

# 执行主流程
main