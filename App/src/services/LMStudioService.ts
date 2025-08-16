import { cleanAIResponse } from '../utils/textUtils';
import { Message } from '../types';
import { AIFileService } from './AIFileService';
import { ToolService } from './ToolService';

// Extend Message type to include tool_calls for internal use in this service
interface ExtendedMessage extends Message {
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number | null;
  stream?: boolean;
  onStream?: (content: string) => void;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface StreamingChatCompletionOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number | null;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: any[]; // Tool definitions array
  tool_choice?: string | object; // Tool choice parameter
  purpose?: 'chat' | 'insert' | 'autocompletion' | 'summary' | 'agent'; // Add purpose parameter
  signal?: AbortSignal; // Add signal for request cancellation
  onUpdate: (content: string) => void;
}

interface CompletionOptions {
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number | null;
  stop?: string[];
  suffix?: string;
  purpose?: 'chat' | 'insert' | 'autocompletion' | 'summary';
}

interface CompletionResponse {
  choices: {
    text: string;
    index: number;
    finish_reason: string;
  }[];
}

class LMStudioService {
  // Gets the full API endpoint for a specific purpose
  private lastToolCallExtraction: number = 0; // Track the last time we extracted a tool call
  private async getApiEndpoint(purpose: 'chat' | 'insert' | 'autocompletion' | 'summary' | 'agent'): Promise<string> {
    try {
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);
      if (!modelConfig.apiEndpoint) {
        throw new Error(`No API endpoint configured for purpose: ${purpose}`);
      }
      
      let apiEndpoint = modelConfig.apiEndpoint;
      
      // Format the endpoint URL correctly
      if (!apiEndpoint.endsWith('/v1')) {
        apiEndpoint = apiEndpoint.endsWith('/') 
          ? `${apiEndpoint}v1` 
          : `${apiEndpoint}/v1`;
      }
      
      console.log(`Using API endpoint for ${purpose}: ${apiEndpoint}`);
      return apiEndpoint;
    } catch (error) {
      console.error(`Error getting API endpoint for ${purpose}:`, error);
      throw new Error(`Failed to get API endpoint for ${purpose}: ${error}`);
    }
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { onStream, ...requestOptions } = options;
    const purpose = 'chat';
    
    try {
      // Get full model configuration including fallbacks
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);
      console.log(`Attempting to connect to API at: ${modelConfig.apiEndpoint}`);

      // Use fallback endpoints if available
      const endpointsToTry = modelConfig.fallbackEndpoints || [modelConfig.apiEndpoint];
      let lastError: Error | null = null;
      
      for (const baseEndpoint of endpointsToTry) {
        try {
          // Format the endpoint URL correctly
          let baseUrl = baseEndpoint;
          if (!baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.endsWith('/') 
              ? `${baseUrl}v1` 
              : `${baseUrl}/v1`;
          }

          console.log(`Trying endpoint: ${baseUrl}`);
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(modelConfig.apiKey && { 'Authorization': `Bearer ${modelConfig.apiKey}` })
            },
            body: JSON.stringify({
              ...requestOptions,
              temperature: options.temperature ?? 0.7,
              ...(options.max_tokens !== null && options.max_tokens !== undefined && options.max_tokens > 0 ? { max_tokens: options.max_tokens } : {}),
              stream: true
            })
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`LM Studio API error (${response.status}): ${text}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const newContent = data.choices[0]?.delta?.content || '';
                    fullContent += newContent;
                    onStream?.(fullContent);
                  } catch (e) {
                    console.warn('Failed to parse streaming response:', e);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          // Clean up any markdown code blocks in the response before returning
          const cleanedContent = cleanAIResponse(fullContent);

          return {
            choices: [{
              message: {
                content: cleanedContent
              }
            }]
          };
        } catch (error) {
          console.error(`Error with endpoint ${baseEndpoint}:`, error);
          lastError = error as Error;
          // Continue to next endpoint
        }
      }
      
      // If we've tried all endpoints and none worked, throw the last error
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('All endpoints failed but no error was captured');
      }
    } catch (error) {
      console.error('Error in createChatCompletion:', error);
      throw error;
    }
  }

  async createStreamingChatCompletion(options: StreamingChatCompletionOptions): Promise<void> {
    const {
      model,
      messages,
      temperature = 0.7,
      max_tokens = null,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      tools,
      tool_choice,
      purpose = 'chat', // Default to 'chat' if not provided
      signal, // Extract the abort signal
      onUpdate
    } = options;
    
    // Create a wrapper for onUpdate that will detect and parse function calls
    const onUpdateWithFunctionCallDetection = (content: string) => {
      // Try to detect function calls in the content
      const detectedFunctionCall = this.detectFunctionCallInContent(content);
      if (detectedFunctionCall) {
        console.log('Detected function call in content update:', detectedFunctionCall);
        
        // Create a properly formatted function call
        let functionName = detectedFunctionCall.name;
        let functionArgs = detectedFunctionCall.arguments;
        
        // Fix common tool name issues (e.g., list_dir vs list_directory)
        if (functionName === 'list_dir') {
          functionName = 'list_directory';
        }
        
        // Make sure arguments is a proper JSON string
        if (typeof functionArgs === 'string') {
          try {
            // If it's already a valid JSON string, parse and stringify it to ensure proper format
            const parsedArgs = JSON.parse(functionArgs);
            functionArgs = JSON.stringify(parsedArgs);
          } catch (e) {
            // If it's not valid JSON, try to fix it
            console.warn('Invalid JSON arguments:', functionArgs);
            functionArgs = '{}';
          }
        } else if (typeof functionArgs === 'object') {
          functionArgs = JSON.stringify(functionArgs);
        } else {
          functionArgs = '{}';
        }
        
        // Create the formatted function call string
        const formattedFunctionCall = `function_call: {"id":"tool-${Date.now()}","name":"${functionName}","arguments":${functionArgs}}`;
        
        // Update the content with the formatted function call
        const contentWithFormattedCall = content.replace(/function_call\s*:\s*{[\s\S]*?}\s*$/, '').trim() + '\n\n' + formattedFunctionCall;
        
        // Call onUpdate with the new content
        onUpdate(contentWithFormattedCall);
        return;
      }
      
      // If no function call detected, just call the original onUpdate
      onUpdate(content);
    };
    
    try {
      // Get the endpoint based on provided purpose
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);
      console.log(`Attempting to connect to API at: ${modelConfig.apiEndpoint} for purpose: ${purpose}`);

      if (!messages || messages.length === 0) {
        throw new Error('Messages array is required and cannot be empty');
      }

      // Use fallback endpoints if available
      const endpointsToTry = modelConfig.fallbackEndpoints || [modelConfig.apiEndpoint];
      let lastError: Error | null = null;
      
      for (const baseEndpoint of endpointsToTry) {
        try {
          // Format the endpoint URL correctly
          let baseUrl = baseEndpoint;
          if (!baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.endsWith('/') 
              ? `${baseUrl}v1` 
              : `${baseUrl}/v1`;
          }

          console.log(`Trying endpoint: ${baseUrl}`);

          // Process messages to remove thinking tags and ensure consistent tool naming
          let processedMessages = this.processMessages(messages);
          
          // Apply limits to prevent oversized payloads
          let trimmedMessages = this.applyMessageLimits(processedMessages);
          
          // Extra safety check for unresponded tool calls
          trimmedMessages = this.ensureAllToolCallsHaveResponses(trimmedMessages);
          
          const requestBody: any = {
            model,
            messages: trimmedMessages,
            temperature,
            ...(max_tokens !== null && max_tokens !== undefined && max_tokens > 0 ? { max_tokens } : {}),
            top_p,
            frequency_penalty,
            presence_penalty,
            stream: true,
          };

          // Add tools and tool_choice if provided
          if (tools && tools.length > 0) {
            requestBody.tools = this.processToolDefinitions(tools);
            if (tool_choice) {
              requestBody.tool_choice = tool_choice;
            }
          }

          // Enhanced debug logging with less verbosity
          this.logApiRequest(baseUrl, requestBody);

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              ...(modelConfig.apiKey && { 'Authorization': `Bearer ${modelConfig.apiKey}` })
            },
            body: JSON.stringify(requestBody),
            signal: signal
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }

          // Process the streaming response
          await this.processStreamingResponse(response, onUpdateWithFunctionCallDetection);
          
          // If we get here, the request succeeded, so we can return
          return;
        } catch (error) {
          console.error(`Error with endpoint ${baseEndpoint}:`, error);
          lastError = error as Error;
          // Continue to next endpoint
        }
      }
      
      // If we've tried all endpoints and none worked, throw the last error
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('All endpoints failed but no error was captured');
      }
    } catch (error) {
      console.error('Error in createStreamingChatCompletion:', error);
      throw error;
    }
  }

  /**
   * Ensure all tool calls have responses - this is a final safety check
   * before sending the request to OpenAI
   */
  private ensureAllToolCallsHaveResponses(messages: Message[]): Message[] {
    // Track tool calls and their responses
    const toolCallsMap = new Map<string, boolean>();
    
    // First identify all tool calls from assistant messages
    messages.forEach((msg: any) => {
      if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
        msg.tool_calls.forEach((tc: any) => {
          if (tc.id) {
            toolCallsMap.set(tc.id, false); // Initialize as not having a response
          }
        });
      }
    });
    
    // Then mark which ones have responses
    messages.forEach((msg: any) => {
      if (msg.role === 'tool' && msg.tool_call_id && toolCallsMap.has(msg.tool_call_id)) {
        toolCallsMap.set(msg.tool_call_id, true);
      }
    });
    
    // Check if any tool calls don't have responses
    let hasUnrespondedCalls = false;
    toolCallsMap.forEach((hasResponse, id) => {
      if (!hasResponse) {
        console.log(`Final check: Unresponded tool call ID: ${id}`);
        hasUnrespondedCalls = true;
      }
    });
    
    // If any unresponded tool calls, we need to fix
    if (hasUnrespondedCalls) {
      console.log("Fixing unresponded tool calls - removing assistant messages with unresponded calls");
      
      // We'll either modify assistant messages or create new tool responses
      // Strategy: Remove any assistant message with tool_calls that don't all have responses
      return messages.filter((msg: any, index: number) => {
        // Only check assistant messages with tool_calls
        if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          // Check if all tool calls in this message have responses
          const allHaveResponses = msg.tool_calls.every((tc: any) => 
            tc.id ? toolCallsMap.get(tc.id) : true
          );
          
          if (!allHaveResponses) {
            console.log(`Removing assistant message at index ${index} with unresponded tool calls`);
            return false; // Remove this message
          }
        }
        
        return true; // Keep all other messages
      });
    }
    
    // No issues, return original messages
    return messages;
  }

  /**
   * Validates and fixes tool call parameters based on the tool name
   */
  private validateAndFixToolCallParameters(toolCall: any): any {
    if (!toolCall || !toolCall.function) return toolCall;
    
    const toolName = toolCall.function.name || '';
    let params: any = {};
    
    // Parse arguments
    try {
      // Handle arguments as string or object
      if (typeof toolCall.function.arguments === 'string') {
        // Try to fix common issues with JSON string arguments
        let argsStr = toolCall.function.arguments.trim();
        
        // Handle escaped quotes in arguments
        argsStr = argsStr
          .replace(/\\"/g, '"')  // Replace escaped quotes with actual quotes
          .replace(/\\\\"/g, '\\"'); // Fix double escaped quotes
        
        // Handle unquoted property names
        argsStr = argsStr.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
        
        console.log(`Processed arguments string: ${argsStr}`);
        
        // Try parsing the fixed arguments string
        try {
          params = JSON.parse(argsStr);
          console.log('Successfully parsed arguments:', params);
        } catch (parseError) {
          // If parsing still fails, try a simpler approach with fixed keys
          console.warn('Failed to parse arguments JSON, using fallbacks:', parseError);
          
          // Handle specific tool arguments
          if (toolName === 'list_directory' || toolName === 'list_dir') {
            const dirMatch = argsStr.match(/"?directory_path"?\s*:\s*"([^"]+)"/);
            if (dirMatch && dirMatch[1]) {
              params = { directory_path: dirMatch[1] };
            } else {
              params = { directory_path: '.' }; // Default to current directory
            }
          } else if (toolName === 'read_file') {
            const fileMatch = argsStr.match(/"?target_file"?\s*:\s*"([^"]+)"/);
            if (fileMatch && fileMatch[1]) {
              params = { target_file: fileMatch[1] };
            } else {
              params = {}; // Empty params for read_file
            }
          } else {
            params = {}; // Default empty params
          }
        }
      } else {
        // Arguments is already an object
        params = toolCall.function.arguments || {};
      }
    } catch (e) {
      console.warn('Failed to parse tool arguments:', e);
      params = {};
    }
    
    console.log(`Tool parameters before fixing: ${JSON.stringify(params)}`);
    
    // Fix parameters based on tool name
    let fixedParams = {...params};
    let fixedToolName = toolName;
    
    // If tool name is empty, try to infer it from parameters
    if (!fixedToolName || fixedToolName === '') {
      console.log('Tool name is empty, trying to infer from parameters:', params);
      
      if (params.directory_path || params.relative_workspace_path) {
        fixedToolName = 'list_directory';
        console.log('Inferred tool name as list_directory from directory parameters');
      } else if (params.file_path) {
        // Check if file_path looks like a directory
        const filePath = params.file_path;
        const isDirectory = filePath.endsWith('\\') || 
                           filePath.endsWith('/') || 
                           !filePath.includes('.') ||
                           filePath.includes('Documents') ||
                           filePath.includes('Users') ||
                           filePath.includes('TestFolder');
        
        if (isDirectory) {
          fixedToolName = 'list_directory';
          console.log('Inferred tool name as list_directory from file_path that looks like directory');
        } else {
          fixedToolName = 'read_file';
          console.log('Inferred tool name as read_file from file_path that looks like file');
        }
      } else if (params.target_file) {
        fixedToolName = 'read_file';
        console.log('Inferred tool name as read_file from target_file parameter');
      } else {
        console.warn('Could not infer tool name from parameters, defaulting to list_directory');
        fixedToolName = 'list_directory';
      }
    }
    
    // Check for parameter mismatches and fix them
    if (toolName === 'read_file' && params.directory_path && !params.target_file) {
      // If read_file is used with directory_path, it's likely meant to be list_directory
      console.log('Detected parameter mismatch: read_file with directory_path');
      fixedToolName = 'list_directory';
    } else if (toolName === 'read_file' && params.file_path && !params.target_file) {
      // Check if file_path looks like a directory path
      const filePath = params.file_path;
      const isDirectory = filePath.endsWith('\\') || 
                         filePath.endsWith('/') || 
                         !filePath.includes('.') ||
                         filePath.includes('Documents') ||
                         filePath.includes('Users') ||
                         filePath.includes('TestFolder');
      
      if (isDirectory) {
        console.log('Detected parameter mismatch: read_file with file_path that looks like directory:', filePath);
        fixedToolName = 'list_directory';
        fixedParams = {
          directory_path: filePath
        };
      } else {
        console.log('Converting file_path to target_file for read_file');
        fixedParams = {
          target_file: params.file_path
        };
      }
    } else if ((toolName === 'list_dir' || toolName === 'list_directory') && params.file_path) {
      // If list_directory is used with file_path, check if it's actually a file
      const filePath = params.file_path;
      const isFile = filePath.includes('.') && 
                    !filePath.endsWith('\\') && 
                    !filePath.endsWith('/') &&
                    !filePath.includes('Documents') &&
                    !filePath.includes('Users');
      
      if (isFile) {
        console.log('Detected parameter mismatch: list_directory with file_path that looks like file. Converting to read_file.');
      fixedToolName = 'read_file';
      fixedParams = {
        target_file: params.file_path
      };
      } else {
        console.log('Converting file_path to directory_path for list_directory');
        fixedParams = {
          directory_path: params.file_path
        };
      }
    } else if (toolName === 'list_dir' || toolName === 'list_directory') {
      // Make sure list_directory uses directory_path
      if (params.relative_workspace_path && !params.directory_path) {
        fixedParams.directory_path = params.relative_workspace_path;
        delete fixedParams.relative_workspace_path;
      }
      
      // Ensure directory_path has a value (default to '.' if missing)
      if (!fixedParams.directory_path) {
        fixedParams.directory_path = '.';
      }
      
      // Always use list_directory on the backend
      fixedToolName = 'list_directory';
      console.log('Fixed tool name to list_directory');
    } else if (toolName === 'read_file') {
      // Make sure read_file uses target_file
      if (params.directory_path && !params.target_file) {
        fixedParams.target_file = params.directory_path;
        delete fixedParams.directory_path;
      }
      
      // Also handle file_path parameter
      if (params.file_path && !params.target_file) {
        fixedParams.target_file = params.file_path;
        delete fixedParams.file_path;
      }
      
      // Ensure target_file exists
      if (!fixedParams.target_file) {
        console.warn('No target_file parameter for read_file');
      }
    }
    
    console.log(`Tool parameters after fixing: ${JSON.stringify(fixedParams)}`);
    
    // Update the tool call with fixed parameters
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        name: fixedToolName,
        arguments: JSON.stringify(fixedParams)
      }
    };
  }

  /**
   * Process messages to clean up thinking tags and ensure consistent tool naming
   */
  private processMessages(messages: Message[]): Message[] {
    // Log the messages being processed to help diagnose issues
    console.log(`Processing ${messages.length} messages for tool calls`);
    
    // Try to extract function calls with multiple patterns
    const detectFunctionCalls = (content: string): string[] => {
      const patterns = [
        // Standard pattern
        /function_call\s*:\s*({[\s\S]*?})(?:\s*$|\s*\n)/g,
        // Tool format pattern
        /<function_calls>[\s\S]*?<\/antml:function_calls>/g,
        // More lenient pattern
        /function_call[^{]*({.*})/g,
        // Claude format pattern
        /<invoke[^>]*>[\s\S]*?<\/antml:invoke>/g,
      ];
      
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`Found ${matches.length} function calls with pattern ${pattern}`);
          return matches;
        }
      }
      return [];
    };

    let toolCallCount = 0;
    
    // First, log all messages to diagnose the issue
    messages.forEach((msg, index) => {
      console.log(`Message ${index}: role=${msg.role}, length=${typeof msg.content === 'string' ? msg.content.length : 'non-string'}`);
      if (msg.role === 'tool' && msg.tool_call_id) {
        console.log(`  Tool response to call ID: ${msg.tool_call_id}`);
        
        // Enhance specific error message for clearer guidance
        if (typeof msg.content === 'string' && 
            msg.content.includes("Error executing tool list_directory: list_directory() got an unexpected keyword argument 'file_path'")) {
          
          console.log("Enhancing error message with suggestion to use read_file");
          
          // Add helpful suggestion to the error message
          msg.content = msg.content.replace(
            "Error executing tool list_directory: list_directory() got an unexpected keyword argument 'file_path'",
            "Error executing tool list_directory: list_directory() got an unexpected keyword argument 'file_path'. Did you mean to use read_file(file_path) instead? Use list_directory with directory_path or relative_workspace_path."
          );
        }
      }
    });

    // Track tool calls and responses to ensure proper structure
    const toolCallIds = new Set<string>();
    const toolResponseIds = new Set<string>();
    const fixedMessages: ExtendedMessage[] = [];

    // First, collect all tool response IDs
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.tool_call_id) {
        toolResponseIds.add(msg.tool_call_id);
      }
    }

    // Now process messages and fix issues
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as ExtendedMessage;
      
      // For assistant messages with tool_calls, ensure each tool_call has a response
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // Filter out tool calls that don't have responses
        let validToolCalls = msg.tool_calls.filter(toolCall => {
          if (toolCall.id && !toolResponseIds.has(toolCall.id)) {
            console.log(`Found assistant message with tool_call ID ${toolCall.id} that has no response. Removing.`);
            return false;
          }
          return true;
        });
        
        // If all tool calls were invalid and filtered out, skip this message
        if (validToolCalls.length === 0) {
          console.log('All tool calls were invalid, skipping this assistant message');
          continue;
        }
        
        // Update the message with only valid tool calls
        msg.tool_calls = validToolCalls;
        
        // Add valid tool call IDs to our tracking set
        validToolCalls.forEach(tc => {
          if (tc.id) {
            toolCallIds.add(tc.id);
          }
        });
        
        // Add the fixed message
        fixedMessages.push(msg);
      }
      // For tool messages, check if there's a matching tool_call_id
      else if (msg.role === 'tool' && msg.tool_call_id) {
        const toolCallId = msg.tool_call_id;
        
        // If we don't have a matching tool_call in an assistant message
        if (!toolCallIds.has(toolCallId)) {
          console.log(`Found tool message with ID ${toolCallId} without preceding tool_calls message. Adding one.`);
          
          // Create a synthetic assistant message with the proper tool_calls
          // Extract tool name from the tool response message
          let toolName = 'unknown_function';
          const toolNameMatch = typeof msg.content === 'string' ? 
            msg.content.match(/Tool ([a-z_]+) result:/) : null;
          
          if (toolNameMatch && toolNameMatch[1]) {
            toolName = toolNameMatch[1];
          }
          
          // Create the assistant message with tool_calls
          const assistantMessage: ExtendedMessage = {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: {
                name: toolName,
                arguments: '{}'
              }
            }]
          };
          
          // Add the assistant message before the tool message
          fixedMessages.push(assistantMessage);
          toolCallIds.add(toolCallId);
        }
        
        // Add the tool message
        fixedMessages.push(msg);
      }
      // For any other message type
      else {
        fixedMessages.push(msg);
      }
    }
    
    // Now do a final pass to ensure all tool calls have responses
    const finalMessages: ExtendedMessage[] = [];
    const seenToolCallIds = new Set<string>();
    
    for (let i = 0; i < fixedMessages.length; i++) {
      const msg = fixedMessages[i];
      
      // Add this message to our final list
      finalMessages.push(msg);
      
      // If this is an assistant message with tool_calls
      if (msg.role === 'assistant' && msg.tool_calls) {
        // Check if each tool call has a corresponding tool response
        for (const toolCall of msg.tool_calls) {
          if (!toolCall.id) continue;
          
          // Skip if we've already seen this tool call id
          if (seenToolCallIds.has(toolCall.id)) continue;
          seenToolCallIds.add(toolCall.id);
          
          // Check if there's a response for this tool call
          const hasResponse = fixedMessages.some((m, index) => 
            index > i && m.role === 'tool' && m.tool_call_id === toolCall.id
          );
          
          // If there's no response, add a dummy response
          if (!hasResponse) {
            console.log(`Adding dummy tool response for tool call ID: ${toolCall.id}`);
            
            const toolName = toolCall.function?.name || 'unknown_function';
            
            const dummyResponse: ExtendedMessage = {
              role: 'tool',
              content: `Tool ${toolName} result: {"success":false,"error":"No response available for this tool call"}`,
              tool_call_id: toolCall.id
            };
            
            // Add the dummy response right after the assistant message
            finalMessages.push(dummyResponse);
          }
        }
      }
    }
    
    // Now process the fixed messages
    const processedMessages = finalMessages.map(msg => {
      // Skip processing for non-assistant messages
      if (msg.role !== 'assistant') {
        return msg;
      }
      
      // Special handling for assistant messages that might contain thinking tags and function calls
      if (typeof msg.content === 'string') {
        const originalContent = msg.content;
        console.log(`Processing assistant message (${msg.content.length} chars):`);
        console.log(originalContent.substring(0, Math.min(500, originalContent.length)));
        
        // First, extract any function calls BEFORE removing thinking tags to preserve them
        // Try multiple detection patterns
        const functionCallMatches = detectFunctionCalls(originalContent);
        let functionCallData = null;
        
        if (functionCallMatches && functionCallMatches.length > 0) {
          toolCallCount += functionCallMatches.length;
          console.log(`Found ${functionCallMatches.length} function calls in message`);
          functionCallMatches.forEach((match, index) => {
            console.log(`Function call ${index+1}:`, match.substring(0, 100) + (match.length > 100 ? '...' : ''));
          });
          
          // Extract the last function call (most recent)
          const lastFunctionCall = functionCallMatches[functionCallMatches.length - 1];
          const jsonPart = lastFunctionCall.replace(/^function_call\s*:\s*/, '');
          
          console.log(`Found function call: ${jsonPart}`);
          
          try {
            // Try to parse the function call to validate it's proper JSON
            functionCallData = JSON.parse(jsonPart);
            console.log('Successfully parsed function call:', functionCallData);
            
            // If arguments is a string (which it often is), parse it too
            if (typeof functionCallData.arguments === 'string') {
              try {
                // Replace escaped quotes in arguments
                const fixedArgs = functionCallData.arguments
                  .replace(/\\"/g, '"')  // Replace escaped quotes
                  .replace(/\\\\"/g, '\\"'); // Fix double escaped quotes
                
                functionCallData.arguments = fixedArgs;
                console.log('Processed arguments:', fixedArgs);
              } catch (e) {
                console.warn('Could not process arguments string:', e);
              }
            }
          } catch (e) {
            console.warn('Failed to parse function call, will attempt repair:', e);
            
            // Try to repair the JSON
            try {
              // Handle escaped quotes in JSON
              const fixedJson = jsonPart
                .replace(/\\"/g, '"')  // Replace escaped quotes
                .replace(/\\\\"/g, '\\"'); // Fix double escaped quotes
              
              functionCallData = JSON.parse(fixedJson);
              console.log('Successfully repaired and parsed function call:', functionCallData);
            } catch (fixError) {
              console.error('Failed to repair JSON:', fixError);
              // Don't lose the original text even if we can't parse it
              functionCallData = jsonPart;
            }
          }
        } else {
          console.log('No function calls found with regex in this message');
          // Try a more lenient pattern as a backup
          const altRegex = /function_call[^{]*({.*})/;
          const altMatch = originalContent.match(altRegex);
          if (altMatch && altMatch[1]) {
            console.log('Found function call with alternate regex:', altMatch[1].substring(0, 100));
            toolCallCount += 1;
            
            // Try to parse this match too
            try {
              functionCallData = JSON.parse(altMatch[1]);
              console.log('Successfully parsed function call from alternate regex');
            } catch (e) {
              console.warn('Failed to parse alternate function call:', e);
              functionCallData = altMatch[1]; // Use the raw string
            }
          }
        }
        
        
        
        // Preserve thinking tags and content - only remove empty or malformed thinking blocks
        let cleanedContent = originalContent;
        
        // Check if content contains thinking tags
        const hasThinkingTags = /<think>.*?<\/think>/gi.test(originalContent);
        
        if (hasThinkingTags) {
          // Extract thinking content to preserve it
          const thinkingMatches = originalContent.match(/<think>([\s\S]*?)<\/think>/gi);
          if (thinkingMatches && thinkingMatches.length > 0) {
            console.log('Found thinking tags in content, preserving them');
            
            // Only remove thinking tags if they contain empty or invalid content
            // For now, preserve all thinking content as it might contain valid reasoning
            cleanedContent = originalContent;
          }
        }
        
        // Now add the function call back if it was present but was removed during cleanup
        if (functionCallData && !cleanedContent.includes('function_call:')) {
          console.log('Function call was removed during thinking tag cleanup, adding it back');
          
          // Format the function call properly
          let functionCallStr = '';
          if (typeof functionCallData === 'string') {
            // Handle the case where we couldn't parse it as JSON
            functionCallStr = `function_call: ${functionCallData}`;
          } else {
            // Properly formatted JSON object - validate and fix parameters
            const validatedCall = this.validateAndFixToolCallParameters({
              id: functionCallData.id || `function-call-${Date.now()}`,
              function: {
                name: functionCallData.name || '',
                arguments: functionCallData.arguments || '{}'
              }
            });
            
            functionCallStr = `function_call: ${JSON.stringify({
              id: validatedCall.id,
              name: validatedCall.function.name,
              arguments: validatedCall.function.arguments
            })}`;
          }
          
          cleanedContent = cleanedContent 
            ? `${cleanedContent}\n\n${functionCallStr}` 
            : functionCallStr;
          
          console.log(`Added function call back to content: ${functionCallStr}`);
        }
        
        // Return the processed message
        return {
          role: 'assistant',
          content: cleanedContent,
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
          ...(msg.tool_calls && { tool_calls: msg.tool_calls })
        };
      }
      
      return msg;
    }).map(msg => {
      // Now handle tool message renaming in a separate pass
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        // Ensure all tool results use consistent naming
        const backendToFrontendMap: { [key: string]: string } = {
          'list_directory': 'list_dir',
          'read_file': 'read_file',
          'web_search': 'web_search',
          'grep_search': 'grep_search',
          'fetch_webpage': 'fetch_webpage',
          'run_terminal_cmd': 'run_terminal_cmd',
        };
        
        // Extract tool name from content
        const toolNameMatch = msg.content.match(/Tool ([a-z_]+) result:/);
        if (toolNameMatch && toolNameMatch[1]) {
          const backendToolName = toolNameMatch[1];
          const frontendToolName = backendToFrontendMap[backendToolName] || backendToolName;
          
          console.log(`Converting tool name in response from ${backendToolName} to ${frontendToolName}`);
          
          return {
            ...msg,
            content: msg.content.replace(
              `Tool ${backendToolName} result:`, 
              `Tool ${frontendToolName} result:`
            )
          };
        }
      }
      
      return msg;
    }) as Message[]; // Add the type assertion to fix type error

    console.log(`Processed ${messages.length} messages with ${toolCallCount} tool calls detected`);
    return processedMessages;
  }
  
  /**
   * Apply size limits to messages to prevent oversized payloads
   */
  private applyMessageLimits(messages: Message[]): Message[] {
    // Check if payload is too large
    const payloadEstimate = JSON.stringify(messages).length;
    const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB max size
    
    if (payloadEstimate <= MAX_PAYLOAD_SIZE) {
      return messages;
    }
    
    console.warn(`Payload too large (${payloadEstimate} bytes), reducing message count`);
    
    // First, ensure we keep all system messages and tool messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const toolMessages = messages.filter(msg => msg.role === 'tool');
    
    // Keep user and assistant messages but limit their quantity
    const otherMessages = messages.filter(
      msg => msg.role !== 'system' && msg.role !== 'tool'
    );
    
    // Keep some user/assistant messages from the start 
    const startMessages = otherMessages.slice(0, 5);
    
    // And keep some from the end for recency
    const endMessages = otherMessages.slice(-10);
    
    // Combine them - ensure tool messages are included
    return [
      ...systemMessages,
      ...startMessages,
      {
        role: 'system',
        content: '... [Previous messages omitted for size] ...'
      },
      ...toolMessages, // Ensure tool messages are included
      ...endMessages
    ];
  }
  
  /**
   * Process tool definitions to ensure consistent naming
   */
  private processToolDefinitions(tools: any[]): any[] {
    // Define mapping from frontend to backend names
    const frontendToBackendMap: { [key: string]: string } = {
      'list_dir': 'list_directory',
      'read_file': 'read_file',
      'web_search': 'web_search',
      'grep_search': 'grep_search',
      'fetch_webpage': 'fetch_webpage',
      'run_terminal_cmd': 'run_terminal_cmd',
    };
    
    // Log the tools before processing
    console.log(`Processing ${tools.length} tool definitions`);
    tools.forEach((tool, index) => {
      if (tool.function && tool.function.name) {
        console.log(`Tool ${index}: ${tool.function.name}`);
      }
    });
    
    // First, check if we need to add any missing tools that might be in messages
    let toolNames = new Set(tools.map(tool => tool.function?.name).filter(Boolean));
    
    // Add missing required tools
        const requiredTools = ['read_file', 'delete_file', 'move_file', 'copy_file', 'list_directory', 'web_search', 'grep_search', 'fetch_webpage', 'run_terminal_cmd'];
    const missingTools = requiredTools.filter(name => !toolNames.has(name) && !toolNames.has(frontendToBackendMap[name]));
    
    if (missingTools.length > 0) {
      console.log(`Adding missing tools: ${missingTools.join(', ')}`);
      
      const additionalTools = missingTools.map(name => {
        if (name === 'grep_search') {
          return {
            type: "function",
            function: {
              name: "grep_search",
              description: "Search for a pattern in files",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "The pattern to search for"
                  },
                  include_pattern: {
                    type: "string",
                    description: "Optional file pattern to include (e.g. '*.ts')"
                  },
                  exclude_pattern: {
                    type: "string",
                    description: "Optional file pattern to exclude (e.g. 'node_modules')"
                  },
                  case_sensitive: {
                    type: "boolean",
                    description: "Whether the search should be case sensitive"
                  }
                },
                required: ["query"]
              }
            }
          };
        } else if (name === 'list_directory' || name === 'list_dir') {
          return {
            type: "function",
            function: {
              name: "list_directory",
              description: "List the contents of a directory",
              parameters: {
                type: "object",
                properties: {
                  directory_path: {
                    type: "string",
                    description: "The path to the directory to list"
                  }
                },
                required: ["directory_path"]
              }
            }
          };
        } else if (name === 'read_file') {
          return {
            type: "function",
            function: {
              name: "read_file",
              description: "Read the contents of a file",
              parameters: {
                type: "object",
                properties: {
                  target_file: {
                    type: "string",
                    description: "The path to the file to read"
                  }
                },
                required: ["target_file"]
              }
            }
          };
        } else if (name === 'delete_file') {
          return {
            type: "function",
            function: {
              name: "delete_file",
              description: "Delete a file",
              parameters: {
                type: "object",
                properties: {
                  file_path: {
                    type: "string",
                    description: "Path to the file to delete"
                  }
                },
                required: ["file_path"]
              }
            }
          };
        } else if (name === 'move_file') {
          return {
            type: "function",
            function: {
              name: "move_file",
              description: "Move or rename a file",
              parameters: {
                type: "object",
                properties: {
                  source_path: {
                    type: "string",
                    description: "Current path of the file"
                  },
                  destination_path: {
                    type: "string",
                    description: "New path for the file"
                  },
                  create_directories: {
                    type: "boolean",
                    description: "Whether to create parent directories if they don't exist (default: true)"
                  }
                },
                required: ["source_path", "destination_path"]
              }
            }
          };
        } else if (name === 'copy_file') {
          return {
            type: "function",
            function: {
              name: "copy_file",
              description: "Copy a file to a new location",
              parameters: {
                type: "object",
                properties: {
                  source_path: {
                    type: "string",
                    description: "Path of the file to copy"
                  },
                  destination_path: {
                    type: "string",
                    description: "Path where the copy should be created"
                  },
                  create_directories: {
                    type: "boolean",
                    description: "Whether to create parent directories if they don't exist (default: true)"
                  }
                },
                required: ["source_path", "destination_path"]
              }
            }
          };
        } else if (name === 'web_search') {
          return {
            type: "function",
            function: {
              name: "web_search",
              description: "Search the web",
              parameters: {
                type: "object",
                properties: {
                  search_term: {
                    type: "string",
                    description: "The search query"
                  },
                  num_results: {
                    type: "integer",
                    description: "Number of results to return (default: 3)"
                  }
                },
                required: ["search_term"]
              }
            }
          };
        } else if (name === 'fetch_webpage') {
          return {
            type: "function",
            function: {
              name: "fetch_webpage",
              description: "Fetch and extract content from a webpage",
              parameters: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "The URL of the webpage to fetch"
                  }
                },
                required: ["url"]
              }
            }
          };
        } else if (name === 'run_terminal_cmd') {
          return {
            type: "function",
            function: {
              name: "run_terminal_cmd",
              description: "Execute a terminal/console command and return the output. IMPORTANT: You MUST provide the 'command' parameter with the actual shell command to execute (e.g., 'ls -la', 'npm run build', 'git status'). This tool runs the command in a shell and returns stdout, stderr, and exit code.",
              parameters: {
                type: "object",
                properties: {
                  command: {
                    type: "string",
                    description: "REQUIRED: The actual shell command to execute. Examples: 'ls -la', 'npm install', 'python --version', 'git status'. Do not include shell operators like '&&' unless necessary."
                  },
                  working_directory: {
                    type: "string",
                    description: "Optional: The directory path where the command should be executed. If not provided, uses current working directory."
                  },
                  timeout: {
                    type: "integer",
                    description: "Optional: Maximum seconds to wait for command completion (default: 30). Use higher values for long-running commands."
                  }
                },
                required: ["command"]
              }
            }
          };
        }
        return null;
      }).filter(Boolean);
      
      tools = [...tools, ...additionalTools];
    }
    
    // Map tool names and parameter schemas to backend expectations
    return tools.map(tool => {
      if (tool.function && tool.function.name) {
        // Get frontend-compatible tool name
        const frontendName = tool.function.name;
        const backendName = frontendToBackendMap[frontendName] || frontendName;
        
        if (frontendName !== backendName) {
          console.log(`Mapping tool name from ${frontendName} to ${backendName}`);
        }

        const mapped = {
          ...tool,
          function: {
            ...tool.function,
            name: backendName
          }
        };

        // Normalize parameter schemas for consistency (e.g., list_directory expects directory_path)
        try {
          if (mapped.function?.name === 'list_directory' && mapped.function.parameters?.properties) {
            const props = mapped.function.parameters.properties;
            // Ensure directory_path exists; drop relative_workspace_path in schema
            if (!props.directory_path) {
              props.directory_path = { type: 'string', description: 'The path to the directory to list' };
            }
            delete props.relative_workspace_path;
          }
          if (mapped.function?.name === 'read_file' && mapped.function.parameters?.properties) {
            const props = mapped.function.parameters.properties;
            if (!props.target_file && props.file_path) {
              props.target_file = props.file_path;
            }
            delete props.file_path;
          }
        } catch {}
        
        return mapped;
      }
      return tool;
    });
  }
  
  /**
   * Log API request with limited verbosity
   */
  private logApiRequest(baseUrl: string, requestBody: any): void {
    // Add more detailed message inspection for debugging
    console.log('Detailed message inspection:');
    const messages = requestBody.messages || [];
    
    // Look for assistant messages with tool_calls and matching tool responses
    const toolCallMap = new Map<string, boolean>();
    
    // First collect all tool_call_ids from assistant messages
    messages.forEach((msg: any, idx: number) => {
      if (msg.role === 'assistant' && msg.tool_calls) {
        msg.tool_calls.forEach((tc: any) => {
          if (tc.id) {
            toolCallMap.set(tc.id, false); // Mark as not having response yet
            console.log(`Message ${idx}: Assistant with tool_call_id ${tc.id} (${tc.function?.name || 'unknown'})`);
          }
        });
      }
    });
    
    // Then check for tool messages responding to those IDs
    messages.forEach((msg: any, idx: number) => {
      if (msg.role === 'tool' && msg.tool_call_id) {
        console.log(`Message ${idx}: Tool response to tool_call_id ${msg.tool_call_id}`);
        if (toolCallMap.has(msg.tool_call_id)) {
          toolCallMap.set(msg.tool_call_id, true); // Mark as having response
        } else {
          console.log(`WARNING: Tool response at index ${idx} refers to non-existent tool_call_id: ${msg.tool_call_id}`);
        }
      }
    });
    
    // Check for unresponded tool calls
    let hasUnrespondedToolCalls = false;
    toolCallMap.forEach((hasResponse, id) => {
      if (!hasResponse) {
        console.log(`ERROR: Unresponded tool_call_id: ${id}`);
        hasUnrespondedToolCalls = true;
      }
    });
    
    if (hasUnrespondedToolCalls) {
      console.log('WARNING: Request has unresponded tool calls, which will cause OpenAI API errors');
    }

    // Original logging
    console.log('Final API request payload:', JSON.stringify({
      ...requestBody,
      messages: requestBody.messages.map((m: any, i: number) => ({
        index: i,
        role: m.role,
        tool_call_id: m.tool_call_id || undefined,
        tool_calls: m.tool_calls ? m.tool_calls.map((tc: any) => ({
          id: tc.id, 
          name: tc.function?.name,
          args_preview: tc.function?.arguments?.substring(0, 30) + '...'
        })) : undefined,
        content_preview: typeof m.content === 'string' ? 
          (m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content) : 
          '[Non-string content]'
      })),
      tools: requestBody.tools ? `[${requestBody.tools.length} tools included]` : 'undefined',
      tool_choice: requestBody.tool_choice || 'undefined',
      model: requestBody.model,
      endpoint: `${baseUrl}/chat/completions`,
      temperature: requestBody.temperature,
      stream: requestBody.stream
    }, null, 2));
  }
  
  /**
   * Process the streaming response from API
   */
  private async processStreamingResponse(response: Response, onUpdate: (content: string) => void): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null');
    }

    let buffer = '';
    let accumulatedContent = '';  // Keep track of all content
    let lastToolCallUpdateTime = Date.now();
    let partialToolCall: any = null; // To accumulate partial tool calls
    let processingToolCall = false; // Flag to track if we're currently processing a tool call
    
    // Add detection for function call formats
    const detectFunctionCallInText = (text: string): boolean => {
      const patterns = [
        /function_call\s*:/i,
        /<function_calls>/i,
        /<tool>/i,
        /<invoke/i
      ];
      
      return patterns.some(pattern => pattern.test(text));
    };
    
    // Set up a periodic check for tool calls that may be stuck
    const toolCallInterval = setInterval(() => {
      const now = Date.now();
      // If we have a partial tool call and it hasn't been updated in 1 second, flush it
      if (partialToolCall && (now - lastToolCallUpdateTime > 1000)) {
        console.log("Timeout - flushing incomplete tool call:", partialToolCall);
        this.flushToolCall(partialToolCall, onUpdate, accumulatedContent);
        partialToolCall = null;
      }
    }, 500);
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // When done, flush any remaining partial tool call
          if (partialToolCall) {
            console.log("End of stream - flushing incomplete tool call:", partialToolCall);
            this.flushToolCall(partialToolCall, onUpdate, accumulatedContent);
          }
          
          // Check for function call markers in the accumulated content
          if (!processingToolCall && detectFunctionCallInText(accumulatedContent)) {
            console.log('End of stream - detected function call in accumulated content');
            this.extractAndFlushFunctionCall(accumulatedContent, onUpdate);
          }
          break;
        }

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

          try {
            if (!line.startsWith('data: ')) continue;
            const jsonData = line.replace(/^data: /, '');
            const data = JSON.parse(jsonData);
            
            // Check if data and choices exist
            if (!data || !data.choices || !data.choices.length) {
              continue;
            }
            
            // Check for regular content
            const content = data.choices[0]?.delta?.content || '';
            if (content) {
              accumulatedContent += content;
              onUpdate(accumulatedContent);
            }
            
            // Check for tool calls in delta
            const deltaObj = data.choices[0]?.delta;
            if (!deltaObj) continue;
            
            const toolCalls = deltaObj.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              // Process tool call delta
              lastToolCallUpdateTime = Date.now(); // Update timestamp before processing
              
            // Initialize partial tool call if needed
              if (partialToolCall === null) {
                partialToolCall = {
                  id: toolCalls[0].id || `tool-call-${Date.now()}`,
                  type: toolCalls[0].type || 'function',
                  function: {
                    name: '',
                    arguments: ''
                  }
                };
              }
            
            // Process the delta and update the partial tool call
            partialToolCall = this.processToolCallDelta(toolCalls[0], partialToolCall, accumulatedContent, (toolCall, onUpdate, accumulatedContent) => this.flushToolCall(toolCall, onUpdate, accumulatedContent), onUpdate);
            }
          } catch (error) {
            console.error('Error processing line:', error);
          }
        }
        
        // After processing all lines, check for function calls in the accumulated content
        if (!processingToolCall && !partialToolCall && detectFunctionCallInText(accumulatedContent)) {
          // Don't process tool calls too frequently - use a timestamp check to debounce
          const now = Date.now();
          if (!this.lastToolCallExtraction || (now - this.lastToolCallExtraction) > 1000) {
            processingToolCall = true;
            console.log('Detected function call marker in accumulated content');
            this.lastToolCallExtraction = now;
            const extracted = this.extractAndFlushFunctionCall(accumulatedContent, onUpdate);
            if (extracted) {
              processingToolCall = false;
            }
          } else {
            console.log('Skipping function call detection, processed too recently:', now - this.lastToolCallExtraction, 'ms ago');
          }
        }
      }
    } finally {
      clearInterval(toolCallInterval);
    }
  }
  
  /**
   * Extract and flush function calls found in text content
   */
  private extractAndFlushFunctionCall(content: string, onUpdate: (content: string) => void): boolean {
    // Try different patterns to extract function call
    const patterns = [
      {
        pattern: /function_call\s*:\s*({[\s\S]*?})(?:\s*$|\s*\n)/,
        extractor: (match: RegExpMatchArray) => {
          try {
            const data = JSON.parse(match[1]);
            return {
              id: data.id || `function-call-${Date.now()}`,
              type: 'function',
              function: {
                name: data.name,
                arguments: data.arguments || '{}'
              }
            };
          } catch (e) {
            console.warn('Failed to parse function call:', e);
            return null;
          }
        }
      },
      {
        pattern: /function_call\s*:\s*\{.*?"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*({[\s\S]*?})\s*\}\s*$/m,
        extractor: (match: RegExpMatchArray) => ({
          id: `function-call-${Date.now()}`,
          type: 'function',
          function: {
            name: match[1],
            arguments: match[2].replace(/\\"/g, '"') || '{}'
          }
        })
      }
    ];
    
    for (const {pattern, extractor} of patterns) {
      const match = content.match(pattern);
      if (match) {
        console.log(`Found function call with pattern ${pattern}:`, match[1]);
        const toolCall = extractor(match);
        if (toolCall) {
          console.log('Extracted tool call:', toolCall);
          this.flushToolCall(toolCall, onUpdate, content);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Process a single tool call delta from the API
   */
  private processToolCallDelta(
    toolCallDelta: any, 
    partialToolCall: any, 
    accumulatedContent: string,
    flushCallback: (toolCall: any, onUpdate: (content: string) => void, accumulatedContent: string) => void,
    onUpdate: (content: string) => void
  ): any {
    if (!toolCallDelta) return null;
    
    // Initialize partial tool call if needed
    if (!partialToolCall) {
      partialToolCall = {
        id: toolCallDelta.id || `tool-call-${Date.now()}`,
        type: toolCallDelta.type || 'function',
        function: {
          name: '',
          arguments: ''
        }
      };
    }
    
    // Update the ID if it's now available
    if (toolCallDelta.id && !partialToolCall.id) {
      partialToolCall.id = toolCallDelta.id;
    }
    
    // Handle function property - it might be missing in some deltas
    if (toolCallDelta.function) {
      // Update function name if present in this delta
      if (toolCallDelta.function.name) {
        partialToolCall.function.name = 
          (partialToolCall.function.name || '') + toolCallDelta.function.name;
      }
      
      // Update function arguments if present in this delta
      if (toolCallDelta.function.arguments) {
        partialToolCall.function.arguments = 
          (partialToolCall.function.arguments || '') + toolCallDelta.function.arguments;
      }
    }
    
    // Check if the ID contains a tool name we can extract (like 'list_directory')
    if (!partialToolCall.function.name && partialToolCall.id) {
      if (partialToolCall.id.includes('list_directory')) {
        partialToolCall.function.name = 'list_directory';
      } else if (partialToolCall.id.includes('read_file')) {
        partialToolCall.function.name = 'read_file';
      }
    }
    
    // Log progress
    console.log(`Tool call progress: ID=${partialToolCall.id}, Name=${partialToolCall.function.name || "pending"}, Args=${partialToolCall.function.arguments?.length || 0} chars`);
    
    // Check if we have a complete function call with valid JSON arguments
    const hasValidName = !!partialToolCall.function.name && partialToolCall.function.name !== 'pending';
    const hasCompleteArgs = partialToolCall.function.arguments && 
                          partialToolCall.function.arguments.startsWith('{') && 
                          partialToolCall.function.arguments.endsWith('}');
    
    // Determine if we should flush the tool call
    const shouldFlush = partialToolCall.id && hasValidName && hasCompleteArgs;
    
    if (shouldFlush) {
      try {
        // Try to validate the arguments as JSON
        JSON.parse(partialToolCall.function.arguments);
        
        console.log('Flushing complete tool call:', {
          id: partialToolCall.id,
          name: partialToolCall.function.name,
          argsLength: partialToolCall.function.arguments.length
        });
        
        // Call the callback with the complete tool call
        flushCallback(partialToolCall, onUpdate, accumulatedContent);
      } catch (error: any) {
        // Arguments are not valid JSON yet
        console.log(`Arguments not valid JSON yet: ${error.message}`);
        
        // If arguments look complete but have JSON errors, try to fix them
        if (hasCompleteArgs) {
          try {
            const fixedArgs = this.attemptToFixJsonString(partialToolCall.function.arguments);
            partialToolCall.function.arguments = fixedArgs;
            
            // Check if our fix worked
            JSON.parse(fixedArgs);
            console.log('Fixed JSON arguments, flushing tool call');
            flushCallback(partialToolCall, onUpdate, accumulatedContent);
          } catch {
            // If arguments are still not valid JSON, wait for more data
            console.log("Waiting for complete tool call arguments");
          }
        }
      }
    }
    
    // Return the updated partial tool call
    return partialToolCall;
  }
  
  /**
   * Attempts to fix common JSON formatting issues in tool call arguments
   */
  private attemptToFixJsonString(jsonString: string): string {
    // Don't try to fix empty strings
    if (!jsonString || !jsonString.trim()) {
      return '{}';
    }
    
    try {
      // If it's already valid JSON, return it
      JSON.parse(jsonString);
      return jsonString;
    } catch (error) {
      console.log('Attempting to fix malformed JSON:', jsonString);
      
      let fixedJson = jsonString;
      
      // Fix common issues:
      
      // 1. Missing closing quotes on property names
      fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
      
      // 2. Missing quotes around string values
      fixedJson = fixedJson.replace(/:\s*([a-zA-Z0-9_\/\.\-]+)(\s*[,}])/g, ': "$1"$2');
      
      // 3. Replace single quotes with double quotes
      fixedJson = fixedJson.replace(/'/g, '"');
      
      // 4. Fix any trailing commas in objects
      fixedJson = fixedJson.replace(/,\s*}/g, '}');
      
      // 5. Fix any trailing commas in arrays
      fixedJson = fixedJson.replace(/,\s*\]/g, ']');
      
      // 6. Make sure object has opening and closing braces
      if (!fixedJson.trim().startsWith('{')) {
        fixedJson = '{' + fixedJson;
      }
      if (!fixedJson.trim().endsWith('}')) {
        fixedJson = fixedJson + '}';
      }
      
      // 7. Check if we need quotes around the entire thing
      if (fixedJson.includes('{') && !fixedJson.trim().startsWith('{')) {
        // Extract just the JSON part
        const jsonPart = fixedJson.substring(fixedJson.indexOf('{'));
        return jsonPart;
      }
      
      console.log('Fixed JSON:', fixedJson);
      return fixedJson;
    }
  }

  async createCompletion(options: CompletionOptions): Promise<CompletionResponse> {
    try {
      // Determine purpose for the API endpoint
      const purpose = options.purpose || 'insert';
      const baseUrl = await this.getApiEndpoint(purpose);
      
      console.log(`LM Studio: Sending completion request to ${baseUrl}/completions`);
      console.log('Request options:', {
        model: options.model,
        prompt: options.prompt.substring(0, 100) + '...', // Log the first 100 chars for debugging
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 100,
        stop: options.stop
      });

      const response = await fetch(`${baseUrl}/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          prompt: options.prompt,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.max_tokens ?? 100,
          stop: options.stop,
          suffix: options.suffix
        })
      }).catch(error => {
        console.error(`Network error connecting to ${baseUrl}: ${error.message}`);
        throw new Error(`Could not connect to AI service at ${baseUrl}. Please check your settings and ensure the service is running.`);
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`LM Studio API error (${response.status}):`, text);
        throw new Error(`LM Studio API error (${response.status}): ${text}`);
      }

      const data = await response.json();
      console.log('LM Studio: Completion response received:', data);
      return data;
    } catch (error) {
      console.error('Error in createCompletion:', error);
      throw error;
    }
  }

  private hasCompleteToolCall(buffer: string): boolean {
    // Check if the buffer contains a complete function call
    try {
      // Look for a pattern that indicates a complete function call
      const match = buffer.match(/function_call:\s*({[\s\S]*?})\s*(?=function_call:|$)/);
      if (!match) return false;
      
      // Extract the JSON part
      const jsonStr = match[1];
      if (!jsonStr) return false;
      
      // Try to parse the JSON to verify it's complete
      const parsedCall = JSON.parse(jsonStr);
      return !!(parsedCall && parsedCall.id && parsedCall.name);
    } catch (error) {
      // If parsing fails, it's not a complete call
      return false;
    }
  }

  private mapToolName(name: string, direction: 'frontend' | 'backend' | 'storage'): string {
    // Use the centralized mapping function from ToolService
    if (direction === 'frontend') {
      return ToolService.mapToolName(name, 'to_frontend');
    } else if (direction === 'backend') {
      return ToolService.mapToolName(name, 'to_backend');
    } else {
      // For storage, use the frontend name as that's what we use in the UI
      return ToolService.mapToolName(name, 'to_frontend');
    }
  }

  /**
   * Format and flush a complete tool call
   */
  private flushToolCall(toolCall: any, onUpdate: (content: string) => void, accumulatedContent: string): void {
    if (!toolCall || !toolCall.id) return;
    
    try {
      console.log('Raw tool call to flush:', JSON.stringify(toolCall));
      
      // If the function property doesn't exist or is incomplete, initialize it
      if (!toolCall.function) {
        toolCall.function = { name: '', arguments: '{}' };
      }
      
      toolCall.function.name = ToolService.mapToolName(toolCall.function.name, 'to_frontend');
      
      // Check for tool name in the arguments if it's a string
      if (toolCall.function.name === '' && typeof toolCall.function.arguments === 'string') {
        const argStr = toolCall.function.arguments;
        console.log('Detecting tool name from arguments:', argStr);
        
        // Parse arguments to check parameters
        try {
          const args = JSON.parse(argStr);
          console.log('Parsed arguments for tool detection:', args);
          
          // Check if it has directory_path or similar parameters
          if (args.directory_path || args.relative_workspace_path) {
            toolCall.function.name = 'list_dir';
            console.log('Detected list_dir from directory_path parameter');
          } 
          // Check if it has file_path parameter and the path is a directory
          else if (args.file_path) {
            // Check if file_path looks like a directory (common indicators)
            const isDirectory = args.file_path.endsWith('\\') || 
                               args.file_path.endsWith('/') || 
                               !args.file_path.includes('.') ||
                               args.file_path.includes('Documents') ||
                               args.file_path.includes('Users');
            
            if (isDirectory) {
              toolCall.function.name = 'list_dir';
              console.log('Detected list_dir from file_path that looks like directory:', args.file_path);
            } else {
              toolCall.function.name = 'read_file';
              console.log('Detected read_file from file_path that looks like file:', args.file_path);
            }
          }
          // Check if it has target_file parameter
          else if (args.target_file) {
            toolCall.function.name = 'read_file';
            console.log('Detected read_file from target_file parameter');
          }
        } catch (e) {
          console.warn('Failed to parse arguments for tool detection:', e);
          // Fallback to string-based detection
        if (argStr.includes('directory_path') || argStr.includes('relative_workspace_path')) {
          toolCall.function.name = 'list_dir';
          } else if (argStr.includes('file_path')) {
            // Check if it looks like a directory path
            if (argStr.includes('Documents') || argStr.includes('Users') || argStr.includes('\\\\')) {
              toolCall.function.name = 'list_dir';
            } else {
              toolCall.function.name = 'read_file';
            }
        } else if (argStr.includes('target_file')) {
          toolCall.function.name = 'read_file';
          }
        }
      }
      
      // Ensure we have valid arguments
      if (!toolCall.function.arguments) {
        toolCall.function.arguments = '{}';
      }
      
      // Try to parse and validate the arguments
      try {
        JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.warn('Arguments are not valid JSON, attempting to fix', e);
        toolCall.function.arguments = this.attemptToFixJsonString(toolCall.function.arguments);
      }
      
      // Validate and fix tool parameters
      let validatedToolCall = this.validateAndFixToolCallParameters(toolCall);
      
      
      // Get the consistent storage tool name
      const backendToolName = validatedToolCall.function.name || '';
      const storageToolName = this.mapToolName(backendToolName, 'storage');
      
      // Log the tool call
          console.log('FLUSHING COMPLETE TOOL CALL:', {
            id: validatedToolCall.id,
            name: storageToolName,
            args: validatedToolCall.function.arguments
          });
          try {
            console.log('[TOOL DEBUG] Finalized tool call for client:', JSON.stringify({
              id: validatedToolCall.id,
              name: storageToolName,
              arguments: JSON.parse(validatedToolCall.function.arguments || '{}')
            }, null, 2));
          } catch {
            console.log('[TOOL DEBUG] Finalized tool call for client:', {
              id: validatedToolCall.id,
              name: storageToolName,
              arguments: validatedToolCall.function.arguments
            });
          }
      
      // Format the tool call data for the client
      const formattedToolCall = `function_call: ${JSON.stringify({
        id: validatedToolCall.id,
        name: storageToolName,
        arguments: validatedToolCall.function.arguments || '{}'
      })}`;
      
      // Clear any existing function call in the accumulated content
      let updatedAccumulatedContent = accumulatedContent;
      if (updatedAccumulatedContent.includes('function_call:')) {
        const functionCallIndex = updatedAccumulatedContent.indexOf('function_call:');
        updatedAccumulatedContent = updatedAccumulatedContent.substring(0, functionCallIndex).trim();
      }
      
      // Add the formatted tool call
      const updatedContent = updatedAccumulatedContent
        ? `${updatedAccumulatedContent}\n\n${formattedToolCall}`
        : formattedToolCall;
        
      // Update client with the new content
      console.log('Sending tool call to client:', formattedToolCall);
      onUpdate(updatedContent);
    } catch (e) {
      console.error('Error formatting tool call:', e);
      // Try simple recovery - Define backendToolName in case it wasn't set in try block
      const safeToolName = toolCall.function?.name || 'list_dir';
      const safeToolCall = `function_call: {"id":"${toolCall.id || 'unknown'}","name":"${safeToolName}","arguments":"{}"}`;
      const updatedContent = `${accumulatedContent}\n\n${safeToolCall}`;
      onUpdate(updatedContent);
    }
  }

  /**
   * Detects and extracts function calls from content
   */
  private detectFunctionCallInContent(content: string): any | null {
    // Various patterns to match function calls
    const functionCallPatterns = [
      // Standard function_call pattern
      /function_call\s*:\s*({[\s\S]*?})\s*$/m,
      
      // Another common variant
      /function_call\s*=\s*({[\s\S]*?})\s*$/m,
      
      // Pattern for escaped JSON in function_call (common with LM Studio)
      /function_call\s*:\s*\\?"?\{\\?"id\\?":\s*\\?"([^"\\]+)\\?"?,\s*\\?"name\\?":\s*\\?"([^"\\]+)\\?"?,\s*\\?"arguments\\?":\s*\\?"?\{([^}]*)\}\\?"?\s*\}\\?"?\s*$/m,
      
      // Pattern for the exact format seen in the logs: function_call: {"id":"...","name":"...","arguments":"..."}
      /function_call\s*:\s*(\{(?:[^{}]|\{[^}]*\})*\})\s*$/m,
      
      // Variant with name and arguments directly
      /function_call\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*({[\s\S]*?})\s*\}\s*$/m,
      
      // Specific pattern for list_dir function
      /function_call\s*:\s*\{\s*(?:"id"\s*:\s*"[^"]*"\s*,\s*)?"name"\s*:\s*"(list_dir(?:ectory)?)"(?:.*?)"arguments"\s*:\s*({[\s\S]*?})\s*\}/m,
      
      // Specific pattern for read_file function
      /function_call\s*:\s*\{\s*(?:"id"\s*:\s*"[^"]*"\s*,\s*)?"name"\s*:\s*"(read_file)"(?:.*?)"arguments"\s*:\s*({[\s\S]*?})\s*\}/m
    ];
    
    // Log the content to help with debugging
    console.log('Checking for function calls in content:', content.substring(Math.max(0, content.length - 300)));
    
    // Try each pattern
    for (const pattern of functionCallPatterns) {
      const match = content.match(pattern);
      if (match) {
        console.log(`Function call detected with pattern ${pattern}:`, match[1]);
        
        try {
          // Handle escaped JSON format first (from LM Studio)
          if (pattern.source.includes('escaped')) {
            console.log('Processing escaped JSON format function call');
            return {
              id: match[1],
              name: match[2],
              arguments: `{${match[3]}}`
            };
          }
          
          // If it's the variant with name and arguments directly
          if (match.length > 2 && pattern.source.includes('"name"')) {
            return {
              name: match[1],
              arguments: match[2]
            };
          }
          
          // Handle the case where the JSON is in string format with escaped quotes
          let jsonStr = match[1];
          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            // Remove outer quotes and unescape
            jsonStr = jsonStr.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            console.log('Processed escaped JSON string:', jsonStr);
          }
          
          // Otherwise, parse the entire JSON
          const parsedCall = JSON.parse(jsonStr);
          return parsedCall;
        } catch (error) {
          console.warn('Error parsing function call:', error);
          console.log('Original match:', match[1]);
          
          // Try to extract with a more lenient approach
          const nameMatch = match[1].match(/"name"\s*:\s*"([^"]+)"/);
          const argsMatch = match[1].match(/"arguments"\s*:\s*({[\s\S]*?})\s*[,}]/);
          const idMatch = match[1].match(/"id"\s*:\s*"([^"]+)"/);
          
          if (nameMatch) {
            return {
              id: idMatch ? idMatch[1] : `function-call-${Date.now()}`,
              name: nameMatch[1],
              arguments: argsMatch ? argsMatch[1] : '{}'
            };
          }
        }
      }
    }
    
    return null;
  }
}

const lmStudio = new LMStudioService();
export default lmStudio; 