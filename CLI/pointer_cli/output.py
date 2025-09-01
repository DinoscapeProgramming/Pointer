"""
Output control system for Pointer CLI.
"""

from typing import Dict, Any, List, Optional, Union
from pathlib import Path
from enum import Enum

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.syntax import Syntax
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from .config import Config
from .utils import truncate_output, format_file_size

class OutputLevel(Enum):
    """Output verbosity levels."""
    QUIET = "quiet"
    NORMAL = "normal"
    VERBOSE = "verbose"
    DEBUG = "debug"

class OutputController:
    """Controls output display and formatting."""
    
    def __init__(self, config: Config, console: Console):
        self.config = config
        self.console = console
        self.output_level = OutputLevel.NORMAL
        self.show_ai_responses = config.ui.show_ai_responses
        self.show_tool_outputs = config.ui.show_tool_outputs
        self.show_diffs = config.ui.show_diffs
        self.max_output_lines = config.ui.max_output_lines
    
    def set_output_level(self, level: OutputLevel) -> None:
        """Set the output verbosity level."""
        self.output_level = level
        
        # Adjust settings based on level
        if level == OutputLevel.QUIET:
            self.show_ai_responses = False
            self.show_tool_outputs = False
            self.show_diffs = False
        elif level == OutputLevel.NORMAL:
            self.show_ai_responses = self.config.ui.show_ai_responses
            self.show_tool_outputs = self.config.ui.show_tool_outputs
            self.show_diffs = self.config.ui.show_diffs
        elif level == OutputLevel.VERBOSE:
            self.show_ai_responses = True
            self.show_tool_outputs = True
            self.show_diffs = True
        elif level == OutputLevel.DEBUG:
            self.show_ai_responses = True
            self.show_tool_outputs = True
            self.show_diffs = True
            self.max_output_lines = 1000
    
    def toggle_ai_responses(self) -> bool:
        """Toggle AI response display."""
        self.show_ai_responses = not self.show_ai_responses
        return self.show_ai_responses
    
    def toggle_tool_outputs(self) -> bool:
        """Toggle tool output display."""
        self.show_tool_outputs = not self.show_tool_outputs
        return self.show_tool_outputs
    
    def toggle_diffs(self) -> bool:
        """Toggle diff display."""
        self.show_diffs = not self.show_diffs
        return self.show_diffs
    
    def show_ai_response(self, response: str, title: str = "AI Response") -> None:
        """Display AI response if enabled."""
        if not self.show_ai_responses:
            return
        
        # Truncate if too long
        if len(response.split('\n')) > self.max_output_lines:
            response = truncate_output(response, self.max_output_lines)
        
        self.console.print(Panel(
            response,
            title=title,
            border_style="green"
        ))
    
    def show_tool_output(self, output: str, tool_name: str, success: bool = True) -> None:
        """Display tool output if enabled."""
        if not self.show_tool_outputs:
            return
        
        # Truncate if too long
        if len(output.split('\n')) > self.max_output_lines:
            output = truncate_output(output, self.max_output_lines)
        
        border_style = "green" if success else "red"
        title = f"Tool: {tool_name}"
        
        self.console.print(Panel(
            output,
            title=title,
            border_style=border_style
        ))
    
    def show_diff(self, diff: str, title: str = "Changes") -> None:
        """Display diff if enabled."""
        if not self.show_diffs:
            return
        
        if not diff.strip():
            self.console.print("[green]No changes detected[/green]")
            return
        
        self.console.print(Panel(
            diff,
            title=title,
            border_style="blue"
        ))
    
    def show_file_content(self, content: str, file_path: Path, language: Optional[str] = None) -> None:
        """Display file content with syntax highlighting."""
        if not content:
            self.console.print(f"[yellow]File is empty: {file_path}[/yellow]")
            return
        
        # Truncate if too long
        if len(content.split('\n')) > self.max_output_lines:
            content = truncate_output(content, self.max_output_lines)
        
        try:
            syntax = Syntax(
                content,
                language or "text",
                theme="monokai",
                line_numbers=True
            )
            self.console.print(Panel(
                syntax,
                title=f"File: {file_path}",
                border_style="cyan"
            ))
        except Exception:
            # Fallback to plain text
            self.console.print(Panel(
                content,
                title=f"File: {file_path}",
                border_style="cyan"
            ))
    
    def show_file_list(self, files: List[Path], title: str = "Files") -> None:
        """Display a list of files in a table."""
        if not files:
            self.console.print(f"[yellow]No files found[/yellow]")
            return
        
        table = Table(title=title)
        table.add_column("Name", style="cyan")
        table.add_column("Size", style="magenta")
        table.add_column("Type", style="green")
        table.add_column("Path", style="dim")
        
        for file_path in files:
            if file_path.exists():
                size = format_file_size(file_path.stat().st_size)
                file_type = "DIR" if file_path.is_dir() else "FILE"
                relative_path = file_path.relative_to(Path.cwd()) if file_path.is_relative_to(Path.cwd()) else file_path
            else:
                size = "N/A"
                file_type = "N/A"
                relative_path = file_path
            
            table.add_row(
                file_path.name,
                size,
                file_type,
                str(relative_path)
            )
        
        self.console.print(table)
    
    def show_search_results(self, results: List[Dict[str, Any]], query: str) -> None:
        """Display search results."""
        if not results:
            self.console.print(f"[yellow]No results found for: {query}[/yellow]")
            return
        
        self.console.print(f"[green]Found {len(results)} results for: {query}[/green]\n")
        
        for result in results:
            file_path = result.get("file", "")
            line_num = result.get("line", 0)
            content = result.get("content", "")
            
            self.console.print(f"[cyan]{file_path}:{line_num}[/cyan]")
            self.console.print(f"  {content}")
            self.console.print()
    
    def show_progress(self, message: str) -> Progress:
        """Show a progress indicator."""
        return Progress(
            SpinnerColumn(),
            TextColumn(f"[bold blue]{message}"),
            console=self.console,
            transient=True
        )
    
    def show_info(self, message: str) -> None:
        """Show informational message."""
        self.console.print(f"[blue]ℹ️  {message}[/blue]")
    
    def show_success(self, message: str) -> None:
        """Show success message."""
        self.console.print(f"[green]✓ {message}[/green]")
    
    def show_warning(self, message: str) -> None:
        """Show warning message."""
        self.console.print(f"[yellow]⚠️  {message}[/yellow]")
    
    def show_error(self, message: str) -> None:
        """Show error message."""
        self.console.print(f"[red]✗ {message}[/red]")
    
    def show_debug(self, message: str) -> None:
        """Show debug message."""
        if self.output_level == OutputLevel.DEBUG:
            self.console.print(f"[dim]🐛 {message}[/dim]")
    
    def show_config_summary(self) -> None:
        """Show current output configuration."""
        config_text = Text()
        config_text.append("Output Configuration:\n\n", style="bold")
        
        config_text.append(f"Output Level: {self.output_level.value}\n")
        config_text.append(f"Show AI Responses: {self.show_ai_responses}\n")
        config_text.append(f"Show Tool Outputs: {self.show_tool_outputs}\n")
        config_text.append(f"Show Diffs: {self.show_diffs}\n")
        config_text.append(f"Max Output Lines: {self.max_output_lines}\n")
        
        self.console.print(Panel(config_text, title="Output Settings", border_style="yellow"))
    
    def show_help(self) -> None:
        """Show output control help."""
        help_text = Text()
        help_text.append("Output Control Commands:\n\n", style="bold")
        
        help_text.append("/output quiet", style="bold blue")
        help_text.append(" - Minimal output (no AI responses, no tool outputs)\n")
        
        help_text.append("/output normal", style="bold blue")
        help_text.append(" - Normal output (default settings)\n")
        
        help_text.append("/output verbose", style="bold blue")
        help_text.append(" - Verbose output (show everything)\n")
        
        help_text.append("/output debug", style="bold blue")
        help_text.append(" - Debug output (show everything + debug info)\n")
        
        help_text.append("/toggle ai", style="bold blue")
        help_text.append(" - Toggle AI response display\n")
        
        help_text.append("/toggle tools", style="bold blue")
        help_text.append(" - Toggle tool output display\n")
        
        help_text.append("/toggle diffs", style="bold blue")
        help_text.append(" - Toggle diff display\n")
        
        help_text.append("/output config", style="bold blue")
        help_text.append(" - Show current output configuration\n")
        
        self.console.print(Panel(help_text, title="Output Control Help", border_style="green"))
    
    def format_tool_result(self, tool_name: str, result: str, success: bool = True) -> str:
        """Format tool result for display."""
        if success:
            return f"[green]✓ {tool_name} completed successfully[/green]\n{result}"
        else:
            return f"[red]✗ {tool_name} failed[/red]\n{result}"
    
    def format_file_info(self, file_path: Path) -> str:
        """Format file information for display."""
        if not file_path.exists():
            return f"[red]File not found: {file_path}[/red]"
        
        stat = file_path.stat()
        size = format_file_size(stat.st_size)
        file_type = "Directory" if file_path.is_dir() else "File"
        
        info = f"[cyan]{file_type}: {file_path.name}[/cyan]\n"
        info += f"  Path: {file_path}\n"
        info += f"  Size: {size}\n"
        info += f"  Modified: {stat.st_mtime}\n"
        
        return info
    
    def clear_screen(self) -> None:
        """Clear the console screen."""
        self.console.clear()
    
    def pause(self, message: str = "Press Enter to continue...") -> None:
        """Pause execution and wait for user input."""
        input(message)
    
    def confirm(self, message: str, default: bool = False) -> bool:
        """Ask for user confirmation."""
        suffix = " [Y/n]" if default else " [y/N]"
        response = input(f"{message}{suffix}: ").strip().lower()
        
        if not response:
            return default
        
        return response in ['y', 'yes', '1', 'true']
