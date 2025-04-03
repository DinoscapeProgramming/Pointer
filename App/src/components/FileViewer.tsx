import React from 'react';
import { FileSystemItem } from '../types';
import DatabaseViewer from './DatabaseViewer';

// Determine if the file is a binary type (excluding DB files now)
const isBinaryFile = (filename: string): boolean => {
  const binaryExtensions = [
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', 'tar', 'gz', '7z', 'bin', 'exe', 'dll',
    'so', 'dylib', 'o', 'obj', 'class', 'jar', 'war',
    'dat', 'mp3', 'mp4', 'avi', 'mov',
    'webm', 'wav', 'ogg', 'ttf', 'otf', 'eot', 'woff',
    'woff2', 'iso'
  ];
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return binaryExtensions.includes(ext);
};

// Determine if the file is an image type
const isImageFile = (filename: string): boolean => {
  const imageExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
    'tiff', 'ico', 'heic', 'avif'
  ];
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return imageExtensions.includes(ext);
};

// Determine if the file is a PDF file
const isPdfFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf';
};

// Determine if the file is an SQLite database file
const isDatabaseFile = (filename: string): boolean => {
  const dbExtensions = ['db', 'sqlite', 'sqlite3'];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return dbExtensions.includes(ext);
};

// Component to display binary files (generic placeholder)
const BinaryFileViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  return (
    <div style={{
      padding: '20px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-primary)',
      height: '100%',
      overflow: 'auto'
    }}>
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <h3>Binary File</h3>
        <p>This file format cannot be displayed directly in the editor.</p>
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          border: '1px solid var(--border-color)', 
          borderRadius: '4px',
          display: 'inline-block'
        }}>
          <p><strong>File:</strong> {file.name}</p>
          <p><strong>Path:</strong> {file.path}</p>
          <p><strong>Type:</strong> Binary</p>
        </div>
      </div>
    </div>
  );
};

// Component to display image files
const ImageViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  // Determine the appropriate URL for the image
  const imageSrc = file.path.startsWith('/') 
    ? `file://${file.path}` 
    : `http://localhost:23816/serve-file?path=${encodeURIComponent(file.path)}`;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--bg-primary)',
      height: '100%',
      overflow: 'auto',
      textAlign: 'center'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>{file.name}</h3>
      <div style={{ 
        backgroundColor: 'var(--bg-secondary)',
        padding: '10px',
        borderRadius: '4px',
        display: 'inline-block',
        maxWidth: '100%',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
      }}>
        <img 
          src={imageSrc} 
          alt={file.name}
          style={{ 
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain'
          }} 
        />
      </div>
      <div style={{ 
        marginTop: '20px',
        color: 'var(--text-secondary)',
        fontSize: '12px'
      }}>
        {file.path}
      </div>
    </div>
  );
};

// Component to display PDF files
const PdfViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const pdfSrc = file.path.startsWith('/')
    ? `file://${file.path}`
    : `http://localhost:23816/serve-file?path=${encodeURIComponent(file.path)}`;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--bg-primary)',
      height: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>{file.name}</h3>
      <iframe
        src={pdfSrc}
        style={{
          width: '100%',
          height: 'calc(100vh - 120px)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          backgroundColor: 'white'
        }}
        title={file.name}
      />
    </div>
  );
};

// Main file viewer component that decides which viewer to use
interface FileViewerProps {
  file: FileSystemItem;
  fileId: string;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, fileId }) => {
  // Determine which viewer to use based on the file type
  if (isDatabaseFile(file.name)) {
    return <DatabaseViewer file={file} />;
  } else if (isImageFile(file.name)) {
    return <ImageViewer file={file} />;
  } else if (isPdfFile(file.name)) {
    return <PdfViewer file={file} />;
  } else if (isBinaryFile(file.name)) {
    return <BinaryFileViewer file={file} />;
  }
  
  // Return null for text files which will be handled by the editor
  return null;
};

export { FileViewer, isImageFile, isBinaryFile, isPdfFile, isDatabaseFile }; 