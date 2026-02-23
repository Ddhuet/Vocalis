"""
Speech-to-Text Transcription Service

Uses NVIDIA Parakeet (via NeMo) to transcribe speech audio.
"""

import numpy as np
import logging
import io
import struct
from typing import Dict, Any, List, Optional, Tuple
from scipy import signal
import time
import torch

import nemo.collections.asr as nemo_asr

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParakeetTranscriber:
    """
    Speech-to-Text service using NVIDIA Parakeet (NeMo).
    
    Requires 16kHz mono audio. Handles resampling from any input sample rate.
    """
    
    TARGET_SAMPLE_RATE = 16000
    
    def __init__(
        self,
        model_name: str = "nvidia/parakeet-tdt-0.6b-v3",
        device: str = None,
    ):
        """
        Initialize the transcription service.
        
        Args:
            model_name: Parakeet model name (e.g., nvidia/parakeet-tdt-0.6b-v3)
            device: Device to run model on ('cpu' or 'cuda'), if None will auto-detect
        """
        self.model_name = model_name
        
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        self._initialize_model()
        
        self.is_processing = False
        
        logger.info(f"Initialized Parakeet Transcriber with model={model_name}, device={self.device}")
    
    def _initialize_model(self):
        """Initialize Parakeet model."""
        try:
            self.model = nemo_asr.models.ASRModel.from_pretrained(model_name=self.model_name)
            self.model.to(self.device)
            logger.info(f"Successfully loaded Parakeet model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load Parakeet model: {e}")
            raise
    
    def _parse_wav_header(self, audio_bytes: bytes) -> Tuple[int, int, int]:
        """
        Parse WAV header to extract audio parameters.
        
        Args:
            audio_bytes: Raw WAV file bytes
            
        Returns:
            Tuple of (sample_rate, num_channels, data_offset)
        """
        if len(audio_bytes) < 44:
            raise ValueError("Audio data too short to contain WAV header")
        
        riff = audio_bytes[0:4]
        wave = audio_bytes[8:12]
        
        if riff != b'RIFF' or wave != b'WAVE':
            raise ValueError("Invalid WAV header")
        
        sample_rate = struct.unpack('<I', audio_bytes[24:28])[0]
        num_channels = struct.unpack('<H', audio_bytes[22:24])[0]
        
        data_offset = 44
        
        chunk_id = audio_bytes[12:16]
        if chunk_id == b'fmt ':
            fmt_size = struct.unpack('<I', audio_bytes[16:20])[0]
            data_offset = 20 + fmt_size
            
            while data_offset < len(audio_bytes):
                if audio_bytes[data_offset:data_offset+4] == b'data':
                    break
                chunk_size = struct.unpack('<I', audio_bytes[data_offset+4:data_offset+8])[0]
                data_offset += 8 + chunk_size
        
        return sample_rate, num_channels, data_offset
    
    def _resample_audio(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """
        Resample audio from original sample rate to target sample rate.
        
        Args:
            audio: Audio samples as numpy array
            orig_sr: Original sample rate
            target_sr: Target sample rate
            
        Returns:
            Resampled audio array
        """
        if orig_sr == target_sr:
            return audio
        
        num_samples = int(len(audio) * target_sr / orig_sr)
        resampled = signal.resample(audio, num_samples)
        
        return resampled.astype(np.float32)
    
    def transcribe(self, audio: np.ndarray) -> Tuple[str, Dict[str, Any]]:
        """
        Transcribe audio data to text.
        
        Args:
            audio: Audio data as numpy array (WAV bytes as uint8 or float32)
            
        Returns:
            Tuple[str, Dict[str, Any]]: 
                - Transcribed text
                - Dictionary with additional information (confidence, language, etc.)
        """
        start_time = time.time()
        self.is_processing = True
        
        try:
            audio_array = None
            input_sample_rate = None
            
            if audio.dtype == np.uint8:
                audio_bytes = bytes(audio)
                
                try:
                    input_sample_rate, num_channels, data_offset = self._parse_wav_header(audio_bytes)
                    logger.debug(f"WAV header: sample_rate={input_sample_rate}, channels={num_channels}")
                    
                    raw_pcm = audio_bytes[data_offset:]
                    
                    pcm_int16 = np.frombuffer(raw_pcm, dtype=np.int16)
                    
                    audio_array = pcm_int16.astype(np.float32) / 32768.0
                    
                    if num_channels > 1:
                        audio_array = audio_array.reshape(-1, num_channels)
                        audio_array = audio_array.mean(axis=1)
                    
                except Exception as e:
                    logger.warning(f"Failed to parse WAV header: {e}, attempting direct processing")
                    audio_array = audio.astype(np.float32) / 255.0
                    input_sample_rate = 44100
            else:
                audio_array = audio.astype(np.float32)
                if np.max(np.abs(audio_array)) > 1.0:
                    audio_array = audio_array / np.max(np.abs(audio_array))
                input_sample_rate = 44100
            
            if input_sample_rate != self.TARGET_SAMPLE_RATE:
                logger.debug(f"Resampling from {input_sample_rate}Hz to {self.TARGET_SAMPLE_RATE}Hz")
                audio_array = self._resample_audio(audio_array, input_sample_rate, self.TARGET_SAMPLE_RATE)
            
            output = self.model.transcribe([audio_array])
            
            if output and len(output) > 0:
                result = output[0]
                if hasattr(result, 'text'):
                    text = result.text
                else:
                    text = str(result)
            else:
                text = ""
            
            processing_time = time.time() - start_time
            logger.info(f"Transcription completed in {processing_time:.2f}s: {text[:50]}...")
            
            metadata = {
                "confidence": 0.0,
                "language": "en",
                "processing_time": processing_time,
                "input_sample_rate": input_sample_rate,
                "resampled_to": self.TARGET_SAMPLE_RATE
            }
            
            return text, metadata
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return "", {"error": str(e)}
        finally:
            self.is_processing = False
    
    def transcribe_streaming(self, audio_generator):
        """
        Stream transcription results from an audio generator.
        
        Note: Parakeet doesn't natively support streaming in the same way as Whisper.
        This method accumulates audio and transcribes in chunks.
        
        Args:
            audio_generator: Generator yielding audio chunks
            
        Yields:
            Partial transcription results as they become available
        """
        self.is_processing = True
        
        try:
            accumulated_audio = []
            
            for chunk in audio_generator:
                accumulated_audio.append(chunk)
            
            if accumulated_audio:
                full_audio = np.concatenate(accumulated_audio)
                text, metadata = self.transcribe(full_audio)
                
                yield {
                    "text": text,
                    "start": 0,
                    "end": len(full_audio) / self.TARGET_SAMPLE_RATE,
                    "confidence": metadata.get("confidence", 0)
                }
                
        except Exception as e:
            logger.error(f"Streaming transcription error: {e}")
            yield {"error": str(e)}
        finally:
            self.is_processing = False
    
    def get_config(self) -> Dict[str, Any]:
        """
        Get the current configuration.
        
        Returns:
            Dict containing the current configuration
        """
        return {
            "model_name": self.model_name,
            "device": self.device,
            "target_sample_rate": self.TARGET_SAMPLE_RATE,
            "is_processing": self.is_processing
        }
