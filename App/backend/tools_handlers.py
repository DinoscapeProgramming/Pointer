"""
Tool handlers for AI tool calling functionality.
"""

import os
import json
import aiohttp
import asyncio
import re
import subprocess
from typing import Dict, Any, List
from pathlib import Path
import platform
import shlex
import time
import httpx


def resolve_path(relative_path: str) -> str:
    """
    Resolve a relative path against the current working directory (user's workspace).
    
    Args:
        relative_path: The path to resolve (can be relative or absolute)
        
    Returns:
        Absolute path resolved against the current working directory
    """
    if not relative_path:
        return relative_path
    
    # If it's already an absolute path, return as-is
    if os.path.isabs(relative_path):
        return relative_path
    
    # Resolve the path against the current working directory (user's workspace)
    resolved_path = os.path.join(os.getcwd(), relative_path)
    
    # Normalize the path (resolve any .. or . components)
    resolved_path = os.path.normpath(resolved_path)
    
    # Security check: ensure the resolved path is within the workspace
    workspace_abs = os.path.abspath(os.getcwd())
    resolved_abs = os.path.abspath(resolved_path)
    
    if not resolved_abs.startswith(workspace_abs):
        raise ValueError(f"Path {relative_path} resolves outside workspace directory")
    
    return resolved_path


async def read_file(file_path: str = None, target_file: str = None) -> Dict[str, Any]:
    """
    Read the contents of a file and return as a dictionary.
    
    Args:
        file_path: Path to the file to read (can be relative to workspace)
        target_file: Alternative path to the file to read (takes precedence over file_path, can be relative)
        
    Returns:
        Dictionary with file content and metadata
    """
    # Use target_file if provided, otherwise use file_path
    actual_path = target_file if target_file is not None else file_path
    
    if actual_path is None:
        return {
            "success": False,
            "error": "No file path provided"
        }
    
    try:
        # Resolve relative path against current working directory (user's workspace)
        resolved_path = resolve_path(actual_path)
        
        # Check if file exists
        if not os.path.exists(resolved_path):
            # Try to suggest similar files that do exist
            suggestions = []
            try:
                # Check if there are any files with similar names
                workspace_dir = os.getcwd()
                for root, dirs, files in os.walk(workspace_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Check if the requested filename is contained in this file
                        if actual_path.lower() in file.lower() or file.lower() in actual_path.lower():
                            # Get relative path from workspace
                            rel_path = os.path.relpath(file_path, workspace_dir)
                            suggestions.append(rel_path)
                            if len(suggestions) >= 5:  # Limit suggestions
                                break
                    if len(suggestions) >= 5:
                        break
            except:
                pass
            
            error_msg = f"File not found: {actual_path} (resolved to: {resolved_path})"
            if suggestions:
                error_msg += f". Similar files found: {', '.join(suggestions[:3])}"
            
            return {
                "success": False,
                "error": error_msg
            }
        
        # Get file extension and size
        file_extension = os.path.splitext(resolved_path)[1].lower()
        file_size = os.path.getsize(resolved_path)
        
        # Read file based on extension
        if file_extension == '.json':
            with open(resolved_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
                file_type = "json"
        else:
            # Default to text for all other file types
            with open(resolved_path, 'r', encoding='utf-8') as f:
                content = f.read()
                file_type = "text"
        
        return {
            "success": True,
            "content": content,
            "metadata": {
                "path": actual_path,
                "resolved_path": resolved_path,
                "size": file_size,
                "type": file_type,
                "extension": file_extension
            }
        }
    except json.JSONDecodeError:
        # Handle invalid JSON
        with open(resolved_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "success": False,
            "error": "Invalid JSON format",
            "content": content,
            "metadata": {
                "path": actual_path,
                "resolved_path": resolved_path,
                "size": file_size,
                "type": "text",
                "extension": file_extension
            }
        }
    except UnicodeDecodeError:
        # Handle binary files
        return {
            "success": False,
            "error": "Cannot read binary file as text",
            "metadata": {
                "path": actual_path,
                "resolved_path": resolved_path,
                "size": file_size,
                "type": "binary",
                "extension": file_extension
            }
        }
    except Exception as e:
        # Handle all other exceptions
        return {
            "success": False,
            "error": str(e),
            "metadata": {
                "path": actual_path
            }
        }


async def list_directory(directory_path: str) -> Dict[str, Any]:
    """
    List the contents of a directory.
    
    Args:
        directory_path: Path to the directory to list (can be relative to workspace)
        
    Returns:
        Dictionary with directory contents
    """
    try:
        # Resolve relative path against current working directory (user's workspace)
        resolved_path = resolve_path(directory_path)
        
        # Check if directory exists
        if not os.path.exists(resolved_path) or not os.path.isdir(resolved_path):
            # Try to suggest similar paths that do exist
            suggestions = []
            try:
                # Check if there are any directories with similar names
                workspace_dir = os.getcwd()
                for item in os.listdir(workspace_dir):
                    item_path = os.path.join(workspace_dir, item)
                    if os.path.isdir(item_path):
                        # Check if the requested directory name is contained in this directory
                        if directory_path.lower() in item.lower() or item.lower() in directory_path.lower():
                            suggestions.append(item)
                        # Also check if there's a subdirectory with the requested name
                        try:
                            subdir_path = os.path.join(item_path, directory_path)
                            if os.path.exists(subdir_path) and os.path.isdir(subdir_path):
                                suggestions.append(f"{item}/{directory_path}")
                        except:
                            pass
            except:
                pass
            
            error_msg = f"Directory not found: {directory_path} (resolved to: {resolved_path})"
            if suggestions:
                error_msg += f". Similar directories found: {', '.join(suggestions)}"
            
            return {
                "success": False,
                "error": error_msg
            }
        
        # List directory contents
        contents = []
        for item in os.listdir(resolved_path):
            item_path = os.path.join(resolved_path, item)
            item_type = "directory" if os.path.isdir(item_path) else "file"
            
            # Create relative path for display
            relative_item_path = os.path.join(directory_path, item)
            
            contents.append({
                "name": item,
                "path": relative_item_path,
                "resolved_path": item_path,
                "type": item_type,
                "size": os.path.getsize(item_path) if item_type == "file" else None
            })
        
        return {
            "success": True,
            "directory": directory_path,
            "resolved_directory": resolved_path,
            "contents": contents
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "directory": directory_path
        }


async def web_search(search_term: str = None, query: str = None, num_results: int = 5, location: str = None) -> Dict[str, Any]:
    """
    Web search using Startpage (Google results without tracking).
    
    Args:
        search_term: Search query (preferred)
        query: Alternative search query
        num_results: Number of results to return (max 20)
        location: Optional location for local search (not fully supported with scraping)
        
    Returns:
        Dictionary with search results
    """
    actual_query = search_term if search_term is not None else query
    
    if actual_query is None:
        return {
            "success": False,
            "error": "No search query provided"
        }
    
    try:
        import aiohttp
        import re
        from urllib.parse import unquote, urljoin
        
        # Limit results to reasonable number for scraping
        num_results = min(num_results, 20)
        
        # Startpage search URL
        search_url = "https://www.startpage.com/sp/search"
        search_params = {
            "query": actual_query,
            "cat": "web",  # Web search category
            "language": "english",
            "region": "us"
        }
        
        # Add location if provided (though limited with scraping)
        if location:
            search_params["region"] = "us"  # Default to US for now
        
        # Browser-like headers to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.startpage.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(search_url, params=search_params, headers=headers, timeout=30) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {response.reason}"
                    }
                
                html_content = await response.text()
                
                # Parse search results from HTML
                results = await _parse_startpage_results(html_content, actual_query, num_results)
                
                if results["success"]:
                    return {
                        "success": True,
                        "query": actual_query,
                        "num_results": len(results["results"]),
                        "total_results": results.get("total_results", "Unknown"),
                        "search_time": "Unknown",
                        "results": results["results"],
                        "source": "Startpage (Google Results)"
                    }
                else:
                    return results
                    
    except Exception as e:
        return {
            "success": False,
            "error": f"Search failed: {str(e)}"
        }


async def _parse_startpage_results(html_content: str, query: str, num_results: int) -> Dict[str, Any]:
    """
    Parse Startpage HTML content to extract search results.
    
    Args:
        html_content: Raw HTML from Startpage
        query: Original search query
        num_results: Number of results to extract
        
    Returns:
        Dictionary with parsed results
    """
    try:
        import re
        from urllib.parse import unquote, urljoin
        
        results = []
        
        # First, try to find the main search results container
        # Startpage often wraps results in specific containers
        
        # Look for common Startpage result containers
        main_container_patterns = [
            r'<div[^>]*class="[^"]*serp__results[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*results[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*web-results[^"]*"[^>]*>(.*?)</div>',
            r'<main[^>]*class="[^"]*results[^"]*"[^>]*>(.*?)</main>',
            r'<section[^>]*class="[^"]*results[^"]*"[^>]*>(.*?)</section>',
            # More flexible patterns
            r'<div[^>]*class="[^"]*serp[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*search[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*id="[^"]*results[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*id="[^"]*serp[^"]*"[^>]*>(.*?)</div>'
        ]
        
        main_content = html_content
        for pattern in main_container_patterns:
            match = re.search(pattern, html_content, re.DOTALL)
            if match:
                main_content = match.group(1)
                break
        
        # Now look for individual result containers within the main content
        result_container_patterns = [
            r'<div[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*serp__result[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*web-result[^"]*"[^>]*>(.*?)</div>',
            r'<article[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)</article>',
            r'<div[^>]*class="[^"]*result__body[^"]*"[^>]*>(.*?)</div>',
            # More flexible patterns
            r'<div[^>]*class="[^"]*serp[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*entry[^"]*"[^>]*>(.*?)</div>',
            r'<li[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)</li>',
            r'<li[^>]*class="[^"]*serp[^"]*"[^>]*>(.*?)</li>'
        ]
        
        # Extract result containers
        result_containers = []
        for pattern in result_container_patterns:
            containers = re.findall(pattern, main_content, re.DOTALL)
            result_containers.extend(containers)
        
        # If we found result containers, parse them
        if result_containers:
            for container in result_containers[:num_results]:
                # Extract title from container
                title_match = re.search(r'<h3[^>]*>(.*?)</h3>', container, re.DOTALL)
                if not title_match:
                    title_match = re.search(r'<h2[^>]*>(.*?)</h2>', container, re.DOTALL)
                if not title_match:
                    title_match = re.search(r'<a[^>]*class="[^"]*result__title[^"]*"[^>]*>(.*?)</a>', container, re.DOTALL)
                if not title_match:
                    title_match = re.search(r'<a[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</a>', container, re.DOTALL)
                if not title_match:
                    title_match = re.search(r'<a[^>]*class="[^"]*serp[^"]*"[^>]*>(.*?)</a>', container, re.DOTALL)
                if not title_match:
                    # Look for any anchor tag with href that could be a title
                    title_match = re.search(r'<a[^>]*href="[^"]*"[^>]*>(.*?)</a>', container, re.DOTALL)
                
                title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else ""
                
                # Extract URL from container
                url_match = re.search(r'href="([^"]*)"', container)
                url = url_match.group(1) if url_match else ""
                
                # Extract snippet from container
                snippet_match = re.search(r'<p[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)</p>', container, re.DOTALL)
                if not snippet_match:
                    snippet_match = re.search(r'<span[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)</span>', container, re.DOTALL)
                if not snippet_match:
                    snippet_match = re.search(r'<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</div>', container, re.DOTALL)
                if not snippet_match:
                    snippet_match = re.search(r'<p[^>]*>(.*?)</p>', container, re.DOTALL)
                if not snippet_match:
                    snippet_match = re.search(r'<span[^>]*>(.*?)</span>', container, re.DOTALL)
                if not snippet_match:
                    snippet_match = re.search(r'<div[^>]*>(.*?)</div>', container, re.DOTALL)
                
                snippet = re.sub(r'<[^>]+>', '', snippet_match.group(1)).strip() if snippet_match else ""
                
                # Filter out internal Startpage URLs and non-http URLs
                if (url.startswith('http') and 
                    not url.startswith('https://www.startpage.com') and
                    not url.startswith('https://startpage.com') and
                    'support.startpage.com' not in url and
                    title and len(title) > 5):
                    
                    result = {
                        "title": title[:100],
                        "url": url,
                        "snippet": snippet[:200] if snippet else "No description available",
                        "position": len(results) + 1,
                        "type": "organic_result"
                    }
                    results.append(result)
        
        # If we didn't get enough results, try a more aggressive approach
        if len(results) < num_results:
            # Look for all external links that could be search results
            link_pattern = r'<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>'
            links = re.findall(link_pattern, html_content)
            
            for href, text in links:
                if (href.startswith('http') and 
                    not href.startswith('https://www.startpage.com') and
                    not href.startswith('https://startpage.com') and
                    'support.startpage.com' not in href and
                    len(text.strip()) > 10 and
                    len(text.strip()) < 200):
                    
                    # Skip navigation and internal elements
                    skip_keywords = ['fully anonymous', 'startpage search results', 'privacy', 'settings', 'help', 'about', 'private search', 'introducing', 'blog articles']
                    if any(keyword in text.strip().lower() for keyword in skip_keywords):
                        continue
                    
                    # Skip CSS/JS related content
                    if any(css_js in text.strip().lower() for css_js in ['@font-face', '@media', 'const ', 'var ', 'function', '/*', '*/', '.css-', '{', '}', ';', 'px', 'em', 'rem', 'vh', 'vw', 'transition:', 'opacity:', 'position:', 'top:', 'right:', 'font-size:', 'font-weight:', 'line-height:', 'margin:', 'height:', 'width:', 'object-fit:', '-webkit-']):
                        continue
                    
                    # Skip if this looks like a URL or domain
                    if text.strip().startswith('http') or text.strip().endswith('.com') or text.strip().endswith('.org') or text.strip().endswith('.net'):
                        continue
                    
                    if len(results) >= num_results:
                        break
                    
                    result = {
                        "title": text.strip()[:100],
                        "url": href,
                        "snippet": "Result extracted from search page",
                        "position": len(results) + 1,
                        "type": "extracted_result"
                    }
                    results.append(result)
        
        # If we still don't have results, try to extract meaningful text
        if not results:
            # First try to find any URLs in the HTML that we might have missed
            url_pattern = r'https?://[^\s<>"]+'
            urls = re.findall(url_pattern, html_content)
            valid_urls = [url for url in urls if not any(skip in url for skip in ['startpage.com', 'support.startpage.com'])]
            
            # Look for text that appears to be search result titles
            # Focus on text that's likely to be actual content
            text_pattern = r'>([^<]{30,200})<'
            text_matches = re.findall(text_pattern, html_content)
            
            for i, text in enumerate(text_matches):
                clean_text = text.strip()
                
                # Skip CSS/JS content
                if any(css_js in clean_text for css_js in ['@font-face', '@media', 'const ', 'var ', 'function', '/*', '*/', '.css-', '{', '}', ';', 'px', 'em', 'rem', 'vh', 'vw', 'transition:', 'opacity:', 'position:', 'top:', 'right:', 'font-size:', 'font-weight:', 'line-height:', 'margin:', 'height:', 'width:', 'object-fit:', '-webkit-']):
                    continue
                
                # Skip navigation elements
                skip_keywords = ['startpage search results', 'privacy', 'settings', 'help', 'about', 'fully anonymous', 'private search', 'introducing', 'blog articles']
                if any(keyword in clean_text.lower() for keyword in skip_keywords):
                    continue
                
                # Look for text that could be a search result title
                if (len(clean_text) > 30 and 
                    len(clean_text) < 200 and
                    not clean_text.startswith('http') and
                    not clean_text.endswith('.com') and
                    not clean_text.endswith('.org') and
                    not clean_text.endswith('.net') and
                    # Make sure it contains some actual words
                    len(clean_text.split()) > 3):
                    
                    if len(results) >= num_results:
                        break
                    
                    # Try to extract any URLs from the text content
                    url_match = re.search(r'https?://[^\s<>"]+', clean_text)
                    fallback_url = url_match.group(0) if url_match else f"https://www.google.com/search?q={query}"
                    
                    # If we have valid URLs from the page, use them
                    if valid_urls and i < len(valid_urls):
                        fallback_url = valid_urls[i]
                    
                    result = {
                        "title": clean_text[:100],
                        "url": fallback_url,
                        "snippet": clean_text[:200],
                        "position": len(results) + 1,
                        "type": "text_extracted"
                    }
                    results.append(result)
        
        if results:
            return {
                "success": True,
                "results": results[:num_results],
                "total_results": len(results)
            }
        else:
            return {
                "success": False,
                "error": "No search results found in the page content. The page structure may have changed or the search returned no results."
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to parse search results: {str(e)}"
        }


async def fetch_webpage(url: str) -> Dict[str, Any]:
    """
    Fetch content from a webpage.
    
    Args:
        url: URL to fetch
        
    Returns:
        Dictionary with webpage content
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                content_type = response.headers.get('Content-Type', '')
                
                if 'text/html' in content_type:
                    # For HTML, return simplified content
                    text = await response.text()
                    return {
                        "success": True,
                        "url": url,
                        "content_type": content_type,
                        "status_code": response.status,
                        "content": text[:5000] + ("..." if len(text) > 5000 else ""),
                        "truncated": len(text) > 5000
                    }
                elif 'application/json' in content_type:
                    # For JSON, parse and return
                    try:
                        data = await response.json()
                        return {
                            "success": True,
                            "url": url,
                            "content_type": content_type,
                            "status_code": response.status,
                            "content": data
                        }
                    except json.JSONDecodeError:
                        text = await response.text()
                        return {
                            "success": False,
                            "url": url,
                            "error": "Invalid JSON response",
                            "content_type": content_type,
                            "status_code": response.status,
                            "content": text[:1000] + ("..." if len(text) > 1000 else "")
                        }
                else:
                    # For other content types, return raw text (limited)
                    text = await response.text()
                    return {
                        "success": True,
                        "url": url,
                        "content_type": content_type,
                        "status_code": response.status,
                        "content": text[:1000] + ("..." if len(text) > 1000 else ""),
                        "truncated": len(text) > 1000
                    }
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "error": str(e)
        }


async def grep_search(query: str, include_pattern: str = None, exclude_pattern: str = None, case_sensitive: bool = False) -> Dict[str, Any]:
    """
    Search for a pattern in files using ripgrep.
    
    Args:
        query: The pattern to search for
        include_pattern: Optional file pattern to include (e.g. '*.ts')
        exclude_pattern: Optional file pattern to exclude (e.g. 'node_modules')
        case_sensitive: Whether the search should be case sensitive
        
    Returns:
        Dictionary with search results
    """
    try:
        # Build the ripgrep command
        cmd = ["rg", "--json", "--line-number", "--column"]
        
        # Add case sensitivity flag
        if not case_sensitive:
            cmd.append("--ignore-case")
        
        # Add include pattern if provided
        if include_pattern:
            cmd.extend(["-g", include_pattern])
        
        # Add exclude pattern if provided
        if exclude_pattern:
            cmd.extend(["-g", f"!{exclude_pattern}"])
        
        # Limit results to prevent overwhelming response
        cmd.extend(["--max-count", "50"])
        
        # Add the query and search location
        cmd.append(query)
        cmd.append(".")
        
        # Execute the command
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        # Check for error
        if process.returncode != 0 and process.returncode != 1:  # rg returns 1 if no matches
            error_msg = stderr.decode().strip()
            if not error_msg:
                error_msg = f"grep search failed with return code {process.returncode}"
            return {
                "success": False,
                "error": error_msg
            }
        
        # Process the results
        matches = []
        for line in stdout.decode().splitlines():
            try:
                result = json.loads(line)
                if result.get("type") == "match":
                    match_data = result.get("data", {})
                    path = match_data.get("path", {}).get("text", "")
                    
                    for match_line in match_data.get("lines", {}).get("text", "").splitlines():
                        matches.append({
                            "file": path,
                            "line": match_line.strip()
                        })
            except json.JSONDecodeError:
                continue
        
        return {
            "success": True,
            "query": query,
            "include_pattern": include_pattern,
            "exclude_pattern": exclude_pattern,
            "matches": matches
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def run_terminal_cmd(command: str, working_directory: str = None, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a terminal/console command and return the output.
    
    Args:
        command: The command to execute
        working_directory: Optional working directory to run the command in
        timeout: Maximum time to wait for command completion in seconds (default: 30)
        
    Returns:
        Dictionary with command execution results
    """
    try:
        start_time = time.time()
        
        # Security check - prevent dangerous commands
        dangerous_commands = [
            'rm', 'del', 'format', 'fdisk', 'mkfs', 'dd', 'sudo rm', 
            'shutdown', 'reboot', 'halt', 'init', 'kill -9', 'killall',
            'chmod 777', 'chown', 'passwd', 'su ', 'sudo su', 'sudo -i'
        ]
        
        command_lower = command.lower().strip()
        for dangerous in dangerous_commands:
            if dangerous in command_lower:
                return {
                    "success": False,
                    "error": f"Command blocked for security reasons: '{dangerous}' not allowed",
                    "command": command,
                    "execution_time": 0
                }
        
        # Parse the command safely
        try:
            # Handle shell operators and complex commands
            if any(op in command for op in ['&&', '||', '|', '>', '<', ';']):
                # Use shell=True for complex commands, but with extra caution
                if platform.system() == "Windows":
                    args = command
                    shell = True
                else:
                    args = command
                    shell = True
            else:
                # Simple commands can use shlex for better security
                args = shlex.split(command)
                shell = False
        except ValueError as e:
            return {
                "success": False,
                "error": f"Invalid command syntax: {str(e)}",
                "command": command,
                "execution_time": 0
            }
        
        # Set working directory
        cwd = working_directory if working_directory and os.path.exists(working_directory) else None
        
        # Create the subprocess
        if shell:
            process = await asyncio.create_subprocess_shell(
                args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd
            )
        else:
            process = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd
            )
        
        try:
            # Wait for completion with timeout
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=timeout
            )
        except asyncio.TimeoutError:
            # Kill the process if it times out
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5)
            except:
                process.kill()
                await process.wait()
            
            execution_time = time.time() - start_time
            return {
                "success": False,
                "error": f"Command timed out after {timeout} seconds",
                "command": command,
                "working_directory": cwd,
                "execution_time": round(execution_time, 2),
                "timeout": timeout
            }
        
        execution_time = time.time() - start_time
        
        # Decode output
        stdout_text = stdout.decode('utf-8', errors='replace').strip() if stdout else ""
        stderr_text = stderr.decode('utf-8', errors='replace').strip() if stderr else ""
        
        # Determine success based on return code
        success = process.returncode == 0
        
        result = {
            "success": success,
            "return_code": process.returncode,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "command": command,
            "working_directory": cwd,
            "execution_time": round(execution_time, 2)
        }
        
        # Add error message if command failed
        if not success:
            error_msg = stderr_text if stderr_text else f"Command failed with return code {process.returncode}"
            result["error"] = error_msg
        
        return result
        
    except Exception as e:
        execution_time = time.time() - start_time if 'start_time' in locals() else 0
        return {
            "success": False,
            "error": f"Failed to execute command: {str(e)}",
            "command": command,
            "working_directory": working_directory,
            "execution_time": round(execution_time, 2)
        }


async def get_codebase_overview() -> Dict[str, Any]:
    """
    Get a comprehensive overview of the current codebase.
    
    Returns:
        Dictionary with codebase overview including languages, file counts, frameworks, etc.
    """
    try:
        # First try the fresh overview endpoint to ensure we get current data
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:23816/api/codebase/overview-fresh")
            
            if response.status_code == 200:
                result = response.json()
                # Add a note that this was a fresh index
                if "overview" in result:
                    result["fresh_index"] = True
                return result
            else:
                # Fallback to regular overview if fresh fails
                response = await client.get("http://localhost:23816/api/codebase/overview")
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {
                        "success": False,
                        "error": f"Failed to get codebase overview: HTTP {response.status_code}"
                    }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error getting codebase overview: {str(e)}"
        }


async def search_codebase(query: str, element_types: str = None, limit: int = 20) -> Dict[str, Any]:
    """
    Search for code elements (functions, classes, etc.) in the indexed codebase.
    
    Args:
        query: Search query for code element names or signatures
        element_types: Optional comma-separated list of element types to filter by 
                      (function, class, interface, component, type)
        limit: Maximum number of results to return
        
    Returns:
        Dictionary with search results
    """
    try:
        params = {"query": query, "limit": limit}
        if element_types:
            params["element_types"] = element_types
            
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:23816/api/codebase/search", params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to search codebase: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error searching codebase: {str(e)}"
        }


async def get_file_overview(file_path: str) -> Dict[str, Any]:
    """
    Get an overview of a specific file including its code elements.
    
    Args:
        file_path: Path to the file to get overview for
        
    Returns:
        Dictionary with file overview including language, line count, and code elements
    """
    try:
        params = {"file_path": file_path}
        
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:23816/api/codebase/file-overview", params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to get file overview: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error getting file overview: {str(e)}"
        }


async def get_codebase_indexing_info() -> Dict[str, Any]:
    """
    Get information about the current codebase indexing setup.
    
    Returns:
        Dictionary with indexing information including workspace path, cache location, 
        database path, and statistics about indexed files and code elements
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:23816/api/codebase/info")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to get indexing info: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error getting codebase indexing info: {str(e)}"
        }


async def cleanup_old_codebase_cache() -> Dict[str, Any]:
    """
    Clean up old .pointer_cache directory in the workspace.
    
    Returns:
        Dictionary with cleanup results indicating success/failure and details
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post("http://localhost:23816/api/codebase/cleanup-old-cache")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to cleanup old cache: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error cleaning up old cache: {str(e)}"
        }


async def get_ai_codebase_context() -> Dict[str, Any]:
    """
    Get a comprehensive AI-friendly summary of the entire codebase.
    
    Returns:
        Dictionary with project summary, important files, common patterns, 
        directory structure, and other contextual information useful for AI understanding
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:23816/api/codebase/ai-context")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to get AI context: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error getting AI codebase context: {str(e)}"
        }


async def query_codebase_natural_language(query: str) -> Dict[str, Any]:
    """
    Ask natural language questions about the codebase structure and content.
    
    Args:
        query: Natural language question about the codebase (e.g., "How many React components are there?", 
               "What files contain authentication logic?", "Show me the largest files")
               
    Returns:
        Dictionary with answers to the natural language query about codebase structure
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:23816/api/codebase/query",
                json={"query": query}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to query codebase: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error querying codebase: {str(e)}"
        }


async def get_relevant_codebase_context(query: str, max_files: int = 5) -> Dict[str, Any]:
    """
    Get relevant code context for a specific task or query.
    
    Args:
        query: Description of what you're working on or need context for
               (e.g., "implementing user authentication", "fixing the payment system", 
               "adding a new React component")
        max_files: Maximum number of relevant files to return (default: 5)
        
    Returns:
        Dictionary with relevant files, code elements, and suggestions for the given task/query
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:23816/api/codebase/context",
                json={"query": query, "max_files": max_files}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to get context: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error getting relevant context: {str(e)}"
        }

async def force_codebase_reindex() -> Dict[str, Any]:
    """
    Force a fresh reindex of the current codebase to ensure up-to-date information.
    
    Returns:
        Dictionary with reindexing results and updated codebase overview
    """
    try:
        async with httpx.AsyncClient() as client:
            # First clear the cache
            clear_response = await client.post("http://localhost:23816/api/codebase/clear-cache")
            
            if clear_response.status_code == 200:
                clear_result = clear_response.json()
                
                # Then get a fresh overview
                overview_response = await client.get("http://localhost:23816/api/codebase/overview-fresh")
                
                if overview_response.status_code == 200:
                    overview_result = overview_response.json()
                    overview_result["cache_cleared"] = True
                    overview_result["clear_result"] = clear_result
                    return overview_result
                else:
                    return {
                        "success": False,
                        "error": f"Failed to get fresh overview after clearing cache: HTTP {overview_response.status_code}"
                    }
            else:
                return {
                    "success": False,
                    "error": f"Failed to clear cache: HTTP {clear_response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error forcing codebase reindex: {str(e)}"
        }

async def cleanup_codebase_database() -> Dict[str, Any]:
    """
    Clean up stale entries from the codebase database (files that no longer exist).
    
    Returns:
        Dictionary with cleanup results including number of removed files and elements
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post("http://localhost:23816/api/codebase/cleanup-database")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Failed to cleanup database: HTTP {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error cleaning up codebase database: {str(e)}"
        }

async def delete_file(file_path: str = None, target_file: str = None) -> Dict[str, Any]:
    """
    Delete a file.
    
    Args:
        file_path: Path to the file to delete (can be relative to workspace)
        target_file: Alternative path to the file to delete (takes precedence over file_path, can be relative)
        
    Returns:
        Dictionary with deletion result
    """
    # Use target_file if provided, otherwise use file_path
    actual_path = target_file if target_file is not None else file_path
    
    if actual_path is None:
        return {
            "success": False,
            "error": "No file path provided"
        }
    
    try:
        # Resolve relative path against current working directory (user's workspace)
        resolved_path = resolve_path(actual_path)
        
        # Check if file exists
        if not os.path.exists(resolved_path):
            return {
                "success": False,
                "error": f"File not found: {file_path} (resolved to: {resolved_path})"
            }
        
        # Check if it's actually a file (not a directory)
        if not os.path.isfile(resolved_path):
            return {
                "success": False,
                "error": f"Path is not a file: {file_path} (resolved to: {resolved_path})"
            }
        
        # Delete the file
        os.remove(resolved_path)
        
        return {
            "success": True,
            "message": f"File deleted successfully: {actual_path}",
            "file_path": actual_path,
            "resolved_path": resolved_path
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error deleting file: {str(e)}"
        }


async def move_file(source_path: str, destination_path: str, create_directories: bool = True) -> Dict[str, Any]:
    """
    Move or rename a file.
    
    Args:
        source_path: Current path of the file (can be relative to workspace)
        destination_path: New path for the file (can be relative to workspace)
        create_directories: Whether to create parent directories if they don't exist
        
    Returns:
        Dictionary with move result
    """
    try:
        # Resolve relative paths against current working directory (user's workspace)
        source_resolved = resolve_path(source_path)
        dest_resolved = resolve_path(destination_path)
        
        # Check if source file exists
        if not os.path.exists(source_resolved):
            return {
                "success": False,
                "error": f"Source file not found: {source_path} (resolved to: {source_resolved})"
            }
        
        # Check if destination already exists
        if os.path.exists(dest_resolved):
            return {
                "success": False,
                "error": f"Destination already exists: {destination_path} (resolved to: {dest_resolved})"
            }
        
        # Create parent directories if needed
        if create_directories:
            parent_dir = os.path.dirname(dest_resolved)
            if parent_dir and not os.path.exists(parent_dir):
                os.makedirs(parent_dir, exist_ok=True)
        
        # Move the file
        import shutil
        shutil.move(source_resolved, dest_resolved)
        
        return {
            "success": True,
            "message": f"File moved successfully: {source_path} -> {destination_path}",
            "source_path": source_path,
            "source_resolved": source_resolved,
            "destination_path": destination_path,
            "destination_resolved": dest_resolved
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error moving file: {str(e)}"
        }


async def copy_file(source_path: str, destination_path: str, create_directories: bool = True) -> Dict[str, Any]:
    """
    Copy a file to a new location.
    
    Args:
        source_path: Path of the file to copy (can be relative to workspace)
        destination_path: Path where the copy should be created (can be relative to workspace)
        create_directories: Whether to create parent directories if they don't exist
        
    Returns:
        Dictionary with copy result
    """
    try:
        # Resolve relative paths against current working directory (user's workspace)
        source_resolved = resolve_path(source_path)
        dest_resolved = resolve_path(destination_path)
        
        # Check if source file exists
        if not os.path.exists(source_resolved):
            return {
                "success": False,
                "error": f"Source file not found: {source_path} (resolved to: {source_resolved})"
            }
        
        # Check if destination already exists
        if os.path.exists(dest_resolved):
            return {
                "success": False,
                "error": f"Destination already exists: {destination_path} (resolved to: {dest_resolved})"
            }
        
        # Create parent directories if needed
        if create_directories:
            parent_dir = os.path.dirname(dest_resolved)
            if parent_dir and not os.path.exists(parent_dir):
                os.makedirs(parent_dir, exist_ok=True)
        
        # Copy the file
        import shutil
        shutil.copy2(source_resolved, dest_resolved)
        
        file_size = os.path.getsize(dest_resolved)
        
        return {
            "success": True,
            "message": f"File copied successfully: {source_path} -> {destination_path}",
            "source_path": source_path,
            "source_resolved": source_resolved,
            "destination_path": destination_path,
            "destination_resolved": dest_resolved,
            "size": file_size
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error copying file: {str(e)}"
        }


async def handle_tool_call(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a tool call by dispatching to the appropriate handler.
    
    Args:
        tool_name: Name of the tool to call
        params: Parameters for the tool
        
    Returns:
        Result of the tool execution
    """
    if tool_name not in TOOL_HANDLERS:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}"
        }
    
    # Get the handler function
    handler = TOOL_HANDLERS[tool_name]
    
    try:
        # Call the handler with parameters (no workspace_dir needed since cwd is set)
        result = await handler(**params)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": f"Error executing tool {tool_name}: {str(e)}"
        }


# Tool definitions for API documentation
TOOL_DEFINITIONS = [
    {
        "name": "read_file",
        "description": "Read the contents of a file",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The path to the file to read (can be relative to workspace)"
                },
                "target_file": {
                    "type": "string",
                    "description": "Alternative path to the file to read (takes precedence over file_path, can be relative)"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "delete_file",
        "description": "Delete a file",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to delete (can be relative to workspace)"
                },
                "target_file": {
                    "type": "string",
                    "description": "Alternative path to the file to delete (takes precedence over file_path, can be relative)"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "move_file",
        "description": "Move or rename a file",
        "parameters": {
            "type": "object",
            "properties": {
                "source_path": {
                    "type": "string",
                    "description": "Current path of the file (can be relative to workspace)"
                },
                "destination_path": {
                    "type": "string",
                    "description": "New path for the file (can be relative to workspace)"
                },
                "create_directories": {
                    "type": "boolean",
                    "description": "Whether to create parent directories if they don't exist (default: true)"
                }
            },
            "required": ["source_path", "destination_path"]
        }
    },
    {
        "name": "copy_file",
        "description": "Copy a file to a new location",
        "parameters": {
            "type": "object",
            "properties": {
                "source_path": {
                    "type": "string",
                    "description": "Path of the file to copy (can be relative to workspace)"
                },
                "destination_path": {
                    "type": "string",
                    "description": "Path where the copy should be created (can be relative to workspace)"
                },
                "create_directories": {
                    "type": "boolean",
                    "description": "Whether to create parent directories if they don't exist (default: true)"
                }
            },
            "required": ["source_path", "destination_path"]
        }
    },
    {
        "name": "list_directory",
        "description": "List the contents of a directory",
        "parameters": {
            "type": "object",
            "properties": {
                "directory_path": {
                    "type": "string",
                    "description": "The path to the directory to list (can be relative to workspace)"
                }
            },
            "required": ["directory_path"]
        }
    },
    {
        "name": "web_search",
        "description": "Search the web for information using Startpage (Google results without tracking)",
        "parameters": {
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "The search query"
                },
                "query": {
                    "type": "string",
                    "description": "Alternative search query (search_term takes precedence)"
                },
                        "num_results": {
            "type": "integer",
            "description": "Number of results to return (default: 5, max: 20)"
        },
                "location": {
                    "type": "string",
                    "description": "Optional location for local search (limited support with scraping)"
                }
            },
            "required": ["search_term"]
        }
    },
    {
        "name": "fetch_webpage",
        "description": "Fetch and extract content from a webpage",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL of the webpage to fetch"
                }
            },
            "required": ["url"]
        }
    },
    {
        "name": "grep_search",
        "description": "Search for a pattern in files",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The pattern to search for"
                },
                "include_pattern": {
                    "type": "string",
                    "description": "Optional file pattern to include (e.g. '*.ts')"
                },
                "exclude_pattern": {
                    "type": "string",
                    "description": "Optional file pattern to exclude (e.g. 'node_modules')"
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "Whether the search should be case sensitive"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "run_terminal_cmd",
        "description": "Execute a terminal/console command and return the output. IMPORTANT: You MUST provide the 'command' parameter with the actual shell command to execute (e.g., 'ls -la', 'npm run build', 'git status'). This tool runs the command in a shell and returns stdout, stderr, and exit code.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "REQUIRED: The actual shell command to execute. Examples: 'ls -la', 'npm install', 'python --version', 'git status'. Do not include shell operators like '&&' unless necessary."
                },
                "working_directory": {
                    "type": "string",
                    "description": "Optional: The directory path where the command should be executed. If not provided, uses current working directory."
                },
                "timeout": {
                    "type": "integer",
                    "description": "Optional: Maximum seconds to wait for command completion (default: 30). Use higher values for long-running commands."
                }
            },
            "required": ["command"]
        }
    },
    {
        "name": "get_codebase_overview",
        "description": "Get a comprehensive overview of the current codebase",
        "parameters": {}
    },
    {
        "name": "search_codebase",
        "description": "Search for code elements in the indexed codebase",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query for code element names or signatures"
                },
                "element_types": {
                    "type": "string",
                    "description": "Optional comma-separated list of element types to filter by (function, class, interface, component, type)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_file_overview",
        "description": "Get an overview of a specific file including its code elements",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to get overview for"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "get_codebase_indexing_info",
        "description": "Get information about the current codebase indexing setup",
        "parameters": {}
    },
    {
        "name": "cleanup_old_codebase_cache",
        "description": "Clean up old .pointer_cache directory in the workspace",
        "parameters": {}
    },
    {
        "name": "get_ai_codebase_context",
        "description": "Get a comprehensive AI-friendly summary of the entire codebase",
        "parameters": {}
    },
    {
        "name": "query_codebase_natural_language",
        "description": "Ask natural language questions about the codebase structure and content",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language question about the codebase"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_relevant_codebase_context",
        "description": "Get relevant code context for a specific task or query",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Description of what you're working on or need context for"
                },
                "max_files": {
                    "type": "integer",
                    "description": "Maximum number of relevant files to return (default: 5)"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "force_codebase_reindex",
        "description": "Force a fresh reindex of the current codebase to ensure up-to-date information",
        "parameters": {}
    },
    {
        "name": "cleanup_codebase_database",
        "description": "Clean up stale entries from the codebase database (files that no longer exist)",
        "parameters": {}
    }
]

# Dictionary mapping tool names to handler functions (defined at end after all functions)
TOOL_HANDLERS = {
    "read_file": read_file,
    "delete_file": delete_file,
    "move_file": move_file,
    "copy_file": copy_file,
    "list_directory": list_directory,
    "web_search": web_search,
    "fetch_webpage": fetch_webpage,
    "grep_search": grep_search,
    "run_terminal_cmd": run_terminal_cmd,
    "get_codebase_overview": get_codebase_overview,
    "search_codebase": search_codebase,
    "get_file_overview": get_file_overview,
    "get_codebase_indexing_info": get_codebase_indexing_info,
    "cleanup_old_codebase_cache": cleanup_old_codebase_cache,
    "get_ai_codebase_context": get_ai_codebase_context,
    "query_codebase_natural_language": query_codebase_natural_language,
    "get_relevant_codebase_context": get_relevant_codebase_context,
    "force_codebase_reindex": force_codebase_reindex,
    "cleanup_codebase_database": cleanup_codebase_database,
        } 