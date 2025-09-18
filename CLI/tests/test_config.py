"""
Tests for configuration management.
"""

import json
import tempfile
from pathlib import Path
import pytest

from pointer_cli.config import Config, APIConfig, UIConfig, ModeConfig

class TestConfig:
    """Test configuration functionality."""
    
    def test_default_config(self):
        """Test default configuration creation."""
        config = Config()
        
        assert config.api.base_url == "http://localhost:8000"
        assert config.api.model_name == "gpt-oss-20b"
        assert config.ui.show_ai_responses is True
        assert config.mode.auto_run_mode is True
        assert config.initialized is False
    
    def test_config_initialization(self):
        """Test configuration initialization."""
        config = Config()
        
        config.initialize(
            api_base_url="http://localhost:1234",
            model_name="gpt-oss-20b",
            auto_run_mode=False,
            show_ai_responses=False
        )
        
        assert config.api.base_url == "http://localhost:1234"
        assert config.api.model_name == "gpt-oss-20b"
        assert config.mode.auto_run_mode is False
        assert config.ui.show_ai_responses is False
        assert config.initialized is True
    
    def test_config_save_load(self):
        """Test configuration save and load."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = Path(temp_dir) / "test_config.json"
            
            # Create and save config
            config = Config()
            config.initialize(
                api_base_url="http://test:8000",
                model_name="test-model"
            )
            config.save(str(config_file))
            
            # Load config
            loaded_config = Config.load(str(config_file))
            
            assert loaded_config.api.base_url == "http://test:8000"
            assert loaded_config.api.model_name == "test-model"
            assert loaded_config.initialized is True
    
    def test_config_toggle_methods(self):
        """Test configuration toggle methods."""
        config = Config()
        
        # Test auto-run toggle
        assert config.mode.auto_run_mode is True
        new_mode = config.toggle_auto_run_mode()
        assert new_mode is False
        assert config.mode.auto_run_mode is False
        

        
        # Test AI responses toggle
        assert config.ui.show_ai_responses is True
        new_setting = config.toggle_ai_responses()
        assert new_setting is False
        assert config.ui.show_ai_responses is False
    
    def test_config_update_methods(self):
        """Test configuration update methods."""
        config = Config()
        
        # Test API config update
        config.update_api_config(
            base_url="http://new-api:8000",
            model_name="new-model"
        )
        assert config.api.base_url == "http://new-api:8000"
        assert config.api.model_name == "new-model"
        
        # Test UI config update
        config.update_ui_config(
            show_ai_responses=False,
            theme="dark"
        )
        assert config.ui.show_ai_responses is False
        assert config.ui.theme == "dark"
        
        # Test mode config update
        config.update_mode_config(
            auto_run_mode=False
        )
        assert config.mode.auto_run_mode is False
