/**
 * 合并 `Vary` 响应头
 *
 * - `*` 表示响应随任意请求头变化，按 RFC 9110 必须单独出现，不能与其他字段拼接
 * - 其余字段按大小写不敏感去重，保留首次出现的写法
 *
 * @param vary 已有的 `Vary` 响应头值
 * @param field 本次需要追加的字段名，如 `Accept-Language`
 */
export const mergeVaryHeader = (vary: unknown, field: string): string => {
  const fields = new Map<string, string>()
  for (const item of String(vary ?? '').split(',')) {
    const value = item.trim()
    const normalizedValue = value.toLowerCase()
    if (value && !fields.has(normalizedValue)) {
      fields.set(normalizedValue, value)
    }
  }

  if (fields.has('*')) {
    return '*'
  }
  const normalizedField = field.toLowerCase()
  if (!fields.has(normalizedField)) {
    fields.set(normalizedField, field)
  }
  return [...fields.values()].join(', ')
}
