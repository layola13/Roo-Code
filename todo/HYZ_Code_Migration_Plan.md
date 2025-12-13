# Roo Code → HYZ Code 企业单机版迁移方案

## 核心目标

将 Roo Code 完全重新品牌化为 **HYZ Code 企业单机版**：

- ✅ **完全离线运行**，无任何后端服务依赖
- ✅ **无数据外传**，保障企业代码安全
- ✅ **无遥测追踪**，完全隐私保护
- ✅ **无登录认证**，开箱即用
- ✅ **所有 "Roo" 字眼全部替换**，包括文件名

---

## Phase 1: 文件重命名 (需手动执行)

### 1.1 src/ 目录文件重命名

| 原文件名                                                     | 新文件名                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `api/providers/roo.ts`                                       | **删除** (Roo云服务Provider)                                 |
| `api/providers/__tests__/roo.spec.ts`                        | **删除**                                                     |
| `assets/images/roo-logo.svg`                                 | `assets/images/hyz-logo.svg`                                 |
| `assets/images/roo.png`                                      | `assets/images/hyz.png`                                      |
| `core/ignore/RooIgnoreController.ts`                         | `core/ignore/HyzIgnoreController.ts`                         |
| `core/ignore/__mocks__/RooIgnoreController.ts`               | `core/ignore/__mocks__/HyzIgnoreController.ts`               |
| `core/ignore/__tests__/RooIgnoreController.spec.ts`          | `core/ignore/__tests__/HyzIgnoreController.spec.ts`          |
| `core/ignore/__tests__/RooIgnoreController.security.spec.ts` | `core/ignore/__tests__/HyzIgnoreController.security.spec.ts` |
| `core/prompts/__tests__/responses-rooignore.spec.ts`         | `core/prompts/__tests__/responses-hyzignore.spec.ts`         |
| `core/protect/RooProtectedController.ts`                     | `core/protect/HyzProtectedController.ts`                     |
| `core/protect/__tests__/RooProtectedController.spec.ts`      | `core/protect/__tests__/HyzProtectedController.spec.ts`      |

### 1.2 webview-ui/ 目录文件重命名

| 原文件名                                            | 新文件名                                            |
| --------------------------------------------------- | --------------------------------------------------- |
| `src/components/ui/hooks/useRooPortal.ts`           | `src/components/ui/hooks/useHyzPortal.ts`           |
| `src/components/welcome/RooHero.tsx`                | `src/components/welcome/HyzHero.tsx`                |
| `src/components/welcome/RooTips.tsx`                | `src/components/welcome/HyzTips.tsx`                |
| `src/components/welcome/__tests__/RooTips.spec.tsx` | `src/components/welcome/__tests__/HyzTips.spec.tsx` |

### 1.3 packages/ 目录文件重命名

| 原文件名                     | 新文件名                         |
| ---------------------------- | -------------------------------- |
| `types/src/providers/roo.ts` | **删除** (Roo Provider 类型定义) |

---

## Phase 2: 配置文件替换 (.rooignore → .hyzignore)

| 原文件       | 新文件       |
| ------------ | ------------ |
| `.rooignore` | `.hyzignore` |
| `.roomodes`  | `.hyzmodes`  |
| `.roo/` 目录 | `.hyz/` 目录 |

---

## Phase 3: 代码内容全局替换

### 3.1 类名/变量名替换

| 原名称                   | 新名称                   | 影响文件数 |
| ------------------------ | ------------------------ | ---------- |
| `RooIgnoreController`    | `HyzIgnoreController`    | 15+        |
| `RooProtectedController` | `HyzProtectedController` | 5+         |
| `RooHandler`             | **删除**                 | -          |
| `RooHero`                | `HyzHero`                | 3+         |
| `RooTips`                | `HyzTips`                | 3+         |
| `useRooPortal`           | `useHyzPortal`           | 5+         |
| `rooModels`              | **删除**                 | -          |
| `rooDefaultModelId`      | **删除**                 | -          |

### 3.2 字符串/文案替换

```
"Roo Code"      → "HYZ Code"
"Roo"           → "HYZ"  (单独出现时)
"roo-code"      → "hyz-code"
"@roo-code/"    → "@hyz-code/"
".rooignore"    → ".hyzignore"
".roomodes"     → ".hyzmodes"
"roo-logo"      → "hyz-logo"
"ROO_CODE_"     → "HYZ_CODE_"  (环境变量)
```

### 3.3 受影响的主要文件 (150+)

**API 层:**

- `src/api/index.ts`
- `src/api/providers/index.ts`
- `src/api/providers/constants.ts`

**核心模块:**

- `src/extension.ts`
- `src/core/task/Task.ts`
- `src/core/ignore/HyzIgnoreController.ts`
- `src/core/protect/HyzProtectedController.ts`
- `src/core/mentions/index.ts`

**工具模块:**

- `src/core/tools/*.ts` (多个文件引用 RooIgnoreController)

**WebView:**

- `webview-ui/src/components/welcome/HyzHero.tsx`
- `webview-ui/src/components/welcome/HyzTips.tsx`

---

## Phase 4: 禁用/删除云服务

### 4.1 删除文件

```bash
rm src/api/providers/roo.ts
rm src/api/providers/__tests__/roo.spec.ts
rm packages/types/src/providers/roo.ts
```

### 4.2 禁用 CloudService

修改 `src/extension.ts`:

```diff
- import { CloudService, BridgeOrchestrator } from "@roo-code/cloud"
+ // HYZ Code Enterprise: Cloud services disabled

- cloudService = await CloudService.createInstance(...)
+ // Cloud services disabled for enterprise security
```

### 4.3 禁用遥测

修改 `packages/telemetry/src/TelemetryService.ts`:

```typescript
// HYZ Code Enterprise: All telemetry disabled
private static readonly ENTERPRISE_MODE = true;
```

---

## Phase 5: Logo 替换

### 已创建的 Logo 文件

| 文件                              | 说明                        |
| --------------------------------- | --------------------------- |
| `src/assets/images/hyz-logo.svg`  | 蜂鸟 Logo (currentColor) ✅ |
| `assets/hyz-code-icon.svg`        | 方形圆角版 (App图标) ✅     |
| `assets/hyz-code-icon-circle.svg` | 正圆形版 ✅                 |

### 需要替换的配置

- `package.json` 中的 `icon` 字段指向新图标
- VS Code 扩展的 activity bar 图标

---

## Phase 6: Package.json 包名替换

### 根目录

```diff
- "name": "roo-code"
+ "name": "hyz-code"
```

### packages/ 子包

```diff
- "@roo-code/cloud"      → "@hyz-code/cloud"
- "@roo-code/types"      → "@hyz-code/types"
- "@roo-code/telemetry"  → "@hyz-code/telemetry"
- "@roo-code/ipc"        → "@hyz-code/ipc"
- "@roo-code/build"      → "@hyz-code/build"
```

---

## 执行脚本 (建议)

```bash
#!/bin/bash
# HYZ Code Migration Script

# 1. 文件重命名
mv src/assets/images/roo-logo.svg src/assets/images/hyz-logo.svg
mv src/assets/images/roo.png src/assets/images/hyz.png
mv src/core/ignore/RooIgnoreController.ts src/core/ignore/HyzIgnoreController.ts
mv src/core/protect/RooProtectedController.ts src/core/protect/HyzProtectedController.ts
mv webview-ui/src/components/welcome/RooHero.tsx webview-ui/src/components/welcome/HyzHero.tsx
mv webview-ui/src/components/welcome/RooTips.tsx webview-ui/src/components/welcome/HyzTips.tsx
mv webview-ui/src/components/ui/hooks/useRooPortal.ts webview-ui/src/components/ui/hooks/useHyzPortal.ts
mv .rooignore .hyzignore
mv .roomodes .hyzmodes

# 2. 删除 Roo Provider
rm -f src/api/providers/roo.ts
rm -f src/api/providers/__tests__/roo.spec.ts
rm -f packages/types/src/providers/roo.ts

# 3. 全局文本替换 (需要 sed 或 IDE 批量替换)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/RooIgnoreController/HyzIgnoreController/g' {} \;

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/RooProtectedController/HyzProtectedController/g' {} \;

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/@roo-code\//@hyz-code\//g' {} \;

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/Roo Code/HYZ Code/g' {} \;

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/\.rooignore/.hyzignore/g' {} \;
```

---

## 预估工作量

| 阶段     | 描述             | 时间 |
| -------- | ---------------- | ---- |
| Phase 1  | 文件重命名       | 1h   |
| Phase 2  | 配置文件替换     | 0.5h |
| Phase 3  | 代码内容全局替换 | 2-3h |
| Phase 4  | 禁用云服务       | 1-2h |
| Phase 5  | Logo 替换        | 0.5h |
| Phase 6  | 包名替换         | 1h   |
| 测试验证 | 构建和测试       | 2-3h |

**总计: 8-11 小时**

---

## 验证清单

- [ ] 扩展名称显示 "HYZ Code"
- [ ] 新蜂鸟 Logo 正常显示
- [ ] `.hyzignore` 功能正常
- [ ] 所有大厂 API (OpenAI, Claude, Gemini, Ollama) 正常工作
- [ ] 无任何 "Roo" 字样残留
- [ ] 无任何网络请求发往 roocode.com
- [ ] 构建 VSIX 成功
- [ ] 单元测试通过
