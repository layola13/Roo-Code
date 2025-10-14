# Code Indexing C++/Emscripten Implementation Plan

**创建时间**: 2025-10-14  
**状态**: 设计阶段  
**目标**: 使用C++和Emscripten重写代码索引模块，实现跨平台支持（VSCode, Unreal, Blender等）

## 1. 背景与动机

### 1.1 为什么不使用Rust？

- Tree-sitter的Rust绑定在WASM环境下存在兼容性问题
- C生态更成熟，官方支持更好
- Tree-sitter本身就是用C编写的

### 1.2 为什么不保留TypeScript？

- **跨平台需求**: 项目需要移植到Unreal Engine、Blender等非Web环境
- **统一技术栈**: 核心逻辑应该独立于运行环境
- **性能优化**: C++编译的WASM性能更优

## 2. 技术架构

### 2.1 核心组件

```
cpp-wasm/
├── code-indexing/
│   ├── src/
│   │   ├── parser.cpp           # Tree-sitter解析器包装
│   │   ├── query_engine.cpp     # 查询引擎
│   │   ├── language_loader.cpp  # 语言加载器
│   │   ├── bindings.cpp         # WASM绑定（Embind）
│   │   └── types.hpp            # 类型定义
│   ├── include/
│   │   └── code_indexing.hpp    # 公共API
│   ├── CMakeLists.txt           # CMake构建配置
│   └── README.md
├── tree-sitter-libs/            # Tree-sitter语言库
│   ├── tree-sitter-javascript/
│   ├── tree-sitter-typescript/
│   ├── tree-sitter-python/
│   └── ...
└── build.sh                      # 构建脚本
```

### 2.2 API设计

#### 2.2.1 主要接口

```cpp
namespace CodeIndexing {
    // 初始化解析器
    void init();

    // 解析单个文件
    std::string parseFile(
        const std::string& content,
        const std::string& language,
        int minComponentLines = 4
    );

    // 批量解析文件
    std::string parseFiles(
        const std::vector<FileInfo>& files,
        int minComponentLines = 4
    );

    // 加载语言解析器
    bool loadLanguage(const std::string& languageName);

    // 支持的语言列表
    std::vector<std::string> getSupportedLanguages();
}
```

#### 2.2.2 数据结构

```cpp
struct FileInfo {
    std::string path;
    std::string content;
    std::string language;
};

struct ParseResult {
    std::string filePath;
    std::string definitions;
    bool success;
    std::string error;
};
```

### 2.3 WASM绑定策略

使用**Embind**（Emscripten的C++绑定工具）：

```cpp
#include <emscripten/bind.h>

EMSCRIPTEN_BINDINGS(code_indexing) {
    emscripten::function("init", &CodeIndexing::init);
    emscripten::function("parseFile", &CodeIndexing::parseFile);
    emscripten::function("parseFiles", &CodeIndexing::parseFiles);
    emscripten::function("loadLanguage", &CodeIndexing::loadLanguage);
    emscripten::function("getSupportedLanguages", &CodeIndexing::getSupportedLanguages);

    emscripten::value_object<FileInfo>("FileInfo")
        .field("path", &FileInfo::path)
        .field("content", &FileInfo::content)
        .field("language", &FileInfo::language);

    emscripten::value_object<ParseResult>("ParseResult")
        .field("filePath", &ParseResult::filePath)
        .field("definitions", &ParseResult::definitions)
        .field("success", &ParseResult::success)
        .field("error", &ParseResult::error);
}
```

## 3. 实施计划

### Phase 1: 基础设施 (Week 1)

#### 3.1.1 设置构建环境

- [x] 安装Emscripten SDK
- [ ] 配置CMake构建系统
- [ ] 创建项目目录结构

#### 3.1.2 集成Tree-sitter核心

- [ ] 添加tree-sitter C库作为submodule
- [ ] 编写CMake配置编译tree-sitter
- [ ] 验证基础编译流程

#### 3.1.3 语言解析器集成

- [ ] 添加主要语言的tree-sitter解析器（JavaScript, TypeScript, Python, Rust, Go, C, C++）
- [ ] 配置语言库的编译
- [ ] 实现语言加载机制

### Phase 2: 核心功能实现 (Week 2-3)

#### 3.2.1 解析器包装器

```cpp
class TreeSitterParser {
private:
    TSParser* parser_;
    TSLanguage* language_;

public:
    TreeSitterParser(const std::string& languageName);
    ~TreeSitterParser();

    TSTree* parse(const std::string& content);
    std::vector<QueryCapture> query(TSTree* tree, const std::string& queryString);
};
```

#### 3.2.2 查询引擎

```cpp
class QueryEngine {
private:
    std::map<std::string, std::string> queryStrings_;

public:
    void loadQueries();
    std::string getQueryForLanguage(const std::string& language);
    std::vector<Capture> executeQuery(TSTree* tree, const std::string& queryString);
};
```

#### 3.2.3 定义提取器

```cpp
class DefinitionExtractor {
public:
    std::string extractDefinitions(
        const std::vector<Capture>& captures,
        const std::vector<std::string>& lines,
        const std::string& language,
        int minComponentLines
    );

private:
    bool isHtmlElement(const std::string& line, const std::string& language);
    std::string formatOutput(const std::vector<Definition>& definitions);
};
```

### Phase 3: WASM编译与优化 (Week 4)

#### 3.3.1 Emscripten编译选项

```cmake
set(EMSCRIPTEN_FLAGS
    -sALLOW_MEMORY_GROWTH=1
    -sEXPORT_ES6=1
    -sMODULARIZE=1
    -sEXPORT_NAME='CodeIndexingModule'
    -sENVIRONMENT=web,worker
    -sINITIAL_MEMORY=64MB
    -sMAXIMUM_MEMORY=2GB
    -sSTACK_SIZE=5MB
    --bind
    -O3
)
```

#### 3.3.2 大小优化策略

- 使用`-Os`或`-Oz`优化大小
- 启用`--closure 1`（Google Closure Compiler）
- 移除未使用的语言解析器
- 懒加载语言WASM模块

#### 3.3.3 性能优化

- 使用SIMD指令（如果可用）
- 启用线程支持（Web Workers）
- 内存池管理

### Phase 4: TypeScript集成 (Week 5)

#### 3.4.1 TypeScript绑定生成

```typescript
// bindings/code-indexing.ts
import CodeIndexingModule from "./code-indexing.js"

export interface FileInfo {
	path: string
	content: string
	language: string
}

export interface ParseResult {
	filePath: string
	definitions: string
	success: boolean
	error?: string
}

class CodeIndexing {
	private module: any

	async init(): Promise<void> {
		this.module = await CodeIndexingModule()
		this.module.init()
	}

	parseFile(content: string, language: string, minComponentLines: number = 4): string {
		return this.module.parseFile(content, language, minComponentLines)
	}

	parseFiles(files: FileInfo[], minComponentLines: number = 4): ParseResult[] {
		return this.module.parseFiles(files, minComponentLines)
	}

	loadLanguage(languageName: string): boolean {
		return this.module.loadLanguage(languageName)
	}

	getSupportedLanguages(): string[] {
		return this.module.getSupportedLanguages()
	}
}

export default CodeIndexing
```

#### 3.4.2 替换现有TypeScript实现

1. 创建新的服务包装器：`src/services/tree-sitter-wasm/index.ts`
2. 保持相同的API接口
3. 逐步迁移调用点
4. 删除旧的TypeScript实现

### Phase 5: 测试与验证 (Week 6)

#### 3.5.1 单元测试（C++）

- 使用Google Test框架
- 测试解析器初始化
- 测试各语言的解析功能
- 测试查询引擎
- 测试定义提取

#### 3.5.2 集成测试（TypeScript）

- 移植现有的`__tests__/`测试
- 验证与现有功能的兼容性
- 性能基准测试
- 内存泄漏检测

#### 3.5.3 跨平台验证

- VSCode环境测试
- Node.js环境测试
- 浏览器环境测试（如果适用）

## 4. 技术挑战与解决方案

### 4.1 挑战：Tree-sitter语言库编译

**问题**: 每个语言解析器都是独立的C库，需要编译为WASM

**解决方案**:

1. 为每个语言创建独立的CMakeLists.txt
2. 使用Emscripten编译每个语言库为静态库（.a）
3. 在主项目中链接所有语言库
4. 或者：动态加载语言WASM模块（懒加载策略）

### 4.2 挑战：查询字符串管理

**问题**: 目前查询字符串存储在TypeScript中（`queries/`目录）

**解决方案**:

1. **选项A**: 将查询字符串嵌入C++代码（constexpr字符串）
2. **选项B**: 在运行时从JavaScript传入查询字符串
3. **推荐**: 选项A，查询字符串编译时确定

### 4.3 挑战：WASM模块大小

**问题**: Tree-sitter + 所有语言解析器可能导致WASM体积过大

**解决方案**:

1. **分割策略**: 将每个语言编译为独立的WASM模块
2. **懒加载**: 仅在需要时加载特定语言
3. **压缩**: 使用Brotli/Gzip压缩WASM文件
4. **优化**: 移除调试信息，启用LTO（Link Time Optimization）

### 4.4 挑战：内存管理

**问题**: C++和JavaScript之间的内存边界

**解决方案**:

1. 使用Embind的自动内存管理
2. 明确所有权语义（谁负责释放内存）
3. 使用RAII模式管理资源
4. 提供明确的cleanup接口

## 5. 性能目标

### 5.1 WASM大小

- **核心模块**: < 500KB
- **单个语言模块**: < 200KB
- **总计（所有语言）**: < 5MB（压缩后 < 2MB）

### 5.2 解析性能

- **小文件（<100行）**: < 10ms
- **中等文件（100-1000行）**: < 50ms
- **大文件（1000-10000行）**: < 200ms

### 5.3 内存使用

- **初始堆大小**: 64MB
- **峰值内存**: < 500MB（解析大量文件时）

## 6. 兼容性保证

### 6.1 API兼容性

- 保持与现有TypeScript API的100%兼容性
- 确保所有现有测试通过
- 不破坏任何调用点

### 6.2 功能兼容性

- 支持所有当前支持的语言
- 保持相同的查询逻辑
- 生成相同格式的输出

## 7. 风险评估

| 风险               | 可能性 | 影响 | 缓解策略             |
| ------------------ | ------ | ---- | -------------------- |
| Emscripten编译问题 | 中     | 高   | 充分的POC验证        |
| 性能不达标         | 低     | 中   | 早期性能测试         |
| WASM大小超标       | 中     | 中   | 分模块加载策略       |
| 内存泄漏           | 中     | 高   | 严格的测试和工具检测 |
| 跨平台兼容性       | 低     | 高   | 多环境测试           |

## 8. 下一步行动

### 立即执行（本周）:

1. ✅ 完成设计文档
2. [ ] 创建`cpp-wasm/code-indexing`目录结构
3. [ ] 设置CMake构建系统
4. [ ]
