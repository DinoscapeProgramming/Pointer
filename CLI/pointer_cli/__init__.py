"""
Pointer CLI - A professional command-line interface for AI-powered local codebase assistance.
"""

__version__ = "1.0.0"
__author__ = "Pointer CLI Team"
__email__ = "team@pointer-cli.dev"

from .main import main
from .core import PointerCLI
from .config import Config
from .chat import ChatInterface
from .tools import ToolManager
from .modes import ModeManager

__all__ = [
    "main",
    "PointerCLI", 
    "Config",
    "ChatInterface",
    "ToolManager",
    "ModeManager",
]
