"""
LLM Service

Handles communication with the LLM API using the OpenAI library.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMClient:
    """
    Client for communicating with an LLM API using the OpenAI library.
    
    This class handles requests to an LLM API that follows the OpenAI API format.
    """
    
    def __init__(
        self,
        api_endpoint: str = "http://127.0.0.1:1234/v1",
        api_key: str = "",
        model: str = "",
        temperature: float = 0.6,
        max_tokens: int = 2048,
        timeout: int = 20,
        approximate_context_length: int = 16000
    ):
        """
        Initialize the LLM client.
        
        Args:
            api_endpoint: Base URL of the LLM API (e.g., http://127.0.0.1:1234/v1)
            api_key: API key for authentication (blank if not required)
            model: Model name to use (blank if API has only one model)
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in seconds
            approximate_context_length: Approximate context length in tokens (4 chars ≈ 1 token)
        """
        self.api_endpoint = api_endpoint
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.approximate_context_length = approximate_context_length
        
        # State tracking
        self.is_processing = False
        self.conversation_history = []
        
        # Initialize OpenAI client
        self.client = OpenAI(
            base_url=api_endpoint,
            api_key=api_key,
            timeout=timeout
        )
        
        logger.info(f"Initialized LLM Client with endpoint={api_endpoint}, context_length={approximate_context_length}")
        
    def _calculate_messages_char_count(self) -> int:
        """
        Calculate the approximate character count of the messages array.
        This includes all JSON structure (brackets, keys, etc.)
        
        Returns:
            int: Total character count of the messages array JSON
        """
        return len(json.dumps(self.conversation_history))
    
    def _trim_history_to_fit_context(self) -> None:
        """
        Trim conversation history to fit within the approximate context length.
        Uses FIFO: removes oldest messages after the system prompt first.
        Never removes the system prompt (first message if role is 'system').
        """
        max_chars = self.approximate_context_length * 4
        
        while self._calculate_messages_char_count() > max_chars and len(self.conversation_history) > 1:
            has_system_prompt = (
                len(self.conversation_history) > 0 and 
                self.conversation_history[0]["role"] == "system"
            )
            
            if has_system_prompt:
                if len(self.conversation_history) > 1:
                    del self.conversation_history[1]
                else:
                    break
            else:
                del self.conversation_history[0]
        
        if self._calculate_messages_char_count() > max_chars:
            logger.warning(
                f"Context still exceeds limit ({self._calculate_messages_char_count()} > {max_chars} chars) "
                f"after trimming. Consider increasing APPROXIMATE_CONTEXT_LENGTH."
            )
        
    def add_to_history(self, role: str, content: str) -> None:
        """
        Add a message to the conversation history.
        
        Args:
            role: Message role ('system', 'user', or 'assistant')
            content: Message content
        """
        self.conversation_history.append({
            "role": role,
            "content": content
        })
        
        self._trim_history_to_fit_context()
    
    def get_response(self, user_input: str, system_prompt: Optional[str] = None, 
                    add_to_history: bool = True, temperature: Optional[float] = None) -> Dict[str, Any]:
        """
        Get a response from the LLM for the given user input.
        
        Args:
            user_input: User's text input
            system_prompt: Optional system prompt to set context
            add_to_history: Whether to add this exchange to conversation history
            temperature: Optional temperature override (0.0 to 1.0)
            
        Returns:
            Dictionary containing the LLM response and metadata
        """
        self.is_processing = True
        start_time = logging.Formatter.converter()
        
        try:
            # Prepare messages
            messages = []
            
            # Add system prompt if provided and not already in history
            if system_prompt:
                messages.append({
                    "role": "system",
                    "content": system_prompt
                })
            
            # Add user input to history if it's not empty and add_to_history is True
            if user_input.strip() and add_to_history:
                self.add_to_history("user", user_input)
            
            # Add conversation history (which now includes the user input if add_to_history=True)
            messages.extend(self.conversation_history)
            
            # Only add user input directly if not adding to history
            # This ensures special cases (greetings/followups) work while preventing duplication for normal speech
            if user_input.strip() and not add_to_history:
                messages.append({
                    "role": "user",
                    "content": user_input
                })
            
            # Log the messages being sent
            logger.info(f"Sending request to LLM API with {len(messages)} messages")
            message_roles = [msg["role"] for msg in messages]
            user_message_count = message_roles.count("user")
            logger.info(f"Message roles: {message_roles}, user messages: {user_message_count}")
            
            # Prepare request parameters
            request_params = {
                "messages": messages,
                "temperature": temperature if temperature is not None else self.temperature,
                "max_tokens": self.max_tokens,
                "extra_body": {
                    "reasoning": {
                        "enabled": False
                    }
                }
            }
            
            # Only add model if it's not blank
            if self.model:
                request_params["model"] = self.model
            
            # Send request to LLM API using OpenAI client
            completion = self.client.chat.completions.create(**request_params)
            
            # Extract assistant response
            assistant_message = completion.choices[0].message.content if completion.choices else ""
            
            # Add assistant response to history (only if we added the user input)
            if assistant_message and add_to_history:
                self.add_to_history("assistant", assistant_message)
            
            # Calculate processing time
            end_time = logging.Formatter.converter()
            processing_time = end_time[0] - start_time[0]
            
            logger.info(f"Received response from LLM API after {processing_time:.2f}s")
            
            return {
                "text": assistant_message,
                "processing_time": processing_time,
                "finish_reason": completion.choices[0].finish_reason if completion.choices else None,
                "model": completion.model if completion.model else "unknown"
            }
            
        except Exception as e:
            logger.error(f"LLM API request error: {e}")
            error_response = f"I'm sorry, I encountered a problem connecting to my language model. {str(e)}"
            
            # Add the error to history if requested
            if add_to_history:
                self.add_to_history("assistant", error_response)
                
                # Check if it's a context length error (typically 400 or similar)
                error_str = str(e).lower()
                if "400" in error_str or "context" in error_str or "too long" in error_str:
                    logger.warning("Received context error, clearing conversation history to recover")
                    # Keep only system prompt if it exists
                    self.clear_history(keep_system_prompt=True)
            
            return {
                "text": error_response,
                "error": str(e)
            }
        finally:
            self.is_processing = False
    
    def clear_history(self, keep_system_prompt: bool = True) -> None:
        """
        Clear conversation history.
        
        Args:
            keep_system_prompt: Whether to keep the system prompt if it exists
        """
        if keep_system_prompt and self.conversation_history and self.conversation_history[0]["role"] == "system":
            self.conversation_history = [self.conversation_history[0]]
        else:
            self.conversation_history = []
    
    def get_config(self) -> Dict[str, Any]:
        """
        Get the current configuration.
        
        Returns:
            Dict containing the current configuration
        """
        return {
            "api_endpoint": self.api_endpoint,
            "api_key": "***" if self.api_key else "(blank)",
            "model": self.model if self.model else "(default)",
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "timeout": self.timeout,
            "approximate_context_length": self.approximate_context_length,
            "is_processing": self.is_processing,
            "history_length": len(self.conversation_history),
            "history_char_count": self._calculate_messages_char_count()
        }
