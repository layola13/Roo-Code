# read_file_lines 功能设计方案

## 一、需求分析

### 1.1 当前问题

- read_file工具可能读取超大文件（>180K），导致上下文溢出
- 现有的line_range功能已经存在，但没有强制限制
- 用户需求：单次读取不超过1500行，文件超过180K时强制使用行范围读取

### 1.2 现有机制分析

通过代码分析发现：

**现有的line_range支持：**

- `src/core/tools/readFileTool.ts` 第145-156行：已经支持 `line_range` 参数
- `src/core/prompts/tools/read-file.ts` 第16行：工具描述中已包含 `line_range` 参数
- `native/file-processor/src/lib.rs` 第89-102行：Rust实现了 `read_line_range_internal` 函数

**现有的文件大小检查：**

- `src/core/tools/helpers/fileSizeHelpers.ts`：
    - 单文件警告阈值：100KB
    - 单文件硬限制：1MB
    - 批量总计警告：500KB
    - 批量总计硬限制：2MB

## 二、设计方案

### 2.1 核心策略

**重要发现：** 系统已经有完整的line_range功能！我们不需要创建新工具read_file_lines，而是：

1. **调整文件大小阈值**：将180K作为新的强制使用line_range的阈值
2. **添加行数限制验证**：在现有line_range逻辑中添加1500行的限制
3. **改进错误提示**：当文件过大时，提供更明确的line_range使用指导

### 2.2 具体改进点

#### 2.2.1 更新文件大小限制常量

在 `src/core/tools/helpers/fileSizeHelpers.ts` 中添加：

```typescript
export const FILE_SIZE_LIMITS = {
	// ... 现有常量 ...

	// 180K 阈值 - 强制使用 line_range
	FORCE_LINE_RANGE_BYTES: 180 * 1024, // 180 KB

	// 单次读取最大行数
	MAX_LINES_PER_READ: 1500,
} as const
```

#### 2.2.2 添加行范围验证函数

```typescript
/**
 * 验证行范围是否在允许的限制内
 */
export function validateLineRange(
	startLine: number,
	endLine: number,
): {
	isValid: boolean
	errorMessage?: string
} {
	const lineCount = endLine - startLine + 1

	if (lineCount > FILE_SIZE_LIMITS.MAX_LINES_PER_READ) {
		return {
			isValid: false,
			errorMessage: `Line range too large: ${lineCount} lines requested, but maximum is ${FILE_SIZE_LIMITS.MAX_LINES_PER_READ} lines per read. Please split into smaller ranges.`,
		}
	}

	return { isValid: true }
}
```

#### 2.2.3 修改 readFileTool.ts

在第491行（处理文件内容之前）添加180K检查：

```typescript
// 在处理approved文件时，检查文件大小
const stats = await fs.stat(fullPath)
const fileSize = stats.size

// 如果文件超过180K且没有指定line_range，要求使用line_range
if (
	fileSize > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES &&
	(!fileResult.lineRanges || fileResult.lineRanges.length === 0)
) {
	const errorMsg = `File size (${formatBytes(fileSize)}) exceeds 180 KB. You MUST use line_range to read specific sections. Use list_code_definition_names first to understand file structure, then read relevant sections.`

	updateFileResult(relPath, {
		status: "error",
		error: errorMsg,
		xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
	})
	continue
}

// 验证line_range不超过1500行
if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
	for (const range of fileResult.lineRanges) {
		const validation = validateLineRange(range.start, range.end)
		if (!validation.isValid) {
			updateFileResult(relPath, {
				status: "error",
				error: validation.errorMessage,
				xmlContent: `<file><path>${relPath}</path><error>${validation.errorMessage}</error></file>`,
			})
			continue // Skip to next file
		}
	}
}
```

#### 2.2.4 更新工具描述

在 `src/core/prompts/tools/read-file.ts` 中增强说明：

```typescript
**IMPORTANT File Size Rules:**
- Files larger than 180 KB MUST be read using line_range
- Each line_range can read a maximum of 1500 lines
- For large files: use list_code_definition_names first, then read specific sections
- Example: <line_range>1-1000</line_range><line_range>2000-2500</line_range>
```

### 2.3 实现优势

1. **复用现有功能**：不需要创建新工具，只需增强现有逻辑
2. **保持兼容性**：对小文件（<180K）保持原有行为
3. **渐进式提示**：先警告（100K），再强制（180K）
4. **清晰的错误信息**：告诉用户如何正确使用line_range

## 三、测试计划

### 3.1 单元测试用例

在 `src/core/tools/__tests__/readFileTool.spec.ts` 中添加：

1. **测试180K阈值强制使用line_range**

    - 创建181K文件，不带line_range → 应返回错误
    - 创建181K文件，带line_range → 应成功读取

2. **测试1500行限制**

    - line_range: 1-1500 → 成功
    - line_range: 1-1501 → 失败
    - line_range: 1000-3000 (>1500行) → 失败

3. **测试多个line_range**

    - 两个范围，各1000行 → 成功
    - 三个范围，总计>1500行但每个<1500 → 成功

4. **测试边界条件**
    - 文件正好180K → 不强制
    - 文件180K+1字节 → 强制

### 3.2 集成测试

测试完整工作流：

1. 读取大文件 → 收到错误提示
2. 使用list_code_definition_names查看结构
3. 使用line_range读取特定部分
4. 验证返回内容正确

## 四、实施步骤

1. ✅ 分析现有实现
2. ⏳ 修改 `fileSizeHelpers.ts` - 添加常量和验证函数
3. ⏳ 修改 `readFileTool.ts` - 添加180K和1500行检查
4. ⏳ 更新 `read-file.ts` - 增强工具描述
5. ⏳ 编写测试用例
6. ⏳ 运行测试验证
7. ⏳ 编译确保无错误
8. ⏳ 文档更新

## 五、潜在问题和解决方案

### 5.1 问题：用户可能不知道使用line_range

**解决方案：**

- 在错误消息中提供明确的使用示例
- 建议先用list_code_definition_names了解文件结构
- 提供具体的行范围建议（如：前1000行，中间1000行等）

### 5.2 问题：多个文件累计可能超过180K

**解决方案：**

- 现有的批量检查逻辑已经处理（2MB硬限制）
- 180K检查是针对单个文件，不影响批量读取小文件

### 5.3 问题：二进制文件和图片怎么办

**解决方案：**

- 二进制文件在isBinary检查时已经特殊处理
- 图片文件有专门的大小限制（maxImageFileSize）
- 180K检查在二进制检查之后进行

## 六、总结

这个方案的核心思想是：**不添加新工具，而是增强现有read_file的智能性**。

关键改进：

1. 添加180K强制使用line_range的阈值
2. 添加1500行的单次读取限制
3. 提供更好的错误提示和使用指导
4. 保持向后兼容性

这样的设计更简洁、更易维护，也更符合用户的使用习惯。
