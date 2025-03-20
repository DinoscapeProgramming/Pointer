import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
  isStreaming?: boolean;
  width?: string;
  height?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  content,
  isStreaming,
  width = '600px',
  height = '80vh' 
}) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          width: width,
          maxWidth: '90%',
          maxHeight: height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--accent-color)',
        }}
      >
        <div 
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
          }}
        >
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px',
            color: 'var(--accent-color)',
            fontWeight: 'bold',
          }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            ×
          </button>
        </div>
        <div 
          style={{
            padding: '20px',
            overflow: 'auto',
            color: 'var(--text-primary)',
            fontSize: '15px',
            lineHeight: 1.6,
            flexGrow: 1,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
          {isStreaming && <span className="blinking-cursor">|</span>}
        </div>
        <div 
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-secondary)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-hover, #0078d7)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--accent-color)'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal; 