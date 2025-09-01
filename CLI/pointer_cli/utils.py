"""
Utility functions for Pointer CLI.
"""

import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import yaml
import toml

def get_config_path() -> Path:
    """Get the configuration directory path."""
    return Path.home() / ".pointer-cli"

def ensure_config_dir() -> None:
    """Ensure the configuration directory exists."""
    config_dir = get_config_path()
    config_dir.mkdir(parents=True, exist_ok=True)

def get_project_root() -> Optional[Path]:
    """Get the project root directory (where .git is located)."""
    current = Path.cwd()
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return None

def is_git_repo() -> bool:
    """Check if current directory is a git repository."""
    return get_project_root() is not None

def get_file_extension(file_path: Path) -> str:
    """Get file extension from path."""
    return file_path.suffix.lower()

def is_text_file(file_path: Path) -> bool:
    """Check if file is likely a text file."""
    text_extensions = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.sass',
        '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.txt',
        '.md', '.rst', '.xml', '.sql', '.sh', '.bash', '.zsh', '.fish',
        '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php',
        '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml', '.fs',
        '.vim', '.vimrc', '.gitignore', '.dockerignore', '.env', '.env.example'
    }
    
    if file_path.suffix.lower() in text_extensions:
        return True
    
    # Check for files without extension that might be text
    if not file_path.suffix:
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(1024)
                return b'\0' not in chunk
        except:
            return False
    
    return False

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format."""
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"

def get_file_info(file_path: Path) -> Dict[str, Any]:
    """Get comprehensive file information."""
    try:
        stat = file_path.stat()
        return {
            "path": str(file_path),
            "name": file_path.name,
            "size": stat.st_size,
            "size_formatted": format_file_size(stat.st_size),
            "modified": stat.st_mtime,
            "is_file": file_path.is_file(),
            "is_dir": file_path.is_dir(),
            "is_text": is_text_file(file_path) if file_path.is_file() else False,
            "extension": get_file_extension(file_path),
        }
    except Exception as e:
        return {
            "path": str(file_path),
            "name": file_path.name,
            "error": str(e),
        }

def safe_read_file(file_path: Path, max_size: int = 10 * 1024 * 1024) -> Optional[str]:
    """Safely read a text file with size limit."""
    try:
        if not file_path.exists():
            return None
        
        if not file_path.is_file():
            return None
        
        if file_path.stat().st_size > max_size:
            return f"[File too large: {format_file_size(file_path.stat().st_size)}]"
        
        if not is_text_file(file_path):
            return "[Binary file]"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    except Exception as e:
        return f"[Error reading file: {e}]"

def safe_write_file(file_path: Path, content: str) -> bool:
    """Safely write content to a file."""
    try:
        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to temporary file first, then rename (atomic operation)
        temp_path = file_path.with_suffix(file_path.suffix + '.tmp')
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        temp_path.replace(file_path)
        return True
    
    except Exception as e:
        print(f"Error writing file {file_path}: {e}")
        return False

def parse_file_content(file_path: Path, content: str) -> Dict[str, Any]:
    """Parse file content based on file type."""
    extension = get_file_extension(file_path)
    
    try:
        if extension in ['.json']:
            return {"type": "json", "data": json.loads(content)}
        elif extension in ['.yaml', '.yml']:
            return {"type": "yaml", "data": yaml.safe_load(content)}
        elif extension in ['.toml']:
            return {"type": "toml", "data": toml.loads(content)}
        else:
            return {"type": "text", "data": content}
    except Exception as e:
        return {"type": "text", "data": content, "parse_error": str(e)}

def create_diff(old_content: str, new_content: str) -> str:
    """Create a simple diff between old and new content."""
    import difflib
    
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile="original",
        tofile="modified",
        lineterm=""
    )
    
    return ''.join(diff)

def truncate_output(text: str, max_lines: int = 100) -> str:
    """Truncate text output to maximum number of lines."""
    lines = text.split('\n')
    if len(lines) <= max_lines:
        return text
    
    truncated = lines[:max_lines]
    truncated.append(f"... ({len(lines) - max_lines} more lines)")
    return '\n'.join(truncated)

def get_relative_path(file_path: Path, base_path: Optional[Path] = None) -> str:
    """Get relative path from base path."""
    if base_path is None:
        base_path = Path.cwd()
    
    try:
        return str(file_path.relative_to(base_path))
    except ValueError:
        return str(file_path)

def find_files(
    pattern: str,
    directory: Path = None,
    recursive: bool = True,
    include_hidden: bool = False
) -> List[Path]:
    """Find files matching pattern."""
    if directory is None:
        directory = Path.cwd()
    
    if not recursive:
        return list(directory.glob(pattern))
    
    files = []
    for file_path in directory.rglob(pattern):
        if not include_hidden and file_path.name.startswith('.'):
            continue
        files.append(file_path)
    
    return files
