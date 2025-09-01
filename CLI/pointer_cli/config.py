"""
Configuration management for Pointer CLI.
"""

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from pydantic import BaseModel, Field

class APIConfig(BaseModel):
    """API configuration settings."""
    base_url: str = Field(default="http://localhost:8000", description="Base URL for AI API")
    model_name: str = Field(default="gpt-oss-20b", description="Model name to use")
    api_key: Optional[str] = Field(default=None, description="API key if required")
    timeout: int = Field(default=30, description="Request timeout in seconds")
    max_retries: int = Field(default=3, description="Maximum retry attempts")

class UIConfig(BaseModel):
    """User interface configuration."""
    show_ai_responses: bool = Field(default=True, description="Show AI chat responses")
    show_tool_outputs: bool = Field(default=True, description="Show tool execution outputs")
    show_diffs: bool = Field(default=True, description="Show diff previews")
    show_ai_followup: bool = Field(default=True, description="Show AI follow-up after tool execution")
    show_thinking: bool = Field(default=True, description="Show AI thinking dialogue")
    theme: str = Field(default="default", description="UI theme")
    max_output_lines: int = Field(default=100, description="Maximum lines to show in output")

class ModeConfig(BaseModel):
    """Mode configuration."""
    auto_run_mode: bool = Field(default=True, description="Execute tools immediately")
    dry_run_mode: bool = Field(default=False, description="Show changes without applying")
    confirm_changes: bool = Field(default=False, description="Confirm before applying changes")

class Config(BaseModel):
    """Main configuration class."""
    api: APIConfig = Field(default_factory=APIConfig)
    ui: UIConfig = Field(default_factory=UIConfig)
    mode: ModeConfig = Field(default_factory=ModeConfig)
    initialized: bool = Field(default=False, description="Whether config is initialized")
    
    model_config = {
        "json_encoders": {
            Path: str,
        }
    }

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> "Config":
        """Load configuration from file or create default."""
        if config_path:
            config_file = Path(config_path)
        else:
            config_file = cls.get_default_config_path()
        
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return cls(**data)
            except (json.JSONDecodeError, ValueError) as e:
                print(f"Warning: Invalid config file {config_file}: {e}")
                return cls()
        
        return cls()
    
    def save(self, config_path: Optional[str] = None) -> None:
        """Save configuration to file."""
        if config_path:
            config_file = Path(config_path)
        else:
            config_file = self.get_default_config_path()
        
        # Ensure directory exists
        config_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(self.model_dump(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def get_default_config_path(cls) -> Path:
        """Get the default configuration file path."""
        config_dir = Path.home() / ".pointer-cli"
        return config_dir / "config.json"
    
    def is_initialized(self) -> bool:
        """Check if configuration is initialized."""
        return self.initialized
    
    def initialize(
        self,
        api_base_url: str,
        model_name: str,
        auto_run_mode: bool = True,
        show_ai_responses: bool = True,
        **kwargs
    ) -> None:
        """Initialize configuration with provided values."""
        self.api.base_url = api_base_url
        self.api.model_name = model_name
        self.mode.auto_run_mode = auto_run_mode
        self.ui.show_ai_responses = show_ai_responses
        self.initialized = True
        
        # Save the configuration
        self.save()
    
    def update_api_config(self, **kwargs) -> None:
        """Update API configuration."""
        for key, value in kwargs.items():
            if hasattr(self.api, key):
                setattr(self.api, key, value)
        self.save()
    
    def update_ui_config(self, **kwargs) -> None:
        """Update UI configuration."""
        for key, value in kwargs.items():
            if hasattr(self.ui, key):
                setattr(self.ui, key, value)
        self.save()
    
    def update_mode_config(self, **kwargs) -> None:
        """Update mode configuration."""
        for key, value in kwargs.items():
            if hasattr(self.mode, key):
                setattr(self.mode, key, value)
        self.save()
    
    def toggle_auto_run_mode(self) -> bool:
        """Toggle auto-run mode."""
        self.mode.auto_run_mode = not self.mode.auto_run_mode
        self.save()
        return self.mode.auto_run_mode
    
    def toggle_dry_run_mode(self) -> bool:
        """Toggle dry-run mode."""
        self.mode.dry_run_mode = not self.mode.dry_run_mode
        self.save()
        return self.mode.dry_run_mode
    
    def toggle_ai_responses(self) -> bool:
        """Toggle AI response display."""
        self.ui.show_ai_responses = not self.ui.show_ai_responses
        self.save()
        return self.ui.show_ai_responses
    
    def toggle_thinking(self) -> bool:
        """Toggle AI thinking display."""
        self.ui.show_thinking = not self.ui.show_thinking
        self.save()
        return self.ui.show_thinking
