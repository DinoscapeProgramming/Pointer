import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { ExtendedMessage } from '../config/chatConfig';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ChatMessageProps {
  message: ExtendedMessage;
  index: number;
  isAnyProcessing?: boolean;
  onEditMessage?: (index: number) => void;
  onContinue?: (messageIndex: number) => void;
}

const ChatMessage = memo(({ message, index, isAnyProcessing = false, onEditMessage, onContinue }: ChatMessageProps) => {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  
  const handleEdit = () => {
    if (onEditMessage) {
      onEditMessage(index);
    }
  };

  // Check if this is an error message
  const isErrorMessage = (content: string): boolean => {
    const errorPatterns = [
      /I apologize, but I encountered an error/,
      /I apologize, but an error occurred/,
      /I'm having trouble processing your request/,
      /encountered an error while trying to continue/,
      /Error processing your request/,
      /Failed to process/,
      /An error occurred/,
      /Operation cancelled by user/,
      /but encountered an error:/
    ];
    
    return errorPatterns.some(pattern => pattern.test(content));
  };

  // Extract error details if available
  const extractErrorDetails = (content: string): string | null => {
    // Look for common error detail patterns
    const detailPatterns = [
      /error:\s*(.+)/i,
      /failed:\s*(.+)/i,
      /exception:\s*(.+)/i,
      /details:\s*(.+)/i,
      /but encountered an error:\s*(.+)/i
    ];
    
    for (const pattern of detailPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const code = String(children).replace(/\n$/, '');
          
          if (!props.inline && language) {
            return (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: '0',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                {code}
              </SyntaxHighlighter>
            );
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // Strikethrough support
        del: ({ children, ...props }) => (
          <del style={{
            textDecoration: 'line-through',
            color: 'var(--text-secondary)',
            opacity: 0.8
          }} {...props}>
            {children}
          </del>
        ),
        // Blockquote support
        blockquote: ({ children, ...props }) => (
          <blockquote style={{
            borderLeft: '4px solid var(--accent-color)',
            margin: '16px 0',
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            fontStyle: 'italic',
            color: 'var(--text-secondary)'
          }} {...props}>
            {children}
          </blockquote>
        ),
        // Table support
        table: ({ children, ...props }) => (
          <div style={{ overflowX: 'auto', margin: '16px 0' }}>
            <table style={{
              borderCollapse: 'collapse',
              width: '100%',
              border: '1px solid var(--border-color)',
              borderRadius: '4px'
            }} {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead style={{
            background: 'var(--bg-secondary)',
            borderBottom: '2px solid var(--border-color)'
          }} {...props}>
            {children}
          </thead>
        ),
        tbody: ({ children, ...props }) => (
          <tbody {...props}>
            {children}
          </tbody>
        ),
        tr: ({ children, ...props }) => (
          <tr style={{
            borderBottom: '1px solid var(--border-color)'
          }} {...props}>
            {children}
          </tr>
        ),
        th: ({ children, ...props }) => (
          <th style={{
            padding: '8px 12px',
            textAlign: 'left',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            borderRight: '1px solid var(--border-color)'
          }} {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td style={{
            padding: '8px 12px',
            borderRight: '1px solid var(--border-color)',
            color: 'var(--text-primary)'
          }} {...props}>
            {children}
          </td>
        ),
        // Horizontal rule with better margins
        hr: ({ ...props }) => (
          <hr style={{
            border: 'none',
            height: '2px',
            background: 'var(--border-color, #444)',
            margin: '24px 0',
            borderRadius: '1px',
            opacity: 0.8
          }} {...props} />
        ),
        // List support
        ul: ({ children, ...props }) => (
          <ul style={{ 
            margin: '8px 0',
            paddingLeft: '24px',
            listStyleType: 'disc'
          }} {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol style={{ 
            margin: '8px 0',
            paddingLeft: '24px',
            listStyleType: 'decimal'
          }} {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li style={{ 
            margin: '4px 0',
            lineHeight: '1.5'
          }} {...props}>
            {children}
          </li>
        ),
        a: ({ href, children, ...props }) => {
          const isExternalLink = href && (href.startsWith('http://') || href.startsWith('https://'));
          
          const handleClick = (e: React.MouseEvent) => {
            if (isExternalLink) {
              e.preventDefault();
              // Use the Electron shell API if available, otherwise fallback to window.open
              if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(href);
              } else {
                window.open(href, '_blank', 'noopener,noreferrer');
              }
            }
          };
          
          return (
            <a
              href={href}
              target={isExternalLink ? '_blank' : undefined}
              rel={isExternalLink ? 'noopener noreferrer' : undefined}
              style={{
                color: 'var(--accent-color)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--accent-color)',
                transition: 'all 0.2s ease',
                padding: '1px 2px',
                borderRadius: '3px',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (isExternalLink) {
                  e.currentTarget.style.background = 'var(--accent-color)';
                  e.currentTarget.style.color = 'var(--bg-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (isExternalLink) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--accent-color)';
                }
              }}
              onClick={handleClick}
              {...props}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const messageContent = typeof message.content === 'string' ? message.content : '';
  const isError = isErrorMessage(messageContent);
  const errorDetails = isError ? extractErrorDetails(messageContent) : null;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: isError 
          ? 'var(--error-bg)' // Light red background for errors
          : message.role === 'user' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        borderLeft: isError ? '4px solid var(--error-color)' : 'none', // Red left border for errors
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px' 
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: isError 
            ? 'var(--error-color)' // Red color for error messages
            : message.role === 'user' ? 'var(--accent-color)' : 'var(--success-color)',
          textTransform: 'uppercase',
        }}>
          {isError ? 'Error' : message.role === 'user' ? 'You' : 'Assistant'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isError && onContinue && (
            <button
              onClick={() => onContinue(index)}
              disabled={isAnyProcessing}
              style={{
                background: 'var(--accent-color)',
                border: '1px solid var(--accent-color)',
                color: 'white',
                cursor: isAnyProcessing ? 'not-allowed' : 'pointer',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                opacity: isAnyProcessing ? 0.6 : 1,
              }}
              title={isAnyProcessing ? "Processing..." : "Retry this conversation"}
              onMouseEnter={(e) => {
                if (!isAnyProcessing) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnyProcessing) {
                  e.currentTarget.style.background = 'var(--accent-color)';
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                }
              }}
            >
              {isAnyProcessing ? 'Processing...' : 'Continue'}
            </button>
          )}
          {isError && errorDetails && (
            <button
              onClick={() => setIsErrorExpanded(!isErrorExpanded)}
              style={{
                background: 'transparent',
                border: '1px solid var(--error-color)',
                color: 'var(--error-color)',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                transition: 'all 0.2s ease',
              }}
              title={isErrorExpanded ? "Hide error details" : "Show error details"}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--error-color)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--error-color)';
              }}
            >
              {isErrorExpanded ? 'Hide Details' : 'Show Details'}
            </button>
          )}
          {message.role === 'user' && onEditMessage && (
            <button
              onClick={handleEdit}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
              }}
              title="Edit message"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <div style={{ 
        color: isError ? 'var(--error-text)' : 'var(--text-primary)', 
        lineHeight: '1.5',
        fontSize: '14px',
      }}>
        {renderMarkdown(messageContent)}
      </div>
      
      {/* Error details section */}
      {isError && errorDetails && isErrorExpanded && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--error-bg)',
          border: '1px solid var(--error-border)',
          borderRadius: '4px',
          fontSize: '13px',
          color: 'var(--error-text)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Error Details:
          </div>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {errorDetails}
          </div>
        </div>
      )}
      
      {message.timestamp && (
        <div style={{
          fontSize: '11px',
          color: isError ? 'var(--error-text)' : 'var(--text-secondary)',
          marginTop: '8px',
        }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage; 