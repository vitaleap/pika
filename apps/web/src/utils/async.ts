/**
 * 睡眠
 * @param timeoutMs 毫秒，1000表示延迟1秒
 */
export const sleep = (timeoutMs = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, timeoutMs))
