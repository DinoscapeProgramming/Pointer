"""
Advanced code editing system for Pointer CLI.
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Union
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text

from .utils import safe_read_file, safe_write_file, create_diff, is_text_file

class EditType(Enum):
    """Types of edits that can be performed."""
    REPLACE_LINE = "replace_line"
    INSERT_LINE = "insert_line"
    DELETE_LINE = "delete_line"
    REPLACE_TEXT = "replace_text"
    REPLACE_BLOCK = "replace_block"
    INSERT_BLOCK = "insert_block"
    DELETE_BLOCK = "delete_block"

@dataclass
class EditOperation:
    """Represents a single edit operation."""
    type: EditType
    line: Optional[int] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    text: str = ""
    old_text: str = ""
    new_text: str = ""
    pattern: Optional[str] = None
    replacement: Optional[str] = None

class CodeEditor:
    """Advanced code editor with fine-grained editing capabilities."""
    
    def __init__(self, console: Console):
        self.console = console
        self.history = []
        self.current_file = None
        self.current_content = None
    
    def load_file(self, file_path: Path) -> bool:
        """Load a file for editing."""
        if not file_path.exists():
            self.console.print(f"[red]File not found: {file_path}[/red]")
            return False
        
        if not is_text_file(file_path):
            self.console.print(f"[red]File is not a text file: {file_path}[/red]")
            return False
        
        content = safe_read_file(file_path)
        if content is None:
            self.console.print(f"[red]Could not read file: {file_path}[/red]")
            return False
        
        self.current_file = file_path
        self.current_content = content
        self.history = []
        
        return True
    
    def get_content(self) -> Optional[str]:
        """Get current content."""
        return self.current_content
    
    def get_line_count(self) -> int:
        """Get number of lines in current content."""
        if self.current_content is None:
            return 0
        return len(self.current_content.split('\n'))
    
    def get_line(self, line_num: int) -> Optional[str]:
        """Get a specific line (1-based indexing)."""
        if self.current_content is None:
            return None
        
        lines = self.current_content.split('\n')
        if 1 <= line_num <= len(lines):
            return lines[line_num - 1]
        return None
    
    def get_lines(self, start_line: int, end_line: int) -> List[str]:
        """Get a range of lines (1-based indexing)."""
        if self.current_content is None:
            return []
        
        lines = self.current_content.split('\n')
        start_idx = max(0, start_line - 1)
        end_idx = min(len(lines), end_line)
        
        return lines[start_idx:end_idx]
    
    def apply_edit(self, edit: EditOperation) -> bool:
        """Apply a single edit operation."""
        if self.current_content is None:
            return False
        
        try:
            new_content = self._apply_edit_to_content(self.current_content, edit)
            if new_content != self.current_content:
                # Save to history
                self.history.append({
                    "operation": edit,
                    "old_content": self.current_content,
                    "new_content": new_content
                })
                
                self.current_content = new_content
                return True
            
            return False
        except Exception as e:
            self.console.print(f"[red]Error applying edit: {e}[/red]")
            return False
    
    def apply_edits(self, edits: List[EditOperation]) -> bool:
        """Apply multiple edit operations."""
        if not edits:
            return True
        
        success = True
        for edit in edits:
            if not self.apply_edit(edit):
                success = False
        
        return success
    
    def _apply_edit_to_content(self, content: str, edit: EditOperation) -> str:
        """Apply edit to content string."""
        lines = content.split('\n')
        
        if edit.type == EditType.REPLACE_LINE:
            if edit.line and 1 <= edit.line <= len(lines):
                lines[edit.line - 1] = edit.text
            else:
                raise ValueError(f"Invalid line number: {edit.line}")
        
        elif edit.type == EditType.INSERT_LINE:
            if edit.line and 0 <= edit.line <= len(lines):
                lines.insert(edit.line, edit.text)
            else:
                raise ValueError(f"Invalid line number: {edit.line}")
        
        elif edit.type == EditType.DELETE_LINE:
            if edit.line and 1 <= edit.line <= len(lines):
                lines.pop(edit.line - 1)
            else:
                raise ValueError(f"Invalid line number: {edit.line}")
        
        elif edit.type == EditType.REPLACE_TEXT:
            if edit.old_text in content:
                return content.replace(edit.old_text, edit.new_text)
            else:
                raise ValueError(f"Text not found: {edit.old_text}")
        
        elif edit.type == EditType.REPLACE_BLOCK:
            if edit.start_line and edit.end_line and 1 <= edit.start_line <= edit.end_line <= len(lines):
                start_idx = edit.start_line - 1
                end_idx = edit.end_line
                lines[start_idx:end_idx] = edit.text.split('\n')
            else:
                raise ValueError(f"Invalid line range: {edit.start_line}-{edit.end_line}")
        
        elif edit.type == EditType.INSERT_BLOCK:
            if edit.line and 0 <= edit.line <= len(lines):
                new_lines = edit.text.split('\n')
                lines[edit.line:edit.line] = new_lines
            else:
                raise ValueError(f"Invalid line number: {edit.line}")
        
        elif edit.type == EditType.DELETE_BLOCK:
            if edit.start_line and edit.end_line and 1 <= edit.start_line <= edit.end_line <= len(lines):
                start_idx = edit.start_line - 1
                end_idx = edit.end_line
                del lines[start_idx:end_idx]
            else:
                raise ValueError(f"Invalid line range: {edit.start_line}-{edit.end_line}")
        
        return '\n'.join(lines)
    
    def save_file(self, file_path: Optional[Path] = None) -> bool:
        """Save current content to file."""
        if self.current_content is None:
            return False
        
        target_file = file_path or self.current_file
        if target_file is None:
            return False
        
        return safe_write_file(target_file, self.current_content)
    
    def show_diff(self, show_context: bool = True) -> None:
        """Show diff of current changes."""
        if not self.history:
            self.console.print("[yellow]No changes to show[/yellow]")
            return
        
        # Get original content
        original_content = self.history[0]["old_content"]
        current_content = self.current_content
        
        if original_content == current_content:
            self.console.print("[green]No changes detected[/green]")
            return
        
        # Create and display diff
        diff = create_diff(original_content, current_content)
        
        if diff:
            self.console.print(Panel(
                diff,
                title="Changes",
                border_style="blue"
            ))
        else:
            self.console.print("[green]No differences found[/green]")
    
    def show_syntax_highlighted(self, language: Optional[str] = None) -> None:
        """Show current content with syntax highlighting."""
        if self.current_content is None:
            self.console.print("[red]No content loaded[/red]")
            return
        
        # Auto-detect language if not provided
        if language is None and self.current_file:
            language = self._detect_language(self.current_file)
        
        try:
            syntax = Syntax(
                self.current_content,
                language or "text",
                theme="monokai",
                line_numbers=True
            )
            self.console.print(syntax)
        except Exception as e:
            self.console.print(f"[red]Error displaying syntax: {e}[/red]")
            self.console.print(self.current_content)
    
    def show_line_numbers(self, start_line: int = 1, end_line: Optional[int] = None) -> None:
        """Show content with line numbers."""
        if self.current_content is None:
            self.console.print("[red]No content loaded[/red]")
            return
        
        lines = self.current_content.split('\n')
        if end_line is None:
            end_line = len(lines)
        
        start_idx = max(0, start_line - 1)
        end_idx = min(len(lines), end_line)
        
        for i in range(start_idx, end_idx):
            line_num = i + 1
            line_content = lines[i]
            self.console.print(f"{line_num:4d}: {line_content}")
    
    def find_text(self, pattern: str, case_sensitive: bool = False) -> List[Tuple[int, str]]:
        """Find text pattern in content."""
        if self.current_content is None:
            return []
        
        flags = 0 if case_sensitive else re.IGNORECASE
        matches = []
        
        for i, line in enumerate(self.current_content.split('\n')):
            if re.search(pattern, line, flags):
                matches.append((i + 1, line))
        
        return matches
    
    def replace_text(self, pattern: str, replacement: str, case_sensitive: bool = False) -> int:
        """Replace text pattern in content."""
        if self.current_content is None:
            return 0
        
        flags = 0 if case_sensitive else re.IGNORECASE
        new_content, count = re.subn(pattern, replacement, self.current_content, flags=flags)
        
        if count > 0:
            self.current_content = new_content
            self.history.append({
                "operation": EditOperation(
                    type=EditType.REPLACE_TEXT,
                    old_text=pattern,
                    new_text=replacement
                ),
                "old_content": self.current_content,
                "new_content": new_content
            })
        
        return count
    
    def undo(self) -> bool:
        """Undo last edit operation."""
        if not self.history:
            return False
        
        last_edit = self.history.pop()
        self.current_content = last_edit["old_content"]
        return True
    
    def get_history(self) -> List[Dict[str, Any]]:
        """Get edit history."""
        return self.history.copy()
    
    def clear_history(self) -> None:
        """Clear edit history."""
        self.history = []
    
    def _detect_language(self, file_path: Path) -> str:
        """Detect programming language from file extension."""
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'jsx',
            '.tsx': 'tsx',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
            '.ini': 'ini',
            '.cfg': 'ini',
            '.conf': 'ini',
            '.txt': 'text',
            '.md': 'markdown',
            '.rst': 'rst',
            '.xml': 'xml',
            '.sql': 'sql',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'zsh',
            '.fish': 'fish',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.clj': 'clojure',
            '.hs': 'haskell',
            '.ml': 'ocaml',
            '.fs': 'fsharp',
            '.vim': 'vim',
            '.vimrc': 'vim',
        }
        
        return extension_map.get(file_path.suffix.lower(), 'text')
    
    def create_edit_from_natural_language(self, instruction: str) -> List[EditOperation]:
        """Create edit operations from natural language instruction."""
        # This is a simplified implementation
        # In a real system, this would use NLP to parse instructions
        
        edits = []
        
        # Simple pattern matching for common operations
        if "add" in instruction.lower() and "line" in instruction.lower():
            # Extract line number and text
            match = re.search(r'line\s+(\d+)', instruction)
            if match:
                line_num = int(match.group(1))
                # Extract text to add (simplified)
                text_match = re.search(r'add\s+"([^"]+)"', instruction)
                if text_match:
                    text = text_match.group(1)
                    edits.append(EditOperation(
                        type=EditType.INSERT_LINE,
                        line=line_num,
                        text=text
                    ))
        
        elif "replace" in instruction.lower() and "line" in instruction.lower():
            # Extract line number and new text
            match = re.search(r'line\s+(\d+)', instruction)
            if match:
                line_num = int(match.group(1))
                text_match = re.search(r'with\s+"([^"]+)"', instruction)
                if text_match:
                    text = text_match.group(1)
                    edits.append(EditOperation(
                        type=EditType.REPLACE_LINE,
                        line=line_num,
                        text=text
                    ))
        
        elif "delete" in instruction.lower() and "line" in instruction.lower():
            # Extract line number
            match = re.search(r'line\s+(\d+)', instruction)
            if match:
                line_num = int(match.group(1))
                edits.append(EditOperation(
                    type=EditType.DELETE_LINE,
                    line=line_num
                ))
        
        return edits
