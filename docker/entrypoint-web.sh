#!/bin/sh
# ntp
cat > /root/nptd.sh << 'EOF'
#!/bin/sh
ntpd -d -q -n -p "${NTP_SERVER:-ntp.aliyun.com}"
EOF
chmod +x /root/nptd.sh
echo "*/30 * * * * sh /root/nptd.sh >> /var/log/nptd.log" >> /etc/crontabs/root

# check ip
cat > /root/check_ip.sh << 'EOF'
#!/bin/sh
if [ -z "$PROXY_PASS" ]; then
    exit 0
fi
IP_FILE="/var/tmp/check_proxy_ip.txt"
HOSTNAME=$(echo "$PROXY_PASS" | sed -E 's|^.*://||; s|[:/].*$||')
if echo "$HOSTNAME" | grep -E "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" > /dev/null; then
    exit 0
fi
# 只取 "Name: / Address:" 成对出现的解析结果（排除上方 Server/Address 里的 DNS 服务器地址）
# sort 保证多 A 记录顺序变化不会误判为 IP 变更
CURRENT_IP=$(nslookup "$HOSTNAME." 2>/dev/null | awk '/^Name:/ { getline; print $2 }' | sort | tr "\n" " ")
if [ -z "$CURRENT_IP" ]; then
    exit 1
fi
if [ -f "$IP_FILE" ]; then
    SAVED_IP=$(cat "$IP_FILE")
else
    echo "$CURRENT_IP" > "$IP_FILE"
    echo "[checkip] host $HOSTNAME record ip $CURRENT_IP"
    exit 0
fi
if [ "$CURRENT_IP" != "$SAVED_IP" ]; then
    echo "$CURRENT_IP" > "$IP_FILE"
    echo "[checkip] host $HOSTNAME ip replace $SAVED_IP with $CURRENT_IP"
    nginx -s reload
fi
EOF
chmod +x /root/check_ip.sh
echo "*/1 * * * * sh /root/check_ip.sh >> /var/log/check_ip.log" >> /etc/crontabs/root

# start crond
crond

# env
cat > /docker-entrypoint.d/01-nginx-env.envsh << 'EOF'
#!/bin/sh
# vim:sw=2:ts=2:sts=2:et
set -eu

# 请求日志是否开启, 0关闭, 1开启
export NGINX_ACCESS_LOG_ENABLED="${NGINX_ACCESS_LOG_ENABLED:-1}"
# 错误日志级别, debug|info|notice|warn|error
export NGINX_ERROR_LOG_LEVEL="${NGINX_ERROR_LOG_LEVEL:-warn}"
# 请求体大小上限
export CLIENT_MAX_BODY_SIZE="${CLIENT_MAX_BODY_SIZE:-256m}"
# 请求体内存缓冲, 超出部分落盘, 每个并发上传请求独占此内存, 不宜过大以免高并发 OOM
export CLIENT_BODY_BUFFER_SIZE="${CLIENT_BODY_BUFFER_SIZE:-256k}"
# 请求头内存缓冲, 超出部分由 large_client_header_buffers 兜底
export CLIENT_HEADER_BUFFER_SIZE="${CLIENT_HEADER_BUFFER_SIZE:-32k}"
# 每个IP最大连接数
export LIMIT_CONN="${LIMIT_CONN:-40}"
# 总连接数
export LIMIT_CONN_ALL="${LIMIT_CONN_ALL:-1000}"
# 每个IP每秒请求数
export LIMIT_REQ_RATE="${LIMIT_REQ_RATE:-40}"
# 允许突发数
export LIMIT_REQ_BURST="${LIMIT_REQ_BURST:-20}"
# 突发模式, 默认空排队, nodelay 则立即返回错误
export LIMIT_REQ_BURST_MODE="${LIMIT_REQ_BURST_MODE:-}"
export LIMIT_REQ_LOG_LEVEL="${LIMIT_REQ_LOG_LEVEL:-warn}"
# 每个连接带宽限速
export LIMIT_RATE="${LIMIT_RATE:-512k}"
# 前 10MB 不限速
export LIMIT_RATE_AFTER="${LIMIT_RATE_AFTER:-10m}"
# 反向代理限速
export PROXY_LIMIT_RATE="${PROXY_LIMIT_RATE:-1024k}"
# 反向代理超时
export PROXY_SEND_TIMEOUT="${PROXY_SEND_TIMEOUT:-1800s}"
export PROXY_READ_TIMEOUT="${PROXY_READ_TIMEOUT:-1800s}"
# 反向代理是否开启缓冲, 若流式返回需要设为off
export PROXY_BUFFERING="${PROXY_BUFFERING:-on}"
export PROXY_PASS="${PROXY_PASS:-http://172.17.0.1:9528}"
EOF
chmod +x /docker-entrypoint.d/01-nginx-env.envsh

# real ip
# 仅当显式配置可信代理网段时启用, 否则 $remote_addr 就是客户端 IP (直连场景)
# REAL_IP_FROM 为逗号分隔的 CIDR, 如 "172.16.0.0/12,10.0.0.0/8"
REAL_IP_FROM="${REAL_IP_FROM:-}"
REAL_IP_HEADER="${REAL_IP_HEADER:-X-Forwarded-For}"
{
  if [ -n "$REAL_IP_FROM" ]; then
    for cidr in $(echo "$REAL_IP_FROM" | tr ',' ' '); do
      echo "set_real_ip_from $cidr;"
    done
    echo "real_ip_header $REAL_IP_HEADER;"
    echo "real_ip_recursive on;"
  fi
} > /etc/nginx/conf.d/realip.conf
