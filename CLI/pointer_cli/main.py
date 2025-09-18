#!/usr/bin/env python3
"""
Main entry point for Pointer CLI.
"""

import sys
import os
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from .core import PointerCLI
from .config import Config
from .utils import get_config_path, ensure_config_dir

app = typer.Typer(
    name="pointer",
    help="Pointer CLI - AI-powered local codebase assistant",
    no_args_is_help=False,
    add_completion=False,
    invoke_without_command=True,
)

console = Console()

def main() -> None:
    """Entry point for the pointer command."""
    app()

@app.callback(invoke_without_command=True)
def cli_main(
    ctx: typer.Context,
    version: bool = typer.Option(False, "--version", "-v", help="Show version information"),
    config_path: Optional[str] = typer.Option(None, "--config", "-c", help="Path to config file"),
    init: bool = typer.Option(False, "--init", help="Initialize configuration"),
) -> None:
    """
    Pointer CLI - A professional command-line interface for AI-powered local codebase assistance.
    
    On first run, the CLI will prompt for initialization and configuration.
    """
    if ctx.invoked_subcommand is not None:
        return
    
    if version:
        from . import __version__
        console.print(f"Pointer CLI v{__version__}")
        return
    
    try:
        # Ensure config directory exists
        ensure_config_dir()
        
        # Load or create configuration
        config = Config.load(config_path)
        
        if init or not config.is_initialized():
            if not _initialize_config(config):
                console.print("[red]Initialization cancelled.[/red]")
                return
        
        # Initialize and run the CLI
        cli = PointerCLI(config)
        cli.run()
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Goodbye![/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)

def _initialize_config(config: Config) -> bool:
    """Initialize the configuration interactively."""
    console.print(Panel.fit(
        "[bold blue]Welcome to Pointer CLI![/bold blue]\n\n"
        "This is your first time running Pointer CLI. Let's set up your configuration.",
        title="Initialization"
    ))
    
    response = typer.confirm("Initialize Pointer CLI?", default=True)
    if not response:
        return False
    
    # API Configuration
    console.print("\n[bold]API Configuration[/bold]")
    api_base_url = typer.prompt(
        "API Base URL", 
        default="http://localhost:8000",
        help="Base URL for your local AI API"
    )
    
    model_name = typer.prompt(
        "Model Name",
        default="gpt-oss-20b",
        help="Model to use for AI interactions"
    )
    
    # Initialize configuration
    config.initialize(
        api_base_url=api_base_url,
        model_name=model_name,
        auto_run_mode=True,
        show_ai_responses=True
    )
    
    console.print("[green]✓ Configuration initialized successfully![/green]")
    return True

if __name__ == "__main__":
    app()
