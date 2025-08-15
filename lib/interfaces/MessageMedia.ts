import { MediaType } from "./MediaType";

export interface MessageMedia {
  id: number;
  message_id: number;
  media_type?: MediaType | null;
  mime_type?: string | null;
  file_path: string;
  caption?: string | null;
}