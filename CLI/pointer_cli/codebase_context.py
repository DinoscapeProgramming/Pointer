"""
Codebase context analysis for Pointer CLI.
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Set
import fnmatch
from dataclasses import dataclass

from .config import Config
from .utils import safe_read_file, get_file_info

@dataclass
class CodebaseFile:
    """Represents a file in the codebase context."""
    path: Path
    relative_path: str
    name: str
    extension: str
    size: int
    size_formatted: str
    modified: float
    is_text: bool
    content_preview: str
    lines: int

class CodebaseContext:
    """Manages codebase context for AI prompts."""
    
    def __init__(self, config: Config):
        self.config = config
        self.context_cache = {}
        self.last_refresh = 0
        self.project_root = None
        self._initialize_project_root()
    
    def _initialize_project_root(self) -> None:
        """Initialize the project root directory."""
        from .utils import get_project_root
        self.project_root = get_project_root()
    
    def should_refresh_context(self) -> bool:
        """Check if context should be refreshed."""
        if not self.config.codebase.include_context:
            return False
        
        if self.config.codebase.auto_refresh_context:
            return True
        
        current_time = time.time()
        return (current_time - self.last_refresh) > self.config.codebase.context_cache_duration
    
    def get_context_summary(self) -> Dict[str, Any]:
        """Get a summary of the codebase context."""
        if not self.config.codebase.include_context:
            return {}
        
        if self.should_refresh_context():
            self._refresh_context()
        
        return {
            "project_root": str(self.project_root) if self.project_root else None,
            "total_files": len(self.context_cache),
            "file_types": self._get_file_type_summary(),
            "structure": self._get_structure_summary(),
            "key_files": self._get_key_files(),
            "last_updated": self.last_refresh
        }
    
    def get_context_for_prompt(self) -> str:
        """Get formatted context string for AI prompts."""
        if not self.config.codebase.include_context:
            return ""
        
        if self.should_refresh_context():
            self._refresh_context()
        
        if not self.context_cache:
            return "No codebase context available."
        
        context_parts = [
            "Codebase Context:",
            f"Project Root: {self.project_root}",
            f"Total Files: {len(self.context_cache)}",
            "",
            "Project Structure:",
        ]
        
        # Add directory structure
        structure = self._get_structure_summary()
        for path, info in structure.items():
            context_parts.append(f"  {path}/ ({info['files']} files, {info['size_formatted']})")
        
        context_parts.append("")
        context_parts.append("Key Files:")
        
        # Add key files with previews
        key_files = self._get_key_files()
        for file_info in key_files[:self.config.codebase.max_context_files]:
            context_parts.append(f"  {file_info.relative_path}")
            if file_info.content_preview:
                preview_lines = file_info.content_preview.split('\n')[:5]
                preview_text = '\n'.join(f"    {line}" for line in preview_lines)
                if len(file_info.content_preview.split('\n')) > 5:
                    preview_text += "\n    ..."
                context_parts.append(preview_text)
            context_parts.append("")
        
        return "\n".join(context_parts)
    
    def _refresh_context(self) -> None:
        """Refresh the codebase context cache."""
        if not self.project_root:
            return
        
        self.context_cache.clear()
        self._scan_directory(self.project_root, depth=0)
        self.last_refresh = time.time()
    
    def _scan_directory(self, directory: Path, depth: int) -> None:
        """Recursively scan directory for relevant files."""
        if depth > self.config.codebase.context_depth:
            return
        
        try:
            for item in directory.iterdir():
                # Skip excluded patterns
                if self._should_exclude(item):
                    continue
                
                if item.is_file():
                    self._add_file_to_context(item)
                elif item.is_dir() and depth < self.config.codebase.context_depth:
                    self._scan_directory(item, depth + 1)
        except PermissionError:
            # Skip directories we can't access
            pass
    
    def _should_exclude(self, path: Path) -> bool:
        """Check if a path should be excluded from context."""
        path_str = str(path)
        
        for pattern in self.config.codebase.exclude_patterns:
            if fnmatch.fnmatch(path_str, pattern) or pattern in path_str:
                return True
        
        return False
    
    def _add_file_to_context(self, file_path: Path) -> None:
        """Add a file to the context cache."""
        try:
            # Check if file type is included
            if file_path.suffix.lower() not in self.config.codebase.context_file_types:
                return
            
            # Get file info
            file_info = get_file_info(file_path)
            if not file_info.get('is_text', False):
                return
            
            # Get relative path
            relative_path = file_path.relative_to(self.project_root) if self.project_root else str(file_path)
            
            # Read file content preview
            content = safe_read_file(file_path, max_size=1024 * 10)  # 10KB max
            content_preview = content[:500] if content else ""  # First 500 chars
            
            # Create codebase file object
            codebase_file = CodebaseFile(
                path=file_path,
                relative_path=str(relative_path),
                name=file_path.name,
                extension=file_path.suffix.lower(),
                size=file_info.get('size', 0),
                size_formatted=file_info.get('size_formatted', '0B'),
                modified=file_info.get('modified', 0),
                is_text=file_info.get('is_text', False),
                content_preview=content_preview,
                lines=len(content.split('\n')) if content else 0
            )
            
            self.context_cache[str(relative_path)] = codebase_file
            
        except Exception:
            # Skip files we can't process
            pass
    
    def _get_file_type_summary(self) -> Dict[str, int]:
        """Get summary of file types in the codebase."""
        type_counts = {}
        for file_info in self.context_cache.values():
            ext = file_info.extension
            type_counts[ext] = type_counts.get(ext, 0) + 1
        return type_counts
    
    def _get_structure_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of directory structure."""
        structure = {}
        
        for file_info in self.context_cache.values():
            path_parts = file_info.relative_path.split('/')
            if len(path_parts) > 1:
                dir_path = '/'.join(path_parts[:-1])
                if dir_path not in structure:
                    structure[dir_path] = {'files': 0, 'size': 0}
                structure[dir_path]['files'] += 1
                structure[dir_path]['size'] += file_info.size
        
        # Format sizes
        for dir_info in structure.values():
            dir_info['size_formatted'] = self._format_size(dir_info['size'])
        
        return structure
    
    def _get_key_files(self) -> List[CodebaseFile]:
        """Get key files for context (sorted by importance)."""
        files = list(self.context_cache.values())
        
        # Sort by importance (README, main files, larger files, etc.)
        def file_importance(file_info: CodebaseFile) -> int:
            importance = 0
            
            # README files are very important
            if 'readme' in file_info.name.lower():
                importance += 1000
            
            # Main entry points are important
            if file_info.name in ['main.py', 'app.py', 'index.js', 'package.json', 'requirements.txt']:
                importance += 500
            
            # Larger files might be more important
            importance += min(file_info.size // 100, 100)
            
            # More recent files might be more important
            importance += min(int(time.time() - file_info.modified) // 86400, 50)
            
            return importance
        
        files.sort(key=file_importance, reverse=True)
        return files
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format."""
        if size_bytes == 0:
            return "0B"
        
        size_names = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
        
        return f"{size_bytes:.1f}{size_names[i]}"
    
    def force_refresh(self) -> None:
        """Force a refresh of the context cache."""
        self._refresh_context()
    
    def get_file_context(self, file_path: str) -> Optional[CodebaseFile]:
        """Get context for a specific file."""
        if not self.config.codebase.include_context:
            return None
        
        if self.should_refresh_context():
            self._refresh_context()
        
        return self.context_cache.get(file_path)
    
    def search_context(self, query: str) -> List[CodebaseFile]:
        """Search context for files matching a query."""
        if not self.config.codebase.include_context:
            return []
        
        if self.should_refresh_context():
            self._refresh_context()
        
        results = []
        query_lower = query.lower()
        
        for file_info in self.context_cache.values():
            # Search in filename, path, and content
            if (query_lower in file_info.name.lower() or
                query_lower in file_info.relative_path.lower() or
                query_lower in file_info.content_preview.lower()):
                results.append(file_info)
        
        return results
