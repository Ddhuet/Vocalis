"""
Conversation Storage Service

Handles saving and loading conversation sessions to/from JSON files.
"""

import os
import json
import uuid
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConversationStorage:
    """
    Service for storing and retrieving conversation sessions.
    """
    
    def __init__(self, storage_dir: str = "conversations"):
        """
        Initialize the conversation storage service.
        
        Args:
            storage_dir: Directory to store conversation files
        """
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        logger.info(f"Initialized ConversationStorage with directory: {storage_dir}")
    
    def save_session(self, messages: List[Dict], 
                    title: Optional[str] = None, 
                    session_id: Optional[str] = None,
                    metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Save a conversation session to a JSON file.
        
        Args:
            messages: List of conversation messages
            title: Optional title for the conversation (auto-generated if None)
            session_id: Optional ID for the session (new UUID if None)
            metadata: Optional metadata to store with the session
            
        Returns:
            str: The session ID
        """
        # Generate ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Generate title if not provided (from first user message or timestamp)
        if not title:
            # Try to find first user message
            for msg in messages:
                if msg.get('role') == 'user' and msg.get('content', '').strip():
                    # Use first ~30 chars of first user message
                    title = msg['content'][:30] + ('...' if len(msg['content']) > 30 else '')
                    break
            
            # Fallback to timestamp if no user messages found
            if not title:
                title = f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        # Prepare session data
        now = datetime.now().isoformat()
        session = {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "messages": messages,
            "metadata": metadata or {}
        }
        
        # Save to file
        file_path = os.path.join(self.storage_dir, f"{session_id}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(session, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved conversation session: {session_id}")
        return session_id
    
    def load_session(self, session_id: str) -> Optional[Dict]:
        """
        Load a conversation session from a JSON file.
        
        Args:
            session_id: ID of the session to load
            
        Returns:
            Optional[Dict]: The session data, or None if not found
        """
        file_path = os.path.join(self.storage_dir, f"{session_id}.json")
        
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    session = json.load(f)
                logger.info(f"Loaded conversation session: {session_id}")
                return session
            else:
                logger.warning(f"Session not found: {session_id}")
                return None
        except Exception as e:
            logger.error(f"Error loading session {session_id}: {e}")
            return None
    
    def list_sessions(self) -> List[Dict]:
        """
        List all available conversation sessions.
        
        Returns:
            List[Dict]: List of session metadata
        """
        sessions = []
        
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json'):
                try:
                    file_path = os.path.join(self.storage_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        session = json.load(f)
                    
                    # Include only metadata for listing (not the actual messages)
                    sessions.append({
                        "id": session.get("id"),
                        "title": session.get("title"),
                        "created_at": session.get("created_at"),
                        "updated_at": session.get("updated_at"),
                        "metadata": session.get("metadata", {})
                    })
                except Exception as e:
                    logger.error(f"Error loading session list from {filename}: {e}")
        
        # Sort by most recent first
        sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a conversation session.
        
        Args:
            session_id: ID of the session to delete
            
        Returns:
            bool: True if deleted successfully, False otherwise
        """
        file_path = os.path.join(self.storage_dir, f"{session_id}.json")
        
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted conversation session: {session_id}")
                return True
            else:
                logger.warning(f"Session not found for deletion: {session_id}")
                return False
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return False
