import React, { useState, useEffect } from 'react';
import { GitService } from '../services/gitService';
import { GitHubService, UserRepository, PopularRepository } from '../services/GitHubService';

interface CloneRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClone: (url: string, directory: string) => Promise<void>;
}

interface SearchResult {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

const CloneRepositoryModal: React.FC<CloneRepositoryModalProps> = ({ isOpen, onClose, onClone }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [cloneLocation, setCloneLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [popularRepos, setPopularRepos] = useState<PopularRepository[]>([]);
  const [userRepos, setUserRepos] = useState<UserRepository[]>([]);
  const [activeTab, setActiveTab] = useState<'url' | 'popular' | 'user'>('url');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isGitHubSettingsOpen, setIsGitHubSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'popular') {
        fetchPopularRepos();
      } else if (activeTab === 'user') {
        fetchUserRepos();
      }
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (activeTab === 'url' && searchQuery.trim()) {
        setIsSearching(true);
        try {
          const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&per_page=10`);
          if (!response.ok) throw new Error('Failed to fetch search results');
          const data = await response.json();
          setSearchResults(data.items);
        } catch (err) {
          console.error('Error searching repositories:', err);
          setError('Failed to search repositories. Please try again.');
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, activeTab]);

  const fetchPopularRepos = async () => {
    try {
      setIsLoadingRepos(true);
      const repos = await GitHubService.getPopularRepositories();
      setPopularRepos(repos);
    } catch (err) {
      console.error('Error fetching popular repositories:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchUserRepos = async () => {
    try {
      setIsLoadingRepos(true);
      const repos = await GitHubService.getUserRepositories();
      setUserRepos(repos);
    } catch (err) {
      console.error('Error fetching user repositories:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      setError('Repository URL is required');
      return;
    }
    
    if (!cloneLocation.trim()) {
      setError('Clone location is required');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await onClone(repoUrl.trim(), cloneLocation.trim());
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRepoUrl('');
    setCloneLocation('');
    setError('');
    setActiveTab('url');
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  const handleBrowse = async () => {
    try {
      const response = await fetch('http://localhost:23816/open-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to open directory: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.path) {
        setCloneLocation(data.path);
      }
    } catch (err) {
      console.error('Error selecting directory:', err);
      setError('Failed to select directory. Please try again or enter the path manually.');
    }
  };

  const selectRepository = (repo: UserRepository | PopularRepository | SearchResult) => {
    if ('html_url' in repo) {
      setRepoUrl(repo.html_url);
    } else {
      setRepoUrl(repo.url);
    }
    setActiveTab('url');
  };

  const filterRepositories = (repos: (UserRepository | PopularRepository)[], query: string) => {
    if (!query.trim()) return repos;
    
    const searchLower = query.toLowerCase();
    return repos.filter(repo => 
      repo.name.toLowerCase().includes(searchLower) ||
      (repo.description && repo.description.toLowerCase().includes(searchLower)) ||
      (repo.owner && repo.owner.toLowerCase().includes(searchLower))
    );
  };

  const filteredPopularRepos = filterRepositories(popularRepos, searchQuery);
  const filteredUserRepos = filterRepositories(userRepos, searchQuery);

  const isPopularRepository = (repo: UserRepository | PopularRepository): repo is PopularRepository => {
    return 'stars' in repo;
  };

  const isUserRepository = (repo: UserRepository | PopularRepository): repo is UserRepository => {
    return 'isPrivate' in repo && 'lastUpdated' in repo;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content" style={{ width: '650px', padding: '20px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-primary)' }}>
            Clone Repository
          </h2>
          
          {error && (
            <div style={{ 
              padding: '8px 12px', 
              marginBottom: '16px', 
              backgroundColor: 'rgba(244, 67, 54, 0.1)', 
              color: 'var(--error-color)',
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`modal-tab ${activeTab === 'url' ? 'modal-tab-active' : ''}`}
              >
                Repository URL
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('popular')}
                className={`modal-tab ${activeTab === 'popular' ? 'modal-tab-active' : ''}`}
              >
                Popular Repositories
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('user')}
                className={`modal-tab ${activeTab === 'user' ? 'modal-tab-active' : ''}`}
              >
                My Repositories
              </button>
              <div style={{ flex: 1 }}></div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            {activeTab === 'url' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="modal-label" htmlFor="repo-url">
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository.git"
                  className="modal-input"
                />
                <div style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search public repositories..."
                    className="modal-input"
                  />
                </div>
                {searchQuery && (
                  <div style={{ 
                    maxHeight: '250px', 
                    overflowY: 'auto', 
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    marginTop: '12px'
                  }}>
                    {isSearching ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Searching repositories...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No repositories found matching your search
                      </div>
                    ) : (
                      searchResults.map(repo => (
                        <div 
                          key={repo.full_name}
                          onClick={() => selectRepository(repo)}
                          className="repo-list-item"
                        >
                          <div className="repo-title">
                            <img 
                              src={repo.owner.avatar_url}
                              alt={repo.owner.login}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                marginRight: '8px',
                                verticalAlign: 'middle'
                              }}
                            />
                            {repo.full_name}
                          </div>
                          <div className="repo-description">{repo.description}</div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            marginTop: '4px'
                          }}>
                            <span style={{ color: 'var(--accent-color)', fontSize: '11px' }}>
                              {repo.html_url}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'popular' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Popular Repositories
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search popular repositories..."
                  className="modal-input"
                  style={{ marginBottom: '12px' }}
                />
                <div style={{ 
                  maxHeight: '250px', 
                  overflowY: 'auto', 
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px'
                }}>
                  {isLoadingRepos ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading repositories...
                    </div>
                  ) : filteredPopularRepos.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {searchQuery ? 'No repositories found matching your search' : 'No repositories found'}
                    </div>
                  ) : (
                    filteredPopularRepos.map(repo => (
                      <div 
                        key={repo.name}
                        onClick={() => selectRepository(repo)}
                        className="repo-list-item"
                      >
                        <div className="repo-title">
                          <img 
                            src={repo.ownerAvatar}
                            alt={repo.owner}
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              marginRight: '8px',
                              verticalAlign: 'middle'
                            }}
                          />
                          {repo.owner}/{repo.name}
                        </div>
                        <div className="repo-description">{repo.description}</div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px'
                        }}>
                          {isPopularRepository(repo) && <span>⭐ {repo.stars.toLocaleString()}</span>}
                          <span style={{ color: 'var(--accent-color)', fontSize: '11px' }}>
                            {repo.url}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'user' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  My Repositories
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your repositories..."
                  className="modal-input"
                  style={{ marginBottom: '12px' }}
                />
                <div style={{ 
                  maxHeight: '250px', 
                  overflowY: 'auto', 
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px'
                }}>
                  {isLoadingRepos ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading repositories...
                    </div>
                  ) : filteredUserRepos.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {searchQuery ? 'No repositories found matching your search' : 'No repositories found'}
                    </div>
                  ) : (
                    filteredUserRepos.map(repo => (
                      <div 
                        key={repo.name}
                        onClick={() => selectRepository(repo)}
                        className="repo-list-item"
                      >
                        <div className="repo-title">
                          <img 
                            src={repo.ownerAvatar}
                            alt={repo.owner}
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              marginRight: '8px',
                              verticalAlign: 'middle'
                            }}
                          />
                          {repo.name}
                          {isUserRepository(repo) && repo.isPrivate && (
                            <span style={{ 
                              marginLeft: '8px', 
                              fontSize: '10px', 
                              padding: '2px 5px', 
                              backgroundColor: 'var(--bg-tertiary)', 
                              borderRadius: '3px',
                              color: 'var(--text-secondary)'
                            }}>
                              Private
                            </span>
                          )}
                        </div>
                        <div className="repo-description">{repo.description}</div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px'
                        }}>
                          {isUserRepository(repo) && <span>Last updated: {repo.lastUpdated}</span>}
                          <span style={{ color: 'var(--accent-color)', fontSize: '11px' }}>
                            {repo.url}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <div style={{ marginBottom: '24px' }}>
              <label className="modal-label" htmlFor="clone-location">
                Clone Location
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="clone-location"
                  type="text"
                  value={cloneLocation}
                  onChange={(e) => setCloneLocation(e.target.value)}
                  placeholder="Select a directory"
                  className="modal-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="modal-button modal-button-secondary"
                >
                  Browse
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={handleClose}
                className="modal-button modal-button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="modal-button modal-button-primary"
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* TODO: Add GitHubSettings component */}
      {isGitHubSettingsOpen && (
        <div>GitHub Settings placeholder</div>
        // <GitHubSettings onClose={() => setIsGitHubSettingsOpen(false)} />
      )}
    </>
  );
};

export default CloneRepositoryModal; 