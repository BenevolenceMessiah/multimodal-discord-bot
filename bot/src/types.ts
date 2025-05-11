/*────────────────  Global configuration shape  ────────────────*/

export interface BotConfig {
  /* === Providers ====================================================== */
  textgenProvider: 'ollama' | 'openrouter';
  voicegenProvider: 'alltalk' | 'elevenlabs';
  imagegenProvider: 'stablediffusion';
  search: { provider: 'tavily'; tavilyKey?: string };

  /* === Model names / IDs ============================================= */
  modelOllama?: string;
  modelOpenrouter?: string;
  modelAlltalk?: string;

  /* === Forge / FLUX block (NEW) ====================================== */
  flux?: {
    enabled: boolean;
    modelName: string;                 // checkpoint: EVERFLUX_x1 …
    steps: number;                     // sampling steps
    sampler: string;                   // Euler, DPM++ 2M, etc.
    //sampler:
  //| 'Euler' | 'Euler a' | 'LMS' | 'Heun' | 'Heun++'
  //| 'DPM2' | 'DPM2 a'
  //| 'DPM++ 2S a' | 'DPM++ 2S a Karras'
  //| 'DPM++ 2M' | 'DPM++ 2M Karras' | 'DPM++ 2M SDE' | 'DPM++ 2M SDE Karras'
  //| 'DPM++ 3M' | 'DPM++ 3M SDE' | 'DPM++ 3M SDE Karras'
  //| 'DPM++ SDE' | 'DPM++ SDE Karras'
  //| 'DDIM' | 'PLMS' | 'DPM fast' | 'DPM adaptive' | 'Restart'
  //| 'UniPC' | 'LCM';
    schedule: 'simple' | 'karras' | 'exponential';
    cfgScale: number;                  // keep 1 for Flux
    distilledCfg: number;              // 3‑4 recommended
    seed: number;                      // -1 = random
    width: number;
    height: number;
    modules: string[];                 // [clip, t5, vae]
  };

  /* === Prompting / generation ======================================== */
  systemMessage: string;
  maxTokens: number;
  keepAlive?: string | number;
  contextLength: number;
  temperature: number;
  stream: boolean;

  /* === Behaviour ====================================================== */
  wakeWords: string[];
  maxLines: number;

  /* === Endpoints & API keys ========================================== */
  endpoints: Record<string, string>;
  openrouterKey?: string;
  elevenlabsKey?: string;

  // Redis (required now)
  redis: { enabled: boolean; url: string; ttl: number };

  // Postgres
  postgres: { enabled: boolean; url: string };
}
