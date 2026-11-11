import cluster from 'node:cluster'
import fs from 'node:fs'
import os from 'node:os'
import { log } from '@/common/log'

export const getCpuCount = (): number => {
  try {
    // Try cgroup v1
    const quotaPath = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us'
    const periodPath = '/sys/fs/cgroup/cpu/cpu.cfs_period_us'

    if (fs.existsSync(quotaPath) && fs.existsSync(periodPath)) {
      const quota = Number(fs.readFileSync(quotaPath, 'utf8'))
      const period = Number(fs.readFileSync(periodPath, 'utf8'))

      if (quota > 0 && period > 0) {
        return Math.floor(quota / period)
      }
    }

    // Try cgroup v2
    const maxPath = '/sys/fs/cgroup/cpu.max'
    if (fs.existsSync(maxPath)) {
      const firstLine = fs.readFileSync(maxPath, 'utf8').split('\n')[0]
      if (firstLine) {
        const [quota, period] = firstLine.split(' ')
        if (quota !== 'max') {
          return Math.floor(Number(quota) / Number(period))
        }
      }
    }
  } catch (error: any) {
    console.error('Error reading cgroup info:', error.message)
  }
  // 无 cgroup 信息或未设置 CPU 限额（v1 quota=-1 / v2 quota=max）时，回退到系统可用核数，
  // 避免裸机或未限额容器只启动 1 个进程
  return os.availableParallelism()
}

export const clusterRun = async (callback: () => Promise<any>): Promise<void> => {
  if (!cluster.isPrimary) {
    await callback()
    return
  }

  const cpuCount = getCpuCount()
  if (cpuCount <= 1) {
    await callback()
    return
  }

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork()
    await Bun.sleep(100)
  }

  try {
    // @ts-ignore
    cluster.on('exit', (worker, code, signal) => {
      log.warn(
        { workerId: worker.id, pid: worker.process.pid, code, signal },
        'cluster worker exited, restarting...',
      )
      cluster.fork()
    })
  } catch {}
}
