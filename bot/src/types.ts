export interface BotConfig {
  // Providers
  textgenProvider: 'ollama' | 'openrouter';
  voicegenProvider: 'alltalk' | 'elevenlabs';
  imagegenProvider: 'stablediffusion';
  search?: {
    provider: 'tavily';
    tavilyKey?: string;
  };

  // Models
  modelOllama?: string;
  modelOpenrouter?: string;
  modelAlltalk?: string;
  fluxModelName?: string;

  // Prompting / generation
  systemMessage: string;
  maxTokens: number;
  keepAlive?: string | number; // Seconds, "0", "5m", etc.
  contextLength: number;
  temperature: number;
  stream: boolean;

  // Bot behaviour
  wakeWords: string[];
  maxLines: number;

  // Endpoints & keys
  endpoints: Record<string, string>;
  openrouterKey?: string;
  elevenlabsKey?: string;

  // Redis cache (optional)
  redis?: {
    enabled: boolean;
    url: string;
    ttl: number; // -1 = no expiry
  };

  // Postgres storage (optional)
  postgres?: {
    enabled: boolean;
    url: string;
  };
}
```ts
export interface BotConfig {
  # Providers
  textgenProvider: 'ollama' | 'openrouter';
  voicegenProvider: 'alltalk' | 'elevenlabs';
  imagegenProvider: 'stablediffusion';
  search?: { provider: 'tavily'; tavilyKey?: string };

  # Models
  modelOllama?: string;
  modelOpenrouter?: string;
  modelAlltalk?: string;
  fluxModelName?: string;

  # Prompting
  systemMessage: string;
  maxTokens: number;
  keepAlive?: string | number;
  contextLength: number;
  temperature: number;
  stream: boolean;

  # Bot behavior
  wakeWords: string[];
  maxLines: number;

  # Endpoints
  endpoints: Record<string, string>;
  openrouterKey?: string;
  elevenlabsKey?: string;

  # Redis
  redis?: {
    enabled: boolean;
    url: string;
    ttl: number;
  };

  # Postgres
  postgres?: {
    enabled: boolean;
    url: string;
  };
}