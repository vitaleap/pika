#!/bin/sh
# AIO 镜像（nginx + 后端同容器）的进程监督
#
# - 作为 PID 1 同时管理 nginx 与后端：任一进程退出则整体退出，由 compose 的 restart 策略恢复，
#   避免后端崩溃后容器仍然存活、一直返回 502
# - 接收 docker stop 的信号并转发：nginx 用 QUIT 优雅退出，后端用 TERM 触发 gracefulShutdown
#
# nginx 侧仍调用官方 entrypoint，以保留其模板渲染（envsubst）与 /docker-entrypoint.d/ 脚本机制
set -u

cd /work || exit 1

/work/app &
app_pid=$!
/docker-entrypoint.sh nginx -g 'daemon off;' &
nginx_pid=$!

# shellcheck disable=SC2329  # 由下方 trap 间接调用
shutdown() {
  trap - QUIT TERM INT
  kill -QUIT "$nginx_pid" 2>/dev/null || true
  kill -TERM "$app_pid" 2>/dev/null || true
  wait "$nginx_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  exit 0
}
# 官方 nginx 镜像的 STOPSIGNAL 是 SIGQUIT，同时兼容 TERM / INT
trap shutdown QUIT TERM INT

# POSIX sh 没有 wait -n，用 1s 轮询检测任一进程退出
while kill -0 "$app_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

echo "[entrypoint-aio] 有进程已退出，容器退出以便重启（app=$app_pid nginx=$nginx_pid）"
# 给后端最多 10s 优雅退出（nginx 随 PID 1 退出由内核回收，无需额外等待）
i=0
while [ "$i" -lt 10 ] && kill -0 "$app_pid" 2>/dev/null; do
  kill -TERM "$app_pid" 2>/dev/null || true
  sleep 1
  i=$((i + 1))
done
exit 1
