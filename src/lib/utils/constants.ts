import type { Settings } from '../../types/settings';

export const STORAGE_KEYS = {
  RULES: 'smm_rules',
  TEMPLATES: 'smm_templates',
  SETTINGS: 'smm_settings',
  ACTIVITY_LOG: 'smm_activity_log',
  AUTO_RESPONSE_COUNT: 'smm_auto_response_count',
  CHAT_HISTORY: 'smm_chat_history',
  UNREAD_CLASSIFICATIONS: 'smm_unread_classifications',
  LOCALE: 'smm_locale',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  classificationEnabled: true,
  autoResponseEnabled: true,
  processExistingOnStartup: false,
  maxAutoResponsesPerHour: 10,
  logRetentionDays: 30,
  notifyOnClassification: true,
  notifyOnAutoResponse: true,
  aiProvider: 'openrouter',
  openaiApiKey: '',
  openaiModel: 'openai/gpt-4o-mini',
  customBaseUrl: '',
};

export const MAX_ACTIVITY_LOG_ENTRIES = 500;

// Models available via OpenRouter (all providers)
export const OPENAI_MODELS = [
  // --- OpenAI ---
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (fast)', provider: 'OpenAI' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano (fastest)', provider: 'OpenAI' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenAI' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'openai/o4-mini', label: 'o4-mini (reasoning)', provider: 'OpenAI' },
  // --- Anthropic ---
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku (fast)', provider: 'Anthropic' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4 (premium)', provider: 'Anthropic' },
  // --- Google ---
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash Preview', provider: 'Google' },
  { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro Preview', provider: 'Google' },
  // --- Meta ---
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', provider: 'Meta' },
  { id: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout', provider: 'Meta' },
  // --- DeepSeek ---
  { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3 (affordable)', provider: 'DeepSeek' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (reasoning)', provider: 'DeepSeek' },
  // --- Mistral ---
  { id: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1', provider: 'Mistral' },
  // --- Qwen ---
  { id: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B', provider: 'Qwen' },
  { id: 'qwen/qwen3-30b-a3b', label: 'Qwen3 30B (light)', provider: 'Qwen' },
] as const;

// Models for direct OpenAI API
export const OPENAI_DIRECT_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (fastest)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'o4-mini', label: 'o4-mini (reasoning)' },
] as const;

// Models for direct Anthropic API
export const ANTHROPIC_DIRECT_MODELS = [
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (fast)' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4 (premium)' },
] as const;

// Models for direct Google Gemini API
export const GOOGLE_DIRECT_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
  { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro Preview' },
] as const;

// Provider endpoint configurations
export const AI_PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPlaceholder: 'sk-or-...',
    keyHint: 'Obtén tu key en openrouter.ai',
    format: 'openai' as const,
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    keyHint: 'Obtén tu key en platform.openai.com',
    format: 'openai' as const,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Obtén tu key en console.anthropic.com',
    format: 'anthropic' as const,
  },
  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyPlaceholder: 'AIza...',
    keyHint: 'Obtén tu key en aistudio.google.com',
    format: 'openai' as const,
  },
  custom: {
    name: 'Compatible OpenAI',
    baseUrl: '',
    keyPlaceholder: 'tu-api-key',
    keyHint: 'Endpoint compatible con la API de OpenAI (Ollama, LM Studio, etc.)',
    format: 'openai' as const,
  },
} as const;

export const TEMPLATE_VARIABLES = [
  { key: 'sender_name', label: 'Nombre del remitente', example: 'Juan García' },
  { key: 'sender_email', label: 'Email del remitente', example: 'juan@example.com' },
  { key: 'to', label: 'Destinatario', example: 'ricard@conexiatec.com' },
  { key: 'subject', label: 'Asunto original', example: 'Re: Presupuesto' },
  { key: 'date', label: 'Fecha', example: '18/05/2026' },
  { key: 'time', label: 'Hora', example: '14:30' },
  { key: 'day_of_week', label: 'Día de la semana', example: 'Lunes' },
  { key: 'original_body', label: 'Cuerpo original completo', example: '...' },
  { key: 'original_body_snippet', label: 'Primeras líneas del cuerpo', example: '...' },
  { key: 'my_name', label: 'Mi nombre', example: 'Ricard Penin' },
  { key: 'my_email', label: 'Mi email', example: 'ricard@conexiatec.com' },
] as const;
