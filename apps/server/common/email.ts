import { sendMail as baseSendMail } from '@pika/elysia-common'
import { ConfigRepository } from '@/system/repositories/config'
import { log } from './log'

export const sendMail = async (to: string, subject: string, text: string, tip?: string) => {
  const { mail } = await ConfigRepository.get()
  return baseSendMail(mail, { to, subject, text, tip }, log)
}
