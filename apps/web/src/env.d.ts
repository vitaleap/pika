import { LoadingBarApiInjection } from 'naive-ui/es/loading-bar/src/LoadingBarProvider'
import { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
import { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import { ModalApiInjection } from 'naive-ui/es/modal/src/ModalProvider'
export {}
declare global {
  interface Window {
    $message: MessageApiInjection
    $notification: NotificationApiInjection
    $loadingBar: LoadingBarApiInjection
    $modal: ModalApiInjection
  }
}
