const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const isDev = process.env.NODE_ENV !== 'production';
const DiscordRPC = require('discord-rpc');
const fs = require('fs');

console.log('Electron app is starting...');

// Discord RPC client
let rpc = null;
const DISCORD_CLIENT_ID = '1350617401724768328';
let startTimestamp = null;
let discordRpcSettings = {
  enabled: true,
  details: 'Editing {file}',
  state: 'Workspace: {workspace}',
  largeImageKey: 'pointer_logo',
  largeImageText: 'Pointer - Code Editor',
  smallImageKey: 'code',
  smallImageText: '{languageId} | Line {line}:{column}',
  button1Label: 'Download Pointer',
  button1Url: 'https://pointer.f1shy312.com',
  button2Label: '',
  button2Url: '',
};

// Function to load settings from storage
async function loadSettings() {
  try {
    // Use platform-specific path for settings
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    
    console.log('Looking for Discord RPC settings at:', settingsPath);
    
    // Check if settings file exists
    if (fs.existsSync(settingsPath)) {
      console.log('Loading Discord RPC settings from:', settingsPath);
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Update the settings
      if (settings && typeof settings === 'object') {
        console.log('Discord RPC settings loaded successfully');
        discordRpcSettings = { ...discordRpcSettings, ...settings };
        
        // Log the current settings for debugging
        console.log('Current Discord RPC settings:');
        console.log('- Enabled:', discordRpcSettings.enabled);
        console.log('- Details template:', discordRpcSettings.details);
        console.log('- State template:', discordRpcSettings.state);
        console.log('- Button 1:', discordRpcSettings.button1Label, discordRpcSettings.button1Url ? '(URL set)' : '(no URL)');
        console.log('- Button 2:', discordRpcSettings.button2Label, discordRpcSettings.button2Url ? '(URL set)' : '(no URL)');
      }
    } else {
      console.log('No saved Discord RPC settings found, using defaults');
      
      // Create the settings directory if it doesn't exist
      const settingsDir = path.dirname(settingsPath);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      
      // Save the default settings
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
        console.log('Default Discord RPC settings saved to:', settingsPath);
      } catch (saveError) {
        console.error('Error saving default Discord RPC settings:', saveError);
      }
    }
  } catch (error) {
    console.error('Error loading Discord RPC settings:', error);
  }
}

// Discord icon mappings - these must match asset names in your Discord Developer Portal
const LANGUAGE_ICONS = {
  'javascript': 'javascript',
  'typescript': 'typescript',
  'python': 'python',
  'html': 'html',
  'css': 'css',
  'json': 'json',
  'markdown': 'markdown',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'csharp': 'csharp',
  'go': 'go',
  'php': 'php',
  'ruby': 'ruby',
  'rust': 'rust',
  'shell': 'shell',
  'sql': 'sql',
  'xml': 'xml',
  'yaml': 'yaml',
};

let editorInfo = {
  file: 'Untitled',
  workspace: 'Pointer',
  line: 1,
  column: 1,
  languageId: 'plaintext',
  fileSize: '0 KB',
};

// Initialize Discord RPC
async function initDiscordRPC() {
  // Load settings first
  await loadSettings();
  
  if (!discordRpcSettings.enabled) {
    console.log('Discord RPC is disabled in settings');
    return;
  }
  
  // Register and create client
  DiscordRPC.register(DISCORD_CLIENT_ID);
  rpc = new DiscordRPC.Client({ transport: 'ipc' });
  startTimestamp = new Date();
  
  // Handle the ready event
  rpc.on('ready', () => {
    console.log('Discord RPC ready');
    updateRichPresence();
  });
  
  // Login with client ID
  rpc.login({ clientId: DISCORD_CLIENT_ID })
    .catch(error => console.error('Discord RPC login failed:', error));
}

// Update Discord Rich Presence with current editor info
function updateRichPresence() {
  if (!rpc || !discordRpcSettings.enabled) return;
  
  try {
    // Check if user is not editing a real file
    const isIdling = !editorInfo.file || editorInfo.file === 'Untitled' || editorInfo.file === 'Welcome';
    
    // Replace placeholders in messages
    const details = replaceVariables(discordRpcSettings.details);
    const state = replaceVariables(discordRpcSettings.state);
    const largeImageText = replaceVariables(discordRpcSettings.largeImageText);
    const smallImageText = replaceVariables(discordRpcSettings.smallImageText);
    
    // Determine correct image keys based on language
    let smallImageKey = discordRpcSettings.smallImageKey;
    if (editorInfo.languageId && discordRpcSettings.smallImageKey === 'code') {
      // Use language-specific icons when available if using default 'code' setting
      if (LANGUAGE_ICONS[editorInfo.languageId]) {
        smallImageKey = LANGUAGE_ICONS[editorInfo.languageId];
      }
    }
    
    // Prepare buttons array
    const buttons = [];
    
    // Add buttons if they have values
    if (discordRpcSettings.button1Label && discordRpcSettings.button1Url) {
      buttons.push({
        label: discordRpcSettings.button1Label.substring(0, 32),
        url: discordRpcSettings.button1Url
      });
    }
    
    if (discordRpcSettings.button2Label && discordRpcSettings.button2Url) {
      buttons.push({
        label: discordRpcSettings.button2Label.substring(0, 32),
        url: discordRpcSettings.button2Url
      });
    }
    
    // Build the activity object
    const activity = {
      details: isIdling ? 'Idling' : (details || 'Editing'),
      state: state || 'In Pointer Editor',
      startTimestamp: startTimestamp,
      largeImageKey: discordRpcSettings.largeImageKey || 'pointer_logo',
      largeImageText: largeImageText || 'Pointer Code Editor',
      smallImageKey: smallImageKey,
      smallImageText: smallImageText,
      instance: false
    };
    
    // Only add buttons if we have any
    if (buttons.length > 0) {
      activity.buttons = buttons;
    }
    
    // Set the activity
    rpc.setActivity(activity)
      .catch(error => {
        console.error('Discord RPC error:', error);
      });
      
  } catch (error) {
    console.error('Error in updateRichPresence:', error);
  }
}

// Replace placeholder variables in Discord RPC messages
function replaceVariables(message) {
  if (!message) return '';
  
  // Check if user is not editing a real file
  let fileDisplay = editorInfo.file;
  if (!fileDisplay || fileDisplay === 'Untitled' || fileDisplay === 'Welcome') {
    fileDisplay = 'Idling';
  }
  
  return message
    .replace(/{file}/g, fileDisplay)
    .replace(/{workspace}/g, editorInfo.workspace)
    .replace(/{line}/g, editorInfo.line)
    .replace(/{column}/g, editorInfo.column)
    .replace(/{languageId}/g, editorInfo.languageId)
    .replace(/{fileSize}/g, editorInfo.fileSize);
}

// Define icon path based on platform
const getIconPath = () => {
  const platform = os.platform();
  const logoPath = path.join(__dirname, 'logo.png');
  
  // On macOS, return the PNG file
  // On Windows and Linux, still use the PNG - electron-builder will use the correct icon from package.json
  return logoPath;
};

// Create a variable to hold the splash window
let splashWindow = null;

// Update splash screen message
function updateSplashMessage(message) {
  if (splashWindow) {
    splashWindow.webContents.executeJavaScript(`
      document.querySelector('.message').textContent = "${message}";
    `).catch(err => console.error('Error updating splash message:', err));
  }
}

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    resizable: false,
    icon: getIconPath(),
    skipTaskbar: true, // Hide from taskbar until main window is ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the splash screen HTML
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  // Prevent the splash screen from closing when clicked
  splashWindow.on('blur', () => {
    splashWindow.focus();
  });
}

// Check if the backend is running
async function checkBackendConnection() {
  const maxRetries = 10;
  const retryDelay = 1000;
  let retries = 0;

  updateSplashMessage('Connecting to backend...');
  
  while (retries < maxRetries) {
    try {
      const response = await fetch('http://127.0.0.1:23816/test-backend');
      if (response.ok) {
        const data = await response.json();
        console.log('Backend connection successful:', data.message);
        return true;
      }
    } catch (err) {
      console.log('Waiting for backend...', retries + 1);
    }
    
    updateSplashMessage(`Connecting to backend... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    retries++;
  }

  return false;
}

async function waitForViteServer() {
  const maxRetries = 10;
  const retryDelay = 1000;
  let retries = 0;

  updateSplashMessage('Starting development server...');

  while (retries < maxRetries) {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok) {
        console.log('Vite server is ready');
        return true;
      }
    } catch (err) {
      console.log('Waiting for Vite server...', retries + 1);
    }
    
    updateSplashMessage(`Starting development server... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    retries++;
  }
  return false;
}

// Function to show and hide windows with timeout protection
function showMainWindow(mainWindow) {
  console.log('Main window ready to show, cleaning up splash screen');
  
  // Close the splash screen
  if (splashWindow) {
    try {
      splashWindow.destroy();
    } catch (err) {
      console.error('Error closing splash screen:', err);
    }
    splashWindow = null;
  }
  
  // Show main window
  try {
    mainWindow.show();
    console.log('Main window shown successfully');
  } catch (err) {
    console.error('Error showing main window:', err);
  }
}

async function createWindow() {
  try {
    // Load settings first
    await loadSettings();
    
    // First check if backend is running
    const backendReady = await checkBackendConnection();
    if (!backendReady) {
      console.error('Failed to connect to backend');
      // Show error dialog
      if (splashWindow) {
        dialog.showErrorBox(
          'Connection Error',
          'Failed to connect to the backend. Please ensure the backend server is running.'
        );
        splashWindow.destroy();
      }
      app.quit();
      return;
    }
    
    // Update splash message
    updateSplashMessage('Initializing editor...');
    
    // Initialize Discord RPC after loading settings
    await initDiscordRPC();
    
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // Don't show until fully loaded
      icon: getIconPath(), // Set application icon
      title: 'Pointer', // Set window title
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Set up window event listeners for debugging
    mainWindow.webContents.on('did-start-loading', () => {
      console.log('Main window did-start-loading');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Main window did-finish-load');
    });

    mainWindow.webContents.on('dom-ready', () => {
      console.log('Main window dom-ready');
    });

    // Set the app user model ID for Windows
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.pointer');
    }

    // Set up a timeout fallback to show the window in case the ready-to-show event doesn't fire
    const windowShowTimeout = setTimeout(() => {
      console.log('Window show timeout reached, forcing display');
      showMainWindow(mainWindow);
    }, 10000); // 10 second fallback timeout

    // Once everything is loaded and rendered, show the main window and close the splash
    mainWindow.once('ready-to-show', () => {
      console.log('Main window ready-to-show event triggered');
      clearTimeout(windowShowTimeout); // Clear the timeout as we got the event
      showMainWindow(mainWindow);
    });

    // Load the app
    if (isDev) {
      // Wait for Vite server in development
      const serverReady = await waitForViteServer();
      if (!serverReady) {
        console.error('Failed to connect to Vite server');
        if (splashWindow) {
          dialog.showErrorBox(
            'Development Server Error',
            'Failed to connect to the development server. Please ensure "yarn start" is running.'
          );
          splashWindow.destroy();
        }
        app.quit();
        return;
      }

      updateSplashMessage('Loading development environment...');
      console.log('Loading development URL: http://localhost:3000');
      try {
        await mainWindow.loadURL('http://localhost:3000');
        console.log('Development URL loaded successfully');
      } catch (error) {
        console.error('Error loading development URL:', error);
        // Show the window anyway if we hit an error trying to load the URL
        showMainWindow(mainWindow);
      }
      
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    } else {
      updateSplashMessage('Loading application...');
      console.log('Loading application from dist folder');
      try {
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        console.log('Application loaded successfully from dist folder');
      } catch (error) {
        console.error('Error loading application from dist folder:', error);
        // Show the window anyway if we hit an error trying to load the file
        showMainWindow(mainWindow);
      }
    }

    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      if (isDev) {
        // Retry loading in development
        setTimeout(() => {
          console.log('Retrying to load the app...');
          mainWindow.loadURL('http://localhost:3000').catch(err => {
            console.error('Error retrying load:', err);
            // Force show the window even if we can't load it
            showMainWindow(mainWindow);
          });
        }, 1000);
      } else {
        // Force show the window even if we can't load it
        showMainWindow(mainWindow);
      }
    });

    // Log any console messages from the renderer process
    mainWindow.webContents.on('console-message', (event, level, message) => {
      console.log('Renderer Console:', message);
    });
  } catch (error) {
    console.error('Error in createWindow:', error);
    if (splashWindow) {
      dialog.showErrorBox(
        'Application Error',
        'An error occurred while initializing the application. Please try restarting the application.'
      );
      splashWindow.destroy();
    }
    app.quit();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('Electron app is ready.');
  
  // Load settings first thing
  await loadSettings();
  console.log('Settings loaded, creating splash screen...');
  
  // Create and show the splash screen
  createSplashScreen();
  
  if (isDev) {
    const session = require('electron').session;
    await session.defaultSession.clearCache();
    console.log('Cache cleared');
  }
  
  // Create the main window
  await createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  console.log('All windows closed. Quitting app...');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated. Checking for open windows...');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for Discord RPC
ipcMain.on('editor-info-update', (event, info) => {
  editorInfo = { ...editorInfo, ...info };
  updateRichPresence();
});

ipcMain.on('discord-settings-update', (event, settings) => {
  // Update the global settings object
  discordRpcSettings = { ...discordRpcSettings, ...settings };
  
  // Save the updated settings to file
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    
    // Create the settings directory if it doesn't exist
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    // Save the settings to file
    fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
    console.log('Discord RPC settings saved to:', settingsPath);
  } catch (error) {
    console.error('Error saving Discord RPC settings:', error);
  }
  
  // Reinitialize Discord RPC if enabled status changed
  if (settings.enabled !== undefined) {
    if (settings.enabled) {
      if (!rpc) {
        initDiscordRPC();
      }
    } else {
      if (rpc) {
        rpc.destroy().catch(console.error);
        rpc = null;
      }
    }
  } else {
    // Just update the presence with new settings
    updateRichPresence();
  }
});

// Update Discord Rich Presence settings
ipcMain.handle('update-discord-rpc-settings', async (event, newSettings) => {
  try {
    console.log('Updating Discord RPC settings:', newSettings);
    
    // Update the global settings object
    discordRpcSettings = { ...discordRpcSettings, ...newSettings };
    
    // Save settings to file
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    
    // Create the settings directory if it doesn't exist
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    // Save the settings
    fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
    console.log('Discord RPC settings saved to:', settingsPath);
    
    // Update the rich presence with new settings
    if (rpc && discordRpcSettings.enabled) {
      updateRichPresence();
    } else if (!discordRpcSettings.enabled && rpc) {
      // Clear presence if disabled
      rpc.clearActivity().catch(console.error);
      console.log('Discord RPC disabled and activity cleared');
    } else if (discordRpcSettings.enabled && !rpc) {
      // Re-initialize if it was disabled before
      initDiscordRPC();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating Discord RPC settings:', error);
    return { success: false, error: error.message };
  }
});

// Get Discord Rich Presence settings
ipcMain.handle('get-discord-rpc-settings', async () => {
  // Force reload settings from disk to ensure we have the latest
  await loadSettings();
  
  console.log('Responding to get-discord-rpc-settings request with:', {
    enabled: discordRpcSettings.enabled,
    details: discordRpcSettings.details,
    state: discordRpcSettings.state,
    button1Label: discordRpcSettings.button1Label,
    button1Url: discordRpcSettings.button1Url,
    button2Label: discordRpcSettings.button2Label,
    button2Url: discordRpcSettings.button2Url
  });
  
  return discordRpcSettings;
}); 