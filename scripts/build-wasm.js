#!/usr/bin/env node

/**
 * Build script for Rust WASM modules
 *
 * This script:
 * 1. Compiles all Rust WASM modules using wasm-pack
 * 2. Merges type definitions into a unified file
 * 3. Handles both development and production builds
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Colors for console output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
}

function log(message, color = colors.reset) {
	console.log(`${color}${message}${colors.reset}`)
}

function checkRustInstalled() {
	try {
		execSync("rustc --version", { stdio: "pipe" })
		return true
	} catch (error) {
		return false
	}
}

function checkWasmPackInstalled() {
	try {
		execSync("wasm-pack --version", { stdio: "pipe" })
		return true
	} catch (error) {
		return false
	}
}

function buildWasmModule(moduleName, modulePath) {
	log(`\n${colors.bright}Building ${moduleName}...${colors.reset}`, colors.cyan)

	const moduleDir = path.join(__dirname, "..", modulePath)

	if (!fs.existsSync(moduleDir)) {
		log(`❌ Module directory not found: ${moduleDir}`, colors.red)
		return false
	}

	try {
		// Check if Cargo.toml exists
		const cargoToml = path.join(moduleDir, "Cargo.toml")
		if (!fs.existsSync(cargoToml)) {
			log(`⚠️  Cargo.toml not found in ${moduleName}, skipping`, colors.yellow)
			return false
		}

		// Build mode: release for production, dev for development
		const isRelease = process.argv.includes("--release") || process.env.NODE_ENV === "production"
		const buildMode = isRelease ? "--release" : "--dev"

		log(`  Running: wasm-pack build ${buildMode} --target web`, colors.cyan)
		execSync(`wasm-pack build ${buildMode} --target web --out-dir wasm-dist/${moduleName}`, {
			cwd: moduleDir,
			stdio: "inherit",
		})

		log(`✅ ${moduleName} built successfully`, colors.green)
		return true
	} catch (error) {
		log(`❌ Failed to build ${moduleName}: ${error.message}`, colors.red)
		return false
	}
}

function mergeTypeDefinitions() {
	log(`\n${colors.bright}Merging type definitions...${colors.reset}`, colors.cyan)

	try {
		// Run the merge-wasm-types.js script
		execSync("node scripts/merge-wasm-types.js", {
			cwd: path.join(__dirname, ".."),
			stdio: "inherit",
		})
		log(`✅ Type definitions merged successfully`, colors.green)
		return true
	} catch (error) {
		log(`❌ Failed to merge type definitions: ${error.message}`, colors.red)
		return false
	}
}

function main() {
	log(`\n${colors.bright}=== Building Rust WASM Modules ===${colors.reset}`, colors.cyan)

	// Check prerequisites
	if (!checkRustInstalled()) {
		log("\n❌ Rust is not installed!", colors.red)
		log("Please install Rust from: https://rustup.rs/", colors.yellow)
		log("After installation, restart your terminal and run this script again.", colors.yellow)
		process.exit(1)
	}

	if (!checkWasmPackInstalled()) {
		log("\n❌ wasm-pack is not installed!", colors.red)
		log("Please install wasm-pack:", colors.yellow)
		log("  cargo install wasm-pack", colors.yellow)
		process.exit(1)
	}

	log("✅ Rust toolchain detected", colors.green)

	// Get Rust version
	try {
		const rustVersion = execSync("rustc --version", { encoding: "utf8" })
		const wasmPackVersion = execSync("wasm-pack --version", { encoding: "utf8" })
		log(`   ${rustVersion.trim()}`, colors.cyan)
		log(`   ${wasmPackVersion.trim()}`, colors.cyan)
	} catch (error) {
		// Ignore version check errors
	}

	// WASM modules to build
	const modules = [
		{ name: "task-engine", path: "rust-wasm/task-engine" },
		{ name: "tools", path: "rust-wasm/tools" },
		{ name: "api-integration", path: "rust-wasm/api-integration" },
		{ name: "conversation", path: "rust-wasm/conversation" },
		{ name: "memory", path: "rust-wasm/memory" },
	]

	let successCount = 0
	let failCount = 0

	// Build each module
	for (const module of modules) {
		if (buildWasmModule(module.name, module.path)) {
			successCount++
		} else {
			failCount++
		}
	}

	// Merge type definitions if all builds succeeded
	if (failCount === 0) {
		if (!mergeTypeDefinitions()) {
			failCount++
		}
	}

	// Summary
	log(`\n${colors.bright}=== Build Summary ===${colors.reset}`, colors.cyan)
	log(`✅ Successfully built: ${successCount} modules`, colors.green)
	if (failCount > 0) {
		log(`❌ Failed: ${failCount}`, colors.red)
		log("\n⚠️  Some modules failed to build. Please check the errors above.", colors.yellow)
	} else {
		log("\n🎉 All WASM modules built successfully!", colors.green)
		log("   Type definitions merged into wasm-dist/roo_core_wasm.d.ts", colors.cyan)
	}

	// Exit with error code if any builds failed
	if (failCount > 0) {
		process.exit(1)
	}
}

// Run the build
main()
