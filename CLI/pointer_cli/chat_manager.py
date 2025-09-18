"""
Chat management system for Pointer CLI.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

@dataclass
class ChatMessage:
    """Represents a single chat message."""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: str
    tokens_used: int = 0

@dataclass
class ChatSession:
    """Represents a chat session."""
    id: str
    title: str
    created_at: str
    last_modified: str
    messages: List[ChatMessage]
    total_tokens: int = 0

class ChatManager:
    """Manages chat sessions and persistence."""
    
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.chats_dir = config_dir / "chats"
        self.chats_dir.mkdir(exist_ok=True)
        self.current_chat: Optional[ChatSession] = None
    
    def create_new_chat(self, title: str = None) -> ChatSession:
        """Create a new chat session."""
        if not title:
            title = f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        chat_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        now = datetime.now().isoformat()
        
        self.current_chat = ChatSession(
            id=chat_id,
            title=title,
            created_at=now,
            last_modified=now,
            messages=[],
            total_tokens=0
        )
        
        return self.current_chat
    
    def save_chat(self, chat: ChatSession = None) -> None:
        """Save a chat session to disk."""
        if chat is None:
            chat = self.current_chat
        
        if chat is None:
            return
        
        chat_file = self.chats_dir / f"{chat.id}.json"
        
        # Update last modified
        chat.last_modified = datetime.now().isoformat()
        
        # Convert to dict and save
        chat_data = {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at,
            "last_modified": chat.last_modified,
            "total_tokens": chat.total_tokens,
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp,
                    "tokens_used": msg.tokens_used
                }
                for msg in chat.messages
            ]
        }
        
        with open(chat_file, 'w', encoding='utf-8') as f:
            json.dump(chat_data, f, indent=2, ensure_ascii=False)
    
    def load_chat(self, chat_id: str) -> Optional[ChatSession]:
        """Load a chat session from disk."""
        chat_file = self.chats_dir / f"{chat_id}.json"
        
        if not chat_file.exists():
            return None
        
        try:
            with open(chat_file, 'r', encoding='utf-8') as f:
                chat_data = json.load(f)
            
            messages = [
                ChatMessage(
                    role=msg["role"],
                    content=msg["content"],
                    timestamp=msg["timestamp"],
                    tokens_used=msg.get("tokens_used", 0)
                )
                for msg in chat_data["messages"]
            ]
            
            chat = ChatSession(
                id=chat_data["id"],
                title=chat_data["title"],
                created_at=chat_data["created_at"],
                last_modified=chat_data["last_modified"],
                messages=messages,
                total_tokens=chat_data.get("total_tokens", 0)
            )
            
            self.current_chat = chat
            return chat
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error loading chat {chat_id}: {e}")
            return None
    
    def list_chats(self) -> List[Dict[str, Any]]:
        """List all available chat sessions."""
        chats = []
        
        for chat_file in self.chats_dir.glob("*.json"):
            try:
                with open(chat_file, 'r', encoding='utf-8') as f:
                    chat_data = json.load(f)
                
                chats.append({
                    "id": chat_data["id"],
                    "title": chat_data["title"],
                    "created_at": chat_data["created_at"],
                    "last_modified": chat_data["last_modified"],
                    "message_count": len(chat_data["messages"]),
                    "total_tokens": chat_data.get("total_tokens", 0)
                })
            except (json.JSONDecodeError, KeyError):
                continue
        
        # Sort by last modified (newest first)
        chats.sort(key=lambda x: x["last_modified"], reverse=True)
        return chats
    
    def delete_chat(self, chat_id: str) -> bool:
        """Delete a chat session."""
        chat_file = self.chats_dir / f"{chat_id}.json"
        
        if chat_file.exists():
            chat_file.unlink()
            
            # If this was the current chat, clear it
            if self.current_chat and self.current_chat.id == chat_id:
                self.current_chat = None
            
            return True
        
        return False
    
    def add_message(self, role: str, content: str, tokens_used: int = 0) -> None:
        """Add a message to the current chat."""
        if self.current_chat is None:
            self.create_new_chat()
        
        message = ChatMessage(
            role=role,
            content=content,
            timestamp=datetime.now().isoformat(),
            tokens_used=tokens_used
        )
        
        self.current_chat.messages.append(message)
        self.current_chat.total_tokens += tokens_used
    
    def get_current_chat(self) -> Optional[ChatSession]:
        """Get the current chat session."""
        return self.current_chat
    
    def set_current_chat(self, chat: ChatSession) -> None:
        """Set the current chat session."""
        self.current_chat = chat
