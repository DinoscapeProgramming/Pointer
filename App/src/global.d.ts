import { FileSystemItem, ThemeSettings } from './types';
import * as monaco from 'monaco-editor';

declare global {
  interface Window {
    fileSystem?: Record<string, FileSystemItem>;
    getCurrentFile?: (() => { path: string } | null) | undefined;
    reloadFileContent?: ((fileId: string) => Promise<void>) | undefined;
    applyCustomTheme?: (() => void) | undefined;
    loadSettings?: (() => Promise<void>) | undefined;
    cursorUpdateTimeout?: number;
    editor?: monaco.editor.IStandaloneCodeEditor;
    appSettings?: {
      theme?: ThemeSettings;
    };
  }
}

export {};