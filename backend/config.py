"""
Vocalis Configuration Module

Loads and provides access to configuration settings from environment variables
and the .env file.
"""

import os
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables from .env file
load_dotenv()


def _getenv(key: str, default=None):
    """Get environment variable value, stripping inline comments."""
    value = os.getenv(key, default)
    if value and isinstance(value, str):
        # Strip inline comments (everything after #)
        value = value.split('#')[0].strip()
    return value if value else default

# API Endpoints
LLM_API_ENDPOINT = _getenv("LLM_API_ENDPOINT", "http://127.0.0.1:1234/v1")
LLM_API_KEY = _getenv("LLM_API_KEY", "")
LLM_MODEL = _getenv("LLM_MODEL", "")
TTS_API_ENDPOINT = _getenv("TTS_API_ENDPOINT", "http://localhost:5005/v1/audio/speech")

# Whisper Model Configuration
WHISPER_MODEL = _getenv("WHISPER_MODEL", "tiny.en")

# TTS Configuration
TTS_MODEL = _getenv("TTS_MODEL", "tts-1")
TTS_VOICE = _getenv("TTS_VOICE", "tara")
TTS_FORMAT = _getenv("TTS_FORMAT", "wav")

# Web Server Configuration (HTTP + WebSocket on same port)
SERVER_HOST = _getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(_getenv("SERVER_PORT", 7744))

# Audio Processing
VAD_THRESHOLD = float(_getenv("VAD_THRESHOLD", 0.5))
VAD_BUFFER_SIZE = int(_getenv("VAD_BUFFER_SIZE", 30))
AUDIO_SAMPLE_RATE = int(_getenv("AUDIO_SAMPLE_RATE", 48000))

def get_config() -> Dict[str, Any]:
    """
    Returns all configuration settings as a dictionary.
    
    Returns:
        Dict[str, Any]: Dictionary containing all configuration settings
    """
    return {
        "llm_api_endpoint": LLM_API_ENDPOINT,
        "llm_api_key": LLM_API_KEY,
        "llm_model": LLM_MODEL,
        "tts_api_endpoint": TTS_API_ENDPOINT,
        "whisper_model": WHISPER_MODEL,
        "tts_model": TTS_MODEL,
        "tts_voice": TTS_VOICE,
        "tts_format": TTS_FORMAT,
        "server_host": SERVER_HOST,
        "server_port": SERVER_PORT,
        "vad_threshold": VAD_THRESHOLD,
        "vad_buffer_size": VAD_BUFFER_SIZE,
        "audio_sample_rate": AUDIO_SAMPLE_RATE,
    }
