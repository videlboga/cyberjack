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

const LLM_MODEL = env('LLM_MODEL', 'deepseek/deepseek-chat-v3-0324');
const PARSER_MODEL = env('PARSER_MODEL', 'google/gemini-3.1-flash-lite-preview');

/**
 * Декларативные назначения. Каждое можно переопределить через env-переменные
 * `<PURPOSE>_MODELS`, `<PURPOSE>_TTFT_TIMEOUT`, `<PURPOSE>_REQUEST_TIMEOUT`.
 */
export const modelAssignments: Record<string, ModelAssignment> = {
  /** Живая реплика персонажа / нарратор. */
  reply: {
    models: [LLM_MODEL, ...splitList(env('LLM_FALLBACK_MODELS', '')).filter(m => m !== LLM_MODEL)],
    // 'ollama' — облачная Ollama (отдельный транспорт, см. llmAdapter.ts),
    // единственный провайдер. Openrouter-фолбэки убраны: все LLM-запросы
    // идут только в ollama (кроме эмбеддингов, которые на openrouter).
    providers: splitList(env('LLM_PROVIDER_ORDER', 'ollama')),
    ttftTimeoutMs: envNum('LLM_TTFT_TIMEOUT', 4000),
    requestTimeoutMs: envNum('LLM_REQUEST_TIMEOUT', 8000),
    format: 'text',
    maxTokens: envNum('LLM_MAX_TOKENS', 180),
    temperature: envNum('LLM_TEMPERATURE', 0.85),
  },
  /** Семантический разбор команды / классификация. */
  parser: {
    models: [PARSER_MODEL, ...splitList(env('PARSER_FALLBACK_MODELS', '')).filter(m => m !== PARSER_MODEL)],
    providers: splitList(env('PARSER_PROVIDER_ORDER', 'ollama')),
    ttftTimeoutMs: envNum('PARSER_TTFT_TIMEOUT', 4000),
    requestTimeoutMs: envNum('PARSER_REQUEST_TIMEOUT', 8000),
    format: 'json',
    maxTokens: envNum('PARSER_MAX_TOKENS', 400),
    temperature: 0.1,
  },
  /** Генерация/переписывание эпизода памяти. Длинный структурированный
   *  JSON (title/summary/associations) над фактами до ~7500 символов.
   *  Модель должна стабильно отдавать полный JSON (не текст) с большим
   *  окном: flash-lite обрезает на 600 токенов, deepseek-v4-flash местами
   *  отдаёт текст вместо JSON. gemini-2.5-flash-lite стабильно отдаёт JSON
   *  при достаточном max_tokens — его и берём основным.
   *  'ollama' идёт первым как дешёвый локальный путь (summary эпизодов). */
  memory: {
    models: [
      env('MEMORY_MODEL', 'deepseek/deepseek-chat-v3-0324'),
      ...splitList(env('MEMORY_FALLBACK_MODELS', '')).filter(m => m !== env('MEMORY_MODEL', 'deepseek/deepseek-chat-v3-0324')),
    ],
    providers: splitList(env('MEMORY_PROVIDER_ORDER', 'ollama')),
    ttftTimeoutMs: envNum('MEMORY_TTFT_TIMEOUT', 8000),
    requestTimeoutMs: envNum('MEMORY_REQUEST_TIMEOUT', 30000),
    format: 'json',
    maxTokens: envNum('MEMORY_MAX_TOKENS', 2000),
    temperature: 0.3,
  },
};

export function getModelAssignment(purpose: string): ModelAssignment {
  return modelAssignments[purpose] || modelAssignments.reply;
}
