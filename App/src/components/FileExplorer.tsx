import React, { useState, useCallback, useEffect } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';
import { ExplorerService } from '../services/ExplorerService';
import { getIconForFile, FolderIcon, ChevronIcon } from './FileIcons';
import { isDatabaseFile } from './FileViewer';

declare global {
  interface Window {
    applyCustomTheme?: () => void;
    loadSettings?: () => Promise<void>;
    appSettings?: {
      theme?: {
        customColors?: {
          customFileExtensions?: Record<string, string>;
        };
      };
    };
  }
}

interface FileExplorerProps {
  items: Record<string, FileSystemItem>;
  rootId: string;
  currentFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onFolderContentsLoaded: (newItems: Record<string, FileSystemItem>) => void;
  onDeleteItem: (item: FileSystemItem) => void;
  onRenameItem: (item: FileSystemItem, newName: string) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetItem: FileSystemItem | null;
}

const activeFileStyle = {
  backgroundColor: 'var(--bg-selected)',
  borderLeft: '2px solid var(--accent-color)',
  fontWeight: 500,
};

const hoverFileStyle = {
  backgroundColor: 'var(--bg-hover)',
  borderLeft: '2px solid var(--border-color)',
};

const FileExplorerItem: React.FC<{
  item: FileSystemItem;
  items: { [key: string]: FileSystemItem };
  level: number;
  currentFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onDeleteItem: (item: FileSystemItem) => void;
}> = ({ item, items, level, currentFileId, onFileSelect, onCreateFile, onCreateFolder, onDeleteItem }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetItem: null,
  });
  const childIds = Object.values(items).filter(i => i.parentId === item.id).map(i => i.id);

  const handleFolderClick = async () => {
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      await loadFolderContents(item.path);
    }
  };

  const handleFolderHover = useCallback(async () => {
    setIsHovered(true);
    // Disable automatic loading on hover to prevent the editor reload issue
    // We'll only load folders when they're explicitly clicked
    /*
    if (item.type === 'directory' && !isExpanded && !FileSystemService.isFolderLoaded(item.path)) {
      await loadFolderContents(item.path);
    }
    */
  }, [item.type, isExpanded]);

  const loadFolderContents = async (path: string) => {
    if (FileSystemService.isFolderLoaded(path)) return;

    setIsLoading(true);
    const result = await FileSystemService.fetchFolderContents(path);
    setIsLoading(false);

    if (result) {
      const newItems = { ...items };
      Object.entries(result.items).forEach(([id, item]) => {
        if (id !== result.rootId) {
          newItems[id] = item;
        }
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetItem: item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      targetItem: null,
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      handleCloseContextMenu();
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  return (
    <div style={{ marginLeft: level === 0 ? 0 : '8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '22px',
          cursor: 'pointer',
          backgroundColor: item.id === currentFileId ? 'var(--bg-selected)' : 
                         isHovered ? 'var(--bg-hover)' : 'transparent',
          color: 'var(--text-primary)',
          fontSize: '13px',
          paddingRight: '8px',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        onClick={() => {
          if (item.type === 'file') {
            onFileSelect(item.id);
            // Ensure theme is applied after file selection
            setTimeout(() => window.applyCustomTheme?.(), 100);
          } else {
            handleFolderClick();
          }
        }}
        onMouseEnter={handleFolderHover}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div style={{ 
          width: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginLeft: level === 0 ? '12px' : '4px',
          flexShrink: 0,
        }}>
          {item.type === 'directory' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleFolderClick();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              <ChevronIcon isExpanded={isExpanded} />
            </span>
          )}
        </div>
        <div style={{
          marginLeft: '4px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          color: item.id === currentFileId ? 'var(--accent-color)' : isHovered ? 'var(--border-color)' : 'var(--text-primary)',
        }}>
          {item.type === 'directory' ? (
            <FolderIcon isOpen={isExpanded} />
          ) : (
            getIconForFile(item.name)
          )}
        </div>
        <span style={{
          marginLeft: '4px',
          color: item.type === 'directory' ? '#C8C8C8' : '#CCCCCC',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: 1,
        }}>
          {item.name}
        </span>
        {isHovered && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '2px',
            flexShrink: 0,
          }}>
            {item.type === 'directory' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFile(item.id);
                  }}
                  style={buttonStyle}
                  title="New File"
                >
                  +
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(item.id);
                  }}
                  style={buttonStyle}
                  title="New Folder"
                >
                  📁
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                  onDeleteItem(item);
                }
              }}
              style={buttonStyle}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
        {isLoading && <span style={{ marginLeft: '4px', opacity: 0.5 }}>...</span>}
      </div>
      {item.type === 'directory' && isExpanded && childIds.map((childId) => (
        <FileExplorerItem
          key={childId}
          item={items[childId]}
          items={items}
          level={level + 1}
          currentFileId={currentFileId}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteItem={onDeleteItem}
        />
      ))}

      {contextMenu.isOpen && contextMenu.targetItem?.id === item.id && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: '160px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        >
          {item.type === 'directory' && (
            <>
              <div
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFile(item.id);
                  handleCloseContextMenu();
                }}
                style={contextMenuItemStyle}
              >
                New File
              </div>
              <div
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder(item.id);
                  handleCloseContextMenu();
                }}
                style={contextMenuItemStyle}
              >
                New Folder
              </div>
              <div style={contextMenuSeparatorStyle} />
            </>
          )}
          <div
            className="context-menu-item"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                // Get the current directory from FileSystemService
                const currentDir = FileSystemService.getCurrentDirectory();
                
                const result = await ExplorerService.openInExplorer(item.path, currentDir || undefined);
                if (!result.success) {
                  console.error('Failed to open in explorer:', result.error);
                }
              } catch (error) {
                console.error('Error opening in explorer:', error);
              }
              handleCloseContextMenu();
            }}
            style={contextMenuItemStyle}
          >
            Open in Explorer
          </div>
          <div style={contextMenuSeparatorStyle} />
          <div
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                onDeleteItem(item);
              }
              handleCloseContextMenu();
            }}
            style={{
              ...contextMenuItemStyle,
              color: 'var(--error-color)',
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
};

const buttonStyle = {
  padding: '0 4px',
  height: '16px',
  fontSize: '12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.8,
  ':hover': {
    opacity: 1,
    background: 'var(--bg-hover)',
  }
};

const contextMenuItemStyle = {
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--text-primary)',
  ':hover': {
    backgroundColor: 'var(--bg-hover)',
  },
};

const contextMenuSeparatorStyle = {
  height: '1px',
  backgroundColor: 'var(--border-color)',
  margin: '4px 0',
};

const getAllChildIds = (items: Record<string, FileSystemItem>, parentId: string): string[] => {
  const children: string[] = [];
  Object.entries(items).forEach(([id, item]) => {
    if (item.parentId === parentId) {
      children.push(id);
      if (item.type === 'directory') {
        children.push(...getAllChildIds(items, id));
      }
    }
  });
  return children;
};

const handleDelete = (item: FileSystemItem, onDeleteItem: (item: FileSystemItem) => void, items: Record<string, FileSystemItem>) => {
  onDeleteItem(item);

  if (item.type === 'directory') {
    const childIds = getAllChildIds(items, item.id);
    childIds.forEach(childId => {
      if (items[childId]) {
        onDeleteItem(items[childId]);
      }
    });
  }
};

const getFileColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const customExtensions = window.appSettings?.theme?.customColors?.customFileExtensions || {};
  
  if (ext && customExtensions[ext]) {
    return customExtensions[ext];
  }
  
  return 'var(--explorer-file-fg, #CCCCCC)';
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  items,
  rootId,
  currentFileId,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onFolderContentsLoaded,
  onDeleteItem,
  onRenameItem,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [themeVersion, setThemeVersion] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    itemId: string | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    itemId: null,
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeVersion(prev => prev + 1);
    };

    window.addEventListener('theme-changed', handleThemeChange);

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const handleFolderClick = async (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      const folder = items[folderId];
      if (folder) {
        await loadFolderContents(folder.path, folderId);
      }
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderHover = useCallback(async (folderId: string | null) => {
    setHoveredFolder(folderId);
    // Disable automatic loading on hover to prevent the editor reload issue
    // We'll only load folders when they're explicitly clicked
    /*
    if (folderId && !expandedFolders.has(folderId)) {
      const folder = items[folderId];
      if (folder && folder.type === 'directory' && !FileSystemService.isFolderLoaded(folder.path)) {
        console.log('Pre-loading folder:', {
          id: folderId,
          path: folder.path,
          name: folder.name
        });
        await loadFolderContents(folder.path, folderId);
      }
    }
    */
  }, [items, expandedFolders]);

  const loadFolderContents = async (path: string, folderId: string) => {
    if (FileSystemService.isFolderLoaded(path)) {
      console.log('Folder already loaded:', path);
      return;
    }

    console.log('Loading folder contents:', {
      path,
      folderId,
      folderName: items[folderId]?.name
    });

    setLoadingFolders(prev => new Set(prev).add(path));
    const result = await FileSystemService.fetchFolderContents(path);
    setLoadingFolders(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });

    if (result) {
      console.log('Folder contents loaded:', {
        path,
        itemCount: Object.keys(result.items).length
      });
      
      const newItems = { ...items };
      Object.entries(result.items).forEach(([id, item]) => {
        if (id !== result.rootId) {
          if (item.parentId === result.rootId) {
            item.parentId = folderId;
          }
          newItems[id] = item;
        }
      });
      onFolderContentsLoaded(newItems);
    } else {
      console.error('Failed to load folder contents:', path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      itemId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      itemId: null,
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  const handleRename = (item: FileSystemItem) => {
    const newName = prompt('Enter new name:', item.name);
    if (newName && newName !== item.name) {
      onRenameItem(item, newName);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F2' && currentFileId) {
      e.preventDefault();
      const currentItem = items[currentFileId];
      if (currentItem) {
        handleRename(currentItem);
      }
    }
  }, [currentFileId, items]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const renderContextMenu = (item: FileSystemItem) => {
    if (!contextMenu.isOpen || contextMenu.itemId !== item.id) return null;

    return (
      <div
        style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '4px 0',
          zIndex: 1000,
          minWidth: '160px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            handleRename(item);
            closeContextMenu();
          }}
          style={contextMenuItemStyle}
        >
          Rename
        </div>
        {item.type === 'directory' && (
          <>
            <div style={contextMenuSeparatorStyle} />
            <div
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFile(item.id);
                closeContextMenu();
              }}
              style={contextMenuItemStyle}
            >
              New File
            </div>
            <div
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(item.id);
                closeContextMenu();
              }}
              style={contextMenuItemStyle}
            >
              New Folder
            </div>
          </>
        )}
        <div style={contextMenuSeparatorStyle} />
        <div
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              handleDelete(item, onDeleteItem, items);
            }
            closeContextMenu();
          }}
          style={{
            ...contextMenuItemStyle,
            color: 'var(--error-color)',
          }}
        >
          Delete
        </div>
      </div>
    );
  };

  const renderItem = (id: string, depth: number = 0) => {
    const item = items[id];
    if (!item) return null;

    const isExpanded = expandedFolders.has(id);
    const isHovered = hoveredFolder === id;
    const isLoading = loadingFolders.has(item.path);
    const isSelected = id === currentFileId;

    const childItems = Object.values(items).filter(i => i.parentId === id);

    return (
      <div key={id}>
        <div
          onClick={() => {
            if (item.type === 'file') {
              onFileSelect(id);
              setTimeout(() => window.applyCustomTheme?.(), 100);
            } else {
              handleFolderClick(id);
            }
          }}
          onMouseEnter={() => handleFolderHover(id)}
          onMouseLeave={() => handleFolderHover(null)}
          onContextMenu={(e) => handleContextMenu(e, id)}
          style={{
            paddingLeft: `${depth * 20}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            height: '24px',
            color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
            userSelect: 'none',
            fontSize: '13px',
            position: 'relative',
            borderBottom: '1px solid var(--border-subtle)',
            transition: 'all 0.1s ease',
            ...(isSelected ? activeFileStyle : {}),
            ...(isHovered && !isSelected ? hoverFileStyle : {}),
            paddingRight: '8px',
            marginLeft: isSelected || isHovered ? '-2px' : '0',
          }}
        >
          <div style={{ 
            width: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginLeft: depth === 0 ? '12px' : '4px',
            flexShrink: 0,
          }}>
            {item.type === 'directory' && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleFolderClick(id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8,
                }}
              >
                <ChevronIcon isExpanded={isExpanded} />
              </span>
            )}
          </div>
          <div style={{
            marginLeft: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            color: isSelected 
              ? 'var(--accent-color)' 
              : item.type === 'directory' 
                ? isExpanded
                  ? 'var(--explorer-folder-expanded-fg, #C8C8C8)'
                  : 'var(--explorer-folder-fg, #C8C8C8)'
                : getFileColor(item.name),
          }}>
            {item.type === 'directory' ? (
              <FolderIcon isOpen={isExpanded} />
            ) : (
              getIconForFile(item.name)
            )}
          </div>
          <span style={{
            marginLeft: '4px',
            color: isSelected 
              ? 'var(--accent-color)' 
              : item.type === 'directory' 
                ? isExpanded
                  ? 'var(--explorer-folder-expanded-fg, #C8C8C8)'
                  : 'var(--explorer-folder-fg, #C8C8C8)'
                : getFileColor(item.name),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
            fontWeight: isSelected ? 500 : 'normal',
          }}>
            {item.name}
          </span>
          {isLoading && <span style={{ marginLeft: '4px', opacity: 0.5 }}>...</span>}
          {isHovered && (
            <div style={{
              position: 'absolute',
              right: '4px',
              display: 'flex',
              gap: '4px',
              background: 'var(--bg-hover)',
              padding: '0 4px',
            }}>
              {item.type === 'directory' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFile(id);
                    }}
                    style={buttonStyle}
                    title="New File"
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFolder(id);
                    }}
                    style={buttonStyle}
                    title="New Folder"
                  >
                    📁
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                    handleDelete(item, onDeleteItem, items);
                  }
                }}
                style={buttonStyle}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
        {item.type === 'directory' && isExpanded && (
          <div>
            {childItems.map(child => renderItem(child.id, depth + 1))}
          </div>
        )}

        {renderContextMenu(item)}
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg-secondary)',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      borderRight: '1px solid var(--border-color)',
    }}>
      <div style={{
        padding: '8px 0 4px 20px',
        fontSize: '11px',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: '#bbbbbb',
        letterSpacing: '1px',
        userSelect: 'none',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ marginBottom: '4px' }}>{items[rootId]?.name || 'Explorer'}</span>
      </div>
      <div style={{ padding: '4px 0 0 12px' }}>
        {renderItem(rootId)}
      </div>
    </div>
  );
};

export default FileExplorer; 