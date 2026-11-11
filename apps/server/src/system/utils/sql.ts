/** 转义 LIKE 模式串中的特殊字符，避免用户输入的 % / _ / \ 被当成通配符 */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)
