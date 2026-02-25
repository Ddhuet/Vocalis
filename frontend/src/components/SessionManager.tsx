import React, { useRef, useState, useEffect } from 'react';
import { FolderOpen, Trash2, X } from 'lucide-react';
import websocketService, { MessageType, Session } from '../services/websocket';

interface SessionManagerProps {
  className?: string;
}

const SessionManager: React.FC<SessionManagerProps> = ({ className = '' }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const lastRefreshAt = useRef<number>(0);
  const currentSessionIdRef = useRef<string | null>(null);

  // Fetch sessions when component mounts
  useEffect(() => {
    fetchSessions();
    
    // Add event listeners for WebSocket responses
    const handleListSessionsResult = (data: any) => {
      console.log('Received list_sessions_result:', data);
      if (data.sessions) {
        setSessions(data.sessions);
      }
      setLoading(false);
    };
    
    const handleSaveSessionResult = (data: any) => {
      console.log('Received save_session_result:', data);
      if (data.success) {
        if (data.session_id) {
          setCurrentSessionId(data.session_id);
          currentSessionIdRef.current = data.session_id;
        }

        // Autosave can fire frequently; throttle refreshes to avoid UI spam.
        const now = Date.now();
        if (now - lastRefreshAt.current > 2000) {
          lastRefreshAt.current = now;
          fetchSessions();
        }
      } else {
        setError('Failed to save session');
      }
    };
    
    const handleLoadSessionResult = (data: any) => {
      console.log('Received load_session_result:', data);
      if (data.success) {
        // Set currently loaded session
        setCurrentSessionId(data.session_id);
        currentSessionIdRef.current = data.session_id;
      } else {
        setError(`Failed to load session: ${data.session_id}`);
      }
      setLoading(false);
    };
    
    const handleDeleteSessionResult = (data: any) => {
      console.log('Received delete_session_result:', data);
      if (data.success) {
        // If the deleted session was the current one, clear currentSessionId
        if (data.session_id === currentSessionIdRef.current) {
          setCurrentSessionId(null);
          currentSessionIdRef.current = null;
        }
        fetchSessions(); // Refresh the list
      } else {
        setError(`Failed to delete session: ${data.session_id}`);
      }
      setLoading(false);
    };
    
    // General error handler for session operations
    const handleError = (data: any) => {
      console.log('Received error message:', data);
      if (data.error) {
        // Check if error is related to session operations
        if (data.error.includes('conversation') || data.error.includes('session')) {
          setLoading(false);
          setError(data.error);
        }
      }
    };
    
    // Make sure these are correctly registered
    websocketService.addEventListener(MessageType.LIST_SESSIONS_RESULT as any, handleListSessionsResult);
    websocketService.addEventListener(MessageType.SAVE_SESSION_RESULT as any, handleSaveSessionResult);
    websocketService.addEventListener(MessageType.LOAD_SESSION_RESULT as any, handleLoadSessionResult);
    websocketService.addEventListener(MessageType.DELETE_SESSION_RESULT as any, handleDeleteSessionResult);
    websocketService.addEventListener(MessageType.ERROR as any, handleError);
    
    return () => {
      websocketService.removeEventListener(MessageType.LIST_SESSIONS_RESULT as any, handleListSessionsResult);
      websocketService.removeEventListener(MessageType.SAVE_SESSION_RESULT as any, handleSaveSessionResult);
      websocketService.removeEventListener(MessageType.LOAD_SESSION_RESULT as any, handleLoadSessionResult);
      websocketService.removeEventListener(MessageType.DELETE_SESSION_RESULT as any, handleDeleteSessionResult);
      websocketService.removeEventListener(MessageType.ERROR as any, handleError);
    };
  }, []);

  // Fetch sessions from server
  const fetchSessions = () => {
    setLoading(true);
    websocketService.listSessions();
  };

  // Load a session
  const loadSession = (sessionId: string) => {
    setLoading(true);
    websocketService.loadSession(sessionId);
  };

  // Delete a session
  const deleteSession = (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      setLoading(true);
      websocketService.deleteSession(sessionId);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h2 className="text-xl font-semibold text-gray-200">Sessions</h2>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-4 p-2 bg-red-900/60 text-red-100 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-400">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No saved sessions</p>
            <p className="text-sm mt-2">Click the + button to save the current conversation</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={`p-3 rounded-lg border ${
                  currentSessionId === session.id
                    ? 'bg-gray-800 border-blue-500/50'
                    : 'bg-gray-800/50 border-gray-700/50'
                } hover:bg-gray-800 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-200 mb-1 truncate pr-2" title={session.title}>
                    {session.title || `Conversation ${formatDate(session.created_at)}`}
                    {currentSessionId === session.id && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs">
                        Active
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="p-1 rounded hover:bg-gray-700"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-400">
                    {formatDate(session.updated_at)}
                  </div>
                  <button
                    onClick={() => loadSession(session.id)}
                    className="text-xs px-2 py-1 rounded bg-blue-800/50 text-blue-200 hover:bg-blue-700/60"
                    title="Load session"
                    disabled={loading}
                  >
                    Load
                  </button>
                </div>
                {session.metadata && (
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                      {session.metadata.message_count || 0} messages
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SessionManager;
