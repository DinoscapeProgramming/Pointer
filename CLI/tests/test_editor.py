"""
Tests for code editor functionality.
"""

import tempfile
from pathlib import Path
import pytest

from pointer_cli.editor import CodeEditor, EditOperation, EditType
from rich.console import Console

class TestCodeEditor:
    """Test code editor functionality."""
    
    @pytest.fixture
    def editor(self):
        """Create a code editor for testing."""
        console = Console()
        return CodeEditor(console)
    
    @pytest.fixture
    def temp_file(self):
        """Create a temporary file for testing."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("Line 1\nLine 2\nLine 3\nLine 4")
            temp_path = Path(f.name)
        
        yield temp_path
        
        # Clean up after test
        try:
            temp_path.unlink()
        except:
            pass
    
    def test_load_file(self, editor, temp_file):
        """Test loading a file."""
        success = editor.load_file(temp_file)
        assert success is True
        assert editor.current_file == temp_file
        assert editor.current_content == "Line 1\nLine 2\nLine 3\nLine 4"
    
    def test_get_line(self, editor, temp_file):
        """Test getting a specific line."""
        editor.load_file(temp_file)
        
        assert editor.get_line(1) == "Line 1"
        assert editor.get_line(2) == "Line 2"
        assert editor.get_line(10) is None  # Out of bounds
    
    def test_get_lines(self, editor, temp_file):
        """Test getting a range of lines."""
        editor.load_file(temp_file)
        
        lines = editor.get_lines(2, 3)
        assert lines == ["Line 2", "Line 3"]
        
        lines = editor.get_lines(1, 2)
        assert lines == ["Line 1", "Line 2"]
    
    def test_replace_line_edit(self, editor, temp_file):
        """Test replace line edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.REPLACE_LINE,
            line=2,
            text="Modified Line 2"
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "Modified Line 2"
        assert len(editor.history) == 1
    
    def test_insert_line_edit(self, editor, temp_file):
        """Test insert line edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.INSERT_LINE,
            line=2,
            text="New Line"
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "New Line"
        assert editor.get_line(3) == "Line 2"
        assert editor.get_line_count() == 5
    
    def test_delete_line_edit(self, editor, temp_file):
        """Test delete line edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.DELETE_LINE,
            line=2
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "Line 3"
        assert editor.get_line_count() == 3
    
    def test_replace_text_edit(self, editor, temp_file):
        """Test replace text edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.REPLACE_TEXT,
            old_text="Line 2",
            new_text="Modified Line 2"
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert "Modified Line 2" in editor.current_content
        assert "Line 2" not in editor.current_content
    
    def test_replace_block_edit(self, editor, temp_file):
        """Test replace block edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.REPLACE_BLOCK,
            start_line=2,
            end_line=3,
            text="New Line 2\nNew Line 3"
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "New Line 2"
        assert editor.get_line(3) == "New Line 3"
        assert editor.get_line_count() == 4
    
    def test_insert_block_edit(self, editor, temp_file):
        """Test insert block edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.INSERT_BLOCK,
            line=2,
            text="New Line A\nNew Line B"
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "New Line A"
        assert editor.get_line(3) == "New Line B"
        assert editor.get_line(4) == "Line 2"
        assert editor.get_line_count() == 6
    
    def test_delete_block_edit(self, editor, temp_file):
        """Test delete block edit operation."""
        editor.load_file(temp_file)
        
        edit = EditOperation(
            type=EditType.DELETE_BLOCK,
            start_line=2,
            end_line=3
        )
        
        success = editor.apply_edit(edit)
        assert success is True
        
        assert editor.get_line(2) == "Line 4"
        assert editor.get_line_count() == 2
    
    def test_undo_operation(self, editor, temp_file):
        """Test undo operation."""
        editor.load_file(temp_file)
        original_content = editor.current_content
        
        # Make an edit
        edit = EditOperation(
            type=EditType.REPLACE_LINE,
            line=2,
            text="Modified Line 2"
        )
        editor.apply_edit(edit)
        
        # Undo the edit
        success = editor.undo()
        assert success is True
        assert editor.current_content == original_content
    
    def test_find_text(self, editor, temp_file):
        """Test text finding functionality."""
        editor.load_file(temp_file)
        
        matches = editor.find_text("Line")
        assert len(matches) == 4
        
        matches = editor.find_text("Line 2")
        assert len(matches) == 1
        assert matches[0][0] == 2  # Line number
    
    def test_replace_text(self, editor, temp_file):
        """Test text replacement functionality."""
        editor.load_file(temp_file)
        
        count = editor.replace_text("Line", "Modified")
        assert count == 4
        
        content = editor.current_content
        assert "Modified 1" in content
        assert "Modified 2" in content
        assert "Line" not in content
    
    def test_save_file(self, editor, temp_file):
        """Test file saving functionality."""
        editor.load_file(temp_file)
        
        # Make an edit
        edit = EditOperation(
            type=EditType.REPLACE_LINE,
            line=1,
            text="Modified Line 1"
        )
        editor.apply_edit(edit)
        
        # Save the file
        success = editor.save_file()
        assert success is True
        
        # Verify the file was saved
        saved_content = temp_file.read_text()
        assert "Modified Line 1" in saved_content
    
    def test_detect_language(self, editor):
        """Test language detection."""
        assert editor._detect_language(Path("test.py")) == "python"
        assert editor._detect_language(Path("test.js")) == "javascript"
        assert editor._detect_language(Path("test.txt")) == "text"
        assert editor._detect_language(Path("test.unknown")) == "text"
