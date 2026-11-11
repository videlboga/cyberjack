import type { BackgroundJob } from '../../orchestration/backgroundJobs';

/**
 * Этап 8. Единые DTO для фоновых заданий и реплики.
 *
 * Транспортный контракт между HTTP/WS и application-слоем.
 */

/** Публичное представление фонового задания (без служебных полей lease). */
export interface BackgroundJobView {
  id: number;
  type: string;
  key: string;
  subjectId: string | null;
  dueMinute: number;
  status: BackgroundJob['status'];
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export function toBackgroundJobView(job: BackgroundJob): BackgroundJobView {
  return {
    id: job.id,
    type: job.type,
    key: job.key,
    subjectId: job.subjectId,
    dueMinute: job.dueMinute,
    status: job.status,
    attempts: job.attempts,
    lastError: job.lastError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** Ответ списка фоновых заданий. */
export interface BackgroundJobsResponse {
  success: boolean;
  jobs: BackgroundJobView[];
}

/** Ответ выполнения реплики персонажа. */
export interface CharacterSpeechResponse {
  success: boolean;
  reply: unknown;
  sentMessages: unknown[];
  error?: string | null;
}
