/**
 * Audio Service
 *
 * Handles audio recording, processing, and playback
 */

import websocketService, { WebSocketService } from './websocket';

// Audio configuration
interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  bufferSize: number;
}

// Default audio configuration
const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 44100, // Match microphone's native sample rate
  channelCount: 1, // Mono
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  bufferSize: 4096
};

// Audio service state
export enum AudioState {
  INACTIVE = 'inactive',
  RECORDING = 'recording',
  PLAYING = 'playing',
  SPEAKING = 'speaking',     // Playing TTS content specifically
  INTERRUPTED = 'interrupted'
}

// Audio service events
export enum AudioEvent {
  RECORDING_START = 'recording_start',
  RECORDING_STOP = 'recording_stop',
  RECORDING_DATA = 'recording_data',
  PLAYBACK_START = 'playback_start',
  PLAYBACK_STOP = 'playback_stop',
  PLAYBACK_END = 'playback_end',
  AUDIO_ERROR = 'audio_error',
  AUDIO_STATE_CHANGE = 'audio_state_change'
}

// Event listener interface
type AudioEventListener = (data: any) => void;

/**
 * Audio Service class
 */
export class AudioService {
  private config: AudioConfig;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private recordingIntervalId: number | null = null;
  private audioBuffer: Float32Array[] = [];
  private audioState: AudioState = AudioState.INACTIVE;
  private eventListeners: Map<AudioEvent, AudioEventListener[]> = new Map();
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private isSpeaking: boolean = false; // Distinct from isPlaying to track TTS specifically
  private isMuted: boolean = false; // Track microphone mute state
  private currentSource: AudioBufferSourceNode | null = null;
  private playbackTimeoutId: number | null = null; // Safety timeout for stuck playback
  private keepAliveOscillator: OscillatorNode | null = null; // Silent oscillator to prevent context suspension
  private keepAliveGain: GainNode | null = null; // Gain node for keep-alive oscillator
  
  // State tracking (for UI coordination)
  private isProcessing: boolean = false;
  private isGreeting: boolean = false;
  private isVisionProcessing: boolean = false;
  
  // Voice detection parameters
  private isVoiceDetected: boolean = false;
  private voiceThreshold: number = 0.01; // Adjust based on testing
  private silenceTimeout: number = 1000; // ms to keep recording after voice drops below threshold
  private lastVoiceTime: number = 0;
  private minRecordingLength: number = 1000; // Minimum ms of audio to send

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set processing state from UI
   */
  public setProcessingState(isProcessing: boolean): void {
    this.isProcessing = isProcessing;
    console.log(`Processing state set to: ${isProcessing}`);
  }
  
  /**
   * Set greeting state from UI
   * This prevents interrupts during the initial greeting
   */
  public setGreetingState(isGreeting: boolean): void {
    this.isGreeting = isGreeting;
    console.log(`Greeting state set to: ${isGreeting}`);
  }
  
  /**
   * Set vision processing state from UI
   * This prevents interrupts during vision processing
   */
  public setVisionProcessingState(isVisionProcessing: boolean): void {
    this.isVisionProcessing = isVisionProcessing;
    console.log(`Vision processing state set to: ${isVisionProcessing}`);
  }
  

  /**
   * Initialize the audio context
   * 
   * MOBILE BROWSER NOTE: This method attempts to resume the AudioContext synchronously
   * first to satisfy mobile browser requirements, then handles async operations.
   */
  private async initAudioContext(): Promise<void> {
    // If context is null, create a new one
    if (!this.audioContext) {
      console.log('Creating new AudioContext');
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: this.config.sampleRate
        });
      } catch (error) {
        // Some mobile browsers don't support sampleRate in constructor
        console.warn('Failed to create AudioContext with sampleRate, trying without:', error);
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('Created AudioContext without sampleRate, actual rate:', this.audioContext.sampleRate);
        } catch (error2) {
          console.error('Failed to create AudioContext', error2);
          this.dispatchEvent(AudioEvent.AUDIO_ERROR, { error: error2 });
          throw error2;
        }
      }
    }
    
    // Always make sure context is running
    if (this.audioContext.state === 'suspended') {
      console.log('Resuming suspended AudioContext');
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.error('Failed to resume AudioContext', error);
        // If resume fails, try creating a new context
        this.audioContext = null;
        return this.initAudioContext();
      }
    } else if (this.audioContext.state === 'closed') {
      console.log('AudioContext was closed, creating new one');
      this.audioContext = null;
      return this.initAudioContext();
    }
    
    console.log(`AudioContext initialized, state: ${this.audioContext.state}`);
  }

  /**
   * Synchronously prepare audio context for mobile browsers
   * 
   * CRITICAL FOR MOBILE: Must be called synchronously from a user gesture handler
   * (click/touch event) BEFORE any async operations. Mobile browsers require
   * AudioContext.resume() to be called synchronously within the user gesture.
   * 
   * Usage: Call this at the very beginning of a click handler, before any await.
   */
  public prepareAudioContext(): void {
    console.log('Preparing audio context (mobile-compatible)');
    
    // Create context if needed
    if (!this.audioContext) {
      try {
        // Try with sampleRate first
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: this.config.sampleRate
        });
        console.log('AudioContext created synchronously with sampleRate:', this.config.sampleRate);
      } catch (error) {
        // Some mobile browsers don't support sampleRate in constructor
        console.warn('Failed to create AudioContext with sampleRate, trying without:', error);
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('AudioContext created synchronously without sampleRate, actual rate:', this.audioContext.sampleRate);
        } catch (error2) {
          console.error('Failed to create AudioContext:', error2);
          return;
        }
      }
    }
    
    // Synchronously attempt to resume (critical for mobile)
    if (this.audioContext.state === 'suspended') {
      console.log('Synchronously resuming AudioContext for mobile');
      // Use void to indicate we're intentionally not awaiting
      void this.audioContext.resume().then(() => {
        console.log(`AudioContext resumed, state: ${this.audioContext?.state}`);
      }).catch(err => {
        console.error('Error resuming AudioContext:', err);
      });
    }
  }

  /**
   * Start the keep-alive oscillator to prevent AudioContext suspension
   * This creates an inaudible tone that keeps the context "warm"
   * Should be called when a call starts
   */
  public startKeepAlive(): void {
    if (!this.audioContext) {
      console.warn('Cannot start keep-alive: AudioContext not initialized');
      return;
    }
    
    // Stop any existing keep-alive first
    this.stopKeepAlive();
    
    try {
      console.log('Starting AudioContext keep-alive oscillator');
      
      // Create an oscillator at a very low frequency (inaudible)
      this.keepAliveOscillator = this.audioContext.createOscillator();
      this.keepAliveOscillator.frequency.value = 20; // 20 Hz - below human hearing range
      
      // Create a gain node and set it to 0 (silent)
      this.keepAliveGain = this.audioContext.createGain();
      this.keepAliveGain.gain.value = 0;
      
      // Connect oscillator -> gain -> destination
      this.keepAliveOscillator.connect(this.keepAliveGain);
      this.keepAliveGain.connect(this.audioContext.destination);
      
      // Start the oscillator
      this.keepAliveOscillator.start();
      
      console.log('Keep-alive oscillator started successfully');
    } catch (error) {
      console.error('Failed to start keep-alive oscillator:', error);
    }
  }

  /**
   * Stop the keep-alive oscillator
   * Should be called when a call ends
   */
  public stopKeepAlive(): void {
    if (this.keepAliveOscillator) {
      try {
        this.keepAliveOscillator.stop();
        this.keepAliveOscillator.disconnect();
        console.log('Keep-alive oscillator stopped');
      } catch (error) {
        console.warn('Error stopping keep-alive oscillator:', error);
      }
      this.keepAliveOscillator = null;
    }
    
    if (this.keepAliveGain) {
      try {
        this.keepAliveGain.disconnect();
      } catch (error) {
        console.warn('Error disconnecting keep-alive gain:', error);
      }
      this.keepAliveGain = null;
    }
  }

  /**
   * Start recording audio
   * 
   * IMPORTANT: For mobile call mode stability, this method keeps the microphone stream alive
   * throughout the entire conversation. The stream is only released when releaseHardware() is called.
   */
  public async startRecording(): Promise<void> {
    if (this.audioState === AudioState.RECORDING) {
      console.log('Already recording');
      return;
    }

    try {
      await this.initAudioContext();
      
      // Check if we already have an active media stream (call mode)
      // This prevents switching between call/media modes on mobile
      if (!this.mediaStream) {
        console.log('No existing mediaStream, requesting microphone access...');
        
        // Request microphone access
        // Use 'ideal' constraints for mobile compatibility - lets browser choose best available
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: isMobile ? {
            // Mobile: be more flexible with constraints
            sampleRate: { ideal: this.config.sampleRate },
            channelCount: { ideal: this.config.channelCount },
            echoCancellation: { ideal: this.config.echoCancellation },
            noiseSuppression: { ideal: this.config.noiseSuppression },
            autoGainControl: { ideal: this.config.autoGainControl }
          } : {
            // Desktop: use exact constraints
            sampleRate: this.config.sampleRate,
            channelCount: this.config.channelCount,
            echoCancellation: this.config.echoCancellation,
            noiseSuppression: this.config.noiseSuppression,
            autoGainControl: this.config.autoGainControl
          }
        });
        
        // Log actual settings for debugging
        const track = this.mediaStream.getAudioTracks()[0];
        if (track) {
          const settings = track.getSettings();
          console.log('Microphone settings:', settings);
        }
        
        // Apply mute state if already set
        if (this.isMuted && this.mediaStream) {
          this.mediaStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
          });
        }
      } else {
        console.log('Reusing existing mediaStream to maintain call mode');
        // Re-enable the stream if it was muted
        if (this.mediaStream) {
          this.mediaStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
          });
        }
      }
      
      // Create media stream source
      if (this.audioContext) {
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
        
        // Create script processor for recording
        this.scriptProcessor = this.audioContext.createScriptProcessor(
          this.config.bufferSize,
          this.config.channelCount,
          this.config.channelCount
        );
        
        // Connect nodes
        this.mediaStreamSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        
        // Handle audio processing
        this.scriptProcessor.onaudioprocess = this.handleAudioProcess.bind(this);
        
        // Clear previous buffer
        this.audioBuffer = [];
        
        // Set state
        this.audioState = AudioState.RECORDING;
        
        // Reset voice detection state
        this.isVoiceDetected = false;
        this.lastVoiceTime = 0;
        
        // Log voice detection threshold
        console.log(`Voice detection enabled with threshold: ${this.voiceThreshold}`);
        
        // Dispatch event
        this.dispatchEvent(AudioEvent.RECORDING_START, {});
        
        console.log('Recording started (mediaStream maintained)');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      // Log additional details for mobile debugging
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        console.error('Mobile device detected. Error details:', {
          error: error,
          audioContextState: this.audioContext?.state,
          userAgent: navigator.userAgent.substring(0, 50)
        });
      }
      this.dispatchEvent(AudioEvent.AUDIO_ERROR, { error });
      this.stopRecording();
      throw error;
    }
  }

  /**
   * Stop recording audio
   * 
   * IMPORTANT: This method keeps the microphone stream (mediaStream) alive to maintain
   * "call mode" on mobile devices. The stream is only released when releaseHardware() is called.
   * This prevents audio mode switching issues that cause TTS cutoffs.
   */
  public stopRecording(): void {
    if (this.audioState !== AudioState.RECORDING) {
      return;
    }

    // Stop sending chunks
    if (this.recordingIntervalId !== null) {
      clearInterval(this.recordingIntervalId);
      this.recordingIntervalId = null;
    }

    // Stop and clean up script processor (stops audio processing)
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    // NOTE: We intentionally DO NOT stop the mediaStream tracks here!
    // Keeping the stream alive prevents mobile devices from switching out of "call mode",
    // which was causing TTS audio to get cut off.
    // The stream is only released when releaseHardware() is called (end call button).
    if (this.mediaStream) {
      // Mute the tracks instead of stopping them to prevent audio feedback
      // while still maintaining the call mode
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('Microphone tracks muted (stream kept alive for call mode)');
    }

    // Send any remaining audio data
    this.sendAudioChunk();

    // Reset state
    this.audioState = AudioState.INACTIVE;
    this.audioBuffer = [];

    // Dispatch event
    this.dispatchEvent(AudioEvent.RECORDING_STOP, {});
    
    console.log('Recording stopped (mediaStream maintained for call mode stability)');
  }

  /**
   * Calculate RMS (Root Mean Square) energy of an audio buffer
   */
  private calculateRMSEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]; // Square each sample
    }
    const rms = Math.sqrt(sum / buffer.length); // RMS = square root of average
    return rms;
  }

  /**
   * Handle audio processing
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // Create a copy of the buffer
    const bufferCopy = new Float32Array(inputData.length);
    bufferCopy.set(inputData);
    
    // Calculate RMS energy
    const energy = this.calculateRMSEnergy(bufferCopy);
    
    // Check if energy is above threshold (voice detected)
    if (energy > this.voiceThreshold) {
      // Check if in a protected state - if so, ignore voice detection entirely
      if (this.isProcessing || this.isVisionProcessing || this.isGreeting) {
        let state = "processing";
        if (this.isVisionProcessing) state = "vision_processing";
        if (this.isGreeting) state = "greeting";
        
        console.log(`Voice detected during ${state} (energy: ${energy.toFixed(4)}), ignoring`);
        // Skip further processing - don't even update isVoiceDetected
        
        // Still dispatch event for visualization, but mark isVoice as false
        this.dispatchEvent(AudioEvent.RECORDING_DATA, { 
          buffer: bufferCopy,
          energy: energy,
          isVoice: false // Force false during processing or greeting
        });
        
        return;
      }
      
      if (!this.isVoiceDetected) {
        console.log('Voice detected, energy:', energy);
        this.isVoiceDetected = true;
        
      // Check if we're currently playing TTS audio
      // If so, interrupt it immediately - BUT NOT during greeting
      // Also explicitly check audioState to catch any edge cases
      if ((this.isSpeaking || this.audioState === AudioState.SPEAKING) && !this.isGreeting) {
        console.log('User started speaking while assistant was speaking - interrupting playback',
                   `isSpeaking=${this.isSpeaking}, audioState=${this.audioState}, isGreeting=${this.isGreeting}`);
        // Stop playback locally
        this.stopPlayback();
        // Send interrupt signal to server
        websocketService.interrupt();
        // Dispatch an event so UI can update
        this.dispatchEvent(AudioEvent.PLAYBACK_STOP, {
          interrupted: true,
          reason: 'user_interrupt'
        });
      } else if (this.isGreeting) {
        console.log('Voice detected during greeting - suppressing interrupt');
      }
      }
      this.lastVoiceTime = Date.now();
    }
    
    // If in a protected state, never accumulate audio buffer
    if (this.isProcessing || this.isVisionProcessing || this.isGreeting) {
      // Dispatch event for visualization only
      this.dispatchEvent(AudioEvent.RECORDING_DATA, { 
        buffer: bufferCopy,
        energy: energy,
        isVoice: false // Force false during processing
      });
      return;
    }
    
    // Add to buffer if voice is detected or we're in the silence timeout period
    if (this.isVoiceDetected) {
      this.audioBuffer.push(bufferCopy);
      
      // Check if we've exceeded silence timeout
      const timeSinceVoice = Date.now() - this.lastVoiceTime;
      if (energy <= this.voiceThreshold && timeSinceVoice > this.silenceTimeout) {
        console.log('Voice ended, silence timeout exceeded');
        this.isVoiceDetected = false;
        
        // Send accumulated audio
        this.sendAudioChunk();
      }
    }
    
    // Dispatch event
    this.dispatchEvent(AudioEvent.RECORDING_DATA, { 
      buffer: bufferCopy,
      energy: energy,
      isVoice: this.isVoiceDetected
    });
  }

  /**
   * Convert Float32Array audio data to WAV format
   */
  private float32ToWav(buffer: Float32Array, sampleRate: number): ArrayBuffer {
    // Create buffer with WAV header
    const numChannels = 1; // Mono
    const bytesPerSample = 2; // 16-bit PCM
    const dataSize = buffer.length * bytesPerSample;
    const headerSize = 44; // Standard WAV header size
    const totalSize = headerSize + dataSize;
    
    // Create the WAV buffer
    const wavBuffer = new ArrayBuffer(totalSize);
    const wavView = new DataView(wavBuffer);
    
    // Write WAV header
    // "RIFF" chunk descriptor
    this.writeString(wavView, 0, 'RIFF');
    wavView.setUint32(4, totalSize - 8, true); // File size - 8
    this.writeString(wavView, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this.writeString(wavView, 12, 'fmt ');
    wavView.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    wavView.setUint16(20, 1, true); // Audio format (1 for PCM)
    wavView.setUint16(22, numChannels, true); // Number of channels
    wavView.setUint32(24, sampleRate, true); // Sample rate
    wavView.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // Byte rate
    wavView.setUint16(32, numChannels * bytesPerSample, true); // Block align
    wavView.setUint16(34, bytesPerSample * 8, true); // Bits per sample
    
    // "data" sub-chunk
    this.writeString(wavView, 36, 'data');
    wavView.setUint32(40, dataSize, true); // Sub-chunk size
    
    // Write audio data
    // Convert from Float32 [-1.0,1.0] to Int16 [-32768,32767]
    const offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      // Clamp the value to [-1.0, 1.0]
      const sample = Math.max(-1.0, Math.min(1.0, buffer[i]));
      // Convert to Int16
      const val = sample < 0 ? sample * 32768 : sample * 32767;
      wavView.setInt16(offset + i * bytesPerSample, val, true);
    }
    
    return wavBuffer;
  }
  
  /**
   * Helper function to write a string to a DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Send accumulated audio chunk to WebSocket
   */
  private sendAudioChunk(): void {
    if (this.audioBuffer.length === 0) {
      return;
    }
    
    // Don't send audio if we're in processing state
    if (this.isProcessing) {
      console.log('Processing state active, discarding audio chunk');
      this.audioBuffer = [];
      return;
    }

    // Calculate total length
    const totalLength = this.audioBuffer.reduce((acc, buffer) => acc + buffer.length, 0);
    
    // Check if we have enough audio to send (avoid sending tiny fragments)
    const audioLengthMs = (totalLength / this.config.sampleRate) * 1000;
    if (!this.isVoiceDetected && audioLengthMs < this.minRecordingLength) {
      console.log(`Audio too short (${audioLengthMs.toFixed(0)}ms), discarding`);
      this.audioBuffer = [];
      return;
    }
    
    // Create combined buffer
    const combinedBuffer = new Float32Array(totalLength);
    
    // Copy data
    let offset = 0;
    for (const buffer of this.audioBuffer) {
      combinedBuffer.set(buffer, offset);
      offset += buffer.length;
    }
    
    console.log(`Sending audio chunk: ${audioLengthMs.toFixed(0)}ms`);
    
    // Convert to WAV format
    const wavBuffer = this.float32ToWav(combinedBuffer, this.config.sampleRate);
    
    // Send to WebSocket
    websocketService.sendAudio(wavBuffer);
    
    // Clear buffer
    this.audioBuffer = [];
  }

  /**
   * Play audio from base64-encoded data
   * 
   * The backend now sends complete audio files instead of chunks,
   * so we just need to decode and play the entire file at once.
   * 
   * This method is specifically for playing TTS content and will
   * set the state to SPEAKING rather than just PLAYING.
   */
  public async playAudioChunk(base64AudioChunk: string, _format: string = 'wav'): Promise<void> {
    try {
      await this.initAudioContext();
      
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }
      
      // Check if context is suspended (mobile browsers may suspend it)
      if (this.audioContext.state === 'suspended') {
        console.warn('AudioContext is suspended when trying to play TTS - attempting resume');
        try {
          await this.audioContext.resume();
          console.log(`AudioContext resumed, state: ${this.audioContext.state}`);
        } catch (resumeError) {
          console.error('Failed to resume AudioContext for TTS playback:', resumeError);
          // Continue anyway - the playback might still work or fail with a clear error
        }
      }
      
      // Convert base64 to ArrayBuffer
      const audioData = WebSocketService.base64ToArrayBuffer(base64AudioChunk);
      
      console.log(`Received complete audio file (${audioData.byteLength} bytes), AudioContext state: ${this.audioContext.state}`);
      
      // Decode the audio data
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(audioData);
        
        // Add to queue (instead of immediate playback)
        this.audioQueue.push(audioBuffer);
        
        // Start playback if not already playing
        if (!this.isPlaying) {
          this.playNextChunk();
        } else {
          console.log(`Added audio buffer to queue: duration=${audioBuffer.duration.toFixed(2)}s`);
        }
        
      } catch (error) {
        console.error('Error decoding audio data:', error);
        this.dispatchEvent(AudioEvent.AUDIO_ERROR, { error });
        // Ensure state is cleaned up even if decoding fails
        if (this.audioQueue.length === 0) {
          this.isPlaying = false;
          this.isSpeaking = false;
          this.audioState = AudioState.INACTIVE;
          this.dispatchEvent(AudioEvent.PLAYBACK_END, {
            previousState: AudioState.SPEAKING,
            error: true
          });
        }
      }
    } catch (error) {
      console.error('Error queueing audio chunk:', error);
      this.dispatchEvent(AudioEvent.AUDIO_ERROR, { error });
    }
  }
  
  /**
   * Play next audio chunk from the queue
   */
  private playNextChunk(): void {
    console.log(`>> playNextChunk called. Queue length: ${this.audioQueue.length}, isPlaying: ${this.isPlaying}, isSpeaking: ${this.isSpeaking}`);
    
    // Clear any existing playback timeout
    if (this.playbackTimeoutId !== null) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
    
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.isSpeaking = false;
      this.audioState = AudioState.INACTIVE;
      this.dispatchEvent(AudioEvent.PLAYBACK_END, {
        previousState: AudioState.SPEAKING
      });
      console.log('Audio queue empty, playback complete');
      return;
    }
    
    if (!this.audioContext) return;
    
    const buffer = this.audioQueue.shift();
    if (!buffer) return;
    
    // Set playback state - only dispatch PLAYBACK_START on the first buffer
    const wasPlaying = this.isPlaying;
    this.isPlaying = true;
    this.isSpeaking = true;
    this.audioState = AudioState.SPEAKING;
    
    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    // Calculate safety timeout duration (buffer duration + 1 second padding)
    const timeoutDuration = (buffer.duration * 1000) + 1000;
    
    // Handle when this chunk ends
    source.onended = () => {
      console.log(`Buffer playback ended. Queue length: ${this.audioQueue.length}`);
      
      // Clear the safety timeout since playback ended normally
      if (this.playbackTimeoutId !== null) {
        clearTimeout(this.playbackTimeoutId);
        this.playbackTimeoutId = null;
      }
      
      // If there are more chunks, play them
      if (this.audioQueue.length > 0) {
        this.playNextChunk();
      } else {
        // No more chunks, end playback
        this.isPlaying = false;
        this.isSpeaking = false;
        this.audioState = AudioState.INACTIVE;
        this.currentSource = null;
        this.dispatchEvent(AudioEvent.PLAYBACK_END, {
          previousState: AudioState.SPEAKING
        });
        console.log('Last audio chunk complete, playback ended');
      }
    };
    
    // Keep track of current source for stopping
    this.currentSource = source;
    
    // Start playback with a small delay
    try {
      source.start(this.audioContext.currentTime + 0.05);
      console.log(`Playing audio buffer: duration=${buffer.duration.toFixed(2)}s, queue remaining: ${this.audioQueue.length}`);
      
      // Set a safety timeout in case onended never fires
      this.playbackTimeoutId = window.setTimeout(() => {
        console.warn(`Playback safety timeout fired after ${timeoutDuration}ms - forcing state cleanup`);
        this.currentSource = null;
        if (this.audioQueue.length > 0) {
          this.playNextChunk();
        } else {
          this.isPlaying = false;
          this.isSpeaking = false;
          this.audioState = AudioState.INACTIVE;
          this.dispatchEvent(AudioEvent.PLAYBACK_END, {
            previousState: AudioState.SPEAKING,
            timeout: true
          });
        }
      }, timeoutDuration);
      
      // Dispatch playback start event only if we weren't already playing
      if (!wasPlaying) {
        console.log('First chunk in sequence - dispatching PLAYBACK_START event');
        this.dispatchEvent(AudioEvent.PLAYBACK_START, {});
      }
    } catch (error) {
      console.error('Error starting audio playback:', error);
      this.dispatchEvent(AudioEvent.AUDIO_ERROR, { error });
      
      // Clear the safety timeout
      if (this.playbackTimeoutId !== null) {
        clearTimeout(this.playbackTimeoutId);
        this.playbackTimeoutId = null;
      }
      
      // Clean up state and try next chunk or end playback
      this.currentSource = null;
      if (this.audioQueue.length > 0) {
        this.playNextChunk();
      } else {
        this.isPlaying = false;
        this.isSpeaking = false;
        this.audioState = AudioState.INACTIVE;
        this.dispatchEvent(AudioEvent.PLAYBACK_END, {
          previousState: AudioState.SPEAKING,
          error: true
        });
      }
    }
  }
  
  /**
   * Check if audio is currently playing speech
   */
  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
  
  /**
   * Get the length of the audio queue
   */
  public getAudioQueueLength(): number {
    return this.audioQueue.length;
  }
  
  /**
   * Check if microphone input is muted
   */
  public isMicrophoneMuted(): boolean {
    return this.isMuted;
  }
  
  /**
   * Toggle microphone mute state
   * Returns the new mute state
   */
  public toggleMicrophoneMute(): boolean {
    this.isMuted = !this.isMuted;
    
    // Apply mute state to active audio tracks
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
      console.log(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`);
    } else {
      console.log('No active microphone to mute/unmute');
    }
    
    // Dispatch event
    this.dispatchEvent(AudioEvent.AUDIO_STATE_CHANGE, {
      type: 'mute_change',
      isMuted: this.isMuted
    });
    
    return this.isMuted;
  }

  /**
   * Stop audio playback
   */
  public stopPlayback(): void {
    if (!this.currentSource) {
      return;
    }
    
    // Store previous state for the event
    const previousState = this.audioState;
    
    // Clear any playback safety timeout
    if (this.playbackTimeoutId !== null) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
    
    try {
      this.currentSource.stop();
      this.currentSource = null;
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
    
    // Clear the queue
    this.audioQueue = [];
    
    // Set state to INTERRUPTED if we were SPEAKING
    if (previousState === AudioState.SPEAKING) {
      this.audioState = AudioState.INTERRUPTED;
    } else {
      this.audioState = AudioState.INACTIVE;
    }
    
    this.isPlaying = false;
    this.isSpeaking = false;
    
    // Dispatch event with previous state info
    this.dispatchEvent(AudioEvent.PLAYBACK_STOP, { 
      interrupted: previousState === AudioState.SPEAKING,
      previousState: previousState
    });
    
    console.log('Playback stopped');
  }

  /**
   * Fully release all hardware access
   * This is more aggressive than just stopRecording() as it also:
   * - Forces all media tracks to stop
   * - Suspends the audio context
   * - Nullifies all resources
   * 
   * Use this when completely ending a call to ensure microphone
   * permissions are fully released at the hardware level.
   */
  public releaseHardware(): void {
    console.log('Releasing all hardware access...');
    
    // First stop any active recording/playback
    this.stopRecording();
    this.stopPlayback();
    
    // Clear any remaining playback timeout
    if (this.playbackTimeoutId !== null) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
    
    // Stop the keep-alive oscillator when ending the call
    this.stopKeepAlive();
    
    // Force-stop and disable all tracks to release hardware
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.mediaStream = null;
    }
    
    // Ensure script processor is disconnected
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    // Ensure media stream source is disconnected
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    
    // Suspend the audio context if it's running
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend().catch(err => {
        console.error('Error suspending audio context:', err);
      });
    }
    
    // Reset all state
    this.audioState = AudioState.INACTIVE;
    this.isVoiceDetected = false;
    this.audioBuffer = [];
    this.isPlaying = false;
    this.isSpeaking = false;
    
    console.log('All hardware access released');
  }

  /**
   * Get current audio state
   */
  public getAudioState(): AudioState {
    return this.audioState;
  }

  /**
   * Add event listener
   */
  public addEventListener(event: AudioEvent, callback: AudioEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)?.push(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: AudioEvent, callback: AudioEventListener): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    
    const listeners = this.eventListeners.get(event) || [];
    this.eventListeners.set(
      event,
      listeners.filter(listener => listener !== callback)
    );
  }

  /**
   * Dispatch event
   */
  private dispatchEvent(event: AudioEvent, data: any): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

// Create singleton instance
const audioService = new AudioService();
export default audioService;
