import type { I18nLocaleMessages } from '@pika/elysia-plugins'
import type { zh } from './zh'

export const en = {
  DATE_INVALID: 'Invalid date',
  FILE_NOT_FOUND: 'File not found',
  FILE_SIZE_INVALID: 'File size is not allowed',
  FILE_TYPE_UNSUPPORTED: 'Unsupported file type',
  FILE_UPLOAD_FAILED: 'Failed to upload file',
  FILENAME_INVALID: 'Invalid filename',
  FILENAME_REQUIRED: 'Filename is required',
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  VALIDATION_ERROR: 'Invalid content',
} satisfies I18nLocaleMessages<typeof zh>
