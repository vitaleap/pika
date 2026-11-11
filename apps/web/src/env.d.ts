import { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
import { LoadingBarApiInjection } from 'naive-ui/es/loading-bar/src/LoadingBarProvider'
export {}
declare global {
  interface Window {
    $message: MessageApiInjection
    $notification: NotificationApiInjection
    $loadingBar: LoadingBarApiInjection
  }
}
