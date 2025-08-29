import { spawn } from 'node:child_process';

interface GitCommandResult {
  success: boolean;
  data: string;
  error?: string;
  userName?: string;
  userEmail?: string;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string;
  changes: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    hasCommitsToPush: boolean;
  };
}

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export class GitService {
  private static readonly API_URL = 'http://localhost:23816';

  /**
   * Checks if the current directory is a Git repository
   */
  static async isGitRepository(directory: string): Promise<boolean> {
    try {
      // Try using git command directly instead of checking for .git folder (which might be hidden)
      const response = await fetch(`${this.API_URL}/git/is-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          directory,
          includeHidden: true  // Add flag to include hidden files/folders
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isGitRepo;
    } catch (error) {
      console.error('Error checking if directory is a git repository:', error);
      return false;
    }
  }

  /**
   * Gets the status of the Git repository
   */
  static async getStatus(directory: string): Promise<GitStatus> {
    try {
      const response = await fetch(`${this.API_URL}/git/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to get git status: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting git status:', error);
      return {
        isGitRepo: false,
        branch: '',
        changes: {
          staged: [],
          unstaged: [],
          untracked: [],
          hasCommitsToPush: false
        }
      };
    }
  }

  /**
   * Initializes a new Git repository
   */
  static async initRepo(directory: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize git repository: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error initializing git repository:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Clones a Git repository
   */
  static async cloneRepository(url: string, directory: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to clone git repository: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error cloning git repository:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Checks if Git user identity is configured
   */
  static async checkIdentityConfig(directory: string): Promise<{ configured: boolean; userName?: string; userEmail?: string }> {
    try {
      const response = await fetch(`${this.API_URL}/git/check-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to check git identity: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking git identity:', error);
      return { configured: false };
    }
  }

  /**
   * Sets Git user identity configuration
   */
  static async setIdentityConfig(directory: string, name: string, email: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/set-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, name, email })
      });

      if (!response.ok) {
        throw new Error(`Failed to set git identity: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error setting git identity:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Commits changes to the repository
   */
  static async commit(directory: string, message: string): Promise<GitCommandResult> {
    try {
      // First check if identity is configured
      const identityCheck = await this.checkIdentityConfig(directory);
      if (!identityCheck.configured) {
        return {
          success: false,
          data: '',
          error: 'IDENTITY_NOT_CONFIGURED',
          userName: identityCheck.userName,
          userEmail: identityCheck.userEmail
        };
      }

      const response = await fetch(`${this.API_URL}/git/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, message })
      });

      if (!response.ok) {
        throw new Error(`Failed to commit changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error committing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Stages files to be committed
   */
  static async addFiles(directory: string, files: string[]): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, files })
      });

      if (!response.ok) {
        throw new Error(`Failed to stage files: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error staging files:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Unstages files
   */
  static async resetFiles(directory: string, files: string[]): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, files })
      });

      if (!response.ok) {
        throw new Error(`Failed to unstage files: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error unstaging files:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a hard reset to a specific commit
   */
  static async resetHard(directory: string, commit: string = 'HEAD'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-hard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform hard reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing hard reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a soft reset to a specific commit
   */
  static async resetSoft(directory: string, commit: string = 'HEAD~1'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-soft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform soft reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing soft reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a mixed reset to a specific commit
   */
  static async resetMixed(directory: string, commit: string = 'HEAD~1'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-mixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform mixed reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing mixed reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Pulls changes from a remote repository
   */
  static async pull(directory: string, remote: string = 'origin', branch: string = ''): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, remote, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error pulling changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Push commits to remote repository
   */
  static async push(directory: string, remote: string = 'origin', branch: string = ''): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, remote, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to push changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error pushing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Gets commit history
   */
  static async getLog(directory: string, limit: number = 50): Promise<GitLogEntry[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, limit })
      });

      if (!response.ok) {
        throw new Error(`Failed to get commit history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  /**
   * Creates and checks out a new branch
   */
  static async checkout(directory: string, branch: string, create: boolean = false): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, branch, create })
      });

      if (!response.ok) {
        throw new Error(`Failed to checkout branch: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking out branch:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Stashes changes
   */
  static async stash(directory: string, message?: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, message })
      });

      if (!response.ok) {
        throw new Error(`Failed to stash changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error stashing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Applies the most recent stash
   */
  static async stashPop(directory: string, index: number = 0): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash-pop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, stash_index: index })
      });

      if (!response.ok) {
        throw new Error(`Failed to apply stash: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error applying stash:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Lists all stashes
   */
  static async listStashes(directory: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to list stashes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.stashes || [];
    } catch (error) {
      console.error('Error listing stashes:', error);
      return [];
    }
  }

  /**
   * Creates or fetches a pull request
   */
  static async pullRequest(directory: string, options: { 
    title?: string, 
    body?: string, 
    baseBranch?: string, 
    headBranch?: string 
  }): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/pull-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          directory,
          ...options 
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create pull request: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating pull request:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Publishes the repository to GitHub
   */
  static async publishToGitHub(directory: string, options: {
    repoName: string,
    description?: string,
    isPrivate?: boolean
  }): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/publish-to-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directory,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to publish to GitHub: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error publishing to GitHub:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Gets a list of branches
   */
  static async getBranches(directory: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to get branches: ${response.statusText}`);
      }

      const data = await response.json();
      return data.branches || [];
    } catch (error) {
      console.error('Error getting branches:', error);
      return [];
    }
  }

  /**
   * Merges a branch into the current branch
   */
  static async merge(directory: string, branch: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to merge branch: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error merging branch:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }
} 