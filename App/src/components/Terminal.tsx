import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  isVisible: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ isVisible }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [height, setHeight] = useState(300);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };

  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const newHeight = Math.max(200, Math.min(800, startHeightRef.current - deltaY));
    setHeight(newHeight);
    if (fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
    }
  };

  const handleMouseUp = () => {
    resizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTerminalData = (data: string, socket: WebSocket) => {
    if (data === '\x7F' || data === '\b') { // Backspace character
      socket.send('\x08'); // Send ASCII backspace character
    } else {
      socket.send(data);
    }
  };

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Wait for the container to be properly sized
    const resizeObserver = new ResizeObserver(() => {
      if (!xtermRef.current && terminalRef.current) {
        // Initialize xterm.js
        const xterm = new XTerm({
          theme: {
            background: '#1e1e1e',
            foreground: '#cccccc',
            cursor: '#ffffff',
            selection: '#264f78',
          },
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 14,
          cursorBlink: true,
          cursorStyle: 'block',
          convertEol: true,
          windowsMode: true,
          allowTransparency: false,
          scrollback: 1000,
          rows: 24,
          cols: 80,
          disableStdin: false,
          rendererType: 'canvas',
          allowProposedApi: true,
        });

        // Initialize addons
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        // Store references
        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Open terminal in the container
        xterm.open(terminalRef.current);
        fitAddon.fit();
        xterm.focus();

        // Connect to WebSocket
        const socket = new WebSocket('ws://localhost:8000/ws/terminal');
        socketRef.current = socket;

        socket.onopen = () => {
          console.log('Terminal WebSocket connected');
        };

        socket.onmessage = (event) => {
          requestAnimationFrame(() => {
            xterm.write(event.data);
          });
        };

        socket.onerror = (error) => {
          console.error('Terminal WebSocket error:', error);
          xterm.write('\r\nWebSocket Error: Failed to connect to terminal server\r\n');
        };

        // Handle terminal input
        xterm.onData((data) => {
          if (socket.readyState === WebSocket.OPEN) {
            handleTerminalData(data, socket);
          }
        });

        // Handle window resize
        const handleResize = () => {
          requestAnimationFrame(() => {
            fitAddon.fit();
          });
        };

        window.addEventListener('resize', handleResize);

        // Cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (socketRef.current) {
            socketRef.current.close();
          }
          xterm.dispose();
          resizeObserver.disconnect();
        };
      }
    });

    // Start observing the container
    resizeObserver.observe(terminalRef.current);

    // Cleanup function if xterm wasn't initialized
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isVisible && xtermRef.current && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      });
    }
  }, [isVisible]);

  return (
    <div
      style={{
        position: 'relative',
        display: isVisible ? 'block' : 'none',
      }}
    >
      <div
        ref={terminalRef}
        style={{
          height: `${height}px`,
          width: '100%',
          backgroundColor: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'hidden',
          minWidth: '200px',
          minHeight: '200px',
        }}
        onClick={() => xtermRef.current?.focus()}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          cursor: 'row-resize',
          backgroundColor: 'transparent',
          zIndex: 10,
        }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default Terminal; 