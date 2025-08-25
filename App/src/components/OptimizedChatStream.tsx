import React, { memo, useRef, useCallback, useEffect, useState } from 'react';
import { ExtendedMessage } from '../config/chatConfig';

interface OptimizedChatStreamProps {
  streamingContent: string;
  isStreaming: boolean;
  onStreamComplete?: (finalContent: string) => void;
}

const OptimizedChatStream = memo(({ 
  streamingContent, 
  isStreaming, 
  onStreamComplete 
}: OptimizedChatStreamProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayContent, setDisplayContent] = useState('');
  const contentBufferRef = useRef('');
  const updateTimeoutRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef(0);
  
  // Batch content updates using requestAnimationFrame
  const batchedUpdateContent = useCallback(() => {
    if (updateTimeoutRef.current) {
      cancelAnimationFrame(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = requestAnimationFrame(() => {
      const now = performance.now();
      // Throttle updates to ~30fps during streaming to maintain performance
      if (now - lastUpdateTimeRef.current > 33) {
        setDisplayContent(contentBufferRef.current);
        lastUpdateTimeRef.current = now;
      }
    });
  }, []);

  // Update content buffer when streaming content changes
  useEffect(() => {
    contentBufferRef.current = streamingContent;
    
    if (isStreaming) {
      batchedUpdateContent();
    } else {
      // Ensure final update when streaming stops
      setDisplayContent(streamingContent);
      if (onStreamComplete) {
        onStreamComplete(streamingContent);
      }
    }
  }, [streamingContent, isStreaming, batchedUpdateContent, onStreamComplete]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        cancelAnimationFrame(updateTimeoutRef.current);
      }
    };
  }, []);

  // Add cleanup effect to reset streaming state on unmount
  useEffect(() => {
    return () => {
      // Reset streaming state when component unmounts
      if (onStreamComplete) {
        onStreamComplete(streamingContent);
      }
    };
  }, [streamingContent, onStreamComplete]);

  // Auto-scroll to bottom during streaming (throttled)
  const autoScrollRef = useRef<number | null>(null);
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }
      
      autoScrollRef.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
    
    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }
    };
  }, [isStreaming, displayContent]);

  return (
    <div
      ref={containerRef}
      style={{
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.5',
        color: 'var(--text-primary)',
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '8px',
        background: isStreaming ? 'var(--bg-secondary)' : 'transparent',
        borderRadius: '4px',
        transition: 'background-color 0.2s ease',
      }}
    >
      {displayContent}
      {isStreaming && (
        <span
          style={{
            opacity: 0.7,
            animation: 'blink 1s infinite',
          }}
        >
          ▊
        </span>
      )}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
});

OptimizedChatStream.displayName = 'OptimizedChatStream';

export default OptimizedChatStream; 