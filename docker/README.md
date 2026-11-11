# Docker 部署说明

## 目录结构

```ini
docker/
├── Dockerfile.aio      # All-In-One：nginx + 后端一体化
├── Dockerfile.server   # 仅后端
├── Dockerfile.web      # 仅前端 (nginx)
├── entrypoint-aio.sh   # AIO 镜像进程监督（nginx + 后端，转发退出信号）
├── entrypoint-web.sh   # web 启动脚本（NTP / 上游 IP 监控 / nginx env）
└── web.conf            # nginx 配置模板（envsubst 渲染）
docker-compose.yml      # AIO 一体化配置
docker-compose.prod.yml # 生产环境参考配置
```

## 一、后端（server）

### 环境变量

| 变量           | 说明                                                                           | 默认 / 示例                                                              |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `TZ`           | 时区                                                                           | `Asia/Shanghai`                                                          |
| `DATABASE_URL` | 数据库连接串。AIO 镜像内置 **PGlite**；独立部署指向 PostgreSQL                 | `/data/pglite.data` 或 `postgresql://pika:<pwd>@pika-postgres:5432/pika` |
| `JWT_ISSUER`   | JWT 签发者                                                                     | `pika`                                                                   |
| `JWT_SECRET`   | JWT 签名密钥（**必填**）                                                       | `openssl rand -hex 32` 生成                                              |
| `ADMIN_EMAIL`  | 管理员邮箱，与登录用户邮箱完全匹配时授予管理员权限                             | `admin@example.com`                                                      |
| `CACHE_URL`    | 支持 `redis://`、`valkey://` 等；`memory` 走内存缓存；其他值视为文件缓存目录； | `redis://:<rds_pwd>@pika-redis:6379/0` 或 `/data/cache`                  |

> 更多环境变量请查看 `apps/server/.env.example` 文件，此处不再赘述

### Volume

- `/data`（AIO 镜像）：存放 PGlite 数据库目录 `pglite.data`、缓存 `cache/` 和文件上传 `file/` 等。

---

## 二、前端 Web（Nginx）

### NTP 时间同步（`entrypoint-web.sh` → `/root/nptd.sh`）

- 每 30 分钟执行一次，日志写入 `/var/log/nptd.log`。
- 通过环境变量 `NTP_SERVER` 自定义上游；未设置时使用 `ntp.aliyun.com`。

### 上游域名 IP 变更自动 reload（`/root/check_ip.sh`）

- 仅当 `PROXY_PASS` 为域名（非 IP）时生效。
- 每分钟通过 `nslookup` 解析域名，IP 变化时执行 `nginx -s reload`，日志位于 `/var/log/check_ip.log`。

### 前置 CDN / 反向代理时的真实 IP（`REAL_IP_FROM`）

限流（`limit_conn` / `limit_req`）与后端拿到的 IP 都基于 `$remote_addr`。若容器前面还有 CDN / 反代，
`$remote_addr` 会变成代理 IP，所有用户共用一个限流桶（全站被压到单 IP 的限额），此时需配置可信代理网段：

```yaml
environment:
  - REAL_IP_FROM=172.16.0.0/12,10.0.0.0/8 # 逗号分隔，填写实际代理/CDN 回源网段
  - REAL_IP_HEADER=X-Forwarded-For # 可选，默认 X-Forwarded-For
```

### Nginx 环境变量

由 `01-nginx-env.envsh` 注入，`web.conf` 通过 `envsubst` 渲染。

| 变量                                        | 含义                                            | 默认值                   |
| ------------------------------------------- | ----------------------------------------------- | ------------------------ |
| `NTP_SERVER`                                | NTP 上游服务器                                  | `ntp.aliyun.com`         |
| `REAL_IP_FROM`                              | 可信代理网段（逗号分隔 CIDR）                   | 空（不启用）             |
| `REAL_IP_HEADER`                            | 真实 IP 请求头                                  | `X-Forwarded-For`        |
| `PROXY_PASS`                                | 上游后端地址                                    | `http://172.17.0.1:9528` |
| `NGINX_ACCESS_LOG_ENABLED`                  | access_log 开关（0/1）                          | `1`                      |
| `NGINX_ERROR_LOG_LEVEL`                     | error_log 级别                                  | `warn`                   |
| `CLIENT_MAX_BODY_SIZE`                      | 请求体上限（需 ≥ 后端 `REQUEST_MAX_BODY_SIZE`） | `256m`                   |
| `CLIENT_BODY_BUFFER_SIZE`                   | 请求体内存缓冲                                  | `256k`                   |
| `CLIENT_HEADER_BUFFER_SIZE`                 | 请求头内存缓冲                                  | `32k`                    |
| `LIMIT_CONN`                                | 单 IP 最大并发连接数                            | `40`                     |
| `LIMIT_CONN_ALL`                            | 整站总连接数                                    | `1000`                   |
| `LIMIT_REQ_RATE`                            | 单 IP 每秒请求数（仅 `/api/`）                  | `40`                     |
| `LIMIT_REQ_BURST`                           | 允许突发请求数                                  | `20`                     |
| `LIMIT_REQ_BURST_MODE`                      | 突发模式（`nodelay` 立即 429）                  | 空                       |
| `LIMIT_REQ_LOG_LEVEL`                       | 限流日志级别                                    | `warn`                   |
| `LIMIT_RATE` / `LIMIT_RATE_AFTER`           | 单连接带宽限速 / 起始阈值                       | `512k` / `10m`           |
| `PROXY_LIMIT_RATE`                          | 反向代理带宽限速                                | `1024k`                  |
| `PROXY_SEND_TIMEOUT` / `PROXY_READ_TIMEOUT` | 反向代理超时                                    | `1800s` / `1800s`        |
| `PROXY_BUFFERING`                           | 反向代理缓冲（流式需 `off`）                    | `on`                     |

---

## 三、运行方式

```bash
# 单机一体（AIO 镜像 + PGlite，端口 8080）
docker compose up --build

# 生产拆分（web + server + redis + postgres，端口 8080）
docker compose -f docker-compose.prod.yml up --build
```

> 生产环境建议定期备份 `pika_postgres_data`、`pika_redis_data` 卷。
