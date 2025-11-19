# 数据库迁移指南

本目录包含 TypeORM 数据库迁移文件，用于管理数据库架构的版本控制。

## 迁移文件

- `1700000000000-InitialSchema.ts` - 初始数据库架构，创建所有核心表

## 可用命令

### 运行迁移

```bash
npm run migration:run
```

在生产环境或开发环境中运行所有待执行的迁移。

### 回滚迁移

```bash
npm run migration:revert
```

回滚最后一次执行的迁移。

### 生成新迁移

```bash
npm run migration:generate -- src/migrations/MigrationName
```

根据实体变更自动生成迁移文件。

### 创建空白迁移

```bash
npm run migration:create -- src/migrations/MigrationName
```

创建一个空白的迁移文件模板。

### 查看迁移状态

```bash
npm run migration:show
```

显示所有迁移及其执行状态。

## 迁移最佳实践

1. **版本控制**: 所有迁移文件都应该提交到版本控制系统
2. **不可修改**: 一旦迁移在生产环境运行，就不应该修改
3. **向后兼容**: 新的迁移应该考虑数据兼容性
4. **测试**: 在生产环境执行前，在测试环境充分测试
5. **可逆性**: 每个迁移都应该有对应的 down() 方法用于回滚

## Docker 部署

在 Docker 环境中，迁移会在应用启动前自动运行：

```yaml
command: sh -c "npm run migration:run && npm start"
```

## 测试

运行迁移测试：

```bash
npm run test -- src/migrations/__tests__/migrations.test.ts
```

测试会验证：

- 迁移的 up() 方法能正确创建所有表
- 所有表结构符合预期
- 外键和索引正确创建
- 迁移的 down() 方法能完全回滚变更
- 迁移可以重复运行

## 数据库表

初始迁移创建以下表：

1. **users** - 用户表
2. **organizations** - 组织表
3. **organization_memberships** - 组织成员关系表
4. **tasks** - 任务表
5. **task_messages** - 任务消息表
6. **shares** - 共享表
7. **telemetry_events** - 遥测事件表

## 故障排查

### 迁移失败

如果迁移失败，检查：

1. 数据库连接配置是否正确
2. 数据库用户是否有足够权限
3. 查看错误日志了解具体原因

### 回滚失败

如果无法回滚：

1. 检查 down() 方法的实现
2. 确保外键约束被正确处理
3. 必要时手动清理数据库

### 迁移表损坏

如果 migrations 表损坏：

```sql
-- 查看迁移表
SELECT * FROM migrations;

-- 必要时删除特定记录（谨慎操作）
DELETE FROM migrations WHERE name = 'MigrationName';
```

## 生产环境注意事项

1. **备份**: 在运行迁移前备份数据库
2. **停机窗口**: 考虑在维护窗口执行重大迁移
3. **监控**: 监控迁移执行时间和资源使用
4. **回滚计划**: 准备回滚方案以防出现问题
