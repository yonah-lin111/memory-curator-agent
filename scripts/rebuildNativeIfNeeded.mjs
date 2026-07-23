#!/usr/bin/env node

import { spawnSync } from "node:child_process"

// 原生模块名。
const nativeModuleName = "better-sqlite3"

// 当前支持的目标运行时。
const supportedTargets = new Set(["electron", "node"])

// 用户传入的目标运行时。
const target = process.argv[2]

// pnpm 可执行命令。
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

// Electron 无 GUI 探测环境。
const electronProbeEnv = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: "1",
}

/**
 * 输出错误并退出。
 */
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

/**
 * 执行子命令。
 */
const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    ...options,
  })

/**
 * 静默探测目标运行时能否加载原生模块。
 */
const canLoadNativeModule = () => {
  const script = `const Database = require('${nativeModuleName}'); new Database(':memory:').close()`

  if (target === "node") {
    const result = run(process.execPath, ["-e", script], { stdio: "ignore" })
    return result.status === 0
  }

  const result = run(pnpmCommand, ["exec", "electron", "-e", script], {
    env: electronProbeEnv,
    stdio: "ignore",
  })
  return result.status === 0
}

/**
 * 按目标运行时强制重建原生模块。
 */
const rebuildNativeModule = () => {
  if (target === "node") {
    return run(pnpmCommand, ["rebuild", nativeModuleName])
  }

  return run(pnpmCommand, [
    "exec",
    "electron-rebuild",
    "-f",
    "-w",
    nativeModuleName,
    "--build-from-source",
  ])
}

if (!supportedTargets.has(target)) {
  fail("用法: node scripts/rebuildNativeIfNeeded.mjs <electron|node>")
}

if (canLoadNativeModule()) {
  console.log(`${nativeModuleName} already matches ${target} runtime; skip rebuild.`)
  process.exit(0)
}

console.log(`${nativeModuleName} does not match ${target} runtime; rebuilding...`)

const rebuildResult = rebuildNativeModule()

if (rebuildResult.status !== 0) {
  process.exit(rebuildResult.status ?? 1)
}
