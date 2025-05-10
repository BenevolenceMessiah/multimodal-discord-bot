export interface BotConfig {
  // Providers
  textgenProvider: 'ollama' | 'openrouter';
  voicegenProvider: 'alltalk' | 'elevenlabs';
  imagegenProvider: 'stablediffusion';
  search: { provider: 'tavily'; tavilyKey?: string };

  // Models
  modelOllama?: string;
  modelOpenrouter?: string;
  modelAlltalk?: string;
  fluxModelName?: string;

  // Generation
  systemMessage: string;
  maxTokens: number;
  keepAlive?: string | number;
  contextLength: number;
  temperature: number;
  stream: boolean;

  // Behaviour
  wakeWords: string[];
  maxLines: number;

  // Endpoints & keys
  endpoints: Record<string, string>;
  openrouterKey?: string;
  elevenlabsKey?: string;

  // Redis (required now)
  redis: { enabled: boolean; url: string; ttl: number };

  // Postgres
  postgres: { enabled: boolean; url: string };
}