"""
Core Pointer CLI implementation.
"""

import asyncio
import sys
from typing import Optional, Dict, Any, List
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt

from .config import Config
from .chat import ChatInterface
from .tools import ToolManager
from .modes import ModeManager
from .utils import get_project_root, is_git_repo

class PointerCLI:
    """Main Pointer CLI class."""
    
    def __init__(self, config: Config):
        self.config = config
        self.console = Console()
        self.chat_interface = ChatInterface(config, self.console)
        self.tool_manager = ToolManager(config, self.console)
        self.mode_manager = ModeManager(config, self.console)
        
        # State
        self.running = False
        self.current_context = {}
        self.first_message = True
        
        # Token tracking
        self.total_tokens = 0
        self.message_count = 0
        self.session_start_time = None
        
    def run(self) -> None:
        """Run the Pointer CLI."""
        self.running = True
        
        # Initialize session tracking
        import time
        self.session_start_time = time.time()
        
        # Show welcome message
        self._show_welcome()
        
        # Initialize context
        self._initialize_context()
        
        # Start chat interface
        try:
            asyncio.run(self._run_chat_loop())
        except KeyboardInterrupt:
            self._handle_exit()
        except Exception as e:
            self.console.print(f"[red]Unexpected error: {e}[/red]")
            sys.exit(1)
    
    def _show_welcome(self) -> None:
        """Show welcome message and status."""
        welcome_text = Text()
        welcome_text.append("Pointer CLI", style="bold blue")
        welcome_text.append(" - AI-powered local codebase assistant\n\n")
        
        # Show current configuration
        welcome_text.append("Configuration:\n", style="bold")
        welcome_text.append(f"  API: {self.config.api.base_url}\n")
        welcome_text.append(f"  Model: {self.config.api.model_name}\n")
        welcome_text.append(f"  Mode: {'Auto-Run' if self.config.mode.auto_run_mode else 'Dry-Run'}\n")
        welcome_text.append(f"  Show AI Responses: {'Yes' if self.config.ui.show_ai_responses else 'No'}\n")
        
        # Show project info
        project_root = get_project_root()
        if project_root:
            welcome_text.append(f"\nProject: {project_root.name}\n")
            welcome_text.append(f"  Root: {project_root}\n")
            welcome_text.append(f"  Git: {'Yes' if is_git_repo() else 'No'}\n")
        else:
            welcome_text.append("\nNo git repository detected\n")
        
        welcome_text.append("\nType your message or use commands:\n")
        welcome_text.append("  /help - Show help\n", style="dim")
        welcome_text.append("  /mode - Toggle run mode\n", style="dim")
        welcome_text.append("  /config - Show configuration\n", style="dim")
        welcome_text.append("  /exit - Exit Pointer CLI\n", style="dim")
        
        self.console.print(Panel(welcome_text, title="Welcome", border_style="blue"))
    
    def _initialize_context(self) -> None:
        """Initialize the current context."""
        self.current_context = {
            "project_root": get_project_root(),
            "current_directory": Path.cwd(),
            "is_git_repo": is_git_repo(),
            "config": self.config,
        }
    
    async def _run_chat_loop(self) -> None:
        """Run the main chat loop."""
        while self.running:
            try:
                # Get user input
                user_input = await self.chat_interface.get_user_input()
                
                if not user_input.strip():
                    continue
                
                # Handle commands
                if user_input.startswith('/'):
                    await self._handle_command(user_input)
                    continue
                
                # Process natural language input
                await self._process_user_message(user_input)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.console.print(f"[red]Error: {e}[/red]")
    
    async def _handle_command(self, command: str) -> None:
        """Handle CLI commands."""
        parts = command[1:].split()
        cmd = parts[0].lower() if parts else ""
        args = parts[1:] if len(parts) > 1 else []
        
        if cmd == "help":
            self._show_help()
        elif cmd == "config":
            self._show_config()
        elif cmd == "exit":
            self._handle_exit()
        elif cmd == "clear":
            # Clear the console completely (true clear, not scroll up)
            import os
            os.system('cls' if os.name == 'nt' else 'clear')
        elif cmd == "status":
            self._show_status()
        elif cmd == "info":
            self._show_info()
        else:
            self.console.print(f"[yellow]Unknown command: {cmd}[/yellow]")
            self.console.print("Type /help for available commands.")
    
    async def _process_user_message(self, message: str) -> None:
        """Process natural language user message."""
        try:
            # Clear screen on first message (but keep user message visible)
            if self.first_message:
                # Clear the console completely
                import os
                os.system('cls' if os.name == 'nt' else 'clear')
                # Re-print the user's message so it stays visible
                self.console.print(f"[bold blue]You:[/bold blue] {message}")
                self.first_message = False
            
            # Increment message count
            self.message_count += 1
            
            # Get AI response (streaming is handled in chat_interface)
            ai_response, tokens_used = await self.chat_interface.get_ai_response_with_tokens(message, self.current_context)
            
            # Track tokens
            if tokens_used:
                self.total_tokens += tokens_used
            
            # Note: AI response is already displayed via streaming, no need to display again
            
            # Parse and execute tools
            tools_to_execute = self.chat_interface.parse_tools(ai_response)
            
            if tools_to_execute:
                await self._execute_tools(tools_to_execute)
                
                # Get AI follow-up after tool execution (if enabled)
                if self.config.ui.show_ai_followup:
                    followup_response, followup_tokens = await self.chat_interface.get_ai_response_with_tokens(
                        self._create_followup_prompt(tools_to_execute), self.current_context
                    )
                    
                    # Track follow-up tokens
                    if followup_tokens:
                        self.total_tokens += followup_tokens
                    
                    # Parse and execute any follow-up tools
                    followup_tools = self.chat_interface.parse_tools(followup_response)
                    if followup_tools:
                        await self._execute_tools(followup_tools)
            
        except Exception as e:
            # Don't show the error again if it was already displayed by chat_interface
            if "Error getting AI response:" not in str(e):
                self.console.print(f"[red]Error processing message: {e}[/red]")
    
    async def _execute_tools(self, tools: List[Dict[str, Any]]) -> None:
        """Execute tools from AI response."""
        for tool in tools:
            try:
                if self.config.mode.dry_run_mode:
                    # Show what would be executed
                    self.console.print(f"[yellow]DRY RUN: Would execute {tool['name']}[/yellow]")
                    if 'args' in tool:
                        self.console.print(f"  Args: {tool['args']}")
                    continue
                
                # Execute the tool
                result = await self.tool_manager.execute_tool(tool)
                
                if self.config.ui.show_tool_outputs:
                    self.console.print(Panel(
                        result,
                        title=f"Tool: {tool['name']}",
                        border_style="blue"
                    ))
                
            except Exception as e:
                self.console.print(f"[red]Error executing tool {tool.get('name', 'unknown')}: {e}[/red]")
    
    async def _get_ai_followup(self, executed_tools: List[Dict[str, Any]]) -> None:
        """Get AI follow-up analysis after tool execution."""
        try:
            # Create a summary of executed tools for the AI
            tool_summary = self._create_tool_summary(executed_tools)
            
            # Create follow-up prompt
            followup_prompt = f"""I just executed the following tools:

{tool_summary}

Please provide a brief analysis of the results and any follow-up suggestions or observations. Keep it concise and actionable."""
            
            # Get AI follow-up response (streaming is handled in chat_interface)
            followup_response = await self.chat_interface.get_ai_response(followup_prompt, self.current_context)
            
            # Note: Follow-up response is already displayed via streaming, no need to display again
            
            # Parse and execute any follow-up tools
            followup_tools = self.chat_interface.parse_tools(followup_response)
            if followup_tools:
                await self._execute_tools(followup_tools)
                
        except Exception as e:
            self.console.print(f"[yellow]Note: Could not get AI follow-up: {e}[/yellow]")
    
    def _create_tool_summary(self, tools: List[Dict[str, Any]]) -> str:
        """Create a summary of executed tools for AI analysis."""
        summary_parts = []
        
        for i, tool in enumerate(tools, 1):
            tool_name = tool.get('name', 'unknown')
            tool_args = tool.get('args', {})
            
            summary_parts.append(f"{i}. {tool_name}")
            if tool_args:
                # Format arguments nicely
                args_str = ", ".join([f"{k}={v}" for k, v in tool_args.items()])
                summary_parts.append(f"   Args: {args_str}")
        
        return "\n".join(summary_parts)
    
    def _create_followup_prompt(self, executed_tools: List[Dict[str, Any]]) -> str:
        """Create follow-up prompt for AI analysis."""
        tool_summary = self._create_tool_summary(executed_tools)
        
        return f"""I just executed the following tools:

{tool_summary}

Please provide a brief analysis of the results and any follow-up suggestions or observations. Keep it concise and actionable."""
    
    def _display_ai_response(self, response: str, title: str, border_style: str) -> None:
        """Display AI response with thinking and main content in separate panels."""
        # Split response into thinking and main content
        thinking_content, main_content = self._split_ai_response(response)
        
        # Display thinking in separate gray panel if present
        if thinking_content:
            self.console.print(Panel(
                thinking_content, 
                title="Thinking", 
                border_style="bright_black"
            ))
        
        # Display main response
        if main_content.strip():
            self.console.print(Panel(main_content, title=title, border_style=border_style))
    
    def _split_ai_response(self, response: str) -> tuple[str, str]:
        """Split AI response into thinking content and main content."""
        import re
        
        # Find thinking blocks
        think_match = re.search(r'<think>(.*?)</think>', response, flags=re.DOTALL)
        
        if think_match:
            # Extract thinking content
            thinking_content = think_match.group(1).strip()
            
            # Remove thinking blocks from main content
            main_content = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()
            
            return thinking_content, main_content
        else:
            # No thinking content found
            return "", response
    
    def _show_info(self) -> None:
        """Show session information including token usage."""
        import time
        
        if self.session_start_time is None:
            self.console.print("[yellow]Session information not available yet.[/yellow]")
            return
        
        # Calculate session duration
        current_time = time.time()
        session_duration = current_time - self.session_start_time
        
        # Format duration
        hours = int(session_duration // 3600)
        minutes = int((session_duration % 3600) // 60)
        seconds = int(session_duration % 60)
        
        if hours > 0:
            duration_str = f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            duration_str = f"{minutes}m {seconds}s"
        else:
            duration_str = f"{seconds}s"
        
        # Calculate average tokens per message
        avg_tokens = self.total_tokens / self.message_count if self.message_count > 0 else 0
        
        # Create info display
        info_text = Text()
        info_text.append("Session Information:\n\n", style="bold")
        
        info_text.append("Duration: ", style="bold")
        info_text.append(f"{duration_str}\n")
        
        info_text.append("Messages: ", style="bold")
        info_text.append(f"{self.message_count}\n")
        
        info_text.append("Total Tokens: ", style="bold")
        info_text.append(f"{self.total_tokens:,}\n")
        
        info_text.append("Avg Tokens/Message: ", style="bold")
        info_text.append(f"{avg_tokens:.1f}\n\n")
        
        info_text.append("Configuration:\n", style="bold")
        info_text.append("Model: ", style="bold")
        info_text.append(f"{self.config.api.model_name}\n")
        info_text.append("API Base URL: ", style="bold")
        info_text.append(f"{self.config.api.base_url}\n")
        
        self.console.print(Panel(info_text, title="Session Info", border_style="green"))
    
    def _show_help(self) -> None:
        """Show help information."""
        help_text = Text()
        help_text.append("Pointer CLI Commands:\n\n", style="bold")
        
        help_text.append("/help", style="bold blue")
        help_text.append(" - Show this help message\n")
        
        help_text.append("/config", style="bold blue")
        help_text.append(" - Show current configuration\n")
        
        help_text.append("/status", style="bold blue")
        help_text.append(" - Show current status and context\n")
        
        help_text.append("/info", style="bold blue")
        help_text.append(" - Show session information and token usage\n")
        
        help_text.append("/clear", style="bold blue")
        help_text.append(" - Clear the screen\n")
        
        help_text.append("/exit", style="bold blue")
        help_text.append(" - Exit Pointer CLI\n\n")
        
        help_text.append("Natural Language:\n", style="bold")
        help_text.append("You can interact with Pointer CLI using natural language.\n")
        help_text.append("Ask questions, request file operations, or describe what you want to do.\n")
        
        self.console.print(Panel(help_text, title="Help", border_style="green"))
    
    def _show_config(self) -> None:
        """Show current configuration."""
        config_text = Text()
        config_text.append("Current Configuration:\n\n", style="bold")
        
        # Show config file location
        from .config import Config
        config_path = Config.get_default_config_path()
        config_text.append("Configuration File:\n", style="bold blue")
        config_text.append(f"  Location: {config_path}\n")
        config_text.append(f"  Exists: {'Yes' if config_path.exists() else 'No'}\n\n")
        
        config_text.append("API Settings:\n", style="bold blue")
        config_text.append(f"  Base URL: {self.config.api.base_url}\n")
        config_text.append(f"  Model: {self.config.api.model_name}\n")
        config_text.append(f"  Timeout: {self.config.api.timeout}s\n")
        config_text.append(f"  Max Retries: {self.config.api.max_retries}\n\n")
        
        config_text.append("UI Settings:\n", style="bold blue")
        config_text.append(f"  Show AI Responses: {self.config.ui.show_ai_responses}\n")
        config_text.append(f"  Show Tool Outputs: {self.config.ui.show_tool_outputs}\n")
        config_text.append(f"  Show Diffs: {self.config.ui.show_diffs}\n")
        config_text.append(f"  Show AI Follow-up: {self.config.ui.show_ai_followup}\n")
        config_text.append(f"  Theme: {self.config.ui.theme}\n\n")
        
        config_text.append("Mode Settings:\n", style="bold blue")
        config_text.append(f"  Auto-Run Mode: {self.config.mode.auto_run_mode}\n")
        config_text.append(f"  Dry-Run Mode: {self.config.mode.dry_run_mode}\n")
        config_text.append(f"  Confirm Changes: {self.config.mode.confirm_changes}\n")
        
        self.console.print(Panel(config_text, title="Configuration", border_style="yellow"))
    
    def _show_status(self) -> None:
        """Show current status."""
        status_text = Text()
        status_text.append("Current Status:\n\n", style="bold")
        
        status_text.append(f"Project Root: {self.current_context.get('project_root', 'None')}\n")
        status_text.append(f"Current Directory: {self.current_context.get('current_directory', 'None')}\n")
        status_text.append(f"Git Repository: {self.current_context.get('is_git_repo', False)}\n")
        status_text.append(f"Mode: {'Auto-Run' if self.config.mode.auto_run_mode else 'Dry-Run'}\n")
        status_text.append(f"Running: {self.running}\n")
        
        self.console.print(Panel(status_text, title="Status", border_style="cyan"))
    
    def _handle_exit(self) -> None:
        """Handle exit gracefully."""
        self.running = False
        self.console.print("\n[yellow]Goodbye![/yellow]")
        sys.exit(0)
