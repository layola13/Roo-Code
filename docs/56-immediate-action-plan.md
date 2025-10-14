# Rust+WASM 迁移 - 立即行动方案

**创建时间**: 2025-10-13  
**目标**: 明确当前任务的具体执行步骤

---

## 📊 当前状态

### ✅ 已完成（Week 1-4）

1. **阶段0**: 项目准备与评估（100%）

    - 13个技术文档
    - POC验证成功
    - 工具链搭建完成

2. **任务1.1**: Task Engine（100%）

    - 800行Rust代码
    - 16个测试通过
    - WASM构建成功

3. **任务1.2**: API Integration（100%）
    - 1,894行Rust代码
    - 23个测试通过
    - WASM大小: 18KB ✨

**累计完成**: ~2,700行Rust代码，39个测试

---

## 🎯 下一个任务：Tools System（工具系统）

### 为什么是这个任务？

1. **用户明确要求**: "务必要涉及 任务系统，代码块索引，对话，**工具调用**等等"
2. **核心功能**: 工具系统是AI Agent的核心，没有它就无法执行任何操作
3. **依赖关系**: Conversation和Memory依赖Tools System的输出

### 任务分解

#### 第一阶段：基础框架（3-4天）

**目标**: 建立工具定义和类型系统

```
rust-wasm/tools/
├── Cargo.toml
└── src/
    ├── lib.rs          # 模块入口 + WASM导出
    ├── types.rs        # 工具类型定义
    ├── error.rs        # 错误处理
    └── registry.rs     # 工具注册表
```

**核心类型**:

```rust
// types.rs
pub enum ToolName {
    ExecuteCommand,
    ReadFile,
    WriteToFile,
    ApplyDiff,
    SearchFiles,
    ListFiles,
    CodebaseSearch,
    // ... 共24种工具
}

pub struct ToolUse {
    pub name: ToolName,
    pub params: HashMap<String, String>,
    pub partial: bool,
}

pub enum ToolGroup {
    Read,
    Edit,
    Browser,
    Command,
    Mcp,
    Modes,
}
```

**输出**:

- ~500行Rust代码
- 10+单元测试
- WASM API: `create_tool_use()`, `validate_tool()`, `get_tool_info()`

#### 第二阶段：工具验证和历史（2-3天）

**目标**: 工具参数验证、权限检查、调用历史

```
rust-wasm/tools/src/
├── validator.rs        # 参数验证
├── permissions.rs      # 权限检查（基于模式）
└── history.rs         # 调用历史管理
```

**核心功能**:

```rust
// validator.rs
pub fn validate_tool_params(
    tool_name: &ToolName,
    params: &HashMap<String, String>
) -> Result<(), ToolError>;

// permissions.rs
pub fn is_tool_allowed(
    tool_name: &ToolName,
    mode: &str
) -> bool;

// history.rs
pub struct ToolHistory {
    calls: VecDeque<ToolCall>,
    max_size: usize,
}
```

**输出**:

- ~400行Rust代码
- 10+单元测试

#### 第三阶段：重复检测和统计（1-2天）

**目标**: 防止工具重复调用、执行统计

```
rust-wasm/tools/src/
├── repetition.rs      # 重复检测
└── stats.rs          # 统计信息
```

**参考**: `src/core/tools/ToolRepetitionDetector.ts`

**输出**:

- ~300行Rust代码
- 8+单元测试

#### 第四阶段：集成测试和优化（1天）

**目标**: 完整测试覆盖，WASM构建优化

**输出**:

- 测试覆盖率 ≥ 80%
- WASM大小验证

---

## 📋 详细执行步骤

### Step 1: 创建项目结构

```bash
cd rust-wasm
mkdir -p tools/src
cd tools
```

创建 `Cargo.toml`:

```toml
[package]
name = "roo-tools"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

### Step 2: 工具类型定义

创建 `src/types.rs` - 定义所有24种工具类型

### Step 3: 工具注册表

创建 `src/registry.rs` - 管理工具定义和元数据

### Step 4: 错误处理

创建 `src/error.rs` - 统一错误类型

### Step 5: 单元测试

为每个模块编写测试，确保覆盖率 ≥ 80%

### Step 6: WASM导出

在 `src/lib.rs` 中导出WASM API

### Step 7: 构建验证

```bash
cd rust-wasm
./scripts/build-all.sh
ls -lh wasm-dist/tools/*.wasm
```

---

## ⏱️ 时间估算

- **第一阶段**: 3-4天
- **第二阶段**: 2-3天
- **第三阶段**: 1-2天
- **第四阶段**: 1天

**总计**: 7-10天

---

## ✅ 验收标准

1. ✅ 所有24种工具都有类型定义
2. ✅ 工具参数验证完整
3. ✅ 权限检查支持所有模式
4. ✅ 工具历史管理功能完整
5. ✅ 重复检测算法正确
6. ✅ 单元测试覆盖率 ≥ 80%
7. ✅ 所有测试通过
8. ✅ WASM构建成功
9. ✅ WASM大小 < 50KB（单独模块）

---

## 🚦 决策点

### 问题1: 是否立即开始Tools System？

**选项A**: 是，按照上述计划开始

- ✅ 优势: 符合用户要求，是核心功能
- ⚠️ 注意: 需要7-10天持续投入

**选项B**: 先完成其他准备工作

- 重新评估优先级
- 更新技术方案

### 问题2: 工具实现的范围？

**选项A**: 完整实现所有24种工具

- 工作量大，但一次到位

**选项B**: 分阶段实现

- 第1批: 核心工具（read_file, write_to_file, execute_command等）
- 第2批: 扩展工具（browser, mcp等）

### 问题3: 是否需要先建立Host Interface？

**当前计划**: 先实现Rust逻辑，后建立接口
**备选方案**: 先定义完整的Host Interface

---

## 💡 建议

根据用户的明确要求（"务必要涉及 任务系统，代码块索引，对话，工具调用"），建议：

1. **立即开始Tools System**
2. **采用分阶段实现**（选项B）- 先核心工具，后扩展工具
3. **并行准备Host Interface定义** - 在实现过程中逐步明确接口需求

这样可以：

- ✅ 满足用户核心需求
- ✅ 控制单次任务复杂度
- ✅ 保持迭代速度
- ✅ 及时获得反馈

---

## 📝 下一步行动

**等待用户确认**:

1. 是否开始Tools System实现？
2. 选择哪种实现范围（完整/分阶段）？
3. 是否需要先定义Host Interface？

**确认后立即开始**:

- 创建项目结构
- 实现工具类型定义
- 编写单元测试
- 持续WASM构建验证
