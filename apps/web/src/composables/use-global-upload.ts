import type { UploadCustomRequestOptions } from 'naive-ui'

// 全局默认 customRequest：上传到后端后把 url 写入 `file.url`，由 w-upload 透传给上层
export const useGlobalUpload = () => {
  return async ({ file, onFinish, onError }: UploadCustomRequestOptions) => {
    if (!file.file) {
      onError()
      return
    }
    try {
      const { url } = await Apis.file.upload({ data: { file: file.file } })
      file.url = url
      onFinish()
    } catch {
      onError()
    }
  }
}
