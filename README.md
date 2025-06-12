# Multimodal Discord Bot 🤖🎨🎤🌐  

**The Ultimate AI Assistant for Discord with Text, Image, Voice, and Web Search Capabilities**  

A feature-rich Discord bot with **AI-powered text generation**, **image creation**, **voice synthesis**, and **web search integration**. Built with TypeScript and Docker for seamless deployment. Choose between local or cloud-based AI providers for each modality, and enjoy hybrid capabilities across all services!  

---

## 🌟 Key Features  

### 🤖 Intelligent Text Generation  

- **Local AI**: Ollama integration for private LLM interactions (supports GGUF models)  
- **Cloud AI**: OpenRouter support for cutting-edge models (e.g., DeepSeek, ChatGPT, Llama, Mistral, Gemini, etc.)  
- Context-aware conversations with **channel-specific memory**  
- **System message customization** for very granular personality control  
- **Hybrid mode**: Mix local/cloud providers for different modalities as necessary

### 🎨 Dynamic Image Generation  

- Integration with **Stable Diffusion WebUI Forge** for high-quality image synthesis  
- **Custom model support** via `FLUX_MODEL_NAME` (e.g., EVERFLUX_x1)  
- Text-to-image generation with configurable steps (default: 28)  
- Fast GPU-accelerated generation when using local SD instance  

### 🎤 Natural Voice Synthesis  

- **Local TTS**: AllTalk for private voice generation  
- **Cloud TTS**: ElevenLabs integration for human-like voices  
- Automatic voice message handling with **model-specific voice profiles**  
- Multiple voice model support via provider configuration  

### 🔍 Web Search Integration  

- **Tavily-powered search** for real-time information retrieval  
- Smart query generation using LLM to optimize search results  
- Returns formatted results with titles and URLs  
- Configurable via `SEARCH_PROVIDER` and `TAVILY_KEY`  

### ⚙️ Infrastructure & Scalability  

- **Redis-based conversation caching** with TTL (Time-to-Live) control  
- **PostgreSQL interaction logging** for analytics and auditing  
- **Docker-first architecture** with Redis, PostgreSQL, and AI services  
- Configurable through environment variables and YAML  
- Modular command system for easy extensibility

### 🤖 Agentic Capacity

A new tool-call router now lets the LLM embed lines such as

```bash
Tool Call: /web "how tall is the ISS"
Tool call: /img "retro neon corgi"
```

inside its free-form reply; the bot parses those lines, executes the matching helper (Tavily search or Stable-Diffusion Forge for image generation) via regex (`tooCallRouter.ts`), and returns rich content—all without ever “faking” a Discord slash interaction, which Discord explicitly forbids for bots

---

## 🚀 Quick Start Guide  

### Prerequisites  

- **Node.js 23+** (Docker uses `node:23-alpine`)  
- Docker & Docker Compose  
- Discord Developer Account (for bot token)  
- AI Provider Accounts:  
  - Ollama (local) or OpenRouter (cloud) for text  
  - Stable Diffusion Forge (local) for images  
  - AllTalk (local) or ElevenLabs (cloud) for voice  
  - Tavily (cloud) for web search  

### Installation  

```bash
# Clone repository
git clone https://github.com/BenevolenceMessiah/multimodal-discord-bot
cd multimodal-discord-bot

# Copy environment template
cp .env.sample .env

# Configure your settings (see below)
nano .env

# Build and start containers
docker compose build
docker compose up -d
```

-Or, if you want your bot to have a personality and a more complex system prompt (suggested)-

1. create a file called `system_prompt.md` and load it with as much stuff as you want.
2. Set `SYSTEM_MESSAGE="file:./system_prompt.md"` in the `.env` file.
3. Build and run the bot:
4. It is suggested you put the following into your `system_prompt.md` file:

```system_prompt.md
## Primary Function

- Your core responsibility is to be a member and moderator of various Discord servers.
- You have access to various tool calls accessed by the end user through /commands. This includes web search queries (`/web`) and image generation capabilities (`/img`).
- You can autonomously call these tools as needed.

## Tool calls and Abilities

- You have the ability to @mention users in the Discord server if necessary.
- You have access to various tool calls via slash commands:
- When using Tool calls, you must follow the specified format for each tool call outlined in the following examples.

### /web

Utilizes Tavily for web search queries

#### Example Tool Useage of /web

Tool Call: /web "how big is the sun"

### /img

Utilizes Stable Diffusion WebUI Forge API for Image Generation.

#### Example Tool Useage of /img

Tool call: /img "a serene beach at sunset with palm trees, gentle waves, and a lone seagull in mid-flight."
```

5. Once Configuration is complete, build and start the containers:

```bash
# Build and start containers
docker compose build && docker compose up -d
```

---

## 🔧 Configuration  

### Environment Variables (`.env`)  

```env
# Discord Bot Credentials
DISCORD_TOKEN=                 # Your bot token
CLIENT_ID=                     # Your application (client) ID
GUILD_ID=                      # (Optional) Guild ID for development

# Text Generation (Ollama / OpenRouter)
TEXTGEN_PROVIDER=ollama        # "ollama" or "openrouter"
MODEL_OLLAMA=hf.co/BenevolenceMessiah/FuseChat-Qwen-2.5-7B-Instruct-Q8_0-GGUF:Q8_0
MODEL_OPENROUTER=deepseek/deepseek-chat-v3-0324:free
OPENROUTER_KEY=                # Only if using OpenRouter

# Image Generation (Stable Diffusion Forge FLUX)
IMAGEGEN_PROVIDER=stablediffusion
FLUX_MODEL_NAME=EVERFLUX_x1
SD_URL=http://host.docker.internal:7860    # Forge FLUX API endpoint

# Forge/Flux Settings
FLUX_ENABLED=true
FLUX_STEPS=20
FLUX_SAMPLER=euler
FLUX_SCHEDULE=simple
FLUX_CFG_SCALE=1
FLUX_DISTILLED_CFG=3.5
FLUX_SEED=-1
FLUX_WIDTH=896
FLUX_HEIGHT=1152
FLUX_MODULE_1=clipLFullFP32Zer0int_textImprovedFP32.safetensors
FLUX_MODULE_2=fluxT5XxlTextencoder_v10.safetensors
FLUX_MODULE_3=FLUX_VAE.safetensors # Must be VAE in MODULE_3 or else edit image.ts "sd_vae: config.flux.modules[2]," and set module number to VAE

# Voice Generation (AllTalk / ElevenLabs)
VOICEGEN_PROVIDER=alltalk      # "alltalk" or "elevenlabs"
MODEL_ALLTALK=xttsv2_2.0.2
ALLTALK_URL=http://host.docker.internal:7851
ELEVENLABS_KEY=                # Only if using ElevenLabs

# Web Search (Tavily)
SEARCH_PROVIDER=tavily          # Currently only "tavily"
TAVILY_KEY=                    # Your Tavily API key

# Bot Behavior & Tuning
SYSTEM_MESSAGE="# System Rules\nYou are a helpful Discord bot.\n- respond politely\n- cite sources"
# SYSTEM_MESSAGE="file:./system_prompt.md"
TEMPERATURE=0.4                # LLM temperature
KEEP_ALIVE=10                    # Ollama keep_alive (0 unloads immediately)
MAX_TOKENS=8192
CONTEXT_LENGTH=32768             # Max past tokens to include
WAKE_WORDS='["bot","help"]'      # Comma-separated list of wakewords
MAX_LINES=25                    # How many past messages to store
HIDE_THOUGHT_PROCESS=false      # Set to true to hide the thought process block

# Cache & Storage
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379    # Redis connection URL
REDIS_TTL=-1                    # Seconds, -1 = no expiry
POSTGRES_ENABLED=true
POSTGRES_URL=postgresql://bot:bot@postgres:5432/bot
```  

### AI Endpoints Configuration (`config.yaml`)  

```yaml
# Providers
textgenProvider: ${TEXTGEN_PROVIDER:-ollama}
voicegenProvider: ${VOICEGEN_PROVIDER:-alltalk}
imagegenProvider: ${IMAGEGEN_PROVIDER:-stablediffusion}

# Models
modelOllama: ${MODEL_OLLAMA}
modelOpenrouter: ${MODEL_OPENROUTER}
modelAlltalk: ${MODEL_ALLTALK}

# ─── FLUX block ────────────────────────────────────────
flux:
  enabled: ${FLUX_ENABLED:-true}
  modelName: ${FLUX_MODEL_NAME}
  steps: ${FLUX_STEPS:-20}
  sampler: ${FLUX_SAMPLER:-Euler}
  schedule: ${FLUX_SCHEDULE:-Simple}
  cfgScale: ${FLUX_CFG_SCALE:-1}
  distilledCfg: ${FLUX_DISTILLED_CFG:-3.5}
  seed: ${FLUX_SEED:--1}
  width: ${FLUX_WIDTH:-896}
  height: ${FLUX_HEIGHT:-1152}
  modules:
    - ${FLUX_MODULE_1}
    - ${FLUX_MODULE_2}
    - ${FLUX_MODULE_3}

# System Prompt (Markdown allowed)
systemMessage: |
  ${SYSTEM_MESSAGE:-"""
  # System Rules
  You are a helpful Discord bot.
  """}

# Generation parameters
maxTokens: ${MAX_TOKENS:-2048}
keepAlive: ${KEEP_ALIVE:-10}
contextLength: ${CONTEXT_LENGTH:-4096}
temperature: ${TEMPERATURE:-0.3}
stream: ${STREAM:-false}

# Context roll‑up
wakeWords: ${WAKE_WORDS:-["hey bot","listen"]}
maxLines: ${MAX_LINES:-25}

# Endpoints
endpoints:
  ollama: ${OLLAMA_URL:-http://host.docker.internal:11434}
  stablediffusion: ${SD_URL:-http://host.docker.internal:7860}
  alltalk: ${ALLTALK_URL:-http://host.docker.internal:7851}
  elevenlabs: ${ELEVENLABS_URL:-https://api.elevenlabs.io/v1}

# Keys
openrouterKey: ${OPENROUTER_KEY}
elevenlabsKey: ${ELEVENLABS_KEY}

# Redis
redis:
  enabled: ${REDIS_ENABLED:-true}
  url: ${REDIS_URL:-redis://localhost:6379}
  ttl: ${REDIS_TTL:-3600}

# Postgres
postgres:
  enabled: ${POSTGRES_ENABLED:-true}
  url: ${POSTGRES_URL:-postgresql://bot:bot@localhost:5432/bot}

# Search
search:
  provider: ${SEARCH_PROVIDER:-tavily}
  tavilyKey: ${TAVILY_KEY}

# Thought process display
hideThoughtProcess: ${HIDE_THOUGHT_PROCESS:-false}
```  

---

## 🎮 Command Reference  

### Core Commands  

| Command         | Description                      | Example                     |  
|-----------------|----------------------------------|-----------------------------|  
| `/say [prompt]` | Force immediate AI response      | `/say Explain quantum physics` |  
| `/img [prompt]` | Generate image from text         | `/img Mystical forest at dusk` |  
| `/clear`        | Reset conversation memory        | `/clear`                    |  
| `/web [topic]`  | Run a Tavily web search        | `/web Current weather in Tokyo` |  

### Thread Management  

| Command               | Description                      | Example Usage            |  
|-----------------------|----------------------------------|--------------------------|  
| `/thread [name]`      | Create public discussion thread  | `/thread General Chat`   |  
| `/thread-private [name]` | Create private thread with invites | `/thread-private Secret Discussion` |  

---

## 🏗 Architecture Overview  

```mermaid
graph TD
    A[Discord Client] --> B[Bot Service]
    B --> C[Text Generation]
    B --> D[Image Generation]
    B --> E[Voice Synthesis]
    B --> F[Web Search]
    C --> G[Ollama/OpenRouter]
    D --> H[Stable Diffusion Forge]
    E --> I[AllTalk/ElevenLabs]
    F --> J[Tavily Search API]
    B --> K[Redis Cache]
    B --> L[PostgreSQL DB]
```  

---

## 📦 Dependencies  

### Core Services  

- **Redis**: Conversation caching and message history  
- **PostgreSQL**: Interaction logging and analytics  
- **Docker**: Container orchestration for all services  

### AI Providers  

```mermaid
pie
    title Modality Providers
    "Local (Ollama)": 30
    "Cloud (OpenRouter)": 30
    "Local (Stable Diffusion)": 15
    "Cloud (ElevenLabs)": 15
    "Cloud (Tavily)": 10
```  

---

## 💡 Usage Tips  

1. **Wake Words**: Use natural triggers like "hey bot" in conversations  
2. **Context Awareness**: The bot maintains separate memory per channel  
3. **Hybrid Mode**: Combine local (Ollama/AllTalk) and cloud (OpenRouter/ElevenLabs) providers  
4. **Rate Limiting**: Built-in safeguards prevent API abuse  
5. **Web Research**: Use `/web` to fetch up-to-date information for complex queries  

---

## 🚀 Roadmap / Future Improvements

^[Enhancing the multimodal-discord-bot with powerful new capabilities:]({"attribution":{"attributableIndex":"0-1"}})

### 🔹 Smart Summarizer

- ^[**Feature**: Summarizes entire channel discussions on-demand (e.g. /summarize), or daily digests via scheduled tasks.]({"attribution":{"attributableIndex":"0-2"}})
- ^[**Leverages**: LLMs (e.g. GPT‑4) for concise, context-aware summaries.]({"attribution":{"attributableIndex":"0-3"}})
- *Inspiration/Precedents*:
  - ^["Summary Bot" services that compress long chat histories]({"attribution":{"attributableIndex":"0-4"}})  [oai_citation:0‡github.com](https://github.com/rauljordan/daily-discord-summarizer?utm_source=chatgpt.com) [oai_citation:1‡top.gg](https://top.gg/tag/summary?utm_source=chatgpt.com).
  - ^[GitHub project [Daily Discord Summarizer](https://github.com/rauljordan/daily-discord-summarizer) for scheduled digests]({"attribution":{"attributableIndex":"547-0"}})  [oai_citation:2‡github.com](https://github.com/rauljordan/daily-discord-summarizer?utm_source=chatgpt.com).
  - ^[TLDRBot-style /tldr implementations for quick summary commands]({"attribution":{"attributableIndex":"693-0"}})  [oai_citation:3‡notta.ai](https://www.notta.ai/en/blog/summary-bot?utm_source=chatgpt.com).

---

### 🔹 Event Creation & Scheduling

- ^[**Feature**: Slash commands such as /create-event, RSVP, timezone management, reminders, and attendance tracking.]({"attribution":{"attributableIndex":"783-0"}})
- *Inspiration/Precedents*:
  - ^[[ScheduleBot](https://github.com/Duinrahaic/ScheduleBot) for community event handling]({"attribution":{"attributableIndex":"783-1"}})  [oai_citation:4‡github.com](https://github.com/Duinrahaic/ScheduleBot?utm_source=chatgpt.com).
  - ^[[Group Up](https://github.com/Burn-E99/GroupUp) using slash commands and threads for events]({"attribution":{"attributableIndex":"1082-0"}})  [oai_citation:5‡github.com](https://github.com/Burn-E99/GroupUp?utm_source=chatgpt.com).
  - ^[[DiscoCal](https://github.com/GyroJoe/DiscoCal) for easy calendar-based event creation]({"attribution":{"attributableIndex":"1199-0"}})  [oai_citation:6‡github.com](https://github.com/GyroJoe/DiscoCal?utm_source=chatgpt.com).

---

### 🔹 Gamification & Engagement Tools

- ^[**Feature**: XP/leveling, experience points, leaderboard and role rewards, mini‑games, counting or trivia games, and interactive quests.]({"attribution":{"attributableIndex":"1312-0"}})
- *Inspiration/Precedents*:
  - ^[MEE6/Carl‑bot: XP, roles, leveling, reaction roles]({"attribution":{"attributableIndex":"1312-1"}})  [oai_citation:7‡rewardtheworld.net](https://rewardtheworld.net/gamification-on-discord-engaging-community-members/?utm_source=chatgpt.com) [oai_citation:8‡rebeccareesey.medium.com](https://rebeccareesey.medium.com/4-discord-bots-every-server-owner-should-use-to-generate-more-engagement-dc6150c87f8?utm_source=chatgpt.com).
  - ^[Counting‑style bots for simple community games]({"attribution":{"attributableIndex":"1615-0"}})  [oai_citation:9‡reddit.com](https://www.reddit.com/r/Discord_Bots/comments/1i9rk7w/what_are_the_simplest_bots_for_promoting/?utm_source=chatgpt.com).
  - ^[Interactive game bots with quests, stats, etc.]({"attribution":{"attributableIndex":"1702-0"}})  [oai_citation:10‡botpenguin.com](https://botpenguin.com/blogs/leveling-up-customer-experiences-discord-game-bot?utm_source=chatgpt.com).

---

### 🔹 /vid: API‑based Video Generation

- *Feature*: /vid command to generate short videos.
- *Integration*:
  - [CogVideo](https://github.com/THUDM/CogVideo) and [cogstudio](https://github.com/pinokiofactory/cogstudio) from THUDM — text-to-video API.

---

### 🔹 /img2vid: Image‑to‑Video Generation

- *Feature*: /img2vid for animating static images into short videos.
- *Integration*:
  - [FramePack](https://github.com/lllyasviel/FramePack) for image-to-video support.

---

### 🔹 /music: AI‑Generated Music Creation

- *Feature*: /music command to compose music clips or tracks.
- *Integration*:
  - [ACE‑Step](https://github.com/ace-step/ACE-Step) to generate music via AI.

---

## 🚨 Troubleshooting  

Common Issues:  

- **Connection Errors**: Verify AI service URLs in `config.yaml`  
- **Permission Issues**: Ensure bot has `Send Messages`, `Manage Threads`, and `Read Message History`  
- **Memory Limits**: Adjust `MAX_TOKENS` and `CONTEXT_LENGTH` in `.env`  
- **Search Failures**: Check `TAVILY_KEY` and `SEARCH_PROVIDER`  

View logs with:  

```bash
docker compose logs -f bot
```  

---

## 📚 Documentation Links  

- [Ollama Setup Guide](https://ollama.ai)  
- [Stable Diffusion WebUI Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge)  
- [AllTalk TTS Server](https://github.com/erew123/alltalk_tts)  
- [ElevenLabs API Docs](https://elevenlabs.io/docs)  
- [Tavily Search API](https://docs.tavily.com)  
- [Discord Developer Portal](https://discord.com/developers/docs)  

---

## 🤝 Contributing  

PRs welcome! Please follow these guidelines:

1. Maintain **TypeScript type safety**  
2. Keep **Docker compatibility**  
3. Add **tests for new features**  
4. Update **documentation** (including this README)  
5. Use **modular command structure**  

---

## 📜 License  

MIT License - See [LICENSE](LICENSE) for details  
Copyright (c) 2025 Benevolence Messiah  
