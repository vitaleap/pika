// 归属原则：哪里调用 `t('COMMON.XXX')`，XXX 就定义在这里（仅限 src 层调用点）。
export const zh = {
  DATE_INVALID: '日期格式错误',
  FILE_NOT_FOUND: '文件不存在',
  FILE_SIZE_INVALID: '文件大小不符合要求',
  FILE_TYPE_UNSUPPORTED: '不支持的文件类型',
  FILE_UPLOAD_FAILED: '文件上传失败',
  FILENAME_INVALID: '文件名不合法',
  FILENAME_REQUIRED: '文件名不能为空',
  FORBIDDEN: '禁止访问',
  UNAUTHORIZED: '未授权',
  VALIDATION_ERROR: '内容不合法',
} as const
