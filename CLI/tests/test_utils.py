"""
Tests for utility functions.
"""

import tempfile
from pathlib import Path
import pytest

from pointer_cli.utils import (
    safe_read_file, safe_write_file, create_diff, format_file_size,
    is_text_file, get_file_info, find_files, truncate_output
)

class TestUtils:
    """Test utility functions."""
    
    def test_safe_read_write_file(self):
        """Test safe file read/write operations."""
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.txt"
            test_content = "Hello, World!\nThis is a test file."
            
            # Test write
            success = safe_write_file(test_file, test_content)
            assert success is True
            assert test_file.exists()
            
            # Test read
            content = safe_read_file(test_file)
            assert content == test_content
    
    def test_safe_read_nonexistent_file(self):
        """Test reading non-existent file."""
        non_existent = Path("/nonexistent/file.txt")
        content = safe_read_file(non_existent)
        assert content is None
    
    def test_create_diff(self):
        """Test diff creation."""
        old_content = "Line 1\nLine 2\nLine 3"
        new_content = "Line 1\nModified Line 2\nLine 3\nLine 4"
        
        diff = create_diff(old_content, new_content)
        assert "Modified Line 2" in diff
        assert "Line 4" in diff
    
    def test_format_file_size(self):
        """Test file size formatting."""
        assert format_file_size(0) == "0B"
        assert format_file_size(1024) == "1.0KB"
        assert format_file_size(1024 * 1024) == "1.0MB"
        assert format_file_size(1024 * 1024 * 1024) == "1.0GB"
    
    def test_is_text_file(self):
        """Test text file detection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Test text file
            text_file = Path(temp_dir) / "test.py"
            text_file.write_text("print('hello')")
            assert is_text_file(text_file) is True
            
            # Test binary file
            binary_file = Path(temp_dir) / "test.bin"
            binary_file.write_bytes(b'\x00\x01\x02\x03')
            assert is_text_file(binary_file) is False
    
    def test_get_file_info(self):
        """Test file information retrieval."""
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.txt"
            test_file.write_text("test content")
            
            info = get_file_info(test_file)
            assert info["name"] == "test.txt"
            assert info["is_file"] is True
            assert info["is_dir"] is False
            assert info["size"] > 0
    
    def test_find_files(self):
        """Test file finding functionality."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create test files
            (temp_path / "test1.py").write_text("")
            (temp_path / "test2.js").write_text("")
            (temp_path / "readme.txt").write_text("")
            
            # Test finding Python files
            py_files = find_files("*.py", temp_path)
            assert len(py_files) == 1
            assert py_files[0].name == "test1.py"
            
            # Test finding all files
            all_files = find_files("*", temp_path)
            assert len(all_files) == 3
    
    def test_truncate_output(self):
        """Test output truncation."""
        long_text = "\n".join([f"Line {i}" for i in range(150)])
        truncated = truncate_output(long_text, 100)
        
        lines = truncated.split('\n')
        assert len(lines) == 101  # 100 lines + truncation message
        assert "... (50 more lines)" in truncated
