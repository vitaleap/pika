# 业务逻辑规范

## 业务逻辑定义

- 所有业务逻辑都按 **模块** 组织，在 `src/[moduleName]/services/` 中实现；例如 `src/system/services/auth.ts`。
- 每个服务类都应导出一个抽象类，包含所有必要的方法
- 路由处理函数应仅负责调用服务方法并处理结果

## 业务逻辑方法

- 业务逻辑方法使用箭头函数形式 `static methodName = async () =>`
- 方法的入参应与 `routes` 接口的 `body`、`params` 和 `query` 配置一致，使用 `z.infer<typeof [Schema]>` 进行类型提示
- 方法的返回值应与 `routes` 接口的 `response` 配置一致，使用 `z.infer<typeof [Schema]>` 进行类型提示

## 错误处理

- 使用 `HttpError` 类（来自 `@pika/elysia-plugins`）抛出业务异常。
- 用户可见的错误文案通过 `t` 生成延迟翻译标记。`t` 从全局插件导入 `import { t } from '@/common/plugins/i18n'`，使用 `t('MODULE.KEY')` 形式调用。
- 自定义 Zod 校验文案也必须使用 `t`，例如 `.min(6, t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 }))`。
- 构造函数参数：`new HttpError(message: string, status?: number, detail?: string)`，status 默认 500。
- 示例：`throw new HttpError(t('USER_NOT_FOUND'), 404)`。
- 完整国际化规范查看 `.agents/docs/server/i18n.md`。
