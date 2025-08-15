import { ChatWithLastMessage } from "./ChatWithLastMessage";

export interface ChatItemProps {
  chat: ChatWithLastMessage;
  onClick: (chat: ChatWithLastMessage) => void;
  currentUserJid: string;
  isSelected?: boolean;

}