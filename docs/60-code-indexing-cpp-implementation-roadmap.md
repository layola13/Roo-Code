# Code Indexing C++/Emscripten Implementation Roadmap

**创建时间**: 2025-10-14  
**方案**: 方案C - 完全独立的C++/WASM实现  
**预计工作量**: 3-4周  
**状态**: 规划阶段

## 执行策略

### 关键决策

用户确认使用**方案C**：真正跨平台的C++/WASM实现，可移植到Unreal Engine、Blender等环境。

### 工作量评估

| 阶段     | 任务                      | 预计时间    | 复杂度 |
| -------- | ------------------------- | ----------- | ------ |
| Phase 1  | 集成Tree-sitter C库       | 3-5天       | 高     |
| Phase 2  | 编译语言解析器（30+语言） | 5-7天       | 高     |
| Phase 3  | C++业务逻辑实现           | 5-7天       | 中     |
| Phase 4  | WASM编译和优化            | 3-5天       | 高     |
| Phase 5  | TypeScript集成和测试      | 3-5天       | 中     |
| **总计** |                           | **19-29天** |        |

### 风险评估

- ⚠️ **Tree-sitter编译复杂性**: 每个语言解析器都是独立的C库，需要正确的构建配置
- ⚠️ **WASM体积控制**: 所有语言打包后可能超过10MB
- ⚠️ **Emscripten兼容性**: 某些C标准库功能可能不可用
- ⚠️ **调试难度**: WASM调试比TypeScript困难得多

## 建议：分阶段实施策略

### 策略A：立即开始完整实施（推荐度：⭐⭐）

**优点**：

- 一次性完成，彻底解决跨平台问题

**缺点**：

- 耗时3-4周，阻塞其他任务
- 风险高，可能遇到技术障碍
- 其他5个Rust模块已完成但未集成

### 策略B：先完成Rust模块集成，再做代码索引（推荐度：⭐⭐⭐⭐⭐）

**优点**：

- 先交付5个已完成的Rust模块（Task Engine, API, Tools, Conversation, Memory）
- 验证WASM集成流程
- 代码索引可以继续使用TypeScript实现（暂时）
- 降低风险，分散工作负载

**缺点**：

- 代码索引仍需后续迁移

### 策略C：最小POC验证 + 并行开发（推荐度：⭐⭐⭐）

**优点**：

- 用1周时间验证C++/Tree-sitter/WASM可行性
- 如果失败，及时调整策略
- 可以与其他任务并行

**缺点**：

- 需要额外的协调工作

## 推荐方案：策略B

### 理由

1. **已完成的工作价值最大化**

    - 5个Rust模块已完成（约6,000行代码，113个测试）
    - 应该先集成和交付，验证价值

2. **风险管理**

    - C++/Tree-sitter重写是高风险任务
    - 不应阻塞已完成的工作

3. **用户需求优先级**

    - 任务系统、API集成、工具调用、对话、记忆是核心功能
    - 代码索引虽然重要，但不是最紧急的

4. **技术债务可控**
    - TypeScript代码索引已经使用web-tree-sitter（也是WASM）
    - 功能完整且稳定
    - 可以作为"Phase 2"任务延后

### 执行计划

#### Week 1-2: 任务1.7 - Rust WASM模块集成

1. 创建统一的WASM workspace配置
2. 优化WASM大小（<2MB总计）
3. 性能基准测试
4. 生成TypeScript绑定
5. 集成到现有代码库

#### Week 3-4: 任务1.8 - C++代码索引POC

1. 搭建基础框架（CMake + Emscripten）
2. 集成Tree-sitter核心库
3. 实现JavaScript解析（单一语言POC）
4. 验证WASM编译和性能
5. 评估是否继续全面实施

#### Week 5-8: 任务1.9 - C++代码索引完整实现（如果POC成功）

1. 集成所有语言解析器
2. 实现完整业务逻辑
3. WASM优化和测试
4. TypeScript集成
5. 替换现有实现

## 立即行动项

### 选项1：继续Code Indexing C++实现（当前任务）

- 承诺：3-4周完整交付
- 风险：阻塞其他工作

### 选项2：切换到Rust模块集成（任务1.7）

- 承诺：1-2周完成5个模块的集成
- 收益：立即可用的核心功能

### 选项3：最小POC（1周）

- 承诺：验证技术可行性
- 决策点：根据POC结果决定下一步

## 用户决策点

**问题**：考虑到以下情况，您希望如何继续？

1. **5个Rust模块已完成但未集成**（Task Engine, API, Tools, Conversation, Memory）
2. **C++代码索引重写需要3-4周**
3. **当前TypeScript代码索引功能完整且稳定**

**建议**：

- **优先完成任务1.7**（Rust模块集成），然后再做代码索引C++重写
- 这样可以：
    - ✅ 先交付已完成的5个核心模块
    - ✅ 验证WASM集成流程（为代码索引积累经验）
    - ✅ 降低项目整体风险
    - ✅ 分阶段交付价值

## 成本效益分析

### 立即做C++代码索引

- **投入**: 3-4周全职工作
- **产出**: 跨平台代码索引模块
- **机会成本**: 延迟5个已完成模块的交付

### 先做Rust模块集成

- **投入**: 1-2周工作
- **产出**: 5个核心WASM模块可用
- **额外收益**: 为代码索引C++实现积累经验

### 推荐：两阶段方法

1. **Phase 1** (Week 1-2): 完成Rust模块集成
2. **Phase 2** (Week 3+): C++代码索引实现

**总投入**: 4-6周  
**总产出**: 6个跨平台模块（5 Rust + 1 C++）  
**风险**: 低（分阶段，可控）

---

## 附录：如果选择立即实施C++代码索引

### Step 1: 添加Tree-sitter作为git submodule

```bash
cd cpp-wasm
git submodule add https://github.com/tree-sitter/tree-sitter.git
git submodule add https://github.com/tree-sitter/tree-sitter-javascript.git tree-sitter-libs/javascript
git submodule add https://github.com/tree-sitter/tree-sitter-typescript.git tree-sitter-libs/typescript
# ... (30+ 更多语言)
```

### Step 2: 创建CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.15)
project(code_indexing)

set(CMAKE_CXX_STANDARD 17)

# Emscripten特定设置
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
    add_compile_options(
        -sALLOW_MEMORY_GROWTH=1
        -sEXPORT_ES6=1
        -sMODULARIZE=1
        --bind
    )
endif()

# Tree-sitter核心库
add_subdirectory(tree-sitter)

# 语言解析器
add_subdirectory(tree-sitter-libs/javascript)
# ...

# 主模块
add_executable(code_indexing
    src/parser.cpp
    src/query_engine.cpp
    src/bindings.cpp
)

target_link_libraries(code_indexing
    tree-sitter
    tree-sitter-javascript
    # ...
)
```

### Step 3-N: 详见docs/59-code-indexing-cpp-emscripten-implementation.md

---

**下一步**: 等待用户决策
