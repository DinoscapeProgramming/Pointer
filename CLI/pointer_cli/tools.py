"""
Tool execution system for Pointer CLI.
"""

import asyncio
import subprocess
import shutil
import os
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
import json
import re

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.syntax import Syntax

from .config import Config
from .utils import (
    safe_read_file, safe_write_file, create_diff, truncate_output,
    get_file_info, find_files, is_text_file, get_relative_path
)

class ToolManager:
    """Manages tool execution for Pointer CLI."""
    
    def __init__(self, config: Config, console: Console):
        self.config = config
        self.console = console
        self.tools = {
            "read_file": self._read_file,
            "write_file": self._write_file,
            "edit_file": self._edit_file,
            "search_files": self._search_files,
            "search_content": self._search_content,
            "run_command": self._run_command,
            "list_directory": self._list_directory,
            "get_file_info": self._get_file_info,
            "create_diff": self._create_diff,
            "delete_file": self._delete_file,
            "create_directory": self._create_directory,
            "move_file": self._move_file,
            "copy_file": self._copy_file,
        }
    
    async def execute_tool(self, tool_data: Dict[str, Any]) -> str:
        """Execute a tool with the given data."""
        tool_name = tool_data.get("name")
        args = tool_data.get("args", {})
        
        if tool_name not in self.tools:
            return f"Unknown tool: {tool_name}"
        
        try:
            # Run tool in executor to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self.tools[tool_name], 
                args
            )
            return result
        except Exception as e:
            return f"Error executing {tool_name}: {e}"
    
    def _read_file(self, args: Dict[str, Any]) -> str:
        """Read file contents."""
        # Clean the file path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        file_path = Path(raw_path)
        
        if not file_path.exists():
            return f"File not found: {file_path}"
        
        if not file_path.is_file():
            return f"Path is not a file: {file_path}"
        
        content = safe_read_file(file_path)
        if content is None:
            return f"Could not read file: {file_path}"
        
        # Show file info
        file_info = get_file_info(file_path)
        info_text = f"File: {file_path}\nSize: {file_info['size_formatted']}\n"
        
        # Truncate if too long
        if len(content.split('\n')) > self.config.ui.max_output_lines:
            content = truncate_output(content, self.config.ui.max_output_lines)
            info_text += f"Content truncated to {self.config.ui.max_output_lines} lines\n"
        
        return info_text + "\n" + content
    
    def _write_file(self, args: Dict[str, Any]) -> str:
        """Write content to file."""
        # Clean the file path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        file_path = Path(raw_path)
        content = args.get("content", "")
        
        if not file_path:
            return "Error: No file path provided"
        
        # Check if file exists
        if file_path.exists():
            old_content = safe_read_file(file_path)
            if old_content and self.config.ui.show_diffs:
                diff = create_diff(old_content, content)
                if diff:
                    return f"File exists. Diff:\n{diff}\n\nFile written successfully."
        
        success = safe_write_file(file_path, content)
        if success:
            return f"File written successfully: {file_path}"
        else:
            return f"Failed to write file: {file_path}"
    
    def _edit_file(self, args: Dict[str, Any]) -> str:
        """Edit file with specific changes."""
        # Clean the file path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        file_path = Path(raw_path)
        changes = args.get("changes", [])
        
        if not file_path:
            return "Error: No file path provided"
        
        if not changes:
            return "Error: No changes provided"
        
        # Read current content
        current_content = safe_read_file(file_path)
        if current_content is None:
            return f"Could not read file: {file_path}"
        
        # Apply changes
        new_content = self._apply_changes(current_content, changes)
        
        # Show diff
        if self.config.ui.show_diffs:
            diff = create_diff(current_content, new_content)
            if diff:
                return f"Changes to {file_path}:\n{diff}\n\nFile updated successfully."
        
        # Write new content
        success = safe_write_file(file_path, new_content)
        if success:
            return f"File updated successfully: {file_path}"
        else:
            return f"Failed to update file: {file_path}"
    
    def _apply_changes(self, content: str, changes: List[Dict[str, Any]]) -> str:
        """Apply changes to content."""
        lines = content.split('\n')
        
        for change in changes:
            change_type = change.get("type", "")
            
            if change_type == "replace_line":
                line_num = change.get("line", 1) - 1  # Convert to 0-based
                new_text = change.get("text", "")
                if 0 <= line_num < len(lines):
                    lines[line_num] = new_text
            
            elif change_type == "insert_line":
                line_num = change.get("line", 1) - 1
                new_text = change.get("text", "")
                if 0 <= line_num <= len(lines):
                    lines.insert(line_num, new_text)
            
            elif change_type == "delete_line":
                line_num = change.get("line", 1) - 1
                if 0 <= line_num < len(lines):
                    lines.pop(line_num)
            
            elif change_type == "replace_text":
                old_text = change.get("old_text", "")
                new_text = change.get("new_text", "")
                content = content.replace(old_text, new_text)
                lines = content.split('\n')
        
        return '\n'.join(lines)
    
    def _search_files(self, args: Dict[str, Any]) -> str:
        """Search for files by pattern."""
        pattern = args.get("pattern", "*")
        directory = args.get("directory", ".")
        recursive = args.get("recursive", True)
        include_hidden = args.get("include_hidden", False)
        
        search_dir = Path(directory)
        if not search_dir.exists():
            return f"Directory not found: {search_dir}"
        
        files = find_files(pattern, search_dir, recursive, include_hidden)
        
        if not files:
            return f"No files found matching pattern: {pattern}"
        
        result = f"Found {len(files)} files matching '{pattern}':\n\n"
        for file_path in files:
            relative_path = get_relative_path(file_path, search_dir)
            result += f"  {relative_path}\n"
        
        return result
    
    def _search_content(self, args: Dict[str, Any]) -> str:
        """Search for content in files."""
        query = args.get("query", "")
        pattern = args.get("pattern", "*")
        directory = args.get("directory", ".")
        case_sensitive = args.get("case_sensitive", False)
        use_regex = args.get("use_regex", False)
        
        if not query:
            return "Error: No search query provided"
        
        search_dir = Path(directory)
        if not search_dir.exists():
            return f"Directory not found: {search_dir}"
        
        # Find files to search
        files = find_files(pattern, search_dir, True, False)
        text_files = [f for f in files if is_text_file(f)]
        
        matches = []
        
        # Check if query looks like a regex pattern (contains |, *, +, ?, etc.)
        if not use_regex and any(char in query for char in ['|', '*', '+', '?', '(', ')', '[', ']', '{', '}']):
            use_regex = True
            
        # For simple OR patterns like "f1shy312|Das_f1shy312", treat as multiple string searches
        # This gives the same behavior as searching for each term individually
        if use_regex and '|' in query and not any(char in query for char in ['*', '+', '?', '(', ')', '[', ']', '{', '}']):
            # Split the OR pattern and do multiple string searches
            search_terms = [term.strip() for term in query.split('|')]
            use_regex = False  # Switch to string search mode
        else:
            search_terms = [query]
        
        try:
            if use_regex:
                import re
                # Compile regex pattern
                flags = 0 if case_sensitive else re.IGNORECASE
                regex_pattern = re.compile(query, flags)
                
                for file_path in text_files:
                    content = safe_read_file(file_path)
                    if content is None:
                        continue
                    
                    # Find line numbers
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if regex_pattern.search(line):
                            matches.append({
                                "file": file_path,
                                "line": i + 1,
                                "content": line.strip()
                            })
            else:
                # Multiple string searches (for OR patterns) or single string search
                for search_term in search_terms:
                    search_query = search_term if case_sensitive else search_term.lower()
                    
                    for file_path in text_files:
                        content = safe_read_file(file_path)
                        if content is None:
                            continue
                        
                        file_content = content if case_sensitive else content.lower()
                        if search_query in file_content:
                            # Find line numbers
                            lines = content.split('\n')
                            for i, line in enumerate(lines):
                                line_content = line if case_sensitive else line.lower()
                                if search_query in line_content:
                                    # Check if we already have this match (avoid duplicates)
                                    existing_match = any(
                                        match["file"] == file_path and match["line"] == i + 1
                                        for match in matches
                                    )
                                    if not existing_match:
                                        matches.append({
                                            "file": file_path,
                                            "line": i + 1,
                                            "content": line.strip()
                                        })
        
        except re.error as e:
            return f"Error: Invalid regex pattern '{query}': {e}"
        
        if not matches:
            return f"No matches found for: {query}"
        
        result = f"Found {len(matches)} matches for '{query}':\n\n"
        for match in matches:
            relative_path = get_relative_path(match["file"], search_dir)
            result += f"  {relative_path}:{match['line']}: {match['content']}\n"
        
        return result
    
    def _run_command(self, args: Dict[str, Any]) -> str:
        """Execute shell command."""
        command = args.get("command", "")
        directory = args.get("directory", ".")
        
        if not command:
            return "Error: No command provided"
        
        try:
            # Change to specified directory
            original_dir = Path.cwd()
            target_dir = Path(directory)
            
            if target_dir.exists() and target_dir.is_dir():
                os.chdir(target_dir)
            
            # Execute command
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Restore original directory
            os.chdir(original_dir)
            
            output = ""
            if result.stdout:
                output += f"STDOUT:\n{result.stdout}\n"
            if result.stderr:
                output += f"STDERR:\n{result.stderr}\n"
            if result.returncode != 0:
                output += f"Exit code: {result.returncode}\n"
            
            return output or "Command executed successfully (no output)"
            
        except subprocess.TimeoutExpired:
            return "Command timed out after 30 seconds"
        except Exception as e:
            return f"Error executing command: {e}"
    
    def _list_directory(self, args: Dict[str, Any]) -> str:
        """List directory contents."""
        # Support both 'directory' and 'path' for backward compatibility
        directory = args.get("directory", args.get("path", "."))
        show_hidden = args.get("show_hidden", False)
        
        dir_path = Path(directory)
        if not dir_path.exists():
            return f"Directory not found: {dir_path}"
        
        if not dir_path.is_dir():
            return f"Path is not a directory: {dir_path}"
        
        items = []
        for item in dir_path.iterdir():
            if not show_hidden and item.name.startswith('.'):
                continue
            
            file_info = get_file_info(item)
            items.append(file_info)
        
        # Sort: directories first, then files, both alphabetically
        items.sort(key=lambda x: (not x.get("is_dir", False), x.get("name", "")))
        
        result = f"Contents of {dir_path}:\n\n"
        for item in items:
            item_type = "DIR" if item.get("is_dir") else "FILE"
            size = item.get("size_formatted", "")
            name = item.get("name", "")
            result += f"  {item_type:4} {size:>8} {name}\n"
        
        return result
    
    def _get_file_info(self, args: Dict[str, Any]) -> str:
        """Get detailed file information."""
        # Clean the file path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        file_path = Path(raw_path)
        
        if not file_path.exists():
            return f"File not found: {file_path}"
        
        info = get_file_info(file_path)
        
        result = f"File Information:\n\n"
        for key, value in info.items():
            if key != "path":  # Skip path as it's redundant
                result += f"  {key}: {value}\n"
        
        return result
    
    def _create_diff(self, args: Dict[str, Any]) -> str:
        """Create diff between two versions."""
        old_content = args.get("old_content", "")
        new_content = args.get("new_content", "")
        
        if not old_content and not new_content:
            return "Error: No content provided for diff"
        
        diff = create_diff(old_content, new_content)
        return diff or "No differences found"
    
    def _delete_file(self, args: Dict[str, Any]) -> str:
        """Delete a file or directory."""
        # Clean the file path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        file_path = Path(raw_path)
        
        if not file_path.exists():
            return f"File not found: {file_path}"
        
        try:
            if file_path.is_file():
                file_path.unlink()
                return f"File deleted: {file_path}"
            elif file_path.is_dir():
                shutil.rmtree(file_path)
                return f"Directory deleted: {file_path}"
            else:
                return f"Unknown file type: {file_path}"
        except Exception as e:
            return f"Error deleting {file_path}: {e}"
    
    def _create_directory(self, args: Dict[str, Any]) -> str:
        """Create a directory."""
        # Clean the directory path by stripping quotes and whitespace
        # Support both 'path' and 'file_path' for backward compatibility
        raw_path = args.get("path", args.get("file_path", ""))
        if isinstance(raw_path, str):
            raw_path = raw_path.strip().strip('"').strip("'")
        
        dir_path = Path(raw_path)
        
        if not dir_path:
            return "Error: No directory path provided"
        
        try:
            dir_path.mkdir(parents=True, exist_ok=True)
            return f"Directory created: {dir_path}"
        except Exception as e:
            return f"Error creating directory {dir_path}: {e}"
    
    def _move_file(self, args: Dict[str, Any]) -> str:
        """Move or rename a file."""
        # Clean the paths by stripping quotes and whitespace
        raw_source = args.get("source", "")
        raw_destination = args.get("destination", "")
        
        if isinstance(raw_source, str):
            raw_source = raw_source.strip().strip('"').strip("'")
        if isinstance(raw_destination, str):
            raw_destination = raw_destination.strip().strip('"').strip("'")
        
        source = Path(raw_source)
        destination = Path(raw_destination)
        
        if not source or not destination:
            return "Error: Both source and destination paths required"
        
        if not source.exists():
            return f"Source file not found: {source}"
        
        try:
            shutil.move(str(source), str(destination))
            return f"Moved {source} to {destination}"
        except Exception as e:
            return f"Error moving file: {e}"
    
    def _copy_file(self, args: Dict[str, Any]) -> str:
        """Copy a file."""
        # Clean the paths by stripping quotes and whitespace
        raw_source = args.get("source", "")
        raw_destination = args.get("destination", "")
        
        if isinstance(raw_source, str):
            raw_source = raw_source.strip().strip('"').strip("'")
        if isinstance(raw_destination, str):
            raw_destination = raw_destination.strip().strip('"').strip("'")
        
        source = Path(raw_source)
        destination = Path(raw_destination)
        
        if not source or not destination:
            return "Error: Both source and destination paths required"
        
        if not source.exists():
            return f"Source file not found: {source}"
        
        try:
            if source.is_file():
                shutil.copy2(str(source), str(destination))
            elif source.is_dir():
                shutil.copytree(str(source), str(destination))
            else:
                return f"Unknown file type: {source}"
            
            return f"Copied {source} to {destination}"
        except Exception as e:
            return f"Error copying file: {e}"
