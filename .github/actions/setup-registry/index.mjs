#!/usr/bin/env node
/**
 * 修改仓库根目录的 bunfig.toml，更新 [install] 段下的 registry 配置
 * 用法: node index.js <registry-url>
 */
import fs from 'node:fs'
import { argv, stderr, stdout } from 'node:process'

const registry = argv[2]
if (!registry) {
  stderr.write('Usage: node index.mjs <registry-url>\n')
  process.exit(1)
}

if (!registry.startsWith('http://') && !registry.startsWith('https://')) {
  stderr.write('Error: registry must be an http(s) URL\n')
  process.exit(1)
}

class Toml {
  _toml = {}

  constructor(str = '') {
    this._toml = this._parse(str)
  }

  _parse = (source) => {
    const result = {}
    let current = null
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.split('#')[0]?.trim() ?? ''
      if (!line) continue
      if (line.startsWith('[') && line.endsWith(']')) {
        const section = line.slice(1, -1).trim()
        current = {}
        result[section] = current
        continue
      }
      const eqIndex = line.indexOf('=')
      if (eqIndex === -1 || !current) continue
      const key = line.slice(0, eqIndex).trim()
      const value = line.slice(eqIndex + 1).trim()
      if (!key) continue
      if (value.startsWith('"') && value.endsWith('"')) {
        current[key] = value.slice(1, -1)
      } else if (value === 'true' || value === 'false') {
        current[key] = value === 'true'
      } else if (value !== '' && !Number.isNaN(Number(value))) {
        current[key] = Number(value)
      } else {
        current[key] = value
      }
    }
    return result
  }

  set(title, key, value) {
    if (!this._toml[title]) {
      this._toml[title] = {}
    }
    this._toml[title][key] = value
  }

  toString() {
    const lines = []
    for (const [section, table] of Object.entries(this._toml)) {
      lines.push(`[${section}]`)
      for (const [key, value] of Object.entries(table)) {
        lines.push(typeof value === 'string' ? `${key} = "${value}"` : `${key} = ${value}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }
}

const FILE = 'bunfig.toml'

let source = ''
try {
  source = fs.readFileSync(FILE, 'utf-8')
} catch {}
const toml = new Toml(source)
toml.set('install', 'registry', registry)
const text = toml.toString()
fs.writeFileSync(FILE, text)

stdout.write(`\n${FILE} has changed\n`)
stdout.write('------\n')
stdout.write(`${text}`)
stdout.write('------\n')
