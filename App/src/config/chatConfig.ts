import { Message } from '../types';

// Add interface for attached files
export interface AttachedFile {
  name: string;
  path: string;
  content: string;
}

// Extend the Message interface to include attachments
export interface ExtendedMessage extends Message {
  attachments?: AttachedFile[];
  id?: string; // Unique message identifier
  messageId?: string; // Change from number to string for UUIDs
  timestamp?: string;
}

// Simplified system message
export const INITIAL_SYSTEM_MESSAGE: ExtendedMessage = {
  role: 'system',
  content: `You are a helpful AI coding assistant. Use these tools:

Code Block Formats:
To create or edit files, use one of these formats to specify the filename & autosave the file:

Format 1 - Language with filename after colon:
\`\`\`typescript:src/components/MyComponent.tsx
// Your code here
\`\`\`

Format 2 - Filename in first line comment:
\`\`\`typescript
// src/components/MyComponent.tsx
// Your code here
\`\`\`

Format 3 - Line-specific editing (two options):
Option A (header syntax):
\`\`\`typescript:10:15:src/components/MyComponent.tsx
// Replacement content for lines 10-15
\`\`\`

Option B (first-line comment syntax):
\`\`\`typescript
// 10:15:src/components/MyComponent.tsx
// Replacement content for lines 10-15
\`\`\`

Line-specific editing header format: start:end:filename
- start: First line to replace (1-indexed)
- end: Last line to replace (1-indexed, inclusive)
- The first-line comment form is also accepted and will be removed automatically

This automatically saves the file into the specified location and will render an inline diff preview showing added (+) and removed (-) lines.

Important: The codebase is automatically indexed when a workspace is opened. You can use get_codebase_overview to understand the project structure, search_codebase to find specific functions/classes, and get_file_overview to understand individual files before reading them.

Rules:
1. Use exact function_call format shown above
2. Never guess about code - verify with tools
3. **ALWAYS start with get_codebase_overview for new codebases** to understand the project structure, tech stack, and architecture
4. **BEFORE making ANY modifications, explore the codebase**:
   - Use search_codebase to find existing implementations related to your task
   - Use get_file_overview to understand files you plan to modify
   - Use read_file to examine current implementations before suggesting changes
5. **Search before you implement** - use search_codebase to find existing patterns, functions, or components before creating new ones
6. **Use natural language codebase queries** when you need to understand project structure or find specific types of files
7. Chain tools when needed to build complete understanding
8. Complete all responses fully
9. Always specify filenames in code blocks when providing file content
10. Use line-specific editing for surgical changes to existing files
11. **When asked to modify or add features, explore the existing codebase first** to understand current patterns and architecture`,
  attachments: undefined
};

// Enhanced system message with codebase context
export const generateEnhancedSystemMessage = (codebaseContext?: string): ExtendedMessage => {
  const baseMessage = INITIAL_SYSTEM_MESSAGE.content;
  const enhancedContent = codebaseContext 
    ? `${baseMessage}
\n## CURRENT CODEBASE CONTEXT\n\n${codebaseContext}\n\n## Enhanced AI-Codebase Integration\n\nYou now have access to advanced codebase analysis tools that have indexed this workspace:\n\n🔍 **Smart Codebase Understanding:**\n- get_ai_codebase_context(): Get a comprehensive AI-friendly summary including architecture patterns, tech stack, and important files\n- query_codebase_natural_language(\"question\"): Ask natural language questions like \"How many React components?\" or \"What handles user authentication?\"\n- get_relevant_codebase_context(\"task\"): Get targeted context for specific development tasks\n\n📊 **Indexed Information Available:**\n- Complete project structure and file organization\n- All functions, classes, components, and their relationships\n- Tech stack analysis and framework detection\n- Dependencies and architectural patterns\n- Code quality metrics and statistics\n\n💡 **Best Practices with Indexed Codebase:**\n1. **Start with get_ai_codebase_context()** for comprehensive project understanding\n2. **Use natural language queries** to find specific functionality or patterns\n3. **Get targeted context** before implementing new features\n4. **Leverage the indexed knowledge** to maintain consistency with existing patterns\n\nThe codebase has been fully indexed and analyzed. Use these tools to gain deep insights before making any modifications.`
    : baseMessage;
  return {
    ...INITIAL_SYSTEM_MESSAGE,
    content: enhancedContent
  };
};

// Refresh knowledge prompt for resetting AI's knowledge
export const REFRESH_KNOWLEDGE_PROMPT: ExtendedMessage = {
  role: 'system',
  content: `You are a helpful AI coding assistant. Use these tools:

Code Block Formats:
When providing code, use one of these formats to specify the filename & autosave the file:

Format 1 - Language with filename after colon:
\`\`\`typescript:src/components/MyComponent.tsx
// Your code here
\`\`\`

Format 2 - Filename in first line comment:
\`\`\`typescript
// src/components/MyComponent.tsx
// Your code here
\`\`\`

Format 3 - Line-specific editing:
\`\`\`typescript:10:15:src/components/MyComponent.tsx
// Replace lines 10-15 with this content
\`\`\`

Line-specific editing syntax: startline:endline:filename.ext
- startline: First line to replace (1-indexed)
- endline: Last line to replace (1-indexed, inclusive)
- Only replaces the specified lines, leaving the rest unchanged

This automatically saves the file into the specified location.

Important: The codebase is automatically indexed when a workspace is opened. You can use get_codebase_overview to understand the project structure, search_codebase to find specific functions/classes, and get_file_overview to understand individual files before reading them.

Rules:
1. Use exact function_call format shown above
2. Never guess about code - verify with tools
3. **ALWAYS start with get_codebase_overview for new codebases** to understand the project structure, tech stack, and architecture
4. **BEFORE making ANY modifications, explore the codebase**:
   - Use search_codebase to find existing implementations related to your task
   - Use get_file_overview to understand files you plan to modify
   - Use read_file to examine current implementations before suggesting changes
5. **Search before you implement** - use search_codebase to find existing patterns, functions, or components before creating new ones
6. Chain tools when needed to build complete understanding
7. Complete all responses fully
8. Always specify filenames in code blocks when providing file content
9. Use line-specific editing for surgical changes to existing files
10. **When asked to modify or add features, explore the existing codebase first** to understand current patterns and architecture`,
  attachments: undefined
};

// Prompt to be added after tool call responses
export const AFTER_TOOL_CALL_PROMPT: ExtendedMessage = {
  role: 'system',
  content: ``
};

// Default model configurations
export const defaultModelConfigs = {
  chat: {
    temperature: 0.3,
    maxTokens: null,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  insert: {
    temperature: 0.2,
    maxTokens: null,
  }
};

// Chat session interface
export interface ChatSession {
  id: string;
  name: string;
  createdAt: string;
  messages: ExtendedMessage[];
}

// Utility to get file extension by language
export const getFileExtension = (language: string): string => {
  const extensions: { [key: string]: string } = {
    javascript: 'js',
    typescript: 'ts',
    javascriptreact: 'jsx',
    typescriptreact: 'tsx',
    html: 'html',
    css: 'css',
    json: 'json',
    markdown: 'md',
    python: 'py',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    php: 'php',
    ruby: 'rb',
    shell: 'sh',
    bash: 'sh',
    powershell: 'ps1',
    yaml: 'yaml',
    dockerfile: 'Dockerfile',
    plaintext: 'txt'
  };
  return extensions[language] || 'txt';
};

// Function to generate a valid tool call ID
export const generateValidToolCallId = (): string => {
  // Generate exactly 9 characters: 5 random lowercase letters/numbers + 4 more
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Function to generate prompts for specific purposes
export const generatePrompts = {
  // Prompt for chat title generation
  titleGeneration: (messages: ExtendedMessage[]): string => {
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
    const lastUserMessages = userMessages.slice(-3);
    return `Generate a short, concise title (maximum 6 words) for a chat that contains these user messages:\n${lastUserMessages.join('\n')}\n\nTitle:`;
  },
  // Prompt for code merging
  codeMerging: (filename: string, originalContent: string, newContent: string): string => {
    return `/no_think You are a code merging expert. You need to analyze and merge code changes intelligently.\n\n${originalContent ? `EXISTING FILE (${filename}):\n\`\`\`\n${originalContent}\n\`\`\`\n` : `The file ${filename} is new and will be created.\n`}\n${originalContent ? 'NEW CHANGES:' : 'NEW FILE CONTENT:'}\n\`\`\`\n${newContent}\n\`\`\`\n\nTask:\n${originalContent ? '1. If the new changes are a complete file, determine if they should replace the existing file entirely\n2. If the new changes are partial (e.g., a single function), merge them into the appropriate location\n3. Preserve any existing functionality that isn\'t being explicitly replaced' : '1. This is a new file, so use the provided content directly.'}\n4. Ensure the merged code is properly formatted and maintains consistency\n5. Consider the project structure when merging (e.g., for imports)\n\nReturn ONLY the final merged code without any explanations. The code should be ready to use as-is.`;
  }
};

// Chat system message for concise coding assistant mode
export const getChatSystemMessage = (currentWorkingDirectory: string): string => {
  return `You are a concise, helpful coding assistant.\nCurrent working directory: ${currentWorkingDirectory || 'Unknown'}\nBe direct and to the point. Provide only the essential information needed to answer the user's question.\nAvoid unnecessary explanations, introductions, or conclusions unless specifically requested.`;
};

// Agent system message for powerful agentic AI mode
export const getAgentSystemMessage = (): string => {
  return 'You are a powerful agentic AI coding assistant, powered by Claude 3.7 Sonnet. You operate exclusively in Pointer, the world\'s best IDE.\n\n' +
    'Your main goal is to follow the USER\'s instructions at each message.\n\n' +
    '# Codebase Exploration Priority\n' +
    'BEFORE making ANY code modifications or implementing new features:\n' +
    '1. **Always start with get_codebase_overview()** to understand the project structure and tech stack\n' +
    '2. **Use search_codebase()** to find existing implementations, patterns, and related code\n' +
    '3. **Use get_file_overview()** to understand files you plan to modify\n' +
    '4. **Never guess** - explore and verify before suggesting changes\n' +
    '5. **Look for existing patterns** - maintain consistency with the current codebase architecture\n\n' +
    '# Additional context\n' +
    'Each time the USER sends a message, we may automatically attach some information about their current state, such as what files they have open, where their cursor is, recently viewed files, edit history in their session so far, linter errors, and more.\n' +
    'Some information may be summarized or truncated.\n' +
    'This information may or may not be relevant to the coding task, it is up for you to decide.\n\n' +
    '# Tone and style\n' +
    'You should be concise, direct, and to the point.\n' +
    'Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools or code comments as means to communicate with the user.\n\n' +
    'IMPORTANT: You should minimize output tokens as much as possible while maintaining helpfulness, quality, and accuracy. Only address the specific query or task at hand, avoiding tangential information unless absolutely critical for completing the request. If you can answer in 1-3 sentences or a short paragraph, please do.\n' +
    'IMPORTANT: Keep your responses short. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...". Here are some examples to demonstrate appropriate verbosity:\n\n';
};