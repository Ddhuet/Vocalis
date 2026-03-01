import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';
import websocketService, { ConnectionState } from './services/websocket';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Track WebSocket connection
  useEffect(() => {
    const handleConnectionChange = () => {
      const state = websocketService.getConnectionState();
      setIsConnected(state === ConnectionState.CONNECTED);
    };
    
    // Set up event listeners
    websocketService.addEventListener('open', handleConnectionChange);
    websocketService.addEventListener('close', handleConnectionChange);
    websocketService.addEventListener('error', handleConnectionChange);
    
    // Initial check
    handleConnectionChange();
    
    // Cleanup
    return () => {
      websocketService.removeEventListener('open', handleConnectionChange);
      websocketService.removeEventListener('close', handleConnectionChange);
      websocketService.removeEventListener('error', handleConnectionChange);
    };
  }, []);

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      {/* Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-50 p-2 rounded-lg bg-slate-800/30 hover:bg-slate-700/30 
                   text-slate-400 hover:text-slate-300 transition-all duration-300"
      >
        <Menu className="w-5 h-5" />
      </button>
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-screen z-40
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <Sidebar 
        onClose={() => setIsSidebarOpen(false)} 
        isConnected={isConnected}
        onReconnect={() => websocketService.connect()}
        onClearHistory={() => websocketService.clearHistory()}
      />
      </div>
      
      {/* Main Content */}
      <div className={`
        flex-1 h-full overflow-hidden transition-all duration-300 ease-in-out
      `}>
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;
