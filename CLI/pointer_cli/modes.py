"""
Mode management for Pointer CLI.
"""

from typing import Dict, Any, Optional
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from .config import Config

class ModeManager:
    """Manages different modes for Pointer CLI."""
    
    def __init__(self, config: Config, console: Console):
        self.config = config
        self.console = console
        self.current_mode = "auto_run" if config.mode.auto_run_mode else "dry_run"
    
    def get_current_mode(self) -> str:
        """Get the current mode."""
        return self.current_mode
    
    def is_auto_run_mode(self) -> bool:
        """Check if in auto-run mode."""
        return self.current_mode == "auto_run"
    
    def is_dry_run_mode(self) -> bool:
        """Check if in dry-run mode."""
        return self.current_mode == "dry_run"
    
    def toggle_mode(self) -> str:
        """Toggle between auto-run and dry-run modes."""
        if self.current_mode == "auto_run":
            self.current_mode = "dry_run"
            self.config.mode.dry_run_mode = True
            self.config.mode.auto_run_mode = False
        else:
            self.current_mode = "auto_run"
            self.config.mode.auto_run_mode = True
            self.config.mode.dry_run_mode = False
        
        self.config.save()
        return self.current_mode
    
    def set_mode(self, mode: str) -> bool:
        """Set a specific mode."""
        if mode not in ["auto_run", "dry_run"]:
            return False
        
        self.current_mode = mode
        
        if mode == "auto_run":
            self.config.mode.auto_run_mode = True
            self.config.mode.dry_run_mode = False
        else:
            self.config.mode.auto_run_mode = False
            self.config.mode.dry_run_mode = True
        
        self.config.save()
        return True
    
    def should_execute_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> bool:
        """Determine if a tool should be executed based on current mode."""
        if self.is_auto_run_mode():
            return True
        
        if self.is_dry_run_mode():
            return False
        
        return True
    
    def get_mode_description(self) -> str:
        """Get description of current mode."""
        if self.is_auto_run_mode():
            return "Auto-Run Mode: Tools are executed immediately"
        else:
            return "Dry-Run Mode: Tools show previews without executing"
    
    def show_mode_status(self) -> None:
        """Show current mode status."""
        mode_text = Text()
        mode_text.append("Current Mode: ", style="bold")
        
        if self.is_auto_run_mode():
            mode_text.append("Auto-Run", style="bold green")
            mode_text.append("\n\nTools will be executed immediately when requested.")
        else:
            mode_text.append("Dry-Run", style="bold yellow")
            mode_text.append("\n\nTools will show previews without executing.")
        
        mode_text.append(f"\n\nMode Settings:")
        mode_text.append(f"\n  Auto-Run: {self.config.mode.auto_run_mode}")
        mode_text.append(f"\n  Dry-Run: {self.config.mode.dry_run_mode}")
        mode_text.append(f"\n  Confirm Changes: {self.config.mode.confirm_changes}")
        
        self.console.print(Panel(mode_text, title="Mode Status", border_style="blue"))
    
    def get_tool_preview(self, tool_name: str, tool_args: Dict[str, Any]) -> str:
        """Get a preview of what a tool would do."""
        if self.is_auto_run_mode():
            return f"Would execute {tool_name} with args: {tool_args}"
        
        # Generate detailed preview based on tool type
        if tool_name == "read_file":
            path = tool_args.get("path", "")
            return f"Would read file: {path}"
        
        elif tool_name == "write_file":
            path = tool_args.get("path", "")
            content = tool_args.get("content", "")
            lines = len(content.split('\n')) if content else 0
            return f"Would write {lines} lines to: {path}"
        
        elif tool_name == "edit_file":
            path = tool_args.get("path", "")
            changes = tool_args.get("changes", [])
            return f"Would apply {len(changes)} changes to: {path}"
        
        elif tool_name == "run_command":
            command = tool_args.get("command", "")
            return f"Would execute command: {command}"
        
        elif tool_name == "delete_file":
            path = tool_args.get("path", "")
            return f"Would delete: {path}"
        
        elif tool_name == "create_directory":
            path = tool_args.get("path", "")
            return f"Would create directory: {path}"
        
        elif tool_name == "move_file":
            source = tool_args.get("source", "")
            destination = tool_args.get("destination", "")
            return f"Would move {source} to {destination}"
        
        elif tool_name == "copy_file":
            source = tool_args.get("source", "")
            destination = tool_args.get("destination", "")
            return f"Would copy {source} to {destination}"
        
        else:
            return f"Would execute {tool_name} with args: {tool_args}"
    
    def confirm_destructive_action(self, action: str) -> bool:
        """Ask for confirmation for destructive actions."""
        if not self.config.mode.confirm_changes:
            return True
        
        # List of destructive actions
        destructive_actions = [
            "delete_file", "delete_directory", "remove_file", "remove_directory",
            "move_file", "rename_file", "overwrite_file"
        ]
        
        if any(destructive in action.lower() for destructive in destructive_actions):
            response = input(f"⚠️  Destructive action detected: {action}\nProceed? (y/N): ")
            return response.lower() in ['y', 'yes']
        
        return True
    
    def get_mode_help(self) -> str:
        """Get help text for modes."""
        help_text = Text()
        help_text.append("Pointer CLI Modes:\n\n", style="bold")
        
        help_text.append("Auto-Run Mode (Default):\n", style="bold green")
        help_text.append("  - Tools are executed immediately\n")
        help_text.append("  - Changes are applied directly\n")
        help_text.append("  - Best for experienced users\n\n")
        
        help_text.append("Dry-Run Mode:\n", style="bold yellow")
        help_text.append("  - Tools show previews without executing\n")
        help_text.append("  - Safe for experimentation\n")
        help_text.append("  - Good for learning and testing\n\n")
        
        help_text.append("Commands:\n", style="bold")
        help_text.append("  /mode - Toggle between modes\n")
        help_text.append("  /status - Show current mode status\n")
        
        return str(help_text)
