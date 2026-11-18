# 安全规范

服务端安全底线：新增或修改接口时，对照下文「判断标准」与「检查清单」。

| 攻击面                 | 必须采取的措施                      |
| ---------------------- | ----------------------------------- |
| 并发请求、请求重放     | `cache.lock` 加锁 + 一次性凭证消费  |
| 接口被遍历、凭证被爆破 | `rateLimit` 业务限流 + 失败次数计数 |
| access token 泄露      | 旧凭证校验 + MFA 二次验证           |
| 越权访问他人数据       | 身份只取 token + 资源归属校验       |

锁与限流都基于 `cache`（`@/common/cache`），多机部署需把 `CACHE_URL` 指向 Redis 或共享目录，否则跨进程失效。

## cache.lock

**判断标准：同一份数据可能被并发读改，就必须加锁。** 常见于读-改-写、先查唯一性再写入、一次性凭证消费、发码/发邮件等不可重复操作。

- 在 **service 层**加锁，包住「判断 + 写入」的完整过程；不在路由层加锁。
- key 用 `<资源>:<标识>` 且全局唯一，同一资源用同一 key；涉及两个唯一资源时嵌套加锁。
- 锁内重新读取数据再判断，锁外读到的值可能已过期。
- 锁不能替代数据库唯一索引，唯一约束是最后一道防线。
- 一次性凭证校验通过后必须删除，防止重放；写库可能失败时改由业务成功后删除。

参考示例

```ts
// 锁关键变量
return cache.lock(`email:${email}`, async () => {
  // 锁内重新读取 → 校验唯一性 → 消费凭证 → 写库
})
```

## rateLimit

**判断标准：接口能被脚本无限次调用并造成危害（枚举、爆破、刷成本），就必须限流。** 如登录、发码、注册、找回/修改密码、`check` 类、上传。

- 在 **路由层**调用 `rateLimit(opts, key)`（`@/common/rate-limit`），service 内不做限流。
- key 用 `<业务名>:<维度>`：未登录用 `requestIp`，登录后用 `user.sub`，不要用 username/email。
- 按风险组合多个窗口（如 `second` + `minute`，有外部成本的再加 `hour`/`day`），`errorMessage` 传 i18n token，超限返回 **429**。

参考示例

```ts
await rateLimit(
  { second: 5, minute: 10, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
  `change_password:${user.sub}`,
)
```

## MFA

access token 是无状态 JWT，泄露后无法吊销，因此**判断标准：拿到 token 就能造成不可逆或高影响后果的操作，必须二次验证。** 如修改密码、改邮箱/手机号、增删验证方式、启停两步验证、生成恢复码。

- body schema 展开 `multiFactorFields`，service 调用 `MultiFactorService.assertVerifiedIfBound`；已绑定任意验证方式即必须校验，与登录两步验证开关无关。
- 有时限的凭证，先校验旧密码/旧验证码，再校验 MFA，避免白白消耗失败次数。
- 后端 `assertVerifiedIfBound` 内部已封装好，无需处理 MFA 相关逻辑。
- 前端已全局拦截 `SYSTEM.MULTI_FACTOR_REQUIRED` 自动弹窗重试，业务页面无需实现。

参考示例

```ts
// body：业务字段之外展开多因素字段
z.object({ /* 业务字段 */ ...multiFactorFields })

// 1. 业务校验，如验证码是否正确
// 2. MFA 校验
await MultiFactorService.assertVerifiedIfBound({
  userId,
  verify: toMultiFactorVerify(body),
  ip,
  userAgent,
})
// 3. 业务逻辑
// 4. 可选收尾，如清除验证码
```

## 身份与数据

- 身份只从 token 取（`user.sub`），不从 body/query 接收用户标识；操作他人资源前校验归属。
- 查询条件用 Drizzle 参数化构造，LIKE 模式串必须经 `escapeLike` 转义。
- `response` schema 显式列出字段，不返回含 `password` 等敏感字段的数据行。
- 密码只存 `hashPassword`，密钥类数据加密或摘要后存储。
- `HttpError` 的 `detail`/`data` 与日志不得出现密码、验证码、token、密钥。
- 随机数用 CSPRNG（`randomInt` 等），禁止 `Math.random`。
- 登录、找回密码等未认证入口，错误文案不区分「账号不存在」与「密码错误」。
- 状态码：401 未认证（token 失效、登录凭证错误）、403 权限不足、400/409/429 业务失败/冲突/限流。

## 检查清单

- [ ] 鉴权与越权：`auth()` 覆盖，身份取自 `user.sub`，他人资源已校验归属。
- [ ] 限流：可被滥用的接口已限流，key 维度正确。
- [ ] 加锁：并发写入同一份数据的路径已加锁，一次性凭证已消费。
- [ ] 二次验证：敏感操作已接入 `assertVerifiedIfBound`。
- [ ] 敏感数据：响应与日志不含密码、验证码、token、密钥。
- [ ] 测试：覆盖未登录/越权、错误凭证、重复提交、第二因素缺失。

相关文档：`.agents/docs/server/routes.md`（鉴权）、`.agents/docs/server/services.md`（错误处理）。
