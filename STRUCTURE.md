# Vocalis Codebase Structure

## Project Overview

Vocalis is a speech-to-speech AI assistant with real-time conversation capabilities. It features barge-in/interruption support, AI-initiated greetings, silence-based follow-ups, image analysis (vision), and session management. The architecture separates concerns between a React frontend for UI/interaction and a FastAPI backend for AI processing and orchestration.

**Current Version**: 1.5.0 (Vision Update)

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React hooks (no Redux/Zustand)

### Backend
- **Framework**: FastAPI (Python)
- **WebSocket Server**: Native FastAPI WebSocket support
- **AI Models**:
  - **STT**: Faster-Whisper (local)
  - **LLM**: External OpenAI-compatible API (default: LM Studio)
  - **TTS**: External OpenAI-compatible API (default: Orpheus-FASTAPI)
  - **Vision**: SmolVLM-256M-Instruct (local, via transformers)
- **Key Libraries**: numpy, torch, transformers, websockets

### Communication
- **Primary Protocol**: WebSocket (bidirectional streaming)
- **Fallback**: HTTP endpoints for health/config checks

---

## Directory Structure

```
Vocalis/
├── backend/                      # FastAPI backend
│   ├── main.py                   # Entry point, service initialization
│   ├── config.py                 # Environment configuration loader
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Environment variables (API endpoints, models)
│   ├── routes/
│   │   ├── __init__.py
│   │   └── websocket.py          # WebSocket endpoint + MessageType definitions
│   ├── services/                 # Core business logic
│   │   ├── __init__.py
│   │   ├── transcription.py      # Whisper STT + VAD
│   │   ├── llm.py                # LLM API client + conversation history
│   │   ├── tts.py                # TTS API client
│   │   ├── vision.py             # SmolVLM image processing
│   │   └── conversation_storage.py  # Session persistence (JSON files)
│   └── prompts/                  # Persisted user data
│       ├── system_prompt.md      # AI behavior prompt
│       ├── user_profile.json     # User name/preferences
│       └── vision_settings.json  # Vision feature toggle
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── App.tsx               # Root component, sidebar toggle
│   │   ├── main.tsx              # React entry point
│   │   ├── index.css             # Global styles + Tailwind
│   │   ├── components/           # React components
│   │   │   ├── AssistantOrb.tsx      # Animated voice assistant orb
│   │   │   ├── BackgroundStars.tsx   # Cosmic background effect
│   │   │   ├── ChatInterface.tsx     # Main chat UI (orb + transcript)
│   │   │   ├── PreferencesModal.tsx  # Settings modal
│   │   │   ├── SessionManager.tsx    # Save/load conversation sessions
│   │   │   └── Sidebar.tsx           # Navigation sidebar
│   │   ├── services/             # Frontend services
│   │   │   ├── websocket.ts      # WebSocket client
│   │   │   └── audio.ts          # Web Audio API handling
│   │   └── utils/
│   │       └── hooks.ts          # Custom React hooks
│   ├── package.json              # NPM dependencies
│   ├── vite.config.ts            # Vite configuration
│   ├── tailwind.config.js        # Tailwind configuration
│   └── tsconfig.json             # TypeScript configuration
│
├── conversations/                # Session storage (created at runtime)
│   └── *.json                    # Saved conversation sessions
│
├── setup.bat / setup.sh          # One-time environment setup
├── run.bat / run.sh              # Start both frontend and backend
├── install-deps.bat / install-deps.sh  # Dependency update
└── README.md                     # User-facing documentation
```

---

## Service Architecture

### Backend Services

All services are initialized in `main.py` during FastAPI lifespan and injected into the WebSocket route.

#### 1. WhisperTranscriber (`services/transcription.py`)
**Purpose**: Speech-to-text with built-in VAD
- Uses Faster-Whisper library
- Auto-detects CUDA/CPU
- Model size configurable via `WHISPER_MODEL` env var
- Processes raw audio (WAV format with headers)
- **Key Method**: `transcribe(audio: np.ndarray) -> Tuple[str, Dict]`

#### 2. LLMClient (`services/llm.py`)
**Purpose**: Communicate with external LLM API
- OpenAI-compatible API format
- Maintains conversation history (max 50 messages)
- Configurable temperature, max_tokens
- **Key Method**: `get_response(user_input, system_prompt) -> Dict`
- **Key Attribute**: `conversation_history: List[Dict]`

#### 3. TTSClient (`services/tts.py`)
**Purpose**: Convert text to speech via external API
- OpenAI-compatible TTS endpoints
- Supports multiple voices and formats
- Returns complete audio file (not streaming)
- **Key Method**: `async_text_to_speech(text) -> bytes`

#### 4. VisionService (`services/vision.py`)
**Purpose**: Image analysis using SmolVLM
- Singleton pattern (auto-initialized)
- Loads SmolVLM-256M-Instruct model
- Processes base64-encoded images
- **Key Method**: `process_image(image_base64, prompt) -> str`

#### 5. ConversationStorage (`services/conversation_storage.py`)
**Purpose**: Persist conversation sessions
- Stores as JSON files in `conversations/` directory
- UUID-based session IDs
- Async file I/O
- **Key Methods**: `save_session()`, `load_session()`, `list_sessions()`, `delete_session()`

### Frontend Services

#### 1. WebSocketService (`services/websocket.ts`)
**Purpose**: Manage WebSocket connection to backend
- Event-driven architecture
- Handles connection state
- Message type routing
- **Key Methods**: `connect()`, `sendAudio()`, `addEventListener()`

#### 2. AudioService (`services/audio.ts`)
**Purpose**: Web Audio API management
- Microphone capture
- Audio playback
- Buffer management
- Interrupt handling

---

## Message Types & Protocol

All WebSocket communication uses JSON messages with a `type` field. Message types are defined in `backend/routes/websocket.py`:

### Core Message Types

```python
class MessageType:
    AUDIO = "audio"                          # Client -> Server: Audio data (base64)
    TRANSCRIPTION = "transcription"          # Server -> Client: STT result
    LLM_RESPONSE = "llm_response"            # Server -> Client: AI text response
    TTS_CHUNK = "tts_chunk"                  # Server -> Client: Audio data (base64)
    TTS_START = "tts_start"                  # Server -> Client: TTS beginning
    TTS_END = "tts_end"                      # Server -> Client: TTS complete
    STATUS = "status"                        # Server -> Client: State updates
    ERROR = "error"                          # Server -> Client: Error info
```

### Configuration Message Types

```python
    SYSTEM_PROMPT = "system_prompt"          # Get current prompt
    SYSTEM_PROMPT_UPDATED = "system_prompt_updated"  # Confirmation
    USER_PROFILE = "user_profile"            # Get user name
    USER_PROFILE_UPDATED = "user_profile_updated"    # Confirmation
    VISION_SETTINGS = "vision_settings"      # Get vision toggle
    VISION_SETTINGS_UPDATED = "vision_settings_updated"
```

### Conversation Flow Message Types

```python
    GREETING = "greeting"                    # Client -> Server: Request AI greeting
    SILENT_FOLLOWUP = "silent_followup"      # Client -> Server: Silence detected
    
    # Session Management
    SAVE_SESSION = "save_session"            # Save current conversation
    SAVE_SESSION_RESULT = "save_session_result"
    LOAD_SESSION = "load_session"            # Load saved conversation
    LOAD_SESSION_RESULT = "load_session_result"
    LIST_SESSIONS = "list_sessions"          # Get all sessions
    LIST_SESSIONS_RESULT = "list_sessions_result"
    DELETE_SESSION = "delete_session"        # Remove session
    DELETE_SESSION_RESULT = "delete_session_result"
```

### Vision Message Types

```python
    VISION_FILE_UPLOAD = "vision_file_upload"      # Client -> Server: Image data
    VISION_FILE_UPLOAD_RESULT = "vision_file_upload_result"
    VISION_PROCESSING = "vision_processing"        # Server -> Client: Processing status
    VISION_READY = "vision_ready"                  # Server -> Client: Analysis complete
```

### Control Message Types

```python
    # Sent by client
    "interrupt"                    # Cancel current TTS
    "clear_history"               # Reset conversation
    "ping" / "pong"               # Keepalive
    
    # Sent by server
    "get_system_prompt"           # Request current prompt
    "update_system_prompt"        # Change system prompt
    "get_user_profile"            # Request user profile
    "update_user_profile"         # Update user name
    "get_vision_settings"         # Request vision settings
    "update_vision_settings"      # Toggle vision
```

---

## Configuration System

### Environment Variables (`.env`)

Located in `backend/.env`:

```bash
# API Endpoints
LLM_API_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions
TTS_API_ENDPOINT=http://localhost:5005/v1/audio/speech

# Whisper Configuration
WHISPER_MODEL=base              # tiny.en, base.en, small.en, medium.en, large

# TTS Configuration
TTS_MODEL=tts-1
TTS_VOICE=tara
TTS_FORMAT=wav

# Server Configuration
WEBSOCKET_HOST=0.0.0.0
WEBSOCKET_PORT=8000

# Audio Processing
VAD_THRESHOLD=0.1
VAD_BUFFER_SIZE=30
AUDIO_SAMPLE_RATE=44100
```

### Runtime Configuration (`config.py`)

Loads `.env` using `python-dotenv`. Provides `get_config()` function returning a dictionary of all settings. Used by `main.py` to initialize services.

### User-Modifiable Configuration (`prompts/`)

- **system_prompt.md**: AI behavior instructions (editable via UI)
- **user_profile.json**: User name and preferences
- **vision_settings.json**: Vision feature toggle state

These files are auto-created with defaults if missing.

---

## Data Flow & Conversation Pipeline

### Normal Conversation Flow

1. **Client** captures audio via Web Audio API
2. **Client** performs Voice Activity Detection (VAD) using RMS energy threshold (0.01)
3. **Client** buffers audio while voice is detected; after 1000ms silence timeout, sends accumulated audio
4. **Client** sends binary audio data via WebSocket (`AUDIO` message)
5. **Server** (WebSocketManager) receives audio, interrupts any playing TTS
6. **Server** calls `WhisperTranscriber.transcribe()` -> returns text
7. **Server** sends `TRANSCRIPTION` message to client
8. **Server** calls `LLMClient.get_response()` with transcribed text
9. **Server** sends `LLM_RESPONSE` message to client
10. **Server** calls `TTSClient.async_text_to_speech()` -> returns audio bytes
11. **Server** sends `TTS_START`, then `TTS_CHUNK` (base64 audio), then `TTS_END`
12. **Client** plays audio via Web Audio API

**Voice Activity Detection**: Located in `frontend/src/services/audio.ts`. Uses real-time RMS energy analysis to detect speech start/stop. Configurable: `voiceThreshold` (0.01), `silenceTimeout` (1000ms), `minRecordingLength` (1000ms).

### Barge-In / Interruption Flow

1. User speaks during AI playback
2. **Client** sends `interrupt` message (or new `AUDIO` message)
3. **Server** sets `interrupt_playback` Event
4. **Server** stops TTS generation, clears audio buffer
5. **Server** sends stop signal to client
6. **Client** clears audio buffer, stops playback
7. Normal conversation flow resumes with new user input

### Session Management Flow

1. **Client** sends `SAVE_SESSION` with optional title
2. **Server** calls `ConversationStorage.save_session()`
3. **Server** persists to `conversations/{uuid}.json`
4. **Server** sends `SAVE_SESSION_RESULT`

### Vision Flow

1. **Client** sends `VISION_FILE_UPLOAD` with base64 image
2. **Server** calls `VisionService.process_image()` (in thread pool)
3. **Server** stores result in `current_vision_context`
4. **Server** sends `VISION_READY` with description
5. Next user query is enhanced with vision context before LLM call

---

## Component Responsibilities

### Backend Components

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app, service initialization, lifespan management |
| `config.py` | Environment variable loading, config aggregation |
| `routes/websocket.py` | WebSocket endpoint, MessageType definitions, WebSocketManager |
| `services/transcription.py` | Whisper model, STT, VAD |
| `services/llm.py` | LLM API client, conversation history management |
| `services/tts.py` | TTS API client |
| `services/vision.py` | SmolVLM model, image processing |
| `services/conversation_storage.py` | JSON file I/O for sessions |

### Frontend Components

| File | Responsibility |
|------|---------------|
| `App.tsx` | Root layout, sidebar toggle, connection status |
| `components/ChatInterface.tsx` | Main UI (orb, transcript, controls) |
| `components/AssistantOrb.tsx` | Animated voice assistant visualization |
| `components/BackgroundStars.tsx` | Cosmic background effect |
| `components/Sidebar.tsx` | Navigation, preferences button |
| `components/PreferencesModal.tsx` | Settings (name, prompt, vision toggle) |
| `components/SessionManager.tsx` | Save/load conversation UI |
| `services/websocket.ts` | WebSocket client connection |
| `services/audio.ts` | Microphone and audio playback |

---

## Development Workflow

### Initial Setup

```bash
# Windows
setup.bat      # Creates venv, installs deps, configures .env

# macOS/Linux
chmod +x *.sh
./setup.sh
```

### Running Development Servers

```bash
# Windows
run.bat        # Starts both backend (port 8000) and frontend (port 5173)

# macOS/Linux
./run.sh
```

### Manual Development

```bash
# Terminal 1 - Backend
cd backend
python -m backend.main

# Terminal 2 - Frontend
cd frontend
npm run dev
```

---

## Navigation Guide for Developers

### "I want to modify..."

| Task | Where to Look |
|------|--------------|
| **STT accuracy/speed** | `backend/services/transcription.py` - Whisper model size, beam_size |
| **LLM integration** | `backend/services/llm.py` - API format, headers, conversation management |
| **TTS voice/format** | `backend/services/tts.py` - API endpoint, voice selection |
| **Vision/image analysis** | `backend/services/vision.py` - SmolVLM prompt, processing |
| **Conversation memory** | `backend/services/llm.py` - `conversation_history`, `add_to_history()` |
| **Session persistence** | `backend/services/conversation_storage.py` - JSON structure |
| **WebSocket protocol** | `backend/routes/websocket.py` - MessageType, handlers |
| **UI styling** | `frontend/src/index.css`, `tailwind.config.js` |
| **Chat interface** | `frontend/src/components/ChatInterface.tsx` |
| **Audio handling** | `frontend/src/services/audio.ts` |
| **Configuration** | `backend/config.py`, `backend/.env` |
| **System prompts** | `backend/prompts/system_prompt.md` (or UI preferences) |

### Key Integration Points

- **Adding new message type**: Update `MessageType` class in `websocket.py`, add handler in `WebSocketManager.handle_client_message()`
- **Adding new service**: Create in `services/`, initialize in `main.py` lifespan, inject into WebSocket route
- **Modifying UI state**: React hooks in components, events via WebSocketService
- **External API changes**: Update `backend/.env` and corresponding service file

---

## External Dependencies

### Required External Services

1. **LLM API**: Must expose OpenAI-compatible `/v1/chat/completions` endpoint
   - Default: LM Studio running locally on port 1234
   - Alternative: Any OpenAI-compatible server

2. **TTS API**: Must expose OpenAI-compatible `/v1/audio/speech` endpoint
   - Default: Orpheus-FASTAPI on port 5005
   - Alternative: Kokoro-FastAPI or other compatible services

### Downloaded Models (Auto)

- **Whisper**: Downloaded on first run by Faster-Whisper (size based on config)
- **SmolVLM**: Downloaded on startup by transformers library (~500MB)

---

## Performance Considerations

- **Latency Target**: <500ms end-to-end
- **Whisper Model**: Use `tiny.en` or `base.en` for speed, larger models for accuracy
- **Audio Buffer**: 20-50ms chunks for streaming
- **Conversation History**: Limited to 50 messages (configurable in `llm.py`)
- **Session Files**: Stored in `conversations/` directory (no database)
- **Vision**: Runs in thread pool to avoid blocking event loop

---

## Testing & Debugging

### Backend Logs
- All services use Python `logging` module
- Default level: INFO
- Check console output for timing metrics and errors

### Frontend Debugging
- React DevTools for component state
- Browser DevTools Network tab for WebSocket frames
- Console logs for audio/connection status

### Health Check
```bash
curl http://localhost:8000/health
```

Returns status of all services and configuration.

---

## License

Apache License 2.0 - See LICENSE file

---

**Last Updated**: Generated from codebase analysis  
**Maintainers**: Lex-au and contributors