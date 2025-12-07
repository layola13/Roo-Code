/**
 * 真实场景大小测试 - 验证输出绝对不超过180KB
 */
import { describe, it, expect, beforeAll } from "vitest"
import { parseSourceCodeDefinitionsForFile, parseSourceCodeForDefinitionsTopLevel } from "../index"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// 计算字符串实际大小（KB）
function getActualSizeKB(str: string): number {
	return Buffer.byteLength(str, "utf8") / 1024
}

// 创建测试文件
async function createTestFile(
	filePath: string,
	lines: number,
	content: string = "export function test() { return true; }\n",
): Promise<void> {
	const fullContent = content.repeat(lines)
	await fs.writeFile(filePath, fullContent, "utf8")
}

describe("Real Size Tests - 绝对不能超过180KB", () => {
	let testDir: string

	beforeAll(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-size-test-"))
	})

	describe("场景1：单个超大文件", () => {
		it("5000行TypeScript文件应该不超过180KB", async () => {
			const testFile = path.join(testDir, "large.ts")
			// 创建5000行代码
			await createTestFile(
				testFile,
				5000,
				'export function testFunction_XXXXX() { return { data: "test", value: 123, nested: { a: 1, b: 2 } }; }\n',
			)

			const result = await parseSourceCodeDefinitionsForFile(testFile)

			if (result) {
				const sizeKB = getActualSizeKB(result)
				console.log(`\n[TEST] 单文件5000行结果大小: ${sizeKB.toFixed(2)}KB`)
				console.log(`[TEST] 结果行数: ${result.split("\n").length}`)
				expect(sizeKB).toBeLessThanOrEqual(180)
			}
		})

		it("10000行TypeScript文件应该不超过180KB", async () => {
			const testFile = path.join(testDir, "huge.ts")
			await createTestFile(
				testFile,
				10000,
				'export function testFunction_XXXXX() { return { data: "test", value: 123, nested: { a: 1, b: 2 } }; }\n',
			)

			const result = await parseSourceCodeDefinitionsForFile(testFile)

			if (result) {
				const sizeKB = getActualSizeKB(result)
				console.log(`\n[TEST] 单文件10000行结果大小: ${sizeKB.toFixed(2)}KB`)
				console.log(`[TEST] 结果行数: ${result.split("\n").length}`)
				expect(sizeKB).toBeLessThanOrEqual(180)
			}
		})
	})

	describe("场景2：目录多文件", () => {
		it("目录包含50个文件应该不超过180KB", async () => {
			const multiFileDir = path.join(testDir, "multi-files")
			await fs.mkdir(multiFileDir, { recursive: true })

			// 创建50个文件，每个100行
			for (let i = 0; i < 50; i++) {
				const filePath = path.join(multiFileDir, `file${i}.ts`)
				await createTestFile(filePath, 100)
			}

			const result = await parseSourceCodeForDefinitionsTopLevel(multiFileDir)

			const sizeKB = getActualSizeKB(result)
			console.log(`\n[TEST] 目录50文件结果大小: ${sizeKB.toFixed(2)}KB`)
			console.log(`[TEST] 结果行数: ${result.split("\n").length}`)
			expect(sizeKB).toBeLessThanOrEqual(180)
		})

		it("目录包含10个大文件应该不超过180KB", async () => {
			const largeDirDir = path.join(testDir, "large-files")
			await fs.mkdir(largeDirDir, { recursive: true })

			// 创建10个文件，每个1000行
			for (let i = 0; i < 10; i++) {
				const filePath = path.join(largeDirDir, `large${i}.ts`)
				await createTestFile(filePath, 1000)
			}

			const result = await parseSourceCodeForDefinitionsTopLevel(largeDirDir)

			const sizeKB = getActualSizeKB(result)
			console.log(`\n[TEST] 目录10大文件结果大小: ${sizeKB.toFixed(2)}KB`)
			console.log(`[TEST] 结果行数: ${result.split("\n").length}`)
			expect(sizeKB).toBeLessThanOrEqual(180)
		})
	})

	describe("场景3：混合场景", () => {
		it("目录包含各种大小文件混合应该不超过180KB", async () => {
			const mixedDir = path.join(testDir, "mixed")
			await fs.mkdir(mixedDir, { recursive: true })

			// 1个超大文件
			await createTestFile(path.join(mixedDir, "huge.ts"), 5000)
			// 10个中等文件
			for (let i = 0; i < 10; i++) {
				await createTestFile(path.join(mixedDir, `medium${i}.ts`), 500)
			}
			// 30个小文件
			for (let i = 0; i < 30; i++) {
				await createTestFile(path.join(mixedDir, `small${i}.ts`), 50)
			}

			const result = await parseSourceCodeForDefinitionsTopLevel(mixedDir)

			const sizeKB = getActualSizeKB(result)
			console.log(`\n[TEST] 混合场景结果大小: ${sizeKB.toFixed(2)}KB`)
			console.log(`[TEST] 结果行数: ${result.split("\n").length}`)
			expect(sizeKB).toBeLessThanOrEqual(180)
		})
	})
})
