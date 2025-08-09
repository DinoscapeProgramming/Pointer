/**
 * Service for interacting with AI tools via the backend
 */

export class ToolService {
  // Use the main backend URL
  private baseUrl: string = 'http://localhost:23816/api/tools';
  
  // Static property to track tool execution state
  private static isExecutingTool = false;
  
  // Tool name mapping between frontend and backend
  private static toolNameMap: Record<string, string> = {
    // Frontend to backend mappings
    'list_dir': 'list_directory',
    'read_file': 'read_file',
    'create_file': 'create_file',
    'edit_file': 'edit_file',
    'delete_file': 'delete_file',
    'move_file': 'move_file',
    'copy_file': 'copy_file',
    'web_search': 'web_search',
    'grep_search': 'grep_search',
    'fetch_webpage': 'fetch_webpage',
    'run_terminal_cmd': 'run_terminal_cmd',
    
    // Backend to frontend mappings
    'list_directory': 'list_dir',
  };
  
  /**
   * Map tool names between frontend and backend
   * @param name The tool name to map
   * @param direction Whether to map frontend->backend or backend->frontend
   */
  public static mapToolName(name: string, direction: 'to_backend' | 'to_frontend'): string {
    if (!name) return name;
    
    if (direction === 'to_backend') {
      return this.toolNameMap[name] || name;
    } else {
      // Find the key with the matching value
      for (const [frontendName, backendName] of Object.entries(this.toolNameMap)) {
        if (backendName === name) return frontendName;
      }
      return name; // If no mapping found, return original
    }
  }
  
  /**
   * Check if a tool execution is currently in progress
   */
  public static isToolExecutionInProgress(): boolean {
    return this.isExecutingTool;
  }
  
  /**
   * Set the tool execution state
   */
  public static setToolExecutionState(isExecuting: boolean): void {
    this.isExecutingTool = isExecuting;
    console.log(`Tool execution state set to: ${isExecuting}`);
  }

  /**
   * Get the consistent tool name for the given context
   * @param toolName Raw tool name from any source
   * @param context 'frontend', 'backend', or 'storage'
   * @returns Consistently mapped tool name
   */
  public getConsistentToolName(toolName: string, context: 'frontend' | 'backend' | 'storage'): string {
    // Use the static mapToolName method for consistent mapping
    if (context === 'backend') {
      return ToolService.mapToolName(toolName, 'to_backend');
    } else {
      return ToolService.mapToolName(toolName, 'to_frontend');
    }
  }

  /**
   * Format a detailed title for tool results to be displayed in the UI
   * @param toolName Name of the tool that was called
   * @param params Parameters passed to the tool
   * @param result Result returned by the tool
   * @returns Formatted title with detailed information
   */
  private formatToolResultTitle(toolName: string, params: any, result: any): string {
    try {
      if (toolName === 'list_directory' || toolName === 'list_dir') {
        const path = params.directory_path || params.relative_workspace_path || '.';
        // Count the number of files/directories in the result if available
        let itemCount = 'unknown';
        if (result.success && Array.isArray(result.contents)) {
          itemCount = result.contents.length.toString();
          const dirCount = result.contents.filter((item: any) => item.type === 'directory').length;
          const fileCount = result.contents.length - dirCount;
          return `Listed directory [${path}]: Found ${dirCount} directories, ${fileCount} files`;
        }
        return `Listed directory [${path}]: ${result.success ? 'Success' : 'Failed'}`;
      } 
      else if (toolName === 'read_file') {
        const path = params.target_file || params.file_path || '';
        let lineCount = 'unknown';
        // Try to count lines in the content if available
        if (result.content) {
          lineCount = (result.content.match(/\n/g) || []).length + 1;
          return `Read file [${path}]: ${lineCount} lines`;
        }
        return `Read file [${path}]: ${result.success ? 'Success' : 'Failed'}`;
      }
      else if (toolName === 'grep_search') {
        const query = params.query || '';
        const pattern = params.include_pattern || '*';
        let matchCount = 'unknown';
        if (result.matches && Array.isArray(result.matches)) {
          matchCount = result.matches.length;
          return `Searched files [${query}]: Found ${matchCount} matches in ${pattern}`;
        }
        return `Searched files [${query}]: ${result.success ? 'Success' : 'Failed'}`;
      }
      else if (toolName === 'web_search') {
        const query = params.search_term || params.query || '';
        let resultCount = 'unknown';
        if (result.results && Array.isArray(result.results)) {
          resultCount = result.results.length;
          return `Searched web [${query}]: Found ${resultCount} results`;
        }
        return `Searched web [${query}]: ${result.success ? 'Success' : 'Failed'}`;
      }
      else if (toolName === 'fetch_webpage') {
        const url = params.url || '';
        const contentType = result.content_type || 'unknown';
        return `Fetched webpage [${url}]: ${result.success ? 'Success' : 'Failed'} (${contentType})`;
      }
      else if (toolName === 'run_terminal_cmd') {
        const command = params.command || '';
        const exitCode = result.return_code !== undefined ? result.return_code : 'unknown';
        const executionTime = result.execution_time ? `${result.execution_time}s` : 'unknown';
        return `Ran command [${command}]: ${result.success ? 'Success' : 'Failed'} (exit code: ${exitCode}, time: ${executionTime})`;
      }
      else if (toolName === 'create_file') {
        const path = params.file_path || '';
        const lines = result.lines || 'unknown';
        const size = result.size || 'unknown';
        return `Created file [${path}]: ${result.success ? 'Success' : 'Failed'} (${lines} lines, ${size} bytes)`;
      }
      else if (toolName === 'edit_file') {
        const path = params.file_path || '';
        const operation = result.operation || 'edit';
        const originalLines = result.original_lines || 'unknown';
        const newLines = result.new_lines || 'unknown';
        return `Edited file [${path}]: ${result.success ? 'Success' : 'Failed'} (${operation}, ${originalLines}→${newLines} lines)`;
      }
      else if (toolName === 'delete_file') {
        const path = params.file_path || '';
        return `Deleted file [${path}]: ${result.success ? 'Success' : 'Failed'}`;
      }
      else if (toolName === 'move_file') {
        const source = params.source_path || '';
        const dest = params.destination_path || '';
        return `Moved file [${source} → ${dest}]: ${result.success ? 'Success' : 'Failed'}`;
      }
      else if (toolName === 'copy_file') {
        const source = params.source_path || '';
        const dest = params.destination_path || '';
        const size = result.size || 'unknown';
        return `Copied file [${source} → ${dest}]: ${result.success ? 'Success' : 'Failed'} (${size} bytes)`;
      }
      // Default format for other tools
      return `Used ${toolName.replace(/_/g, ' ')}: ${result.success === false ? 'Failed' : 'Success'}`;
    } catch (e) {
      console.error('Error formatting tool result title:', e);
      return `Used ${toolName}: Result`;
    }
  }

  /**
   * Save the current chat state
   * This is called before making a tool call to ensure the chat is preserved
   */
  private async saveCurrentChat(): Promise<void> {
    // No longer disabled - actively save chat before tool execution
    // Try multiple selectors to find the chat component
    const selectors = [
      '.llm-chat-container',
      '.chat-container',
      '[data-chat-container]'
    ];
    
    let chatComponent = null;
    for (const selector of selectors) {
      const component = document.querySelector(selector) as any;
      if (component && component.saveBeforeToolExecution) {
        chatComponent = component;
        break;
      }
    }
    
    if (chatComponent && chatComponent.saveBeforeToolExecution) {
      try {
        await chatComponent.saveBeforeToolExecution();
        console.log('Successfully saved chat before tool execution');
      } catch (error) {
        console.error('Failed to save chat before tool execution:', error);
      }
    } else {
      console.log('Chat component not available for saving before tool execution');
      // Continue with tool execution even if we can't save the chat
    }
  }

  /**
   * Call a tool with parameters
   * @param toolName Name of the tool to call
   * @param params Tool parameters
   * @returns Tool execution result
   */
  async callTool(toolName: string, params: any): Promise<any> {
    try {
      // Use the setToolExecutionState static method for tracking
      ToolService.setToolExecutionState(true);
      
      // First, sanitize the tool name to prevent duplications
      const sanitizedToolName = this.sanitizeToolName(toolName);
      // Save chat before tool execution
      await this.saveCurrentChat();
      
      console.log(`Calling tool ${sanitizedToolName} with params:`, params);
      
      // Map to backend tool name consistently
      let backendToolName = ToolService.mapToolName(sanitizedToolName, 'to_backend');
      console.log(`Mapped tool name ${sanitizedToolName} -> ${backendToolName}`);

      // Normalize parameters for the backend
      const mappedParams = this.normalizeParamsForBackend(backendToolName, params);
      
      console.log(`Making API call to backend tool ${backendToolName} with params:`, mappedParams);
      // Debug: print full tool call payload clearly
      try {
        console.log('[TOOL DEBUG] Outgoing tool call:', JSON.stringify({
          tool_name: backendToolName,
          params: mappedParams
        }, null, 2));
      } catch {}
      
      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool_name: backendToolName,
          params: mappedParams
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to call tool: ${sanitizedToolName} - Status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Tool ${sanitizedToolName} result:`, result);
      
      // Format the response with consistent tool name for storage
      const storageToolName = sanitizedToolName; // Keep original name for consistent display
      
      // Create a detailed title for the tool result
      const detailedTitle = this.formatToolResultTitle(storageToolName, mappedParams, result);
      
      // Format the response in a flatter structure that's easier for the LLM to process
      return {
        role: 'tool',
        content: `${detailedTitle}\n${JSON.stringify(result, null, 2)}`,
        tool_call_id: this.generateToolCallId() // Add a unique ID for this tool call
      };
    } catch (error) {
      console.error(`Tool call failed: ${(error as Error).message}`);
      
      // Use the sanitized name for consistency in error messages too
      const errorToolName = this.sanitizeToolName(toolName);
      return { 
        role: 'tool',
        content: `Error from ${errorToolName}: ${(error as Error).message}`,
        tool_call_id: this.generateToolCallId() // Add a unique ID for this tool call
      };
    } finally {
      // Reset executing flag after tool call completes using the static method
      ToolService.setToolExecutionState(false);
    }
  }

  /**
   * Normalize parameters for backend tools to ensure expected keys are present
   */
  private normalizeParamsForBackend(backendToolName: string, params: any): any {
    const p = { ...(params || {}) };

    if (backendToolName === 'list_directory') {
      // Prefer explicit directory_path; support relative_workspace_path and file_path fallbacks
      if (!p.directory_path) {
        if (p.relative_workspace_path) p.directory_path = p.relative_workspace_path;
        else if (p.file_path) p.directory_path = p.file_path;
      }
      // Remove aliases to avoid backend "unexpected keyword" errors
      delete p.relative_workspace_path;
      delete p.file_path;
    }

    if (backendToolName === 'read_file') {
      // Prefer target_file; support file_path and directory_path fallbacks
      if (!p.target_file) {
        if (p.file_path) p.target_file = p.file_path;
        else if (p.directory_path) p.target_file = p.directory_path;
      }
      delete p.file_path;
      delete p.directory_path;
    }

    if (backendToolName === 'edit_file') {
      // Coalesce file path parameter
      if (!p.target_file) {
        if (p.file_path) p.target_file = p.file_path;
        else if (p.path) p.target_file = p.path;
      }
      // Coalesce line numbers (support camelCase and strings)
      const sl = p.start_line ?? p.startLine;
      const el = p.end_line ?? p.endLine;
      if (sl != null) p.start_line = Number(sl);
      if (el != null) p.end_line = Number(el);
      // Coalesce new content
      if (p.new_content == null) {
        if (p.newContent != null) p.new_content = p.newContent;
        else if (p.content != null) p.new_content = p.content;
      }
      // Normalize append to boolean
      if (p.append != null) {
        if (typeof p.append === 'string') p.append = p.append.toLowerCase() === 'true';
        else p.append = Boolean(p.append);
      }
      // Clean aliases
      delete p.file_path;
      delete p.path;
      delete p.startLine;
      delete p.endLine;
      delete p.newContent;
      delete p.content;
    }

    // run_terminal_cmd: ensure timeout is a number
    if (backendToolName === 'run_terminal_cmd') {
      if (p.timeout != null) p.timeout = Number(p.timeout);
    }

    return p;
  }

  /**
   * Sanitize tool name to prevent duplications
   * @param toolName The original tool name that might have duplications
   * @returns Sanitized tool name
   */
  private sanitizeToolName(toolName: string): string {
    // Check for duplicated tool names
    if (toolName.includes('list_dir') && toolName.includes('list_directory')) {
      console.warn('Found duplicated tool name pattern:', toolName);
      return 'list_dir'; // Return normalized name
    }
    
    // Check for other common duplications
    const duplicatePatterns = [
      { check: /list_directory.*list_directory/i, replace: 'list_directory' },
      { check: /list_dir.*list_dir/i, replace: 'list_dir' },
      { check: /read_file.*read_file/i, replace: 'read_file' },
      { check: /grep_search.*grep_search/i, replace: 'grep_search' }
    ];
    
    for (const pattern of duplicatePatterns) {
      if (pattern.check.test(toolName)) {
        console.warn('Found duplicated tool name pattern:', toolName);
        return pattern.replace;
      }
    }
    
    return toolName;
  }

  /**
   * Get a list of available tools
   * @returns List of available tools with schema
   */
  async getAvailableTools(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get tool list - Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get tools: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Generate a unique ID for tool calls
   * @returns A pseudo-random string ID
   */
  private generateToolCallId(): string {
    return Math.floor(Math.random() * 1000000000).toString();
  }
}

// Create a singleton instance
const toolServiceInstance = new ToolService();

// Add static methods to the instance to make them accessible
(toolServiceInstance as any).isExecutingTool = () => {
  return ToolService.isToolExecutionInProgress();
};

// Add getConsistentToolName as a static method on the instance
(toolServiceInstance as any).getConsistentToolName = (toolName: string, context: 'frontend' | 'backend' | 'storage'): string => {
  if (context === 'backend') {
    return ToolService.mapToolName(toolName, 'to_backend');
  } else {
    return ToolService.mapToolName(toolName, 'to_frontend');
  }
};

// Export the instance with added static methods
export default toolServiceInstance; 