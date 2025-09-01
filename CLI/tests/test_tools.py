"""
Tests for tool execution system.
"""

import tempfile
from pathlib import Path
import pytest

from pointer_cli.tools import ToolManager
from pointer_cli.config import Config
from rich.console import Console

class TestToolManager:
    """Test tool manager functionality."""
    
    @pytest.fixture
    def tool_manager(self):
        """Create a tool manager for testing."""
        config = Config()
        console = Console()
        return ToolManager(config, console)
    
    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    def test_read_file_tool(self, tool_manager, temp_dir):
        """Test read file tool."""
        test_file = temp_dir / "test.txt"
        test_content = "Hello, World!"
        test_file.write_text(test_content)
        
        result = tool_manager._read_file({"path": str(test_file)})
        assert test_content in result
        assert "File:" in result
    
    def test_write_file_tool(self, tool_manager, temp_dir):
        """Test write file tool."""
        test_file = temp_dir / "test.txt"
        test_content = "Hello, World!"
        
        result = tool_manager._write_file({
            "path": str(test_file),
            "content": test_content
        })
        
        assert "File written successfully" in result
        assert test_file.exists()
        assert test_file.read_text() == test_content
    
    def test_edit_file_tool(self, tool_manager, temp_dir):
        """Test edit file tool."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("Line 1\nLine 2\nLine 3")
        
        changes = [
            {
                "type": "replace_line",
                "line": 2,
                "text": "Modified Line 2"
            }
        ]
        
        result = tool_manager._edit_file({
            "path": str(test_file),
            "changes": changes
        })
        
        assert "File updated successfully" in result
        content = test_file.read_text()
        assert "Modified Line 2" in content
    
    def test_search_files_tool(self, tool_manager, temp_dir):
        """Test search files tool."""
        # Create test files
        (temp_dir / "test1.py").write_text("")
        (temp_dir / "test2.js").write_text("")
        (temp_dir / "readme.txt").write_text("")
        
        result = tool_manager._search_files({
            "pattern": "*.py",
            "directory": str(temp_dir)
        })
        
        assert "Found 1 files" in result
        assert "test1.py" in result
    
    def test_search_content_tool(self, tool_manager, temp_dir):
        """Test search content tool."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("Hello, World!\nThis is a test.\nHello again!")
        
        result = tool_manager._search_content({
            "query": "Hello",
            "directory": str(temp_dir)
        })
        
        assert "Found 2 matches" in result
        assert "Hello, World!" in result
        assert "Hello again!" in result
    
    def test_list_directory_tool(self, tool_manager, temp_dir):
        """Test list directory tool."""
        # Create test files and directories
        (temp_dir / "file1.txt").write_text("")
        (temp_dir / "file2.txt").write_text("")
        (temp_dir / "subdir").mkdir()
        
        result = tool_manager._list_directory({
            "directory": str(temp_dir)
        })
        
        assert "Contents of" in result
        assert "file1.txt" in result
        assert "file2.txt" in result
        assert "subdir" in result
    
    def test_get_file_info_tool(self, tool_manager, temp_dir):
        """Test get file info tool."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("test content")
        
        result = tool_manager._get_file_info({
            "path": str(test_file)
        })
        
        assert "File Information:" in result
        assert "test.txt" in result
        assert "is_file: True" in result
    
    def test_create_diff_tool(self, tool_manager):
        """Test create diff tool."""
        old_content = "Line 1\nLine 2"
        new_content = "Line 1\nModified Line 2\nLine 3"
        
        result = tool_manager._create_diff({
            "old_content": old_content,
            "new_content": new_content
        })
        
        assert "Modified Line 2" in result
        assert "Line 3" in result
    
    def test_delete_file_tool(self, tool_manager, temp_dir):
        """Test delete file tool."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("test content")
        assert test_file.exists()
        
        result = tool_manager._delete_file({
            "path": str(test_file)
        })
        
        assert "File deleted" in result
        assert not test_file.exists()
    
    def test_create_directory_tool(self, tool_manager, temp_dir):
        """Test create directory tool."""
        new_dir = temp_dir / "new_directory"
        
        result = tool_manager._create_directory({
            "path": str(new_dir)
        })
        
        assert "Directory created" in result
        assert new_dir.exists()
        assert new_dir.is_dir()
    
    def test_move_file_tool(self, tool_manager, temp_dir):
        """Test move file tool."""
        source = temp_dir / "source.txt"
        destination = temp_dir / "destination.txt"
        source.write_text("test content")
        
        result = tool_manager._move_file({
            "source": str(source),
            "destination": str(destination)
        })
        
        assert "Moved" in result
        assert not source.exists()
        assert destination.exists()
        assert destination.read_text() == "test content"
    
    def test_copy_file_tool(self, tool_manager, temp_dir):
        """Test copy file tool."""
        source = temp_dir / "source.txt"
        destination = temp_dir / "destination.txt"
        source.write_text("test content")
        
        result = tool_manager._copy_file({
            "source": str(source),
            "destination": str(destination)
        })
        
        assert "Copied" in result
        assert source.exists()
        assert destination.exists()
        assert destination.read_text() == "test content"
