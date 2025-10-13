#!/bin/bash

# Git Commit 自动化脚本
# 用法: ./scripts/commit.sh "your commit message"
# 或者: bash scripts/commit.sh "your commit message"

# 检查是否提供了提交信息
if [ -z "$1" ]; then
    echo "❌ 错误: 请提供提交信息"
    echo "用法: ./scripts/commit.sh \"your commit message\""
    exit 1
fi

# 获取提交信息
COMMIT_MESSAGE="$1"

# 显示当前 Git 状态
echo "📋 当前 Git 状态:"
echo "================================================"
git status --short
echo "================================================"
echo ""

# 询问是否添加所有文件
read -p "❓ 是否添加所有更改的文件? (y/n, 默认: y): " ADD_ALL
ADD_ALL=${ADD_ALL:-y}

if [[ "$ADD_ALL" == "y" || "$ADD_ALL" == "Y" ]]; then
    echo "➕ 添加所有更改..."
    git add .
else
    echo "❌ 已取消添加文件，请手动使用 git add 添加需要提交的文件"
    exit 1
fi

# 显示将要提交的文件
echo ""
echo "📦 将要提交的文件:"
echo "================================================"
git status --short
echo "================================================"
echo ""

# 执行提交
echo "💾 执行提交..."
git commit -m "$COMMIT_MESSAGE"

# 检查提交是否成功
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 提交成功!"
    echo "📝 提交信息: $COMMIT_MESSAGE"
    echo ""
    echo "🔍 最近的提交历史:"
    git log --oneline -3
else
    echo ""
    echo "❌ 提交失败，请检查错误信息"
    exit 1
fi

# 询问是否推送
read -p "❓ 是否推送到远程仓库? (y/n, 默认: n): " PUSH_REMOTE
PUSH_REMOTE=${PUSH_REMOTE:-n}

if [[ "$PUSH_REMOTE" == "y" || "$PUSH_REMOTE" == "Y" ]]; then
    echo "🚀 推送到远程仓库..."
    git push
    if [ $? -eq 0 ]; then
        echo "✅ 推送成功!"
    else
        echo "❌ 推送失败，请检查网络连接和权限"
        exit 1
    fi
fi