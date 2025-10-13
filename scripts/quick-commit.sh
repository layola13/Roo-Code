#!/bin/bash

# Git 快速提交脚本（无交互）
# 用法: ./scripts/quick-commit.sh "your commit message"

# 检查是否提供了提交信息
if [ -z "$1" ]; then
    echo "❌ 错误: 请提供提交信息"
    echo "用法: ./scripts/quick-commit.sh \"your commit message\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo "➕ 添加所有更改..."
git add .

echo "💾 执行提交: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

if [ $? -eq 0 ]; then
    echo "✅ 提交成功!"
    echo ""
    echo "🔍 最近的提交:"
    git log --oneline -3
else
    echo "❌ 提交失败"
    exit 1
fi