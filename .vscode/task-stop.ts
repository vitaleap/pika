// @ts-ignore
import { $ } from 'bun'

// 判断当前操作系统是否为 Windows
// @ts-ignore
const isWin = process.platform === 'win32'

try {
  if (isWin) {
    // Windows: 使用 PowerShell 查找并终止后端（inspect=/elysia）和前端（vite）进程
    const backendCmd = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*inspect=/elysia*' } | Stop-Process -Force -ErrorAction SilentlyContinue`
    const frontendCmd = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*vite*' } | Stop-Process -Force -ErrorAction SilentlyContinue`
    await $`powershell -NoProfile -Command "${backendCmd}"`
    await $`powershell -NoProfile -Command "${frontendCmd}"`
  } else {
    // macOS/Linux: 终止后端（bun.*elysia）和前端（vite）进程
    // || true 用于防止未找到进程时抛出错误
    await $`pkill -INT -f 'bun.*elysia' || true`
    await $`pkill -INT -f 'vite' || true`
  }
  console.log('Development server stopped successfully.')
} catch {
  // 忽略错误，因为如果进程不存在，不需要报错
  console.log('No running development server found.')
}
