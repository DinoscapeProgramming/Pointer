/**
 * Text utilities for processing and formatting text
 */

/**
 * Removes all markdown code blocks (triple backticks) from a string
 * and returns the cleaned content.
 * 
 * This function handles both:
 * 1. Code blocks with language specifiers: ```javascript ... ```
 * 2. Code blocks without language specifiers: ``` ... ```
 * 
 * @param content The string content containing code blocks
 * @returns The content with code blocks' backticks removed but the code preserved
 */
export function removeMarkdownCodeBlocks(content: string): string {
  if (!content) return content;
  
  // Replace code blocks with language specifier: ```javascript\n... ```
  let result = content.replace(/```[\w-]*\n([\s\S]*?)```/g, (_, code) => code);
  
  // Replace code blocks without language specifier: ```\n... ```
  result = result.replace(/```\n([\s\S]*?)```/g, (_, code) => code);
  
  // Handle edge case where language specifier and code are on the same line: ```javascript code```
  result = result.replace(/```([\w-]+)\s+([\s\S]*?)```/g, (_, lang, code) => code);
  
  // Replace any stray backticks (in case the regex missed some)
  result = result.replace(/^```[\w-]*$/gm, '').replace(/^```$/gm, '');
  
  return result.trim();
}

/**
 * Cleans up AI response content by:
 * 1. Removing triple backticks from code blocks while preserving the code
 * 2. Trimming whitespace
 * 3. Normalizing line endings
 * 
 * @param content The AI response content to clean
 * @returns The cleaned content
 */
export function cleanAIResponse(content: string): string {
  if (!content) return content;
  
  try {
    // Remove code blocks formatting
    let result = removeMarkdownCodeBlocks(content);
    
    // Normalize line endings
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return result.trim();
  } catch (error) {
    console.error('Error cleaning AI response:', error);
    // If there's an error, return the original content as a fallback
    return content;
  }
}

/**
 * Checks if a string contains markdown code blocks (triple backticks)
 * 
 * @param content The string content to check
 * @returns boolean True if the content contains code blocks
 */
export function containsMarkdownCodeBlocks(content: string): boolean {
  if (!content) return false;
  
  // Check for proper code blocks (triple backticks with newlines)
  // This excludes inline code (single backticks) which don't have newlines
  return /```[\w-]*\n[\s\S]*?```/g.test(content) || 
         /```\n[\s\S]*?```/g.test(content) ||
         /```[\w-]+\s+[\s\S]*?```/g.test(content);
}

/**
 * Identifies incomplete code pointer blocks where the start tag exists but not the end tag
 * 
 * @param content The content to check for incomplete code blocks
 * @returns An array of objects containing info about incomplete blocks (filename and startIndex)
 */
export function findIncompleteCodeBlocks(content: string): Array<{filename: string, startIndex: number, partialCode: string}> {
  if (!content) return [];
  
  const incompleteBlocks: Array<{filename: string, startIndex: number, partialCode: string}> = [];
  const startTagRegex = /Pointer:Code\+(.*?):start\s*([\s\S]*?)(?=(Pointer:Code\+\1:end|$))/g;
  
  let match;
  while ((match = startTagRegex.exec(content)) !== null) {
    const [fullMatch, filename, partialCode] = match;
    const endTagExists = content.includes(`Pointer:Code+${filename}:end`);
    
    if (!endTagExists) {
      incompleteBlocks.push({
        filename: filename.trim(),
        startIndex: match.index,
        partialCode: partialCode.trim()
      });
    }
  }
  
  return incompleteBlocks;
}

/**
 * Extracts the language from a filename based on its extension
 * 
 * @param filename The filename to extract language from
 * @returns The language identifier for syntax highlighting
 */
export function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map common file extensions to language identifiers
  const extensionToLanguage: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'swift': 'swift',
    'kt': 'kotlin',
  };
  
  return extensionToLanguage[extension] || extension || 'plaintext';
}

/**
 * Utility functions for text processing
 */

/**
 * Remove <think> and </think> tags and their content from text
 * @param text - The text to clean
 * @returns The text with thinking blocks removed
 */
export const stripThinkTags = (text: string): string => {
  // Remove <think>...</think> blocks (case insensitive, handles multiline)
  // return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return text;
};

/**
 * Extract code blocks with filenames from message content, excluding those in thinking blocks
 * @param content - The message content to parse
 * @returns Array of code blocks with language, filename, content, and optional line range for editing
 */
export const extractCodeBlocks = (content: string) => {
  const codeBlocks: {
    language: string; 
    filename: string; 
    content: string; 
    startLine?: number; 
    endLine?: number;
    isLineEdit?: boolean;
  }[] = [];
  
  if (!content || typeof content !== 'string') {
    return codeBlocks;
  }
  
  // First, find all thinking blocks to exclude code blocks within them
  // Use a more robust approach to handle nested or malformed thinking blocks
  const thinkBlocks: Array<{start: number; end: number}> = [];
  let searchStart = 0;
  
  while (searchStart < content.length) {
    const thinkStartIndex = content.indexOf('<think>', searchStart);
    if (thinkStartIndex === -1) break;
    
    const thinkEndIndex = content.indexOf('</think>', thinkStartIndex);
    if (thinkEndIndex === -1) {
      // Handle malformed thinking block - exclude everything from start to end of content
      thinkBlocks.push({
        start: thinkStartIndex,
        end: content.length
      });
      break;
    } else {
      thinkBlocks.push({
        start: thinkStartIndex,
        end: thinkEndIndex + 8 // 8 is length of '</think>'
      });
      searchStart = thinkEndIndex + 8;
    }
  }
  
  // Function to check if a position is within any thinking block
  const isInThinkBlock = (position: number) => {
    return thinkBlocks.some(block => position >= block.start && position <= block.end);
  };

  // Use a non-global regex to prevent infinite loops
  const codeBlockRegex = /```(\w+)(?::([^\n]+))?\n([\s\S]*?)```/;
  let remainingContent = content;
  let currentOffset = 0;
  let iterationCount = 0;
  const maxIterations = 100; // Safety limit to prevent infinite loops
  
  while (remainingContent && iterationCount < maxIterations) {
    const match = codeBlockRegex.exec(remainingContent);
    if (!match) break;
    
    iterationCount++;
    
    const [fullMatch, language, explicitFilename, code] = match;
    const matchStart = currentOffset + match.index;
    
    // Skip this code block if it's within a thinking block
    if (isInThinkBlock(matchStart)) {
      console.log(`Skipping code block as it's within a thinking block at position ${matchStart}`);
      // Move past this match and continue searching
      const nextSearchStart = match.index + fullMatch.length;
      remainingContent = remainingContent.substring(nextSearchStart);
      currentOffset += nextSearchStart;
      continue;
    }
    
    let filename = explicitFilename;
    let cleanedCode = code;
    let startLine: number | undefined;
    let endLine: number | undefined;
    let isLineEdit = false;
    
    // Check for line-specific editing format: startline:endline:filename
    if (filename) {
      const lineEditMatch = filename.match(/^(\d+):(\d+):(.+)$/);
      if (lineEditMatch) {
        startLine = parseInt(lineEditMatch[1], 10);
        endLine = parseInt(lineEditMatch[2], 10);
        filename = lineEditMatch[3];
        
        // Validate line numbers
        if (startLine < 1 || endLine < 1) {
          console.warn(`Invalid line numbers: ${startLine}-${endLine}. Line numbers must be >= 1`);
          startLine = undefined;
          endLine = undefined;
        } else if (startLine > endLine) {
          console.warn(`Invalid line range: ${startLine}-${endLine}. Start line must be <= end line`);
          startLine = undefined;
          endLine = undefined;
        } else {
          isLineEdit = true;
          console.log(`Found line-specific edit for ${filename}, lines ${startLine}-${endLine} (inclusive)`);
        }
      }
    }
    
    // If no explicit filename was provided, try to extract it from the first line of code
    if (!filename && code) {
      const lines = code.split('\n');
      const firstLine = lines[0]?.trim() || '';
      
      // Extract potential filename from any comment style
      const commentPatterns = [
        /^<!--\s*(.*?\.[\w]+)\s*-->/, // HTML comments
        /^\/\/\s*(.*?\.[\w]+)\s*$/, // Single line comments
        /^#\s*(.*?\.[\w]+)\s*$/, // Hash comments
        /^\/\*\s*(.*?\.[\w]+)\s*\*\/$/, // Multi-line comments
        /^--\s*(.*?\.[\w]+)\s*$/, // SQL comments
        /^%\s*(.*?\.[\w]+)\s*$/, // Matlab/LaTeX comments
        /^;\s*(.*?\.[\w]+)\s*$/, // Assembly/Lisp comments
        // More flexible patterns
        /^(?:\/\/|#|\/\*|--)\s*(?:filename|file|path):\s*([^\s\n]+)/i, // filename: pattern
        /^(?:\/\/|#|\/\*|--)\s*@file:\s*([^\s\n]+)/i, // @file: pattern
      ];

      for (const pattern of commentPatterns) {
        const commentMatch = firstLine.match(pattern);
        if (commentMatch && commentMatch[1]) {
          const potentialPath = commentMatch[1].trim();
          // Basic check if it looks like a file path (has extension, no spaces in the main part)
          if (potentialPath.includes('.') && !potentialPath.includes(' ')) {
            filename = potentialPath;
            // Remove the first line from the content since we're using it as the filename
            cleanedCode = lines.slice(1).join('\n').trim();
            break;
          }
        }
      }
    }
    
    if (filename && cleanedCode) {
      // Strip any think tags from the code content
      const finalCode = stripThinkTags(cleanedCode);
      
      // Only add the code block if there's actual content after cleaning
      if (finalCode.trim()) {
        const blockType = isLineEdit ? 'line-specific edit' : 'auto-insertion';
        console.log(`Found code block for ${blockType}: ${filename}`);
        
        codeBlocks.push({
          language,
          filename,
          content: finalCode,
          ...(isLineEdit && { startLine, endLine, isLineEdit })
        });
      } else {
        console.log(`Skipping code block for ${filename} as it contains only thinking content`);
      }
    }
    
    // Move past this match and continue searching
    const nextSearchStart = match.index + fullMatch.length;
    remainingContent = remainingContent.substring(nextSearchStart);
    currentOffset += nextSearchStart;
  }
  
  if (iterationCount >= maxIterations) {
    console.warn(`extractCodeBlocks: Hit iteration limit (${maxIterations}), stopping to prevent infinite loop`);
  }
  
  console.log(`extractCodeBlocks: Found ${codeBlocks.length} code blocks after ${iterationCount} iterations`);
  return codeBlocks;
}; 