import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { User, Sparkles, Eye, Mic } from 'lucide-react';
import websocketService, { MessageType } from '../services/websocket';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userName, setUserName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'voice' | 'vision'>('profile');
  const [isVisionEnabled, setIsVisionEnabled] = useState(false);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  const [wakeWord, setWakeWord] = useState('Biscuit');
  const [isSendWordEnabled, setIsSendWordEnabled] = useState(false);
  const [sendWord, setSendWord] = useState('taxi');
  const [isAiFollowupsEnabled, setIsAiFollowupsEnabled] = useState(false);
  const [isUserInterruptEnabled, setIsUserInterruptEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSaveError(null);

      // Fetch current system prompt, user profile, and vision settings
      const handleSystemPrompt = (data: any) => {
        if (data && data.prompt) {
          setSystemPrompt(data.prompt);
        }
      };

      const handleUserProfile = (data: any) => {
        if (data && data.name !== undefined) {
          setUserName(data.name);
        }
      };

      const handleVisionSettings = (data: any) => {
        if (data && data.enabled !== undefined) {
          setIsVisionEnabled(data.enabled);
        }
      };

      const handleVoiceSettings = (data: any) => {
        if (data) {
          if (data.ai_followups_enabled !== undefined) setIsAiFollowupsEnabled(data.ai_followups_enabled);
          if (data.wake_word_enabled !== undefined) setIsWakeWordEnabled(data.wake_word_enabled);
          if (data.wake_word !== undefined) setWakeWord(data.wake_word);
          if (data.send_word_enabled !== undefined) setIsSendWordEnabled(data.send_word_enabled);
          if (data.send_word !== undefined) setSendWord(data.send_word);
          if (data.user_interrupt_enabled !== undefined) setIsUserInterruptEnabled(data.user_interrupt_enabled);
        }
      };

      // Listen for responses
      websocketService.addEventListener(MessageType.SYSTEM_PROMPT, handleSystemPrompt);
      websocketService.addEventListener(MessageType.USER_PROFILE, handleUserProfile);
      websocketService.addEventListener(MessageType.VISION_SETTINGS as any, handleVisionSettings);
      websocketService.addEventListener(MessageType.VOICE_SETTINGS as any, handleVoiceSettings);

      // Request data
      websocketService.getSystemPrompt();
      websocketService.getUserProfile();
      websocketService.getVisionSettings();
      websocketService.getVoiceSettings();

      console.log('Requested preferences data');

      return () => {
        websocketService.removeEventListener(MessageType.SYSTEM_PROMPT, handleSystemPrompt);
        websocketService.removeEventListener(MessageType.USER_PROFILE, handleUserProfile);
        websocketService.removeEventListener(MessageType.VISION_SETTINGS as any, handleVisionSettings);
        websocketService.removeEventListener(MessageType.VOICE_SETTINGS as any, handleVoiceSettings);
      };
    }
  }, [isOpen]);

  // Listen for update confirmations
  useEffect(() => {
    let updateCount = 0;
    const expectedUpdateCount = 4; // Always expect 4 updates: system prompt, user profile, vision, and voice
    let success = true;

    const handlePromptUpdated = (data: any) => {
      updateCount++;
      if (!(data && data.success)) {
        success = false;
        setSaveError('Failed to update system prompt. Please try again.');
      }

      if (updateCount >= expectedUpdateCount) {
        setIsSaving(false);
        if (success) {
          // Close modal only if all updates succeeded
          onClose();
        }
      }
    };

    const handleProfileUpdated = (data: any) => {
      updateCount++;
      if (!(data && data.success)) {
        success = false;
        setSaveError('Failed to update user profile. Please try again.');
      }

      if (updateCount >= expectedUpdateCount) {
        setIsSaving(false);
        if (success) {
          // Close modal only if all updates succeeded
          onClose();
        }
      }
    };

    const handleVisionSettingsUpdated = (data: any) => {
      updateCount++;
      if (!(data && data.success)) {
        success = false;
        setSaveError('Failed to update vision settings. Please try again.');
      }

      if (updateCount >= expectedUpdateCount) {
        setIsSaving(false);
        if (success) {
          // Close modal only if all updates succeeded
          onClose();
        }
      }
    };

    const handleVoiceSettingsUpdated = (data: any) => {
      updateCount++;
      if (!(data && data.success)) {
        success = false;
        setSaveError('Failed to update voice settings. Please try again.');
      }

      if (updateCount >= expectedUpdateCount) {
        setIsSaving(false);
        if (success) {
          // Close modal only if all updates succeeded
          onClose();
        }
      }
    };

    websocketService.addEventListener(MessageType.SYSTEM_PROMPT_UPDATED, handlePromptUpdated);
    websocketService.addEventListener(MessageType.USER_PROFILE_UPDATED, handleProfileUpdated);
    websocketService.addEventListener(MessageType.VISION_SETTINGS_UPDATED as any, handleVisionSettingsUpdated);
    websocketService.addEventListener(MessageType.VOICE_SETTINGS_UPDATED as any, handleVoiceSettingsUpdated);

    return () => {
      websocketService.removeEventListener(MessageType.SYSTEM_PROMPT_UPDATED, handlePromptUpdated);
      websocketService.removeEventListener(MessageType.USER_PROFILE_UPDATED, handleProfileUpdated);
      websocketService.removeEventListener(MessageType.VISION_SETTINGS_UPDATED as any, handleVisionSettingsUpdated);
      websocketService.removeEventListener(MessageType.VOICE_SETTINGS_UPDATED as any, handleVoiceSettingsUpdated);
    };
  }, [onClose, activeTab]);

  const handleSave = () => {
    // Check if system prompt is empty when in system tab
    if (activeTab === 'system' && !systemPrompt.trim()) {
      setSaveError('System prompt cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    // Always update all settings
    websocketService.updateSystemPrompt(systemPrompt);
    websocketService.updateUserProfile(userName);
    websocketService.updateVisionSettings(isVisionEnabled);
    websocketService.updateVoiceSettings(
      isAiFollowupsEnabled,
      isWakeWordEnabled,
      wakeWord,
      isSendWordEnabled,
      sendWord,
      isUserInterruptEnabled
    );
  };

  // backticks, in my code, in the year of our lord, 2025? no.
  const handleRestore = () => {
    setSystemPrompt(
      "You are a helpful, friendly, and concise voice assistant. " +
      "Respond to user queries in a natural, conversational manner. " +
      "Keep responses brief and to the point, as you're communicating via voice. " +
      "When providing information, focus on the most relevant details. " +
      "If you don't know something, admit it rather than making up an answer." +
      "\n\n" +
      "Through the webapp, you can receive and understand photographs and pictures."
    );
  };

  const renderVisionTab = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Vision</label>
        <div className="flex items-center">
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isVisionEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            onClick={() => setIsVisionEnabled(!isVisionEnabled)}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isVisionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </div>
          <span className="ml-3 text-sm text-slate-300">
            {isVisionEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          When enabled, Vocalis will use computer vision to analyze images and provide visual context to your conversations.
        </p>
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
          <p className="text-xs text-blue-300">
            <strong>Coming Soon:</strong> Vision capabilities will allow Vocalis to see and describe images,
            analyze documents, interpret charts, and provide visual assistance during your conversations.
          </p>
        </div>
      </div>
    </div>
  );

  const renderVoiceTab = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Wake Word</label>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isWakeWordEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              onClick={() => setIsWakeWordEnabled(!isWakeWordEnabled)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isWakeWordEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </div>
          </div>
          <input
            type="text"
            value={wakeWord}
            onChange={(e) => setWakeWord(e.target.value)}
            disabled={!isWakeWordEnabled}
            placeholder="e.g. Biscuit"
            className={`flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors ${!isWakeWordEnabled ? 'opacity-50 text-slate-500 cursor-not-allowed' : 'text-slate-300'}`}
          />
        </div>
        <p className="text-xs text-slate-400">
          When enabled, Vocalis will only start listening after hearing this word/phrase.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Send Word</label>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSendWordEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              onClick={() => setIsSendWordEnabled(!isSendWordEnabled)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSendWordEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </div>
          </div>
          <input
            type="text"
            value={sendWord}
            onChange={(e) => setSendWord(e.target.value)}
            disabled={!isSendWordEnabled}
            placeholder="e.g. Taxi"
            className={`flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors ${!isSendWordEnabled ? 'opacity-50 text-slate-500 cursor-not-allowed' : 'text-slate-300'}`}
          />
        </div>
        <p className="text-xs text-slate-400">
          When enabled, Vocalis will listen continuously until it hears this word, then send everything you said to the AI.
        </p>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-700/50">
        <label className="text-sm font-medium text-slate-300">AI Initiated Followups</label>
        <div className="flex items-center">
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAiFollowupsEnabled ? 'bg-amber-600' : 'bg-slate-700'
              }`}
            onClick={() => setIsAiFollowupsEnabled(!isAiFollowupsEnabled)}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAiFollowupsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </div>
          <span className="ml-3 text-sm text-slate-300">
            {isAiFollowupsEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          When enabled, Vocalis will occasionally speak on its own if you go silent during a conversation.
        </p>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-700/50">
        <label className="text-sm font-medium text-slate-300">Allow User Interrupts</label>
        <div className="flex items-center">
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isUserInterruptEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            onClick={() => setIsUserInterruptEnabled(!isUserInterruptEnabled)}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isUserInterruptEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </div>
          <span className="ml-3 text-sm text-slate-300">
            {isUserInterruptEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          When disabled, the AI cannot be interrupted once it starts speaking. Your input will be cleared and you'll need to use the wake word again after the AI finishes.
        </p>
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Your Name</label>
        <div className="relative">
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 p-3 text-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Enter your name (optional)"
          />
          <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
        </div>
        <p className="text-xs text-slate-400">
          Your name will be used to personalize greetings and make the conversation feel more natural.
        </p>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">System Prompt</label>
        <button
          onClick={handleRestore}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          Restore Default
        </button>
      </div>
      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Enter system prompt..."
      />
      <p className="text-xs text-slate-400">
        The system prompt defines how the AI assistant behaves when responding to your voice commands.
      </p>
    </div>
  );

  // Handle animation state
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 300); // Match animation duration
    }
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  return ReactDOM.createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100 bg-black/50' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-slate-900 border border-slate-700 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Header */}
        <div className="flex items-center p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Preferences</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'profile'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('profile')}
          >
            <User className="w-4 h-4" />
            <span>User Profile</span>
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'system'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('system')}
          >
            <Sparkles className="w-4 h-4" />
            <span>System Prompt</span>
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'voice'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('voice')}
          >
            <Mic className="w-4 h-4" />
            <span>Voice Settings</span>
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'vision'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('vision')}
          >
            <Eye className="w-4 h-4" />
            <span>Vision</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {activeTab === 'profile'
            ? renderProfileTab()
            : activeTab === 'system'
              ? renderSystemTab()
              : activeTab === 'voice'
                ? renderVoiceTab()
                : renderVisionTab()}

          {saveError && (
            <div className="text-red-400 text-sm p-2 bg-red-900/20 border border-red-900/30 rounded">
              {saveError}
            </div>
          )}
        </div>



        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg
              ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreferencesModal;
