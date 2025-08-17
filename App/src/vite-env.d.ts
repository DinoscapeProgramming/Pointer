/// <reference types="vite/client" />

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

// Add Discord RPC TypeScript definitions
interface ElectronAPI {
  send: (channel: string, data: any) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  discord: {
    updateEditorInfo: (info: {
      file: string;
      workspace: string;
      line: number;
      column: number;
      languageId: string;
      fileSize: string;
    }) => void;
    updateSettings: (settings: {
      enabled?: boolean;
      details?: string;
      state?: string;
      largeImageKey?: string;
      largeImageText?: string;
      smallImageKey?: string;
      smallImageText?: string;
      showElapsedTime?: boolean;
    }) => void;
  };
  window?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
  };
  openInExplorer: (filePath: string) => Promise<{success: boolean, error?: string}>;
}

interface Window {
  electron?: ElectronAPI;
} 