# Multimodal Discord Bot 🤖🎨🎤🌐  

**The Ultimate AI Assistant for Discord with Text, Image, Voice, and Web Search Capabilities**  

A feature-rich Discord bot with **AI-powered text generation**, **image creation**, **voice synthesis**, and **web search integration**. Built with TypeScript and Docker for seamless deployment. Choose between local or cloud-based AI providers for each modality, and enjoy hybrid capabilities across all services!  

---

## 🌟 Key Features  

### 🤖 Intelligent Text Generation  

- **Local AI**: Ollama integration for private LLM interactions (supports GGUF models)  
- **Cloud AI**: OpenRouter support for cutting-edge models (e.g., DeepSeek, Llama, Mistral)  
- Context-aware conversations with **channel-specific memory**  
- **System message customization** for personality control  
- **Hybrid mode**: Mix local/cloud providers for different modalities  

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
2. Set SYSTEM_MESSAGE="file:./system_prompt.md" in .env
3. Build and run the bot:

```bash
# Build and start containers
docker compose build && docker compose up -d
```

---

## 🔧 Configuration  

### Essential Environment Variables (`.env`)  

```env
# Discord Bot Credentials
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id  # Optional for dev

# AI Providers
TEXTGEN_PROVIDER=ollama        # "ollama" or "openrouter"
VOICEGEN_PROVIDER=alltalk     # "alltalk" or "elevenlabs"
IMAGEGEN_PROVIDER=stablediffusion  # "stablediffusion"

# API Keys (for cloud services)
OPENROUTER_KEY=your_openrouter_key
ELEVENLABS_KEY=your_elevenlabs_key
TAVILY_KEY=your_tavily_key  # ← New addition

# Performance Tuning
TEMPERATURE=0.4          # 0-1, higher = more creative
MAX_TOKENS=8192          # Maximum response length
CONTEXT_LENGTH=32768   # Conversation history limit
MAX_LINES=25           # Visible message history
KEEP_ALIVE=0            # Ollama model retention (0 unloads immediately)
WAKE_WORDS=bot,help    # Comma-separated wake words
```  

### AI Endpoints Configuration (`config.yaml`)  

```yaml
endpoints:
  ollama: http://127.0.0.1:11434          # Local Ollama instance
  stablediffusion: http://127.0.0.1:7860  # Stable Diffusion WebUI Forge
  alltalk: http://127.0.0.1:7851          # AllTalk TTS server
  elevenlabs: https://api.elevenlabs.io/v1 # ElevenLabs base URL

# Redis Cache Configuration
redis:
  enabled: true
  url: redis://redis:6379
  ttl: -1  # No expiry by default

# PostgreSQL Persistence
postgres:
  enabled: true
  url: postgresql://bot:bot@postgres:5432/bot

# Web Search Settings
search:
  provider: tavily  # ← New section
  tavilyKey: ${TAVILY_KEY}
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
