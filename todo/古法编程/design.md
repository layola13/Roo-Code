# 古法编程模式 - 详细开发步骤指南

## 📋 快速导航

| 阶段                                                      | 周期      | 核心交付物                             |
| --------------------------------------------------------- | --------- | -------------------------------------- |
| [Phase 1A: 后端基础](#phase-1a-后端基础架构-week-1)       | Week 1    | AncientModeManager, Types, State       |
| [Phase 1B: 诊断系统](#phase-1b-诊断收集系统-week-2)       | Week 2    | DiagnosticCollector, ScoringEngine     |
| [Phase 1C: 前端UI](#phase-1c-前端-ui-基础-week-3)         | Week 3    | SetupWizard, ProblemList, ScoreDisplay |
| [Phase 1D: 集成测试](#phase-1d-集成与测试-week-4)         | Week 4    | Tests, Bug fixes, MVP发布              |
| [Phase 2: 时间激励](#phase-2-时间激励--成就系统-week-5-7) | Week 5-7  | Timer, Achievements, Notifications     |
| [Phase 3: Git协作](#phase-3-git-协作集成-week-8-11)       | Week 8-11 | GitAnalyzer, TeamBoard                 |

---

## Phase 1A: 后端基础架构 (Week 1)

### Step 1.1: 创建目录结构和类型定义

**文件**: `src/core/ancient/types.ts`

```typescript
// 用户等级
export type UserLevel = "beginner" | "professional" | "expert" | "professor"
export type UserLevelCN = "炼气期" | "筑基期" | "金丹期" | "元婴期"

// 问题严重程度
export type ProblemSeverity = "critical" | "warning" | "info" | "improvement"

// 用户配置
export interface AncientUserProfile {
	id: string
	level: UserLevel
	levelCN: UserLevelCN
	primaryLanguages: string[]
	learningMode: boolean
	learningLanguage?: string
	timePressureEnabled: boolean
	createdAt: number
}

// 问题定义
export interface AncientProblem {
	id: string
	type: ProblemSeverity
	message: string
	location: {
		file: string
		line: number
		column: number
	}
	difficulty: 1 | 2 | 3 | 4 | 5
	timeLimit?: number // 秒
	startTime?: number
	hint: string
	source: "diagnostic" | "terminal" | "custom"
	isResolved: boolean
}

// 评分记录
export interface ScoreEntry {
	timestamp: number
	problemId: string
	fixType: "handwritten" | "ai-generated"
	baseScore: number
	timeBonus: number
	timePenalty: number
	totalScore: number
}

// 成就定义
export interface Achievement {
	id: string
	name: string
	nameCN: string
	description: string
	icon: string
	reward: number
	progress: number
	total: number
	unlocked: boolean
	unlockedAt?: number
	type: "personal" | "team"
}

// 状态存储
export interface AncientModeState {
	isInitialized: boolean
	userProfile: AncientUserProfile | null
	currentScore: number
	scoreHistory: ScoreEntry[]
	achievements: Achievement[]
	problems: AncientProblem[]
	settings: AncientSettings
}

// 设置
export interface AncientSettings {
	severityThreshold: number
	terminalMonitorEnabled: boolean
	timePressureLevel: "relaxed" | "standard" | "intense"
	hintDetailLevel: "minimal" | "standard" | "detailed"
	soundEnabled: boolean
	animationsEnabled: boolean
}
```

✅ **验证点**: 编译无错误

---

### Step 1.2: 创建常量定义

**文件**: `src/core/ancient/constants.ts`

```typescript
import { Achievement, AncientSettings, UserLevel } from "./types"

// 用户等级配置
export const USER_LEVEL_CONFIG: Record<
	UserLevel,
	{
		displayName: string
		displayNameCN: string
		scoreMultiplier: number
		timeMultiplier: number
		hintDetail: "minimal" | "standard" | "detailed"
	}
> = {
	beginner: {
		displayName: "Beginner",
		displayNameCN: "炼气期",
		scoreMultiplier: 1.5,
		timeMultiplier: 1.5,
		hintDetail: "detailed",
	},
	professional: {
		displayName: "Professional",
		displayNameCN: "筑基期",
		scoreMultiplier: 1.2,
		timeMultiplier: 1.2,
		hintDetail: "standard",
	},
	expert: {
		displayName: "Expert",
		displayNameCN: "金丹期",
		scoreMultiplier: 1.0,
		timeMultiplier: 1.0,
		hintDetail: "minimal",
	},
	professor: {
		displayName: "Professor",
		displayNameCN: "元婴期",
		scoreMultiplier: 0.8,
		timeMultiplier: 0.8,
		hintDetail: "minimal",
	},
}

// 难度时间限制 (秒)
export const DIFFICULTY_TIME_LIMITS: Record<number, Record<UserLevel, number>> = {
	1: { beginner: 300, professional: 180, expert: 120, professor: 60 },
	2: { beginner: 420, professional: 300, expert: 180, professor: 120 },
	3: { beginner: 600, professional: 420, expert: 300, professor: 180 },
	4: { beginner: 900, professional: 600, expert: 420, professor: 300 },
	5: { beginner: 1200, professional: 900, expert: 600, professor: 420 },
}

// 评分配置
export const SCORING_CONFIG = {
	handwrittenBase: 1.0,
	aiGeneratedBase: 0.01,
	maxTimeBonus: 0.5,
	maxTimePenalty: 0.5,
	comboMultiplier: 0.2,
	maxCombo: 10,
}

// 默认设置
export const DEFAULT_SETTINGS: AncientSettings = {
	severityThreshold: 3,
	terminalMonitorEnabled: true,
	timePressureLevel: "standard",
	hintDetailLevel: "standard",
	soundEnabled: false,
	animationsEnabled: true,
}

// 初始成就列表
export const INITIAL_ACHIEVEMENTS: Achievement[] = [
	{
		id: "handwrite-master",
		name: "Handwrite Master",
		nameCN: "手写大师",
		description: "连续10次手写修复",
		icon: "🏆",
		reward: 10.0,
		progress: 0,
		total: 10,
		unlocked: false,
		type: "personal",
	},
	{
		id: "lightning-fast",
		name: "Lightning Fast",
		nameCN: "闪电手",
		description: "连续5次在时限50%内完成",
		icon: "⚡",
		reward: 8.0,
		progress: 0,
		total: 5,
		unlocked: false,
		type: "personal",
	},
	{
		id: "problem-slayer",
		name: "Problem Slayer",
		nameCN: "问题终结者",
		description: "修复100个错误",
		icon: "🗡️",
		reward: 15.0,
		progress: 0,
		total: 100,
		unlocked: false,
		type: "personal",
	},
	{
		id: "first-blood",
		name: "First Blood",
		nameCN: "初窥门径",
		description: "完成首次手写修复",
		icon: "🎯",
		reward: 1.0,
		progress: 0,
		total: 1,
		unlocked: false,
		type: "personal",
	},
]
```

---

### Step 1.3: 创建核心管理器

**文件**: `src/core/ancient/manager.ts`

```typescript
import * as vscode from "vscode"
import { ExtensionContext } from "vscode"
import { AncientModeState, AncientProblem, AncientUserProfile, ScoreEntry } from "./types"
import { DEFAULT_SETTINGS, INITIAL_ACHIEVEMENTS } from "./constants"

const STATE_KEY = "ancientProgrammingState"

export class AncientModeManager {
	private state: AncientModeState
	private context: ExtensionContext
	private onStateChangeEmitter = new vscode.EventEmitter<AncientModeState>()

	public readonly onStateChange = this.onStateChangeEmitter.event

	constructor(context: ExtensionContext) {
		this.context = context
		this.state = this.loadState()
	}

	private loadState(): AncientModeState {
		const savedState = this.context.globalState.get<AncientModeState>(STATE_KEY)
		return savedState || this.getDefaultState()
	}

	private getDefaultState(): AncientModeState {
		return {
			isInitialized: false,
			userProfile: null,
			currentScore: 0,
			scoreHistory: [],
			achievements: [...INITIAL_ACHIEVEMENTS],
			problems: [],
			settings: { ...DEFAULT_SETTINGS },
		}
	}

	private async saveState(): Promise<void> {
		await this.context.globalState.update(STATE_KEY, this.state)
		this.onStateChangeEmitter.fire(this.state)
	}

	public getState(): AncientModeState {
		return { ...this.state }
	}

	public async initializeUser(profile: AncientUserProfile): Promise<void> {
		this.state.userProfile = profile
		this.state.isInitialized = true
		await this.saveState()
	}

	public async recordFix(entry: ScoreEntry): Promise<void> {
		this.state.scoreHistory.push(entry)
		this.state.currentScore += entry.totalScore
		await this.updateAchievementProgress(entry)
		await this.saveState()
	}

	private async updateAchievementProgress(entry: ScoreEntry): Promise<void> {
		if (entry.fixType === "handwritten") {
			const handwriteMaster = this.state.achievements.find((a) => a.id === "handwrite-master")
			if (handwriteMaster && !handwriteMaster.unlocked) {
				handwriteMaster.progress++
				if (handwriteMaster.progress >= handwriteMaster.total) {
					handwriteMaster.unlocked = true
					handwriteMaster.unlockedAt = Date.now()
					this.state.currentScore += handwriteMaster.reward
				}
			}
		}
	}

	public dispose(): void {
		this.onStateChangeEmitter.dispose()
	}
}
```

---

### Step 1.4: 注册到 Extension

**修改**: `src/extension.ts`

```typescript
import { AncientModeManager } from "./core/ancient"

// 在 activate 函数中添加:
const ancientManager = new AncientModeManager(context)
context.subscriptions.push({ dispose: () => ancientManager.dispose() })

vscode.commands.registerCommand("roo-cline.openAncientMode", () => {
	vscode.window.showInformationMessage("古法编程模式已启动！🏮")
})
```

**修改**: `package.json`

```json
{
	"commands": [
		{
			"command": "roo-cline.openAncientMode",
			"title": "🏮 打开古法道场",
			"category": "Roo Code"
		}
	]
}
```

✅ **Week 1 验收**: 目录和类型创建完成，Manager 可实例化

---

## Phase 1B: 诊断收集系统 (Week 2)

### Step 2.1: 诊断收集器

**文件**: `src/core/ancient/diagnostics/collector.ts`

```typescript
import * as vscode from "vscode"
import { AncientProblem, ProblemSeverity } from "../types"

export class DiagnosticCollector {
	private disposables: vscode.Disposable[] = []
	private onProblemsChangeEmitter = new vscode.EventEmitter<AncientProblem[]>()
	public readonly onProblemsChange = this.onProblemsChangeEmitter.event

	constructor() {
		this.disposables.push(vscode.languages.onDidChangeDiagnostics(() => this.collectDiagnostics()))
		this.collectDiagnostics()
	}

	private collectDiagnostics(): void {
		const problems: AncientProblem[] = []
		vscode.languages.getDiagnostics().forEach(([uri, diagnostics]) => {
			diagnostics.forEach((diag, index) => {
				problems.push({
					id: `diag-${uri.fsPath}-${index}`,
					type: this.mapSeverity(diag.severity),
					message: diag.message,
					location: {
						file: vscode.workspace.asRelativePath(uri),
						line: diag.range.start.line + 1,
						column: diag.range.start.character + 1,
					},
					difficulty: this.calculateDifficulty(diag),
					hint: this.generateHint(diag),
					source: "diagnostic",
					isResolved: false,
				})
			})
		})
		this.onProblemsChangeEmitter.fire(problems)
	}

	private mapSeverity(severity?: vscode.DiagnosticSeverity): ProblemSeverity {
		switch (severity) {
			case vscode.DiagnosticSeverity.Error:
				return "critical"
			case vscode.DiagnosticSeverity.Warning:
				return "warning"
			default:
				return "info"
		}
	}

	private calculateDifficulty(diag: vscode.Diagnostic): 1 | 2 | 3 | 4 | 5 {
		const msg = diag.message.toLowerCase()
		if (msg.includes("unused")) return 1
		if (msg.includes("type") || msg.includes("cannot find")) return 2
		if (msg.includes("null")) return 3
		return 2
	}

	private generateHint(diag: vscode.Diagnostic): string {
		const msg = diag.message.toLowerCase()
		if (msg.includes("cannot find name")) return "检查变量是否已声明"
		if (msg.includes("type")) return "检查类型定义是否匹配"
		return "仔细阅读错误信息"
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose())
	}
}
```

---

### Step 2.2: 评分引擎

**文件**: `src/core/ancient/scoring/engine.ts`

```typescript
import { AncientProblem, ScoreEntry, UserLevel } from "../types"
import { SCORING_CONFIG, DIFFICULTY_TIME_LIMITS, USER_LEVEL_CONFIG } from "../constants"

export class ScoringEngine {
	private consecutiveHandwritten = 0

	public calculateScore(
		problem: AncientProblem,
		fixType: "handwritten" | "ai-generated",
		userLevel: UserLevel,
		timeSpent: number,
	): ScoreEntry {
		const levelConfig = USER_LEVEL_CONFIG[userLevel]

		let baseScore =
			fixType === "handwritten"
				? SCORING_CONFIG.handwrittenBase * problem.difficulty * levelConfig.scoreMultiplier
				: SCORING_CONFIG.aiGeneratedBase

		if (fixType === "handwritten") {
			this.consecutiveHandwritten++
		} else {
			this.consecutiveHandwritten = 0
		}

		const timeLimit = this.getTimeLimit(problem.difficulty, userLevel)
		const { timeBonus, timePenalty } = this.calculateTimeModifier(timeSpent, timeLimit)
		const comboBonus =
			Math.min(this.consecutiveHandwritten, SCORING_CONFIG.maxCombo) * SCORING_CONFIG.comboMultiplier

		return {
			timestamp: Date.now(),
			problemId: problem.id,
			fixType,
			baseScore,
			timeBonus: timeBonus + comboBonus,
			timePenalty,
			totalScore: Math.max(0, baseScore + timeBonus + timePenalty + comboBonus),
		}
	}

	public getTimeLimit(difficulty: number, userLevel: UserLevel): number {
		return (DIFFICULTY_TIME_LIMITS[difficulty]?.[userLevel] || 300) * 1000
	}

	private calculateTimeModifier(timeSpent: number, timeLimit: number) {
		if (timeSpent <= timeLimit * 0.5) {
			return { timeBonus: SCORING_CONFIG.maxTimeBonus, timePenalty: 0 }
		} else if (timeSpent <= timeLimit) {
			return { timeBonus: SCORING_CONFIG.maxTimeBonus * (1 - timeSpent / timeLimit), timePenalty: 0 }
		} else {
			const ratio = Math.min((timeSpent - timeLimit) / timeLimit, 1)
			return { timeBonus: 0, timePenalty: -SCORING_CONFIG.maxTimePenalty * ratio }
		}
	}
}
```

✅ **Week 2 验收**: 诊断可收集，评分计算正确

---

## Phase 1C: 前端 UI 基础 (Week 3)

### 核心组件

1. **SetupWizard.tsx** - 初始化向导（3步选择等级/语言/模式）
2. **ProblemList.tsx** - 问题列表（分组显示紧急/警告/建议）
3. **ScoreDisplay.tsx** - 分数显示（排名、连击、今日收益）
4. **useAncientMode.ts** - 状态管理 Hook

### UI 集成

- 添加到 Activity Bar 作为新图标
- 使用现有 VSCode 主题变量
- 通过 postMessage 与后端通信

✅ **Week 3 验收**: 向导可完成，问题列表显示，分数实时更新

---

## Phase 1D: 集成与测试 (Week 4)

### 单元测试

```typescript
// src/core/ancient/__tests__/scoring.test.ts
describe("ScoringEngine", () => {
	it("手写修复分数高于AI生成")
	it("快速完成有时间奖励")
	it("超时有惩罚")
	it("连击有奖励")
})
```

✅ **Week 4 验收**: MVP 可演示，核心功能正常

---

## Phase 2: 时间激励 + 成就系统 (Week 5-7)

| 任务              | 说明             |
| ----------------- | ---------------- |
| Timer 组件        | 倒计时，超时警告 |
| AchievementSystem | 成就解锁逻辑     |
| AchievementWall   | 成就展示         |
| Notification      | 解锁通知         |

---

## Phase 3: Git 协作集成 (Week 8-11)

| 任务            | 说明                      |
| --------------- | ------------------------- |
| GitAnalyzer     | 提交质量分析              |
| CommitQuality   | Conventional Commits 检查 |
| TeamLeaderboard | 本地排行榜                |
| LegacyDetector  | 技术债务评估              |

---

## 📋 验收检查清单

### MVP (Phase 1)

- [ ] 初始化向导完成
- [ ] 诊断错误显示
- [ ] 手写/AI评分差异
- [ ] 分数持久化
- [ ] 成就进度更新

### 完整版 (Phase 3)

- [ ] 时间限制功能
- [ ] 成就通知
- [ ] Git 提交分析
- [ ] 团队排行榜
