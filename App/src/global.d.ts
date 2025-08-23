import { FileSystemItem, ThemeSettings } from './types';
import * as monaco from 'monaco-editor';

declare global {
  interface Window {
    fileSystem?: Record<string, FileSystemItem>;
    getCurrentFile?: (() => { path: string } | null) | null;
    reloadFileContent?: ((fileId: string) => Promise<void>) | null;
    applyCustomTheme?: (() => void) | null;
    loadSettings?: (() => Promise<void>) | null;
    cursorUpdateTimeout?: number;
    editor?: monaco.editor.IStandaloneCodeEditor;
    appSettings?: {
      theme?: ThemeSettings;
    };
  }
}

export {};