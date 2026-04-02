'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from './Icons';

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  project_count: number;
  subfolder_count: number;
  created_at: string;
  updated_at: string;
}

interface FolderTreeItem {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  project_count: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BreadcrumbItem {
  id: string | null; // null = root
  name: string;
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
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Projects' }]);
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

  // New project creation
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Move project state
  const [movingProject, setMovingProject] = useState<ProjectSummary | null>(null);
  const [moveTargetFolders, setMoveTargetFolders] = useState<FolderTreeItem[]>([]);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'folder' | 'project'; id: string; name: string } | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch top-level folders and unfiled projects for root view
  const fetchRoot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, projectsRes] = await Promise.all([
        fetch('/api/folders?parent_id=root'),
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

  // Fetch subfolders and projects in a specific folder
  const fetchFolder = useCallback(async (folder: Folder, newBreadcrumbs?: BreadcrumbItem[]) => {
    setLoading(true);
    setError(null);
    setCurrentFolder(folder);
    setView('folder');
    if (newBreadcrumbs) {
      setBreadcrumbs(newBreadcrumbs);
    }
    try {
      const [subfoldersRes, projectsRes] = await Promise.all([
        fetch(`/api/folders?parent_id=${folder.id}`),
        fetch(`/api/projects?folder_id=${folder.id}`),
      ]);
      const subfoldersData = await subfoldersRes.json();
      const projectsData = await projectsRes.json();
      setFolders(subfoldersData.folders || []);
      setProjects(projectsData.projects || []);
    } catch (err) {
      console.error('Error fetching folder contents:', err);
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
      setBreadcrumbs([{ id: null, name: 'Projects' }]);
      fetchRoot();
    }
  }, [isOpen, fetchRoot]);

  // Focus edit input when editing
  useEffect(() => {
    if ((editingFolderId || editingProjectId || isCreatingFolder || isCreatingProject) && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolderId, editingProjectId, isCreatingFolder, isCreatingProject]);

  // --- Folder CRUD ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const parentId = view === 'folder' && currentFolder ? currentFolder.id : null;
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parent_id: parentId }),
      });
      if (res.ok) {
        setNewFolderName('');
        setIsCreatingFolder(false);
        if (view === 'folder' && currentFolder) {
          fetchFolder(currentFolder);
        } else {
          fetchRoot();
        }
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const folderId = view === 'folder' && currentFolder ? currentFolder.id : null;
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), folderId, data: {} }),
      });
      if (res.ok) {
        const result = await res.json();
        setNewProjectName('');
        setIsCreatingProject(false);
        onOpenProject(result.id);
      }
    } catch (err) {
      console.error('Error creating project:', err);
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
      // Refresh the current view
      if (view === 'folder' && currentFolder) {
        if (currentFolder.id === folderId) {
          setCurrentFolder({ ...currentFolder, name: editingFolderName.trim() });
          // Update breadcrumbs too
          setBreadcrumbs(prev => prev.map(b => b.id === folderId ? { ...b, name: editingFolderName.trim() } : b));
        }
        fetchFolder(currentFolder);
      } else {
        fetchRoot();
      }
    } catch (err) {
      console.error('Error renaming folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      setConfirmDelete(null);
      if (view === 'folder' && currentFolder) {
        // If we deleted the current folder, go up
        if (currentFolder.id === folderId) {
          navigateUp();
        } else {
          fetchFolder(currentFolder);
        }
      } else {
        fetchRoot();
      }
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

  const handleDuplicateProject = async (project: ProjectSummary) => {
    try {
      // Fetch the full project data
      const getRes = await fetch(`/api/projects/${project.id}`);
      if (!getRes.ok) return;
      const projectData = await getRes.json();

      // Create a new project with the same data
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${project.name} (Copy)`,
          folderId: projectData.folderId || null,
          data: projectData.data,
        }),
      });
      if (res.ok) {
        // Refresh the current view
        if (view === 'root') fetchRoot();
        else if (view === 'folder' && currentFolder) fetchFolder(currentFolder);
        else fetchAll();
      }
    } catch (err) {
      console.error('Error duplicating project:', err);
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
      setMoveTargetFolders([]);
      if (view === 'root') fetchRoot();
      else if (view === 'folder' && currentFolder) fetchFolder(currentFolder);
      else fetchAll();
    } catch (err) {
      console.error('Error moving project:', err);
    }
  };

  // Open the move picker with the full folder tree
  const openMovePicker = async (project: ProjectSummary) => {
    setMovingProject(project);
    try {
      const res = await fetch('/api/folders?tree=true');
      const data = await res.json();
      setMoveTargetFolders(data.folders || []);
    } catch {
      setMoveTargetFolders([]);
    }
  };

  // Navigate up one level in breadcrumbs
  const navigateUp = () => {
    if (breadcrumbs.length <= 1) {
      // Already at root
      setView('root');
      setCurrentFolder(null);
      setBreadcrumbs([{ id: null, name: 'Projects' }]);
      fetchRoot();
      return;
    }
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    const parentCrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    if (parentCrumb.id === null) {
      // Go to root
      setView('root');
      setCurrentFolder(null);
      setBreadcrumbs(newBreadcrumbs);
      fetchRoot();
    } else {
      // Go to parent folder
      const parentFolder: Folder = {
        id: parentCrumb.id,
        name: parentCrumb.name,
        parent_id: null,
        project_count: 0,
        subfolder_count: 0,
        created_at: '',
        updated_at: '',
      };
      fetchFolder(parentFolder, newBreadcrumbs);
    }
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    if (crumb.id === null) {
      setView('root');
      setCurrentFolder(null);
      setBreadcrumbs(newBreadcrumbs);
      fetchRoot();
    } else {
      const folder: Folder = {
        id: crumb.id,
        name: crumb.name,
        parent_id: null,
        project_count: 0,
        subfolder_count: 0,
        created_at: '',
        updated_at: '',
      };
      fetchFolder(folder, newBreadcrumbs);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            {view !== 'root' && view !== 'all' && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="Back"
                onClick={navigateUp}
                style={{ flexShrink: 0 }}
              >
                <Icons.Back size="x-small" />
              </button>
            )}
            {view === 'all' && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="Back"
                onClick={() => { setView('root'); setCurrentFolder(null); setBreadcrumbs([{ id: null, name: 'Projects' }]); fetchRoot(); }}
                style={{ flexShrink: 0 }}
              >
                <Icons.Back size="x-small" />
              </button>
            )}
            {view === 'root' && (
              <h2 className="slds-text-heading_medium" style={{ margin: 0 }}>Projects</h2>
            )}
            {view === 'all' && (
              <h2 className="slds-text-heading_medium" style={{ margin: 0 }}>All Projects</h2>
            )}
            {view === 'folder' && breadcrumbs.length > 0 && (
              <nav className="projects-browser-breadcrumbs" aria-label="Folder navigation" style={{ minWidth: 0 }}>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.id ?? 'root'} className="projects-browser-breadcrumb-item">
                    {i > 0 && <span className="projects-browser-breadcrumb-sep">/</span>}
                    {i < breadcrumbs.length - 1 ? (
                      <button
                        className="projects-browser-breadcrumb-link"
                        onClick={() => navigateToBreadcrumb(i)}
                      >
                        {crumb.name}
                      </button>
                    ) : (
                      <span className="projects-browser-breadcrumb-current">{crumb.name}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
            {view === 'root' && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="View all projects"
                title="View all projects"
                onClick={fetchAll}
              >
                <Icons.List size="x-small" />
              </button>
            )}
            {(view === 'root' || view === 'folder') && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="New project"
                title="New project"
                onClick={() => { setIsCreatingProject(true); setNewProjectName('New Project'); }}
              >
                <Icons.Add size="x-small" />
              </button>
            )}
            {(view === 'root' || view === 'folder') && (
              <button
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                aria-label="New folder"
                title="New folder"
                onClick={() => { setIsCreatingFolder(true); setNewFolderName('New Folder'); }}
              >
                <Icons.New size="x-small" />
              </button>
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
                      {moveTargetFolders.map((folder) => (
                        <li key={folder.id} className="slds-item">
                          <button
                            className="projects-browser-move-item"
                            style={{ paddingLeft: `${(folder.depth || 0) * 1.25 + 0.75}rem` }}
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
                      onClick={() => { setMovingProject(null); setMoveTargetFolders([]); }}
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
                        ? 'This folder and all its subfolders will be deleted. Projects inside will become unfiled.'
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

              {/* Create new project inline */}
              {isCreatingProject && (view === 'root' || view === 'folder') && (
                <div className="projects-browser-item projects-browser-item--editing">
                  <Icons.File size="x-small" />
                  <input
                    ref={editInputRef}
                    className="slds-input projects-browser-inline-input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject();
                      if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); }
                    }}
                    onBlur={() => { if (newProjectName.trim()) handleCreateProject(); else setIsCreatingProject(false); }}
                    placeholder="Project name"
                  />
                </div>
              )}

              {/* Create new folder inline */}
              {isCreatingFolder && (view === 'root' || view === 'folder') && (
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
                  {folders.map((folder) => renderFolderItem(folder, [{ id: null, name: 'Projects' }]))}

                  {/* Unfiled projects */}
                  {projects.length > 0 && folders.length > 0 && (
                    <div className="projects-browser-divider">
                      <span>Unfiled Projects</span>
                    </div>
                  )}
                  {projects.map((project) => renderProjectItem(project))}
                </>
              )}

              {/* Folder view: subfolders + projects */}
              {view === 'folder' && (
                <>
                  {folders.length === 0 && projects.length === 0 && !isCreatingFolder && (
                    <div className="projects-browser-empty">
                      <Icons.File size="medium" />
                      <p className="slds-m-top_small">This folder is empty.</p>
                    </div>
                  )}
                  {/* Subfolders */}
                  {folders.map((folder) => renderFolderItem(folder, breadcrumbs))}
                  {/* Projects in this folder */}
                  {projects.length > 0 && folders.length > 0 && (
                    <div className="projects-browser-divider">
                      <span>Projects</span>
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
                  aria-label="Duplicate project"
                  title="Duplicate"
                  onClick={(e) => { e.stopPropagation(); handleDuplicateProject(project); }}
                >
                  <Icons.Copy size="x-small" />
                </button>
                <button
                  className="slds-button slds-button_icon slds-button_icon-x-small"
                  aria-label="Move to folder"
                  title="Move to folder"
                  onClick={(e) => { e.stopPropagation(); openMovePicker(project); }}
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

  function renderFolderItem(folder: Folder, parentBreadcrumbs: BreadcrumbItem[]) {
    const itemCount = (folder.project_count || 0) + (folder.subfolder_count || 0);
    return (
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
              onClick={() => {
                const newBreadcrumbs = [...parentBreadcrumbs, { id: folder.id, name: folder.name }];
                fetchFolder(folder, newBreadcrumbs);
              }}
            >
              <Icons.OpenFolder size="x-small" />
              <span className="projects-browser-item-name">{folder.name}</span>
              <span className="projects-browser-item-badge">{itemCount}</span>
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
    );
  }
}
