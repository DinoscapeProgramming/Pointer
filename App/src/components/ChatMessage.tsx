import React, { memo } from 'react';
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
}

const ChatMessage = memo(({ message, index, isAnyProcessing = false, onEditMessage }: ChatMessageProps) => {
  const handleEdit = () => {
    if (onEditMessage) {
      onEditMessage(index);
    }
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

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: message.role === 'user' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
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
          color: message.role === 'user' ? 'var(--accent-color)' : 'var(--success-color)',
          textTransform: 'uppercase',
        }}>
          {message.role === 'user' ? 'You' : 'Assistant'}
        </div>
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
      <div style={{ 
        color: 'var(--text-primary)', 
        lineHeight: '1.5',
        fontSize: '14px',
      }}>
        {renderMarkdown(message.content)}
      </div>
      {message.timestamp && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
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