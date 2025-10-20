"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

export default function ConfigTestPage() {
	const [loading, setLoading] = useState(false)
	const [result, setResult] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)

	const testVSCodeConfig = async () => {
		setLoading(true)
		setError(null)
		setResult(null)

		try {
			const response = await fetch("/api/vscode-config")
			const data = await response.json()

			if (data.success) {
				setResult(data.data)
			} else {
				setError(data.error || "Failed to read config")
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error")
		} finally {
			setLoading(false)
		}
	}

	const testCurrentApiConfig = async () => {
		setLoading(true)
		setError(null)
		setResult(null)

		try {
			const response = await fetch("/api/vscode-config", { method: "POST" })
			const data = await response.json()

			if (data.success) {
				setResult({ currentApiConfig: data.data })
			} else {
				setError(data.error || "Failed to read API config")
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="container mx-auto py-10 px-4">
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-3xl font-bold mb-2">VSCode 配置测试</h1>
					<p className="text-muted-foreground">测试从VSCode插件读取配置的功能</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>测试操作</CardTitle>
						<CardDescription>点击按钮测试不同的配置读取功能</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex gap-4">
							<Button onClick={testVSCodeConfig} disabled={loading} className="flex items-center gap-2">
								{loading && <Loader2 className="w-4 h-4 animate-spin" />}
								读取完整配置
							</Button>

							<Button
								onClick={testCurrentApiConfig}
								disabled={loading}
								variant="secondary"
								className="flex items-center gap-2">
								{loading && <Loader2 className="w-4 h-4 animate-spin" />}
								获取当前API配置
							</Button>
						</div>
					</CardContent>
				</Card>

				{error && (
					<Alert className="border-red-500 bg-red-50">
						<XCircle className="h-4 w-4" />
						<AlertTitle>错误</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{result && (
					<Alert>
						<CheckCircle2 className="h-4 w-4" />
						<AlertTitle>成功</AlertTitle>
						<AlertDescription>
							{result.hasConfig !== undefined && (
								<div className="mb-2">
									配置状态: {result.hasConfig ? "✅ 找到配置" : "❌ 未找到配置"}
								</div>
							)}
							{result.storagePath && (
								<div className="mb-2 text-sm">
									存储路径: <code className="bg-muted px-1 rounded">{result.storagePath}</code>
								</div>
							)}
						</AlertDescription>
					</Alert>
				)}

				{result && (
					<Card>
						<CardHeader>
							<CardTitle>配置详情</CardTitle>
							<CardDescription>从VSCode插件读取的配置信息</CardDescription>
						</CardHeader>
						<CardContent>
							<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
								{JSON.stringify(result, null, 2)}
							</pre>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<CardTitle>说明</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>
							<strong>读取完整配置：</strong>{" "}
							从VSCode插件的globalStorage读取所有配置，包括任务历史、自定义模式等。
						</p>
						<p>
							<strong>获取当前API配置：</strong> 仅获取当前激活的API provider和模型配置。
						</p>
						<p>
							<strong>配置位置：</strong> 通常在{" "}
							<code>~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/</code>
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
