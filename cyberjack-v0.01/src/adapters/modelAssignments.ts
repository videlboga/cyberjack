/**
 * Этап 6. Декларативная конфигурация назначений моделей.
 *
 * Каждое назначение (реплика, парсер, память) задаёт список моделей по
 * приоритету, таймауты, число попыток и формат результата. Значения по
 * умолчанию читаются из env (обратная совместимость), но конфиг позволяет
 * задать их декларативно без env.
 */

export interface ModelAssignment {
  /** Модели по приоритету (первая — основная, остальные — fallback). */
  models: string[];
  /** Провайдеры по приоритету для основной модели (пусто = auto). */
  providers: string[];
  /** Таймаут до первого токена (мс). */
  ttftTimeoutMs: number;
  /** Таймаут всего запроса (мс). */
  requestTimeoutMs: number;
  /** Формат результата: 'text' | 'json'. */
  format: 'text' | 'json';
  /** Максимум токенов. */
  maxTokens: number;
  /** Температура. */
  temperature: number;
}

const env = (key: string, fallback: string) => process.env[key] || fallback;
const envNum = (key: string, fallback: number) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
};
const splitList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

const LLM_MODEL = env('LLM_MODEL', 'deepseek/deepseek-v4-flash-0731');
const PARSER_MODEL = env('PARSER_MODEL', 'google/gemini-3.1-flash-lite-preview');

/**
 * Декларативные назначения. Каждое можно переопределить через env-переменные
 * `<PURPOSE>_MODELS`, `<PURPOSE>_TTFT_TIMEOUT`, `<PURPOSE>_REQUEST_TIMEOUT`.
 */
export const modelAssignments: Record<string, ModelAssignment> = {
  /** Живая реплика персонажа / нарратор. */
  reply: {
    models: [LLM_MODEL, ...splitList(env('LLM_FALLBACK_MODELS', 'deepseek/deepseek-v4-flash,google/gemini-2.5-flash-lite')).filter(m => m !== LLM_MODEL)],
    providers: splitList(env('LLM_PROVIDER_ORDER', 'novita,siliconflow,deepinfra')),
    ttftTimeoutMs: envNum('LLM_TTFT_TIMEOUT', 4000),
    requestTimeoutMs: envNum('LLM_REQUEST_TIMEOUT', 8000),
    format: 'text',
    maxTokens: envNum('LLM_MAX_TOKENS', 180),
    temperature: envNum('LLM_TEMPERATURE', 0.85),
  },
  /** Семантический разбор команды / классификация. */
  parser: {
    models: [PARSER_MODEL, ...splitList(env('PARSER_FALLBACK_MODELS', 'google/gemini-2.5-flash-lite,deepseek/deepseek-chat-v3-0324')).filter(m => m !== PARSER_MODEL)],
    providers: [],
    ttftTimeoutMs: envNum('PARSER_TTFT_TIMEOUT', 4000),
    requestTimeoutMs: envNum('PARSER_REQUEST_TIMEOUT', 8000),
    format: 'json',
    maxTokens: envNum('PARSER_MAX_TOKENS', 400),
    temperature: 0.1,
  },
  /** Генерация/переписывание эпизода памяти. */
  memory: {
    models: [PARSER_MODEL, ...splitList(env('PARSER_FALLBACK_MODELS', 'google/gemini-2.5-flash-lite,deepseek/deepseek-chat-v3-0324')).filter(m => m !== PARSER_MODEL)],
    providers: [],
    ttftTimeoutMs: envNum('MEMORY_TTFT_TIMEOUT', 6000),
    requestTimeoutMs: envNum('MEMORY_REQUEST_TIMEOUT', 12000),
    format: 'json',
    maxTokens: envNum('MEMORY_MAX_TOKENS', 600),
    temperature: 0.1,
  },
};

export function getModelAssignment(purpose: string): ModelAssignment {
  return modelAssignments[purpose] || modelAssignments.reply;
}
