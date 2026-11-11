/**
 * Этап 8. Единые DTO для памяти и реплики.
 *
 * Транспортный контракт между HTTP/WS и application-слоем для чат-памяти
 * и журналов контекста.
 */

/** Строка чат-памяти субъекта. */
export interface ChatMemoryLine {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  portraitEmotion?: string;
  createdAt?: string;
  worldMinute?: number | null;
  speakerId?: string;
  speakerName?: string;
  messageId?: string;
  originChatId?: number;
}

/** Строка журнала контекста (комната/устройство). */
export interface ContextJournalLine {
  id: number;
  subjectId: string;
  characterName: string;
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  portraitEmotion?: string;
  createdAt?: string;
  worldMinute?: number | null;
}

/** Ответ истории чата субъекта. */
export interface ChatHistoryResponse {
  success: boolean;
  subjectId: string;
  messages: ChatMemoryLine[];
}

/** Ответ журнала контекста. */
export interface ContextJournalResponse {
  success: boolean;
  contexts: string[];
  messages: ContextJournalLine[];
}
