import React from 'react';
import LinkHoverCard from './LinkHoverCard';

const LinkHoverCardDemo: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'var(--font-primary)', color: 'var(--text-primary)' }}>
      <h2>Link Hover Card Demo</h2>
      <p>Hover over the links below to see the hover cards in action:</p>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>GitHub Links:</h3>
        <p>
          Check out the <LinkHoverCard url="https://github.com/facebook/react">
            <a href="https://github.com/facebook/react" style={{ color: 'var(--accent-color)' }}>
              React repository
            </a>
          </LinkHoverCard> for the latest updates.
        </p>
        <p>
          Also visit <LinkHoverCard url="https://github.com/microsoft/vscode">
            <a href="https://github.com/microsoft/vscode" style={{ color: 'var(--accent-color)' }}>
              VS Code
            </a>
          </LinkHoverCard> for editor features.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Documentation Links:</h3>
        <p>
          Read the <LinkHoverCard url="https://react.dev/">
            <a href="https://react.dev/" style={{ color: 'var(--accent-color)' }}>
              React documentation
            </a>
          </LinkHoverCard> for detailed guides.
        </p>
        <p>
          Check out <LinkHoverCard url="https://developer.mozilla.org/en-US/docs/Web/JavaScript">
            <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" style={{ color: 'var(--accent-color)' }}>
              MDN JavaScript docs
            </a>
          </LinkHoverCard> for web development.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>API Documentation:</h3>
        <p>
          Explore the <LinkHoverCard url="https://api.github.com/">
            <a href="https://api.github.com/" style={{ color: 'var(--accent-color)' }}>
              GitHub API
            </a>
          </LinkHoverCard> for integration options.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Stack Overflow:</h3>
        <p>
          Find answers on <LinkHoverCard url="https://stackoverflow.com/questions/tagged/react">
            <a href="https://stackoverflow.com/questions/tagged/react" style={{ color: 'var(--accent-color)' }}>
              Stack Overflow React tag
            </a>
          </LinkHoverCard>.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Invalid/Error Links:</h3>
        <p>
          This should show an error state: <LinkHoverCard url="https://invalid-domain-that-does-not-exist-12345.com/">
            <a href="https://invalid-domain-that-does-not-exist-12345.com/" style={{ color: 'var(--accent-color)' }}>
              Invalid link
            </a>
          </LinkHoverCard>.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Internal Links (should not show hover card):</h3>
        <p>
          This is an <a href="#internal-link" style={{ color: 'var(--accent-color)' }}>internal link</a> that should not show a hover card.
        </p>
      </div>
    </div>
  );
};

export default LinkHoverCardDemo;
