# Git 提交脚本使用说明

本目录包含了两个用于简化 Git 提交流程的自动化脚本。

## 📋 脚本列表

### 1. `commit.sh` - 交互式提交脚本

功能完整的交互式提交脚本，会在提交前确认操作。

**特性：**

- ✅ 显示当前 Git 状态
- ✅ 询问是否添加所有文件
- ✅ 显示将要提交的文件列表
- ✅ 执行提交操作
- ✅ 显示最近的提交历史
- ✅ 询问是否推送到远程仓库

**用法：**

```bash
./scripts/commit.sh "你的提交信息"
```

或者：

```bash
bash scripts/commit.sh "你的提交信息"
```

**示例：**

```bash
./scripts/commit.sh "feat: 添加新功能"
./scripts/commit.sh "fix: 修复登录问题"
./scripts/commit.sh "docs: 更新文档"
```

---

### 2. `quick-commit.sh` - 快速提交脚本（无交互）

无需交互确认的快速提交脚本，适合快速迭代开发。

**特性：**

- ⚡ 自动添加所有更改
- ⚡ 立即执行提交
- ⚡ 显示提交结果
- ⚡ 无交互确认

**用法：**

```bash
./scripts/quick-commit.sh "你的提交信息"
```

**示例：**

```bash
./scripts/quick-commit.sh "feat(rust-wasm): 完成 OpenAI Provider 实现"
./scripts/quick-commit.sh "test: 添加单元测试"
```

---

## 🎯 使用场景推荐

### 使用 `commit.sh`（交互式）适合：

- 首次提交或重要提交
- 需要仔细检查文件列表
- 需要推送到远程仓库
- 不确定要提交哪些文件

### 使用 `quick-commit.sh`（快速）适合：

- 快速迭代开发
- 频繁的小改动提交
- 确定要提交所有更改
- 本地开发测试

---

## 📝 提交信息规范

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**常用类型（type）：**

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例：**

```bash
# 简单提交
./scripts/quick-commit.sh "feat: 添加用户登录功能"

# 带作用域
./scripts/quick-commit.sh "fix(auth): 修复token过期问题"

# 多行提交信息
./scripts/commit.sh "feat(rust-wasm): 完成 OpenAI Provider 实现

- 实现 OpenAI API 调用
- 支持 Stream 响应
- 添加 4 个单元测试
- WASM 构建成功"
```

---

## ⚙️ 首次使用

确保脚本有执行权限（已自动设置）：

```bash
chmod +x scripts/commit.sh
chmod +x scripts/quick-commit.sh
```

---

## 🔧 故障排除

### 问题：脚本无法执行

**解决方案：**

```bash
# 方法1：添加执行权限
chmod +x scripts/commit.sh

# 方法2：使用 bash 直接运行
bash scripts/commit.sh "你的提交信息"
```

### 问题：提交失败

**可能原因：**

1. 没有配置 Git 用户信息
2. 仓库未初始化
3. 有未解决的冲突

**解决方案：**

```bash
# 配置 Git 用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 检查 Git 状态
git status

# 查看详细错误信息
git commit -v
```

---

## 📖 相关文档

- [Git 官方文档](https://git-scm.com/doc)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [项目贡献指南](../CONTRIBUTING.md)

---

## 💡 提示

1. **提交前先测试：** 确保代码能够正常运行和通过测试
2. **小步提交：** 频繁提交小改动，便于代码审查和回滚
3. **清晰的提交信息：** 让其他开发者（和未来的你）能快速理解改动内容
4. **使用分支：** 新功能开发在独立分支进行，避免污染主分支

---

**创建日期：** 2025-10-13  
**维护者：** Roo-Code Team
