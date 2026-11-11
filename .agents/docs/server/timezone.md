# Server 时区兼容规范

## 设计目标

- **插件与业务分离**：dayjs 的 utc/timezone 扩展与请求时区解析位于 `@pika/elysia-plugins` 的 `createTimezonePlugin`，server 只做薄包装。
- **时区由请求头驱动**：客户端通过 `Time-Zone` 请求头（IANA 时区，如 `Asia/Shanghai`）上报所在时区；缺失或非法时回退到服务器时区。
- **数据库只存时间点**：时区仅影响「展示」与「按天计算」，不参与持久化；写入统一传 `dayjs()`，由 `dayjsType` 序列化为 UTC ISO 字符串存储。

## 注册与注入

插件实例位于 `apps/server/common/plugins/timezone.ts`，由 `src/app.ts` 启动时 `.use(timezonePlugin)` 挂载一次（在 `i18nPlugin`、`globalContextPlugin` 之后）：

```ts
// apps/server/src/app.ts
import { globalContextPlugin } from '@/common/plugins/global-context'
import { i18nPlugin } from '@/common/plugins/i18n'
import { timezonePlugin } from '@/common/plugins/timezone'

new Elysia().use(i18nPlugin).use(globalContextPlugin).use(timezonePlugin)
```

> 顺序不可颠倒：`timezonePlugin` 的 `onBeforeHandle` 会写入 `globalThis.ctx`，而该容器由 `globalContextPlugin` 在自身 `onBeforeHandle` 中注入。

插件通过 `derive` 向 Context 注入两个字段：

| 字段       | 说明                                                     |
| ---------- | -------------------------------------------------------- |
| `timeZone` | 当前请求时区，缺失或非法时为服务器时区                   |
| `dayjs`    | 按当前请求时区构建时间的函数，替代业务代码中的 `dayjs()` |

```ts
.get('/demo/time', ({ timeZone, dayjs }) => ({
  timeZone,
  now: dayjs().format('YYYY-MM-DD HH:mm:ss'),
}))
```

响应会带上 `Vary: Time-Zone`（与 i18n 的 `Vary: Accept-Language` 合并），避免缓存层串时区。

## 时间解析语义

`dayjs(date, format?)` 与 `dayjsTz(date, timeZone?, format?)` 保持一致：

| 入参                                                    | 语义                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 无参数 / `Date` / 时间戳                                | 当前时刻，换算到目标时区                                                                |
| 纯数字字符串（10 位及以上）                             | 按时间戳处理：11 位及以上为毫秒（如 `'1704067200000'`），10 位为秒（如 `'1704067200'`） |
| 带偏移量的字符串（`...Z`、`+08:00`）                    | 表示确定时刻，换算到目标时区（传 `format` 时同样优先）                                  |
| 不带偏移量的字符串（`2024-01-01 08:00:00`、`20240101`） | 按目标时区的本地时间解析；传 `format` 时按该格式解析                                    |

> 带偏移量的字符串会被换算而不是按本地时间解析，避免数据库返回的 ISO 时间被错位。传 `format` 时偏移量仍然优先，`format` 只用于解析不带偏移量的字符串。

## 使用约定

- 需要「当前时间」「按用户时区格式化」时，使用 Context 中的 `dayjs`，不要直接用 `dayjs()`。
- 写入数据库统一传 `dayjs()`（`Dayjs` 对象），由 `dayjsType` 序列化为 ISO 字符串（`varchar(30)`）存储，禁止存格式化后的本地时间字符串。
- 只有展示、按天统计、按用户本地零点等场景才需要区分时区。
- 请求外（定时任务、脚本）使用导出的 `dayjsTz(date, timeZone)`，显式传入时区。

```ts
import { dayjsTz } from '@/common/plugins/timezone'

// 请求外按指定时区构建
const dayStart = dayjsTz(Date.now(), 'Asia/Shanghai').startOf('day')
```

## 客户端配合

时区属于设备偏好，只保存在浏览器本地（`usePreferenceStore` 的 `timezone`），服务端不做持久化，仅按请求头解析。

Web 端请求拦截器需要在每次请求时上报当前时区（与 `Accept-Language` 同一处）：

```ts
// 跟随系统时为浏览器时区，否则为用户在「设置 → 语言与时区」中选择的 IANA 时区
method.config.headers['Time-Zone'] = preferenceStore.resolvedTimeZone
```

## 提交前检查

1. 用户时区相关的展示/计算使用 Context 中的 `dayjs`，没有直接调用 `dayjs()`。
2. 数据库写入的是 `dayjs()`（`Dayjs` 对象），不是格式化后的本地时间字符串。
3. 新增时区行为包含「指定时区」「缺失时区」「非法时区」三类测试。
4. 执行 `bun lint`、`bun check` 和相关测试。
