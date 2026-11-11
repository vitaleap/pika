import { join } from 'node:path'

const HOME = Bun.env.HOME ?? Bun.env.USERPROFILE ?? '~'

const isDev = Bun.env.NODE_ENV !== 'production'

const defaultAppDir = '.pika'
export const HOME_DIR = `${HOME}/${isDev ? `${defaultAppDir}_dev` : `${defaultAppDir}`}`

/** Join arbitrary sub-paths under `~/.pika`. */
export const joinHomePath = (...parts: string[]): string => join(HOME_DIR, ...parts)
