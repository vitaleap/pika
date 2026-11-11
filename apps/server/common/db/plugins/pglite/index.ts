/// <reference types='./types.d.ts' />

import { resolve } from 'node:path'
import { PGlite, type PGliteOptions } from '@electric-sql/pglite'

import { acquireDirLock } from './lock'

import wasmPath from '@electric-sql/pglite/pglite.wasm' with {
  type: 'file',
  embed: 'true',
}

import initdbWasmPath from '@electric-sql/pglite/initdb.wasm' with {
  type: 'file',
  embed: 'true',
}

import dataPath from '@electric-sql/pglite/pglite.data' with {
  type: 'file',
  embed: 'true',
}

/** 内存 / IndexedDB 文件系统不共享目录，不需要加锁 */
const isVirtualDataDir = (dataDir: string) =>
  dataDir.startsWith('memory://') || dataDir.startsWith('idb://')

export async function createPGlite(dataDir: string, options?: PGliteOptions): Promise<PGlite> {
  if (isVirtualDataDir(dataDir)) {
    return createInstance(dataDir, options)
  }

  // PGlite 不会自动创建父目录，加锁时会顺带创建
  const absoluteDataDir = resolve(dataDir)
  const release = await acquireDirLock(absoluteDataDir)
  try {
    const db = await createInstance(absoluteDataDir, options)
    const close = db.close.bind(db)
    // 关库时释放锁：必须等 close 完成（数据已落盘）之后，否则别的实例会读到半成品
    db.close = async () => {
      try {
        await close()
      } finally {
        await release()
      }
    }
    return db
  } catch (error) {
    await release()
    throw error
  }
}

async function createInstance(dataDir: string, options?: PGliteOptions): Promise<PGlite> {
  // Read the embedded files
  const [wasmBuffer, initdbBuffer, dataBuffer] = await Promise.all([
    Bun.file(wasmPath).arrayBuffer(),
    Bun.file(initdbWasmPath).arrayBuffer(),
    Bun.file(dataPath).arrayBuffer(),
  ])
  // Create PGlite instance with pre-loaded modules
  return PGlite.create(dataDir, {
    ...options,
    pgliteWasmModule: await WebAssembly.compile(wasmBuffer),
    initdbWasmModule: await WebAssembly.compile(initdbBuffer),
    fsBundle: new Blob([dataBuffer]),
  })
}
