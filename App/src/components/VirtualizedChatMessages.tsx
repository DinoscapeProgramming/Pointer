import React, { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ExtendedMessage } from '../config/chatConfig';
import ChatMessage from './ChatMessage';

interface VirtualizedChatMessagesProps {
  messages: ExtendedMessage[];
  isAnyProcessing?: boolean;
  onEditMessage?: (index: number) => void;
  onContinue?: (messageIndex: number) => void;
  containerHeight: number;
}

const ITEM_HEIGHT = 150; // Estimated height per message
const BUFFER_SIZE = 5; // Number of items to render outside visible area

const VirtualizedChatMessages = memo(({ 
  messages, 
  isAnyProcessing = false, 
  onEditMessage,
  onContinue,
  containerHeight 
}: VirtualizedChatMessagesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
      messages.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    
    return {
      startIndex,
      endIndex,
      items: messages.slice(startIndex, endIndex)
    };
  }, [messages, scrollTop, containerHeight]);

  const totalHeight = messages.length * ITEM_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    
    // Detect if user is manually scrolling
    const isAtBottom = newScrollTop + containerHeight >= totalHeight - 50;
    setIsUserScrolling(!isAtBottom);
  }, [containerHeight, totalHeight]);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (!isUserScrolling && containerRef.current) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [messages.length, isUserScrolling, totalHeight]);

  // Throttled scroll handler
  const throttledHandleScroll = useMemo(
    () => {
      let timeoutId: number;
      return (e: React.UIEvent<HTMLDivElement>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => handleScroll(e), 16) as unknown as number; // ~60fps
      };
    },
    [handleScroll]
  );

  return (
    <div
      ref={containerRef}
      onScroll={throttledHandleScroll}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: visibleItems.startIndex * ITEM_HEIGHT,
            width: '100%',
          }}
        >
          {visibleItems.items.map((message, index) => (
            <div
              key={`${visibleItems.startIndex + index}-${message.id || message.timestamp}`}
              style={{ height: ITEM_HEIGHT, overflow: 'hidden' }}
            >
              <ChatMessage
                message={message}
                index={visibleItems.startIndex + index}
                isAnyProcessing={isAnyProcessing}
                onEditMessage={onEditMessage}
                onContinue={onContinue}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

VirtualizedChatMessages.displayName = 'VirtualizedChatMessages';

export default VirtualizedChatMessages; 