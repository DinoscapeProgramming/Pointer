# Pointer CLI

A professional production-level command-line interface for interacting with an AI-powered local codebase assistant.

## Features

- **Global Command Access**: Accessible via `pointer` command globally
- **Chat-Only Interface**: Natural language interaction through terminal chat
- **Tool Execution**: Support for file operations, search, shell commands, and more
- **Fine-Grained Code Editing**: Line-by-line editing with diff previews
- **Dual Modes**: Auto-Run and Dry-Run modes for safe experimentation
- **Output Control**: Configurable display of AI responses and tool outputs
- **Local-Only Setup**: Custom API base URL and model selection support

## Installation

```bash
pip install -e .
```

## Usage

```bash
pointer
```

On first run, the CLI will prompt for initialization and configuration.

## Configuration

The CLI supports custom API base URLs and model selection for local AI services.

## Development

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black pointer_cli/

# Lint code
flake8 pointer_cli/
```

## License

MIT License
