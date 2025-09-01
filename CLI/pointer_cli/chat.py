"""
Chat interface for Pointer CLI.
"""

import asyncio
import json
import re
import time
from typing import Dict, Any, List, Optional, AsyncGenerator
from pathlib import Path

import aiohttp
from rich.console import Console
from rich.prompt import Prompt
from rich.text import Text
from rich.live import Live
from rich.spinner import Spinner
from rich.panel import Panel

from .config import Config
from .utils import truncate_output

class ChatInterface:
    """Chat interface for natural language interaction."""
    
    def __init__(self, config: Config, console: Console):
        self.config = config
        self.console = console
        self.session = None
        self.conversation_history = []
        
    async def get_user_input(self) -> str:
        """Get user input from the terminal."""
        try:
            # Use asyncio to handle input without blocking
            loop = asyncio.get_event_loop()
            user_input = await loop.run_in_executor(
                None, 
                lambda: Prompt.ask("\n[bold blue]You[/bold blue]")
            )
            return user_input.strip()
        except KeyboardInterrupt:
            raise
        except Exception as e:
            self.console.print(f"[red]Error getting input: {e}[/red]")
            return ""
    
    async def get_ai_response(self, message: str, context: Dict[str, Any]) -> str:
        """Get AI response for the given message with loading animation."""
        try:
            # Add message to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": message
            })
            
            # Prepare the request
            request_data = await self._prepare_request(message, context)
            
            # Try streaming first, fallback to non-streaming if it fails
            try:
                response = await self._make_streaming_api_call(request_data)
            except Exception as streaming_error:
                # Fallback to non-streaming if streaming fails
                self.console.print(f"[yellow]Streaming failed, using fallback: {streaming_error}[/yellow]")
                # Show simple loading message for fallback
                self.console.print("[blue]Generating response...[/blue]")
                response = await self._make_api_call(request_data)
            
            # Add response to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            
            return response
            
        except Exception as e:
            error_msg = f"Error getting AI response: {e}"
            self.console.print(f"[red]{error_msg}[/red]")
            raise Exception(error_msg)  # Re-raise instead of returning error message
    
    async def get_ai_response_with_tokens(self, message: str, context: Dict[str, Any]) -> tuple[str, int]:
        """Get AI response for the given message and return token count."""
        try:
            # Add message to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": message
            })
            
            # Prepare the request
            request_data = await self._prepare_request(message, context)
            
            # Try streaming first, fallback to non-streaming if it fails
            try:
                response, tokens = await self._make_streaming_api_call_with_tokens(request_data)
            except Exception as streaming_error:
                # Fallback to non-streaming if streaming fails
                self.console.print(f"[yellow]Streaming failed, using fallback: {streaming_error}[/yellow]")
                # Show simple loading message for fallback
                self.console.print("[blue]Generating response...[/blue]")
                response, tokens = await self._make_api_call_with_tokens(request_data)
            
            # Add response to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            
            return response, tokens
            
        except Exception as e:
            error_msg = f"Error getting AI response: {e}"
            self.console.print(f"[red]{error_msg}[/red]")
            raise Exception(error_msg)  # Re-raise instead of returning error message
    
    async def _prepare_request(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare the API request."""
        # Build system prompt
        system_prompt = self._build_system_prompt(context)
        
        # Prepare messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 10 messages to avoid token limits)
        recent_history = self.conversation_history[-10:]
        messages.extend(recent_history)
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        return {
            "model": self.config.api.model_name,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": True
        }
    
    def _build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build the system prompt with context."""
        prompt_parts = [
            "You are Pointer CLI, an AI-powered local codebase assistant.",
            "You help users interact with their codebase through natural language.",
            "",
            "Current Context:",
            f"- Project Root: {context.get('project_root', 'None')}",
            f"- Current Directory: {context.get('current_directory', 'None')}",
            f"- Git Repository: {context.get('is_git_repo', False)}",
            "",
            "Available Tools:",
            "- read_file: Read file contents",
            "- write_file: Write content to file",
            "- edit_file: Edit file with specific changes",
            "- search_files: Search for files by pattern",
            "- search_content: Search for content in files",
            "- run_command: Execute shell commands",
            "- list_directory: List directory contents",
            "- get_file_info: Get file information",
            "- create_diff: Show diff between versions",
            "",
            "Tool Format:",
            "When you need to use a tool, respond with:",
            "```tool",
            "name: tool_name",
            "args:",
            "  arg1: value1",
            "  arg2: value2",
            "```",
            "",
            "Guidelines:",
            "- Be concise and helpful",
            "- Always show diffs when editing files",
            "- Explain what you're doing",
            "- Ask for confirmation for destructive operations",
            "- Use the most appropriate tool for each task",
        ]
        
        return "\n".join(prompt_parts)
    
    async def _make_streaming_api_call(self, request_data: Dict[str, Any]) -> str:
        """Make streaming API call with loading animation and token counting."""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.config.api.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if self.config.api.api_key:
            headers["Authorization"] = f"Bearer {self.config.api.api_key}"
        
        url = f"{self.config.api.base_url}/v1/chat/completions"
        
        try:
            full_response = ""
            token_count = 0
            start_time = time.time()
            
            # Use Rich Live for streaming the entire AI response
            from rich.live import Live
            from rich.text import Text
            from rich.panel import Panel
            
            def make_response_display():
                if token_count == 0:
                    return Panel("⠋ Generating response...", title="[bold blue]AI Response[/bold blue]", border_style="blue")
                else:
                    elapsed = time.time() - start_time
                    tokens_per_sec = token_count / elapsed if elapsed > 0 else 0
                    spinner_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
                    spinner_char = spinner_chars[token_count % len(spinner_chars)]
                    
                    # Show the actual response content as it streams
                    if full_response.strip():
                        # Split response into thinking and main content
                        thinking_content, main_content = self._split_ai_response(full_response.strip())
                        
                        # If we have thinking content and it's enabled, show it
                        if thinking_content and self.config.ui.show_thinking:
                            # Create a combined display with thinking and main content
                            combined_content = f"[bright_black]Thinking:[/bright_black]\n{thinking_content}\n\n[green]Response:[/green]\n{main_content}"
                        else:
                            combined_content = main_content
                        
                        return Panel(
                            combined_content,
                            title=f"[bold green]AI Response[/bold green] | Tokens: {token_count} | Speed: {tokens_per_sec:.1f} tokens/sec",
                            border_style="green"
                        )
                    else:
                        # Still loading, show spinner
                        return Panel(
                            f"{spinner_char} Generating response...",
                            title="[bold blue]AI Response[/bold blue] | Tokens: 0 | Speed: 0.0 tokens/sec",
                            border_style="blue"
                        )
            
            # Create initial display
            current_display = make_response_display()
            
            with Live(current_display, console=self.console, refresh_per_second=10) as live:
                async with self.session.post(url, json=request_data, headers=headers) as response:
                    if response.status == 200:
                        async for line in response.content:
                            line = line.decode('utf-8').strip()
                            
                            if line.startswith('data: '):
                                data_str = line[6:]  # Remove 'data: ' prefix
                                
                                if data_str == '[DONE]':
                                    break
                                
                                try:
                                    data = json.loads(data_str)
                                    
                                    if 'choices' in data and len(data['choices']) > 0:
                                        choice = data['choices'][0]
                                        if 'delta' in choice and 'content' in choice['delta']:
                                            content = choice['delta']['content']
                                            full_response += content
                                            token_count += 1
                                            
                                            # Update the live display with streaming content
                                            current_display = make_response_display()
                                            live.update(current_display)
                                
                                except json.JSONDecodeError:
                                    continue
                    else:
                        error_text = await response.text()
                        raise Exception(f"API error {response.status}: {error_text}")
            
            # No need to show final stats - they're already in the panel title
            
            return full_response
        
        except aiohttp.ClientError as e:
            raise Exception(f"Network error: {e}")
        except Exception as e:
            raise Exception(f"Streaming error: {e}")
    
    async def _make_streaming_api_call_with_tokens(self, request_data: Dict[str, Any]) -> tuple[str, int]:
        """Make streaming API call and return response with token count."""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.config.api.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if self.config.api.api_key:
            headers["Authorization"] = f"Bearer {self.config.api.api_key}"
        
        url = f"{self.config.api.base_url}/v1/chat/completions"
        
        try:
            full_response = ""
            token_count = 0
            start_time = time.time()
            
            # Use Rich Live for streaming the entire AI response
            from rich.live import Live
            from rich.text import Text
            from rich.panel import Panel
            
            def make_response_display():
                if token_count == 0:
                    return Panel("⠋ Generating response...", title="[bold blue]AI Response[/bold blue]", border_style="blue")
                else:
                    elapsed = time.time() - start_time
                    tokens_per_sec = token_count / elapsed if elapsed > 0 else 0
                    spinner_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
                    spinner_char = spinner_chars[token_count % len(spinner_chars)]
                    
                    # Show the actual response content as it streams
                    if full_response.strip():
                        # Split response into thinking and main content
                        thinking_content, main_content = self._split_ai_response(full_response.strip())
                        
                        # If we have thinking content and it's enabled, show it
                        if thinking_content and self.config.ui.show_thinking:
                            # Create a combined display with thinking and main content
                            combined_content = f"[bright_black]Thinking:[/bright_black]\n{thinking_content}\n\n[green]Response:[/green]\n{main_content}"
                        else:
                            combined_content = main_content
                        
                        return Panel(
                            combined_content,
                            title=f"[bold green]AI Response[/bold green] | Tokens: {token_count} | Speed: {tokens_per_sec:.1f} tokens/sec",
                            border_style="green"
                        )
                    else:
                        # Still loading, show spinner
                        return Panel(
                            f"{spinner_char} Generating response...",
                            title="[bold blue]AI Response[/bold blue] | Tokens: 0 | Speed: 0.0 tokens/sec",
                            border_style="blue"
                        )
            
            # Create initial display
            current_display = make_response_display()
            
            with Live(current_display, console=self.console, refresh_per_second=10) as live:
                async with self.session.post(url, json=request_data, headers=headers) as response:
                    if response.status == 200:
                        async for line in response.content:
                            line = line.decode('utf-8').strip()
                            
                            if line.startswith('data: '):
                                data_str = line[6:]  # Remove 'data: ' prefix
                                
                                if data_str == '[DONE]':
                                    break
                                
                                try:
                                    data = json.loads(data_str)
                                    
                                    if 'choices' in data and len(data['choices']) > 0:
                                        choice = data['choices'][0]
                                        if 'delta' in choice and 'content' in choice['delta']:
                                            content = choice['delta']['content']
                                            full_response += content
                                            token_count += 1
                                            
                                            # Update the live display with streaming content
                                            current_display = make_response_display()
                                            live.update(current_display)
                                
                                except json.JSONDecodeError:
                                    continue
                    else:
                        error_text = await response.text()
                        raise Exception(f"API error {response.status}: {error_text}")
            
            # No need to show final stats - they're already in the panel title
            
            return full_response, token_count
        
        except aiohttp.ClientError as e:
            raise Exception(f"Network error: {e}")
        except Exception as e:
            raise Exception(f"Streaming error: {e}")
    
    async def _make_api_call_with_tokens(self, request_data: Dict[str, Any]) -> tuple[str, int]:
        """Make API call and return response with token count."""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.config.api.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if self.config.api.api_key:
            headers["Authorization"] = f"Bearer {self.config.api.api_key}"
        
        url = f"{self.config.api.base_url}/v1/chat/completions"
        
        try:
            async with self.session.post(url, json=request_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    if "choices" not in data:
                        raise Exception(f"Invalid API response: missing 'choices' field. Response: {data}")
                    
                    if not data["choices"] or len(data["choices"]) == 0:
                        raise Exception("Invalid API response: empty choices array")
                    
                    if "message" not in data["choices"][0]:
                        raise Exception(f"Invalid API response: missing 'message' field in choice. Choice: {data['choices'][0]}")
                    
                    if "content" not in data["choices"][0]["message"]:
                        raise Exception(f"Invalid API response: missing 'content' field in message. Message: {data['choices'][0]['message']}")
                    
                    # Extract token count if available
                    token_count = 0
                    if "usage" in data and "total_tokens" in data["usage"]:
                        token_count = data["usage"]["total_tokens"]
                    
                    return data["choices"][0]["message"]["content"], token_count
                else:
                    error_text = await response.text()
                    raise Exception(f"API error {response.status}: {error_text}")
        
        except aiohttp.ClientError as e:
            raise Exception(f"Network error: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response: {e}")
        except KeyError as e:
            raise Exception(f"Invalid API response structure: missing key {e}")
    
    def _split_ai_response(self, response: str) -> tuple[str, str]:
        """Split AI response into thinking content and main content."""
        import re
        
        # Find thinking blocks
        think_match = re.search(r'<think>(.*?)</think>', response, flags=re.DOTALL)
        
        if think_match:
            # Extract thinking content
            thinking_content = think_match.group(1).strip()
            
            # Remove thinking blocks from main content
            main_content = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()
            
            return thinking_content, main_content
        else:
            # No thinking content found
            return "", response
    
    async def _make_api_call(self, request_data: Dict[str, Any]) -> str:
        """Make API call to the AI service."""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.config.api.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if self.config.api.api_key:
            headers["Authorization"] = f"Bearer {self.config.api.api_key}"
        
        url = f"{self.config.api.base_url}/v1/chat/completions"
        
        try:
            async with self.session.post(url, json=request_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Validate response structure
                    if "choices" not in data:
                        raise Exception(f"Invalid API response: missing 'choices' field. Response: {data}")
                    
                    if not data["choices"] or len(data["choices"]) == 0:
                        raise Exception("Invalid API response: empty choices array")
                    
                    if "message" not in data["choices"][0]:
                        raise Exception(f"Invalid API response: missing 'message' field in choice. Choice: {data['choices'][0]}")
                    
                    if "content" not in data["choices"][0]["message"]:
                        raise Exception(f"Invalid API response: missing 'content' field in message. Message: {data['choices'][0]['message']}")
                    
                    return data["choices"][0]["message"]["content"]
                else:
                    error_text = await response.text()
                    raise Exception(f"API error {response.status}: {error_text}")
        
        except aiohttp.ClientError as e:
            raise Exception(f"Network error: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response: {e}")
        except KeyError as e:
            raise Exception(f"Invalid API response structure: missing key {e}")
    
    def parse_tools(self, response: str) -> List[Dict[str, Any]]:
        """Parse tools from AI response."""
        tools = []
        
        # Look for tool blocks in the response
        tool_pattern = r'```tool\s*\n(.*?)\n```'
        matches = re.findall(tool_pattern, response, re.DOTALL)
        
        for match in matches:
            try:
                tool_data = self._parse_tool_block(match)
                if tool_data:
                    tools.append(tool_data)
            except Exception as e:
                self.console.print(f"[yellow]Warning: Could not parse tool block: {e}[/yellow]")
        
        return tools
    
    def _parse_tool_block(self, block: str) -> Optional[Dict[str, Any]]:
        """Parse a single tool block."""
        lines = block.strip().split('\n')
        tool_data = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                if key == "name":
                    tool_data["name"] = value
                elif key == "args":
                    # Parse YAML-like args
                    tool_data["args"] = self._parse_args(value)
                else:
                    # Add to args
                    if "args" not in tool_data:
                        tool_data["args"] = {}
                    tool_data["args"][key] = value
        
        # Fix common parameter mismatches
        if tool_data.get("name") == "search_content" and "args" in tool_data:
            args = tool_data["args"]
            # Map 'pattern' to 'query' for search_content tool
            if "pattern" in args and "query" not in args:
                args["query"] = args["pattern"]
                # Also set pattern to "*" for file pattern matching
                args["pattern"] = "*"
        
        return tool_data if "name" in tool_data else None
    
    def _parse_args(self, args_str: str) -> Dict[str, Any]:
        """Parse tool arguments."""
        args = {}
        lines = args_str.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Try to parse as JSON for complex values
                try:
                    args[key] = json.loads(value)
                except json.JSONDecodeError:
                    args[key] = value
        
        return args
    
    async def close(self) -> None:
        """Close the chat interface and cleanup resources."""
        if self.session:
            await self.session.close()
            self.session = None
    
    def clear_history(self) -> None:
        """Clear conversation history."""
        self.conversation_history = []
    
    def get_history(self) -> List[Dict[str, Any]]:
        """Get conversation history."""
        return self.conversation_history.copy()
    
    def add_to_history(self, role: str, content: str) -> None:
        """Add message to conversation history."""
        self.conversation_history.append({
            "role": role,
            "content": content
        })
