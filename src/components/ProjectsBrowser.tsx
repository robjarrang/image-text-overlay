'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from './Icons';

interface Folder {
  id: string;
  name: string;
  project_count: number;
  created_at: string;
  updated_at: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  currentProjectId?: string;
}

type View = 'root' | 'folder' | 'all';

export function ProjectsBrowser({ isOpen, onClose, onOpenProject, currentProjectId }: ProjectsBrowserProps) {
  const [view, setView] = useState<View>('root');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // New folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Move project state
  const [movingProject, setMovingProject] = useState<ProjectSummary | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'folder' | 'project'; id: string; name: string } | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch folders and unfiled projects for root view
  const fetchRoot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, projectsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/projects?unfiled=true'),
      ]);
      const foldersData = await foldersRes.json();
      const projectsData = await projectsRes.json();
      setFolders(foldersData.folders || []);
      setProjects(projectsData.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch projects in a specific folder
  const fetchFolder = useCallback(async (folder: Folder) => {
    setLoading(true);
    setError(null);
    setCurrentFolder(folder);
    setView('folder');
    try {
      const res = await fetch(`/api/projects?folder_id=${folder.id}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching folder projects:', err);
      setError('Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all projects
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setView('all');
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching all projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load root view when panel opens
  useEffect(() => {
    if (isOpen) {
      setView('root');
      setCurrentFolder(null);
      fetchRoot();
    }
  }, [isOpen, fetchRoot]);

  // Focus edit input when editing
  useEffect(() => {
    if ((editingFolderId || editingProjectId || isCreatingFolder) && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolderId, editingProjectId, isCreatingFolder]);

  // --- Folder CRUD ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        setNewFolderName('');
        setIsCreatingFolder(false);
        fetchRoot();
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    try {
      await fetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });
      setEditingFolderId(null);
      if (view === 'root') fetchRoot();
      else if (currentFolder?.id === folderId) {
        setCurrentFolder({ ...currentFolder, name: editingFolderName.trim() });
      }
    } catch (err) {
      console.error('Error renaming folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      setConfirmDelete(null);
      fetchRoot();
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  // --- Project actions ---
  const handleRenameProject = async (projectId: string) => {
    if (!editingProjectName.trim()) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingProjectName.trim() }),
      });
      setEditingProjectId(null);
      // Refresh current view
      if (view === 'root') fetchRoot();
      else if (view === 'folder' && currentFolder) fetchFolder(currentFolder);
      else fetchAll();
    } catch (err) {
      console.error('Error renaming project:', err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      setConfirmDelete(null);
      if (view === 'root') fetchRoot();
      else if (view === 'folder' && currentFolder) fetchFolder(currentFolder);
      else fetchAll();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleMoveProject = async (projectId: string, targetFolderId: string | null) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      setMovingProject(null);
      if (view === 'root') fetchRoot();
      else if (view === 'folder' && currentFolder) fetchFolder(currentFolder);
      else fetchAll();
    } catch (err) {
      console.error('Error moving project:', err);
    }
  };

  // --- Format dates ---
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="projects-browser-overlay" onClick={onClose}>
      <div
        className="projects-browser-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Projects browser"
      >
        {/* Header */}
        <div className="projects-browser-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {view !== 'root' && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="Back"
                onClick={() => { setView('root'); setCurrentFolder(null); fetchRoot(); }}
              >
                <Icons.Back size="x-small" />
              </button>
            )}
            <h2 className="slds-text-heading_medium" style={{ margin: 0 }}>
              {view === 'root' && 'Projects'}
              {view === 'folder' && currentFolder?.name}
              {view === 'all' && 'All Projects'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {view === 'root' && (
              <>
                <button
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  aria-label="View all projects"
                  title="View all projects"
                  onClick={fetchAll}
                >
                  <Icons.List size="x-small" />
                </button>
                <button
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  aria-label="New folder"
                  title="New folder"
                  onClick={() => { setIsCreatingFolder(true); setNewFolderName('New Folder'); }}
                >
                  <Icons.New size="x-small" />
                </button>
              </>
            )}
            <button
              className="slds-button slds-button_icon slds-button_icon-border-filled"
              aria-label="Close projects browser"
              onClick={onClose}
            >
              <Icons.Close size="x-small" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="projects-browser-content">
          {loading && (
            <div className="projects-browser-loading">
              <div className="slds-spinner_container" style={{ position: 'relative', height: '3rem' }}>
                <div role="status" className="slds-spinner slds-spinner_small">
                  <span className="slds-assistive-text">Loading</span>
                  <div className="slds-spinner__dot-a"></div>
                  <div className="slds-spinner__dot-b"></div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="slds-notify slds-notify_alert slds-alert_error slds-m-around_small" role="alert" style={{ position: 'relative' }}>
              <span className="slds-assistive-text">Error</span>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Move project picker */}
              {movingProject && (
                <div className="projects-browser-move-overlay">
                  <div className="projects-browser-move-panel">
                    <h3 className="slds-text-heading_small slds-m-bottom_small">
                      Move &ldquo;{movingProject.name}&rdquo; to:
                    </h3>
                    <ul className="slds-has-dividers_bottom-space">
                      <li className="slds-item">
                        <button
                          className="projects-browser-move-item"
                          onClick={() => handleMoveProject(movingProject.id, null)}
                        >
                          <Icons.File size="x-small" />
                          <span>No Folder (Unfiled)</span>
                        </button>
                      </li>
                      {folders.map((folder) => (
                        <li key={folder.id} className="slds-item">
                          <button
                            className="projects-browser-move-item"
                            onClick={() => handleMoveProject(movingProject.id, folder.id)}
                          >
                            <Icons.OpenFolder size="x-small" />
                            <span>{folder.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="slds-button slds-button_neutral slds-m-top_small"
                      onClick={() => setMovingProject(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="projects-browser-move-overlay">
                  <div className="projects-browser-move-panel">
                    <h3 className="slds-text-heading_small slds-m-bottom_small">
                      Delete &ldquo;{confirmDelete.name}&rdquo;?
                    </h3>
                    <p className="slds-text-body_regular slds-m-bottom_medium" style={{ color: 'var(--slds-g-color-neutral-base-30, #706e6b)' }}>
                      {confirmDelete.type === 'folder'
                        ? 'The folder will be deleted. Projects inside it will become unfiled.'
                        : 'This project will be permanently deleted.'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="slds-button slds-button_neutral"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="slds-button slds-button_destructive"
                        onClick={() => {
                          if (confirmDelete.type === 'folder') handleDeleteFolder(confirmDelete.id);
                          else handleDeleteProject(confirmDelete.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Create new folder inline */}
              {isCreatingFolder && view === 'root' && (
                <div className="projects-browser-item projects-browser-item--editing">
                  <Icons.OpenFolder size="x-small" />
                  <input
                    ref={editInputRef}
                    className="slds-input projects-browser-inline-input"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
                    }}
                    onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else setIsCreatingFolder(false); }}
                    placeholder="Folder name"
                  />
                </div>
              )}

              {/* Root view: folders + unfiled projects */}
              {view === 'root' && (
                <>
                  {folders.length === 0 && projects.length === 0 && !isCreatingFolder && (
                    <div className="projects-browser-empty">
                      <Icons.OpenFolder size="medium" />
                      <p className="slds-m-top_small">No projects saved yet.</p>
                      <p className="slds-text-body_small" style={{ color: 'var(--slds-g-color-neutral-base-30, #706e6b)' }}>
                        Click Share to save your first project.
                      </p>
                    </div>
                  )}

                  {/* Folders */}
                  {folders.map((folder) => (
                    <div key={folder.id} className="projects-browser-item projects-browser-item--folder">
                      {editingFolderId === folder.id ? (
                        <>
                          <Icons.OpenedFolder size="x-small" />
                          <input
                            ref={editInputRef}
                            className="slds-input projects-browser-inline-input"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameFolder(folder.id);
                              if (e.key === 'Escape') setEditingFolderId(null);
                            }}
                            onBlur={() => handleRenameFolder(folder.id)}
                          />
                        </>
                      ) : (
                        <>
                          <button
                            className="projects-browser-item-main"
                            onClick={() => fetchFolder(folder)}
                          >
                            <Icons.OpenFolder size="x-small" />
                            <span className="projects-browser-item-name">{folder.name}</span>
                            <span className="projects-browser-item-badge">{folder.project_count}</span>
                            <Icons.ChevronRight size="x-small" />
                          </button>
                          <div className="projects-browser-item-actions">
                            <button
                              className="slds-button slds-button_icon slds-button_icon-x-small"
                              aria-label="Rename folder"
                              title="Rename"
                              onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}
                            >
                              <Icons.Edit size="x-small" />
                            </button>
                            <button
                              className="slds-button slds-button_icon slds-button_icon-x-small"
                              aria-label="Delete folder"
                              title="Delete"
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'folder', id: folder.id, name: folder.name }); }}
                            >
                              <Icons.Delete size="x-small" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Unfiled projects */}
                  {projects.length > 0 && folders.length > 0 && (
                    <div className="projects-browser-divider">
                      <span>Unfiled Projects</span>
                    </div>
                  )}
                  {projects.map((project) => renderProjectItem(project))}
                </>
              )}

              {/* Folder view */}
              {view === 'folder' && (
                <>
                  {projects.length === 0 && (
                    <div className="projects-browser-empty">
                      <Icons.File size="medium" />
                      <p className="slds-m-top_small">This folder is empty.</p>
                    </div>
                  )}
                  {projects.map((project) => renderProjectItem(project))}
                </>
              )}

              {/* All projects view */}
              {view === 'all' && (
                <>
                  {projects.length === 0 && (
                    <div className="projects-browser-empty">
                      <Icons.File size="medium" />
                      <p className="slds-m-top_small">No projects saved yet.</p>
                    </div>
                  )}
                  {projects.map((project) => renderProjectItem(project, true))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  function renderProjectItem(project: ProjectSummary, showFolder = false) {
    const isCurrent = project.id === currentProjectId;

    return (
      <div
        key={project.id}
        className={`projects-browser-item projects-browser-item--project ${isCurrent ? 'projects-browser-item--current' : ''}`}
      >
        {editingProjectId === project.id ? (
          <>
            <Icons.File size="x-small" />
            <input
              ref={editInputRef}
              className="slds-input projects-browser-inline-input"
              value={editingProjectName}
              onChange={(e) => setEditingProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameProject(project.id);
                if (e.key === 'Escape') setEditingProjectId(null);
              }}
              onBlur={() => handleRenameProject(project.id)}
            />
          </>
        ) : (
          <>
            <button
              className="projects-browser-item-main"
              onClick={() => onOpenProject(project.id)}
            >
              <Icons.File size="x-small" />
              <div className="projects-browser-item-info">
                <span className="projects-browser-item-name">
                  {project.name}
                  {isCurrent && <span className="projects-browser-current-badge">Current</span>}
                </span>
                <span className="projects-browser-item-date">
                  {showFolder && project.folder_id && (
                    <span className="projects-browser-item-folder-tag">
                      {folders.find(f => f.id === project.folder_id)?.name || 'Folder'}
                      {' · '}
                    </span>
                  )}
                  Updated {formatDate(project.updated_at)}
                </span>
              </div>
            </button>
            <div className="projects-browser-item-actions">
                <button
                  className="slds-button slds-button_icon slds-button_icon-x-small"
                  aria-label="Rename project"
                  title="Rename"
                  onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); setEditingProjectName(project.name); }}
                >
                  <Icons.Edit size="x-small" />
                </button>
                <button
                  className="slds-button slds-button_icon slds-button_icon-x-small"
                  aria-label="Move to folder"
                  title="Move to folder"
                  onClick={(e) => { e.stopPropagation(); setMovingProject(project); }}
                >
                  <Icons.OpenFolder size="x-small" />
                </button>
                <button
                  className="slds-button slds-button_icon slds-button_icon-x-small"
                  aria-label="Delete project"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'project', id: project.id, name: project.name }); }}
                >
                  <Icons.Delete size="x-small" />
                </button>
              </div>
          </>
        )}
      </div>
    );
  }
}
