type NotificationType = "private" | "group" | "community" | "file";

export type NotificationPayload = {
  type: NotificationType;
  from?: string; // user id for private messages
  fromName?: string; // user name
  fromAvatar?: string; // user avatar url
  title?: string; // short title shown in list
  message?: string; // optional message preview
  file?: { filename?: string; url?: string; mimetype?: string; size?: number };
  groupId?: string; // for group/community notifications
  groupName?: string; // group name
  groupPicture?: string; // group picture url
  ts?: number; // optional timestamp
};

// action payload for cross-component commands (e.g. open-chat)
export type ActionPayload = {
  action: 'open-chat' | 'clear-notifications' | string;
  data?: any;
};

const bus = new EventTarget();

export function emitNotification(payload: NotificationPayload) {
  bus.dispatchEvent(new CustomEvent("notification", { detail: payload }));
}

export function onNotification(handler: (payload: NotificationPayload) => void) {
  const h = (e: Event) => {
    const ev = e as CustomEvent<NotificationPayload>;
    handler(ev.detail);
  };
  bus.addEventListener("notification", h as EventListener);
  return () => bus.removeEventListener("notification", h as EventListener);
}

export function emitAction(payload: ActionPayload) {
  bus.dispatchEvent(new CustomEvent("action", { detail: payload }));
}

export function onAction(handler: (payload: ActionPayload) => void) {
  const h = (e: Event) => {
    const ev = e as CustomEvent<ActionPayload>;
    handler(ev.detail);
  };
  bus.addEventListener("action", h as EventListener);
  return () => bus.removeEventListener("action", h as EventListener);
}

export function clearNotifications(chatId: string, chatType: 'dm' | 'group') {
  emitAction({ action: 'clear-notifications', data: { chatId, chatType } });
}

export default { emitNotification, onNotification, emitAction, onAction, clearNotifications };
