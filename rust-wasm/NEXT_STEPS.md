# Rust+WASM Integration - Next Steps

**Last Updated**: 2025-10-14  
**Current Phase**: Phase 1 - Rust Module Integration  
**Status**: Planning Complete, Ready for Implementation

---

## 📍 Current Status

### ✅ Completed

- 5 Rust modules implemented (~7,121 lines, 113+ tests)
    - Task Engine
    - API Integration
    - Tools System
    - Conversation System
    - Memory System
- Architecture decisions documented
- Detailed implementation roadmap created

### ⏳ Next: Task 1.7 - WASM Integration (1-2 weeks)

---

## 🚀 Quick Start

### Prerequisites

- Rust 1.70+ with wasm32-unknown-unknown target
- wasm-pack 0.13+
- Node.js 18+
- wasm-opt (optional, for optimization)

### Install Missing Tools

```bash
# Install Rust target
rustup target add wasm32-unknown-unknown

# Verify wasm-pack
wasm-pack --version

# Install wasm-opt (optional)
cargo install wasm-opt
```

---

## 📋 Task 1.7 Checklist

### 1.7.1: Create Unified WASM Workspace Config (2-4 hours)

**Goal**: Set up the main crate to aggregate all modules

**Steps**:

1. Review current `rust-wasm/Cargo.toml` (workspace config ✅)
2. Check if `rust-wasm/src/lib.rs` needs `[package]` section
3. Add missing dependencies:
    ```toml
    [dependencies]
    wasm-bindgen = { workspace = true }
    console_error_panic_hook = "0.1"
    serde = { workspace = true }
    serde_json = { workspace = true }
    serde-wasm-bindgen = "0.6"
    js-sys = { workspace = true }
    ```
4. Verify all module re-exports in `src/lib.rs`
5. Test compilation: `cargo check`

**Output**: ✅ Compilable workspace

---

### 1.7.2: Build All Rust Modules as WASM (4-8 hours)

**Goal**: Generate WASM binary and JS/TS bindings

**Steps**:

1. Clean previous builds:

    ```bash
    cd rust-wasm
    cargo clean
    rm -rf wasm-dist pkg
    ```

2. Build with wasm-pack:

    ```bash
    wasm-pack build \
      --target web \
      --out-dir wasm-dist \
      --release \
      --scope roo
    ```

3. Verify outputs:

    ```bash
    ls -lh wasm-dist/
    # Expected:
    # - roo_code_bg.wasm (WASM binary)
    # - roo_code.js (JS bindings)
    # - roo_code.d.ts (TS types)
    # - package.json
    ```

4. Check WASM size:
    ```bash
    ls -lh wasm-dist/*.wasm
    # Target: <2MB
    ```

**Output**: ✅ Built WASM module

---

### 1.7.3: Optimize WASM Size (4-6 hours)

**Goal**: Reduce WASM size to <2MB

**Steps**:

1. Analyze current size:

    ```bash
    ls -lh wasm-dist/*.wasm
    wasm-opt --version || cargo install wasm-opt
    ```

2. Apply optimization:

    ```bash
    wasm-opt -Oz \
      wasm-dist/roo_code_bg.wasm \
      -o wasm-dist/roo_code_optimized.wasm

    # Compare sizes
    ls -lh wasm-dist/*.wasm
    ```

3. If still too large, analyze dependencies:

    ```bash
    cargo tree --target wasm32-unknown-unknown
    # Look for unexpectedly large dependencies
    ```

4. Consider splitting into smaller modules (if needed)

**Output**: ✅ Optimized WASM (<2MB)

---

### 1.7.4: Performance Benchmarking (4-6 hours)

**Goal**: Measure performance vs TypeScript implementation

**Steps**:

1. Create benchmark script:

    ```typescript
    // benchmarks/wasm-vs-ts.ts
    import { RooCodeWasm } from "../wasm-dist"

    async function benchmark() {
    	const wasm = await RooCodeWasm.init()

    	// Test Task Engine
    	console.time("Task Engine - Create 100 tasks")
    	for (let i = 0; i < 100; i++) {
    		wasm.createTask({
    			/* ... */
    		})
    	}
    	console.timeEnd("Task Engine - Create 100 tasks")

    	// Add more benchmarks...
    }
    ```

2. Run benchmarks:

    ```bash
    node benchmarks/wasm-vs-ts.ts
    ```

3. Document results in `benchmarks/RESULTS.md`

**Output**: ✅ Performance report

---

### 1.7.5: Generate TypeScript Bindings (6-8 hours)

**Goal**: Create ergonomic TypeScript API

**Steps**:

1. Create TypeScript wrapper:

    ```typescript
    // bindings/index.ts
    import init, * as wasm from "../wasm-dist/roo_code.js"

    export class RooCodeWasm {
    	private static instance: RooCodeWasm | null = null
    	private initialized = false

    	private constructor() {}

    	static async getInstance(): Promise<RooCodeWasm> {
    		if (!RooCodeWasm.instance) {
    			RooCodeWasm.instance = new RooCodeWasm()
    			await RooCodeWasm.instance.init()
    		}
    		return RooCodeWasm.instance
    	}

    	private async init(): Promise<void> {
    		if (!this.initialized) {
    			await init()
    			this.initialized = true
    		}
    	}

    	// Module accessors
    	get taskEngine() {
    		return wasm.TaskEngine
    	}
    	get apiIntegration() {
    		return wasm.ApiIntegration
    	}
    	get tools() {
    		return wasm.Tools
    	}
    	get conversation() {
    		return wasm.Conversation
    	}
    	get memory() {
    		return wasm.Memory
    	}
    }
    ```

2. Add JSDoc comments
3. Create usage examples: `examples/basic-usage.ts`
4. Generate API documentation

**Output**: ✅ TypeScript bindings + docs

---

### 1.7.6: Integrate into Main Project (8-12 hours)

**Goal**: Replace TypeScript implementations with WASM

**Steps**:

1. Copy WASM files:

    ```bash
    mkdir -p src/core/wasm
    cp -r rust-wasm/wasm-dist/* src/core/wasm/
    cp rust-wasm/bindings/* src/core/wasm/bindings/
    ```

2. Create integration layer:

    ```typescript
    // src/core/wasm/index.ts
    import { RooCodeWasm } from "./bindings"

    let wasmInstance: RooCodeWasm | null = null

    export async function getWasmCore(): Promise<RooCodeWasm> {
    	if (!wasmInstance) {
    		wasmInstance = await RooCodeWasm.getInstance()
    	}
    	return wasmInstance
    }

    export { RooCodeWasm }
    ```

3. Update existing code to use WASM:

    ```typescript
    // Example: src/core/task/TaskManager.ts
    import { getWasmCore } from "../wasm"

    export class TaskManager {
    	private wasm: RooCodeWasm | null = null

    	async init() {
    		this.wasm = await getWasmCore()
    	}

    	async createTask(config: TaskConfig) {
    		return this.wasm!.taskEngine.create(config)
    	}
    }
    ```

4. Run all tests:

    ```bash
    cd src
    npx vitest run
    ```

5. Run integration tests
6. Performance validation
7. Final checks:
    ```bash
    pnpm check-types
    pnpm clean
    pnpm build
    pnpm vsix
    ```

**Output**: ✅ Fully integrated WASM module, all tests passing

---

## 📚 Reference Documents

- **Architecture Decisions**:

    - `docs/58-code-indexing-architecture-decision.md`
    - `docs/60-code-indexing-cpp-implementation-roadmap.md`

- **Implementation Plans**:

    - `docs/59-code-indexing-cpp-emscripten-implementation.md`
    - `docs/61-rust-wasm-integration-session-summary.md`

- **Session Summary**:
    - `docs/62-session-final-summary.md`

---

## 🎯 Phase 2 Preview: C++ Code Indexing (After Phase 1)

**Timeline**: 3-4 weeks after Rust integration  
**Goal**: Replace TypeScript code indexing with C++/Emscripten + Tree-sitter

See `docs/59-code-indexing-cpp-emscripten-implementation.md` for details.

---

## ⚠️ Important Notes

1. **上下文限制**: 会话只有120K token，分批处理文件
2. **测试要求**: 所有代码变更必须有测试覆盖
3. **完成标准**: 全部完成，不是部分完成
4. **原子化JSON写入**: 必须使用`safeWriteJson`

---

## 🐛 Troubleshooting

### WASM Build Fails

```bash
# Check Rust target
rustup target list | grep wasm32

# Install if missing
rustup target add wasm32-unknown-unknown

# Clean and rebuild
cargo clean
wasm-pack build --target web --out-dir wasm-dist --release
```

### WASM Size Too Large

```bash
# Use aggressive optimization
wasm-opt -Oz input.wasm -o output.wasm

# Check dependency sizes
cargo tree --target wasm32-unknown-unknown -e normal

# Consider splitting modules
```

### TypeScript Types Not Generated

```bash
# wasm-pack should generate .d.ts automatically
# If missing, check wasm-pack version
wasm-pack --version

# Update if needed
cargo install wasm-pack --force
```

---

## 📞 Support

- **Project Documentation**: `docs/` directory
- **Rust Modules**: `rust-wasm/` directory
- **Coding Standards**: `rust-wasm/CODING_STANDARDS.md`

---

**Ready to start?** Begin with Task 1.7.1! 🚀
