#!/usr/bin/env python3
"""
Demo script for Pointer CLI functionality.
"""

import asyncio
import tempfile
from pathlib import Path
from rich.console import Console
from rich.panel import Panel

from pointer_cli.config import Config
from pointer_cli.tools import ToolManager
from pointer_cli.editor import CodeEditor, EditOperation, EditType
from pointer_cli.output import OutputController

def demo_tools():
    """Demonstrate tool functionality."""
    console = Console()
    console.print(Panel.fit("Pointer CLI Tools Demo", title="Demo", border_style="blue"))
    
    # Create temporary directory for demo
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create demo files
        demo_file = temp_path / "demo.py"
        demo_file.write_text("""#!/usr/bin/env python3
# Demo Python file

def hello_world():
    print("Hello, World!")

if __name__ == "__main__":
    hello_world()
""")
        
        # Initialize components
        config = Config()
        tool_manager = ToolManager(config, console)
        output_controller = OutputController(config, console)
        
        # Demo file operations
        console.print("\n[bold]1. Reading a file:[/bold]")
        result = tool_manager._read_file({"path": str(demo_file)})
        output_controller.show_tool_output(result, "read_file")
        
        # Demo file search
        console.print("\n[bold]2. Searching for files:[/bold]")
        result = tool_manager._search_files({
            "pattern": "*.py",
            "directory": str(temp_path)
        })
        output_controller.show_tool_output(result, "search_files")
        
        # Demo content search
        console.print("\n[bold]3. Searching for content:[/bold]")
        result = tool_manager._search_content({
            "query": "hello",
            "directory": str(temp_path)
        })
        output_controller.show_tool_output(result, "search_content")
        
        # Demo file editing
        console.print("\n[bold]4. Editing a file:[/bold]")
        changes = [
            {
                "type": "replace_line",
                "line": 4,
                "text": '    print("Hello, Pointer CLI!")'
            }
        ]
        result = tool_manager._edit_file({
            "path": str(demo_file),
            "changes": changes
        })
        output_controller.show_tool_output(result, "edit_file")
        
        # Show the modified file
        console.print("\n[bold]5. Modified file content:[/bold]")
        result = tool_manager._read_file({"path": str(demo_file)})
        output_controller.show_tool_output(result, "read_file")

def demo_editor():
    """Demonstrate code editor functionality."""
    console = Console()
    console.print(Panel.fit("Pointer CLI Code Editor Demo", title="Demo", border_style="green"))
    
    # Create temporary file for demo
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""# Demo file for editing
def example_function():
    return "Hello, World!"

def another_function():
    return "Goodbye, World!"
""")
        temp_file = Path(f.name)
    
    try:
        # Initialize editor
        editor = CodeEditor(console)
        editor.load_file(temp_file)
        
        console.print(f"\n[bold]Original file:[/bold]")
        editor.show_syntax_highlighted()
        
        # Make some edits
        console.print(f"\n[bold]Making edits...[/bold]")
        
        # Replace a line
        edit1 = EditOperation(
            type=EditType.REPLACE_LINE,
            line=2,
            text='    return "Hello, Pointer CLI!"'
        )
        editor.apply_edit(edit1)
        
        # Insert a new line
        edit2 = EditOperation(
            type=EditType.INSERT_LINE,
            line=4,
            text='    print("This is a new line")'
        )
        editor.apply_edit(edit2)
        
        # Show diff
        console.print(f"\n[bold]Changes made:[/bold]")
        editor.show_diff()
        
        # Show modified file
        console.print(f"\n[bold]Modified file:[/bold]")
        editor.show_syntax_highlighted()
        
    finally:
        # Clean up
        temp_file.unlink()

def demo_config():
    """Demonstrate configuration functionality."""
    console = Console()
    console.print(Panel.fit("Pointer CLI Configuration Demo", title="Demo", border_style="yellow"))
    
    # Create and configure (without saving to file)
    config = Config()
    
    console.print(f"\n[bold]Default configuration:[/bold]")
    console.print(f"API Base URL: {config.api.base_url}")
    console.print(f"Model: {config.api.model_name}")
    console.print(f"Auto-Run Mode: {config.mode.auto_run_mode}")
    console.print(f"Show AI Responses: {config.ui.show_ai_responses}")
    
    # Show what initialization would do (without actually doing it)
    console.print(f"\n[bold]Example initialization (not applied):[/bold]")
    console.print(f"API Base URL: http://localhost:1234")
    console.print(f"Model: gpt-oss-20b")
    console.print(f"Auto-Run Mode: False")
    console.print(f"Show AI Responses: False")
    
    # Show what toggling would do (without actually doing it)
    console.print(f"\n[bold]Example toggling (not applied):[/bold]")
    console.print(f"Auto-Run Mode: {not config.mode.auto_run_mode}")
    console.print(f"Show AI Responses: {not config.ui.show_ai_responses}")
    
    console.print(f"\n[dim]Note: Demo shows examples without modifying your actual configuration[/dim]")

def main():
    """Run all demos."""
    console = Console()
    console.print(Panel.fit(
        "[bold blue]Pointer CLI[/bold blue] - Professional AI-powered local codebase assistant\n\n"
        "This demo showcases the core functionality of Pointer CLI.",
        title="Welcome",
        border_style="blue"
    ))
    
    # Run demos
    demo_config()
    demo_tools()
    demo_editor()
    
    console.print(Panel.fit(
        "[green]Demo completed successfully![/green]\n\n"
        "To use Pointer CLI:\n"
        "1. Run: [bold]python -m pointer_cli[/bold]\n"
        "2. Initialize configuration on first run\n"
        "3. Start chatting with your codebase!",
        title="Next Steps",
        border_style="green"
    ))

if __name__ == "__main__":
    main()
