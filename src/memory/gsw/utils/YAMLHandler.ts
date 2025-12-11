/**
 * GSW三元记忆系统 - YAML文件读写工具
 * 提供高性能的YAML序列化/反序列化功能
 */

import * as yaml from "js-yaml"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../../utils/fs"

export class YAMLHandler {
	/**
	 * 读取YAML文件
	 * @param filePath 文件路径
	 * @returns 解析后的对象
	 */
	static async read<T>(filePath: string): Promise<T> {
		if (!(await fileExistsAtPath(filePath))) {
			throw new Error(`YAML file not found: ${filePath}`)
		}

		const content = await fs.readFile(filePath, "utf-8")
		const parsed = yaml.load(content) as T

		if (!parsed) {
			throw new Error(`Failed to parse YAML: ${filePath}`)
		}

		return parsed
	}

	/**
	 * 写入YAML文件（原子操作）
	 * @param filePath 文件路径
	 * @param data 要写入的数据
	 */
	static async write(filePath: string, data: unknown): Promise<void> {
		const yamlContent = yaml.dump(data, {
			indent: 2,
			lineWidth: 120,
			noRefs: true,
			sortKeys: false,
		})

		// 使用原子写入（临时文件+重命名）
		const tempPath = `${filePath}.tmp.${Date.now()}`

		try {
			await fs.writeFile(tempPath, yamlContent, "utf-8")
			await fs.rename(tempPath, filePath)
		} catch (error) {
			// 清理临时文件
			try {
				await fs.unlink(tempPath)
			} catch {
				// 忽略清理错误
			}
			throw error
		}
	}

	/**
	 * 批量读取YAML文件（并行优化）
	 * @param filePaths 文件路径数组
	 * @returns 解析后的对象数组
	 */
	static async readBatch<T>(filePaths: string[]): Promise<T[]> {
		const results = await Promise.all(filePaths.map((path) => this.read<T>(path).catch(() => null as null)))
		return results.filter((r): r is Awaited<T> => r !== null) as T[]
	}
}
