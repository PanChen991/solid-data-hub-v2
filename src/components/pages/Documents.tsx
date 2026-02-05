import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileType,
  ChevronRight,
  ChevronLeft,
  Lock,
  Globe,
  Building2,
  Users,
  Clock,
  User,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  MoreHorizontal,
  Upload,
  Download,
  Pencil,
  Trash2,
  FolderPlus,
  Check,
  Shield,
  AlertTriangle,
  Share2
} from 'lucide-react';
import { PermissionDialog } from '@/components/dialogs/PermissionDialog';
import { rootSpaces, FolderItem as MockFolderItem } from '@/data/mockData';
import { useFolders, useDocuments, useProjects, useDepartments, Folder as DBFolder, Document as DBDocument } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UploadDialog } from '@/components/documents/UploadDialog';
import { NewFolderDialog, ParentPermission } from '@/components/documents/NewFolderDialog';
import { FilePreviewDialog } from '@/components/documents/FilePreviewDialog';
import { RenameDialog } from '@/components/documents/RenameDialog';
import { SearchBar, SearchFilters } from '@/components/documents/SearchBar';
import { useAuth } from '@/hooks/useAuth';
import { BatchActions } from '@/components/documents/BatchActions';
import { MoveDialog } from '@/components/documents/MoveDialog';
import { ProjectSettingsCard } from '@/components/documents/ProjectSettingsCard';
import { ProjectDialog } from '@/components/dialogs/ProjectDialog';
import { ProjectMembersDialog } from '@/components/dialogs/ProjectMembersDialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface FolderItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'pdf' | 'image' | 'video' | 'audio' | 'xlsx' | 'docx' | 'pptx' | 'txt' | 'zip';
  size?: string;
  updatedAgo?: string;
  author?: string;
  badge?: string;
  badgeColor?: string;
  children?: FolderItem[];
  isLocked?: boolean;
  fileUrl?: string;
  spaceType?: 'public' | 'department' | 'project' | 'personal';
  departmentId?: number;
  ownerId?: number;
  projectId?: number; // Added for project context
  role?: 'viewer' | 'editor' | 'admin';
  isProtected?: boolean; // System protected folder
  isRestricted?: boolean; // Added for metadata pre-loading
  ownerName?: string; // Added for metadata pre-loading
  ancestors?: { id: number; name: string }[]; // Added for search context
  childrenCount?: number; // Added for card footer stats
}
// Helper for copying text (handles insecure contexts)
const copyToClipboard = async (text: string) => {
  if (!text) return;

  console.log('[Clipboard] Attempting to copy:', text);

  let success = false;

  try {
    // 1. Try modern API first (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        toast.success('链接已复制 (自动模式)');
      } else {
        toast.success('链接已复制到剪贴板');
      }
    } else {
      // 2. Insecure Context / Fallback -> Force Prompt
      // execCommand is flaky in 0.0.0.0, so we skip straight to prompt to guarantee user gets the link via MANUAL copy.
      // This solves the "pasted nothing" issue.
      const promptMsg = window.location.protocol === 'http:'
        ? "浏览器安全限制（HTTP环境）无法自动复制，请手动复制："
        : "无法访问剪贴板，请手动复制：";

      window.prompt(promptMsg, text);
    }
  } catch (err) {
    console.error('[Clipboard] Full copy process failed', err);
    window.prompt("复制失败，请手动复制下方链接:", text);
  }
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Limit to GB if exceedingly large, but TB is fine.
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (type: string, isLocked?: boolean) => {
  if (type === 'folder') {
    if (isLocked) {
      return { icon: Lock, bgColor: 'bg-red-50', iconColor: 'text-red-500' };
    }
    return { icon: Folder, bgColor: 'bg-amber-50', iconColor: 'text-amber-500' };
  }
  switch (type) {
    case 'pdf':
      return { icon: FileText, bgColor: 'bg-red-50', iconColor: 'text-red-500' };
    case 'xlsx':
      return { icon: FileSpreadsheet, bgColor: 'bg-green-50', iconColor: 'text-green-600' };
    case 'docx':
      return { icon: FileType, bgColor: 'bg-blue-50', iconColor: 'text-blue-600' };
    case 'pptx':
      return { icon: FileText, bgColor: 'bg-orange-50', iconColor: 'text-orange-500' };
    default:
      return { icon: FileText, bgColor: 'bg-muted', iconColor: 'text-muted-foreground' };
  }
};

const getRootIcon = (item: FolderItem) => {
  if ((item as any).customIcon === 'globe') return Globe;
  if ((item as any).customIcon === 'home') return Building2; // Use Building2 or a Home icon if imported
  if (item.id === 'public' || item.name.includes('公共资源库')) return Globe;
  if (item.id === 'departments' || item.name.includes('职能部门')) return Building2;
  if (item.id === 'projects' || item.name.includes('项目')) return Users;
  if (item.id === 'projects' || item.name.includes('项目')) return Users;
  if (item.id === 'shared' || item.name.includes('与我共享')) return Share2; // Use Share2 for shared folder
  return Folder;
};

const getBadgeColor = (color?: string) => {
  switch (color) {
    case 'blue':
      return 'bg-blue-100 text-blue-700';
    case 'amber':
      return 'bg-amber-100 text-amber-700';
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
  } catch (e) {
    return dateStr;
  }
};

// Get parent permission based on current path
const getParentPermission = (path: BreadcrumbItem[]): ParentPermission | undefined => {
  if (path.length === 0) {
    return undefined; // Root level - no parent
  }

  // Use the role from the current (last) breadcrumb item if available
  const currentItem = path[path.length - 1];

  // Determine permission based on root space
  const rootId = path[0]?.id || '';
  const rootIdStr = String(rootId);

  if (rootIdStr.startsWith('public') || rootIdStr === '65' || rootIdStr === '124') {
    return { type: 'all', label: '全员可见', description: '所有人可访问' };
  } else if (rootIdStr.startsWith('dept') || rootIdStr.startsWith('64')) {
    return { type: 'department', label: '部门可见', description: '本部门成员可访问' };
  } else if (rootIdStr.startsWith('project')) {
    return { type: 'project', label: '项目组可见', description: '项目成员可访问' };
  } else {
    return { type: 'inherit', label: '继承上级', description: '与上级目录权限一致' };
  }
};

interface BreadcrumbItem {
  id: string;
  name: string;
  role?: 'viewer' | 'editor' | 'admin';
  projectId?: number; // Added to persist project context
  departmentId?: number; // Added to persist department context
}

type ViewMode = 'grid' | 'list';

// NEW: Add props interface
interface DocumentsProps {
  initialFolderId?: string;
  // mode removed
}

export function Documents({ initialFolderId }: DocumentsProps) {
  // Database hooks
  const { getFolders, getFolder, createFolder: createFolderApi, deleteFolder } = useFolders(); // Added getFolder
  const { getDocuments, deleteDocument, getSharedResources } = useDocuments();
  const { getDepartments } = useDepartments();
  const { getProjects, deleteProject } = useProjects();
  const { user } = useAuth();
  const navigate = useNavigate(); // For URL updates if needed

  const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([]);

  // Define Shared Space Item
  const sharedSpaceItem: any = {
    id: 'shared',
    name: '与我共享',
    type: 'folder',
    size: '-',
    updatedAgo: '-',
    author: 'System',
    badge: '跨部门',
    badgeColor: 'red', // Distinct color
    children: [], // Will be loaded dynamically
    role: 'viewer',
    bgColor: 'bg-red-50',
    iconColor: 'text-red-600'
  };

  const [currentItems, setCurrentItems] = useState<FolderItem[]>(initialFolderId ? [] : [...rootSpaces, sharedSpaceItem]);
  const [loading, setLoading] = useState(!!initialFolderId); // Start loading if deep link provided
  const [refreshKey, setRefreshKey] = useState(0); // For forcing reloads
  const [currentFolder, setCurrentFolder] = useState<any>(null); // To store current folder metadata (e.g. isRestricted)

  // Deep Link Handling
  useEffect(() => {
    const handleDeepLink = async () => {
      if (initialFolderId) {
        setLoading(true);
        try {
          const { data: folder, error } = await getFolder(initialFolderId);
          if (folder) {
            setCurrentFolder(folder);
            // Reconstruct path
            const ancestorBreadcrumbs: BreadcrumbItem[] = (folder.ancestors || []).map(a => ({
              id: a.id.toString(),
              name: a.name,
              role: 'viewer' // Ancestors usually just viewer for navigation
            }));

            const role = (folder.role || 'viewer') as 'viewer' | 'editor' | 'admin';
            setCurrentPath([
              ...ancestorBreadcrumbs,
              { id: folder.id.toString(), name: folder.name, role: role }
            ]);
            setEffectiveFolderRole(role);

            // LOAD CONTENT
            const { data: subFolders } = await getFolders(initialFolderId);
            const { data: docs } = await getDocuments(initialFolderId);

            const folderItems = (subFolders || []).map(f => ({
              id: f.id.toString(),
              name: f.name,
              type: 'folder' as const,
              updatedAgo: formatDate(f.updated_at || ''),
              size: f.is_locked ? '-' : '0 items', // Count logic needed if available
              author: f.owner_name || 'System',
              isLocked: f.is_locked,
              role: (f.role || 'viewer') as 'viewer' | 'editor' | 'admin',
              spaceType: f.space_type
            }));

            const docItems = (docs || []).map(d => ({
              id: d.id.toString(),
              name: d.name,
              type: d.file_type as any,
              size: d.size ? formatFileSize(d.size) : '0 B',
              updatedAgo: formatDate(d.updated_at || ''),
              author: d.author_name || 'System',
              isLocked: d.is_restricted
            }));

            setCurrentItems([...folderItems, ...docItems]);
          } else {
            // Handle folder not found or error
            console.error('Initial folder not found:', initialFolderId);
            toast.error('文件夹加载失败，可能已被删除或无权限');
            setCurrentPath([]);
            setCurrentItems([...rootSpaces, sharedSpaceItem]);
          }
        } catch (err) {
          console.error('Deep link failed:', err);
          setCurrentPath([]);
          setCurrentItems([...rootSpaces, sharedSpaceItem]);
        } finally {
          setLoading(false);
        }
      }
    };
    // Only run if initialFolderId is present and path is empty (first load)
    if (initialFolderId && currentPath.length === 0) {
      handleDeepLink();
    }
  }, [initialFolderId]);

  // SYNC: Ensure currentFolder metadata is always fresh when path changes
  useEffect(() => {
    const fetchCurrentFolderDetails = async () => {
      if (currentPath.length > 0) {
        const lastItem = currentPath[currentPath.length - 1];
        // Skip virtual folders
        if (['shared', 'projects', 'departments', 'public'].includes(lastItem.id)) {
          setCurrentFolder(null);
          return;
        }

        // Check if ID is numeric (real folder)
        // CRITICAL FIX: Do NOT strip 'dept-' or 'project-' and call getFolder with the result.
        // Department ID 2!= Folder ID 2. This causes 404.
        // Only fetch if it's a pure numeric ID or a standard 'folder-' ID (though folder- is usually stripped in UI list, path usually has raw ID unless virtual)
        // If it starts with dept- or project-, skip this metadata fetch (handled by virtual logic)
        const isVirtual = lastItem.id.toString().startsWith('dept-') || lastItem.id.toString().startsWith('project-');

        if (!isVirtual) {
          const rawId = lastItem.id.toString().replace(/^(dept-|project-)/, ''); // Legacy cleanup just in case
          if (!isNaN(Number(rawId))) {
            try {
              const { data } = await getFolder(rawId);
              if (data) {
                setCurrentFolder(data);
              }
            } catch (e) {
              console.warn("Folder metadata fetch failed", e);
            }
          }
        } else {
          setCurrentFolder(null); // Virtual folders don't have standard "Folder" metadata
        }
      } else {
        setCurrentFolder(null); // Root
      }
    };
    fetchCurrentFolderDetails();
  }, [currentPath]);

  // NEW: Sync URL when returning to Root
  const location = useLocation();
  useEffect(() => {
    // If we are at Root (path empty) AND we are currently on a share URL AND finished loading
    if (currentPath.length === 0 && location.pathname.includes('/share/') && !loading) {
      // Force eject to proper root URL
      navigate('/', { replace: true });
    }
  }, [currentPath, location, navigate, loading]);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FolderItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<FolderItem[] | null>(null); // New Search State
  const [searchLoading, setSearchLoading] = useState(false); // New Search Loading State
  // const [filteredItems, setFilteredItems] = useState<FolderItem[] | null>(null); // Removed
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<FolderItem | null>(null);
  const [effectiveFolderRole, setEffectiveFolderRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [isHighlightActive, setIsHighlightActive] = useState(false);

  // Permission Dialog State
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionTarget, setPermissionTarget] = useState<{
    id: number;
    type: 'folder' | 'document';
    name: string;
    isRestricted?: boolean;
    owner_id?: number;
    owner_name?: string;
  } | null>(null);

  // Project Dialogs
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectMembersDialogState, setProjectMembersDialogState] = useState<{
    isOpen: boolean;
    projectId: number;
    projectTitle: string;
  }>({ isOpen: false, projectId: 0, projectTitle: '' });

  // Highlighting Logic
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  // Define isEditable based on role
  const isEditable = useMemo(() => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (currentPath.length === 0) return false; // Root virtual spaces are not editable directly
    // If in shared folder (root), not editable
    if (currentPath.length > 0 && currentPath[currentPath.length - 1].id === 'shared') return false;

    return effectiveFolderRole === 'editor' || effectiveFolderRole === 'admin';
  }, [user, effectiveFolderRole, currentPath]);

  useEffect(() => {
    if (highlightId && !loading && currentItems.length > 0) {
      // Activate highlight
      setIsHighlightActive(true);

      // Auto-scroll
      setTimeout(() => {
        const rawId = highlightId.replace(/^(doc-|file-|folder-)/, '');
        // Try precise match first (e.g. file-row-doc-7), then fallback
        const element =
          document.getElementById(`file-row-${highlightId}`) ||
          document.getElementById(`file-row-${rawId}`) ||
          document.getElementById(`file-row-doc-${rawId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500); // Slight delay to ensure render

      // Auto-fade out highlight after 30 seconds
      const timer = setTimeout(() => {
        setIsHighlightActive(false);
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, currentItems]);

  const handleOpenPermissions = (item: FolderItem) => {
    // Determine ID - handle non-numeric cases gracefully
    const rawId = item.id.replace(/^(doc-|folder-|file-)/, '');
    let id = parseInt(rawId);
    if (isNaN(id)) {
      toast.error("根空间权限由系统管理，无法直接修改");
      return;
    }

    setPermissionTarget({
      id: id,
      type: item.type === 'folder' ? 'folder' : 'document', // Map 'pdf' etc to 'document' for backend consistency? 
      // Actually backend expects 'document' or 'folder' type enum.
      // But item.type can be 'pdf'.
      // If it's not folder, it's a document.
      name: item.name,
      // Metadata for pre-loading state
      isRestricted: (item as any).isRestricted,
      owner_id: (item as any).ownerId || (item as any).authorId,
      owner_name: (item as any).ownerName || (item as any).author
    });
    setPermissionDialogOpen(true);
  };

  const isRootLevel = currentPath.length === 0;
  const isLevel2 = currentPath.length === 1;
  const isLevel3 = currentPath.length >= 2;

  // Check if we're in a project space (for showing member management)
  const isInProjectSpace = currentPath.length >= 1 && currentPath[0]?.id === 'projects';
  // Show member management at project level
  // Logic: If we are in project space (level >= 2), the second item (index 1) is the Project Root.
  const currentProjectId = isInProjectSpace && currentPath.length >= 2 ? (currentPath[1]?.projectId?.toString()) || null : null;
  const currentProjectName = isInProjectSpace && currentPath.length >= 2 ? currentPath[1]?.name : null;

  // Determine current Department ID for permission context
  const currentDepartmentId = useMemo(() => {
    // Traverse backwards to find the nearest defined departmentId
    for (let i = currentPath.length - 1; i >= 0; i--) {
      if (currentPath[i].departmentId) return currentPath[i].departmentId;
    }
    return undefined;
  }, [currentPath]);

  // Also detect if we're viewing the list of projects (to show settings on each project card)
  const isViewingProjectsList = currentPath.length === 1 && currentPath[0]?.id === 'projects';

  // const displayItems = filteredItems ?? currentItems;
  const displayItems = currentItems;
  const parentPermission = getParentPermission(currentPath);

  // Permission Check for Actions
  const canPerformActions = useMemo(() => {
    if (!user) return false;
    // SUPER_ADMIN always can
    if (user.role.toLowerCase() === 'super_admin') return true;

    // Root level (Navigation)
    if (currentPath.length === 0) {
      // Only Admin can create projects/Public folders usually, 
      // but let's stick to global role for root.
      const rolesWithWriteAccess = ['super_admin'];
      return rolesWithWriteAccess.includes(user.role.toLowerCase());
    }

    // Inside a folder: check the effective role for THIS folder
    return effectiveFolderRole === 'editor' || effectiveFolderRole === 'admin';
  }, [user, effectiveFolderRole, currentPath]);

  // Fetch data when path changes
  useEffect(() => {
    const fetchData = async () => {
      // Prevent default root loading if we are deep linking
      if (initialFolderId && currentPath.length === 0) return;

      setLoading(true);
      try {
        // Level 1: Root
        if (currentPath.length === 0) {
          // Dynamic Root Mapping for "00_公共资源库"
          const { data: publicRoots } = await getFolders(undefined, 'public');
          const root00 = publicRoots?.find(f => f.name === '00_公共资源库');

          const newRoots = [...rootSpaces];
          if (root00) {
            const idx = newRoots.findIndex(r => r.name.includes('公共资源库'));
            if (idx !== -1) {
              const rootItem = {
                ...newRoots[idx],
                id: root00.id.toString(), // Use Real ID
                role: (root00.role || 'viewer') as 'viewer' | 'editor' | 'admin', // NEW: Preserve Real Role
              };
              // Force styles to ensure UI consistency
              (rootItem as any).bgColor = (newRoots[idx] as any).bgColor || 'bg-blue-50';
              (rootItem as any).iconColor = (newRoots[idx] as any).iconColor || 'text-blue-600';
              (rootItem as any).customIcon = 'globe';
              newRoots[idx] = rootItem;
            }
          }

          // Fetch Counts asynchronously
          const updateCounts = async () => {
            // Reverted My Department Shortcut

            // 00 Count
            if (root00) {
              const { data } = await getFolders(root00.id.toString());
              if (data) {
                const idx = newRoots.findIndex(r => r.name.includes('公共资源库'));
                if (idx !== -1) newRoots[idx].children = new Array(data.length).fill({});
              }
            }
            // 01 Count
            const { data: depts } = await getDepartments();
            const rootDepts = depts?.filter(d => !d.parent_id);
            if (rootDepts) {
              const idx = newRoots.findIndex(r => r.name.includes('部门'));
              if (idx !== -1) newRoots[idx].children = new Array(rootDepts.length).fill({});
            }
            setCurrentItems([...newRoots, sharedSpaceItem]);
          };
          updateCounts();

          setCurrentItems([...newRoots, sharedSpaceItem]);
          setLoading(false);
          return;
        }

        const rootId = currentPath[0].id;
        let newItems: FolderItem[] = [];

        // Special handling for legacy/mock roots
        if (rootId === 'departments' && currentPath.length === 1) {
          const { data } = await getDepartments();
          if (data) {
            let rootDepts = data.filter(d => !d.parent_id);

            // FILTERING logic: If user has a department, only show their root ancestor
            // EXCEPTION: Super Admin sees all
            if (user?.department_id && user?.role?.toUpperCase() !== 'SUPER_ADMIN') {
              let currentDept = data.find(d => d.id === user.department_id);
              let safety = 0;
              while (currentDept && currentDept.parent_id && safety < 10) {
                currentDept = data.find(d => d.id === currentDept?.parent_id);
                safety++;
              }
              if (currentDept) {
                // Determine if we should ONLY show this one
                // Yes, as per requirement, user only sees their own department tree root
                rootDepts = [currentDept];
              }
            }

            newItems = rootDepts.map(d => {
              // Count sub-departments for display
              // We might need to filter sub-counts too if permissions are strict? 
              // For now, let's keep sub-count as is, they can't access if permission denied anyway.
              const subCount = data.filter(sub => sub.parent_id === d.id).length;
              return {
                id: `dept-${d.id}`,
                name: d.name,
                type: 'folder',
                badge: '部门',
                badgeColor: 'amber',
                role: 'editor' as const,
                children: new Array(subCount).fill({}),
                updatedAgo: '-'
              };
            });
          }
        } else if (rootId === 'projects' && currentPath.length === 1) {
          const { data } = await getProjects();
          if (data) {
            newItems = data.map(p => ({
              id: p.root_folder_id.toString(), // Use Root Folder ID for navigation
              name: p.name,
              type: 'folder',
              badge: '项目',
              badgeColor: 'blue',
              children: [],
              author: p.owner_name || 'System',
              updatedAgo: p.updated_at ? formatDate(p.updated_at) : '-',
              projectId: p.id,
              ownerId: p.owner_id,
              role: p.role as any
            }));
          }
        } else if (rootId === 'shared' && currentPath.length === 1) {
          const { data, error } = await getSharedResources();
          console.log('Shared resources loaded (fetchData):', data, 'Error:', error); // Debug log

          if (error) {
            toast.error(`获取共享内容失败: ${error.message || '未知错误'}`);
          }

          if (data) {
            newItems = data.map(item => ({
              id: item.id.toString(),
              name: item.name,
              type: item.type === 'folder' ? 'folder' : (item.file_type as any) || 'file',
              size: item.size ? formatFileSize(item.size) : '-',
              updatedAgo: '-',
              author: item.owner_name,
              isLocked: false,
              role: item.role as any,
              children: []
            }));
          }
        } else {
          // Generic / Deep navigation
          const currentId = currentPath[currentPath.length - 1].id;
          const currentIdStr = String(currentId);

          if (currentIdStr.startsWith('dept-')) {
            const deptId = parseInt(currentIdStr.replace('dept-', ''));
            if (!isNaN(deptId)) {
              // If we are at a department root, inject departmentId into items for future navigation
              // Actually, handleFolderClick propagates it. Here we just view it.
              const { data: allDepts } = await getDepartments();

              // Calculate Effective Role for this Department View
              let deptRole: 'viewer' | 'editor' | 'admin' = 'viewer';
              const userRole = user?.role?.toUpperCase();

              if (userRole === 'SUPER_ADMIN') {
                deptRole = 'admin';
              } else if (user?.department_id) {
                // Check Direct Match
                if (user.department_id === deptId) {
                  if (userRole === 'MANAGER') deptRole = 'admin';
                  else if (userRole === 'EDITOR') deptRole = 'editor';
                }
                // Check Ancestor Match (Only for Managers)
                else if (userRole === 'MANAGER' && allDepts) {
                  let current = allDepts.find(d => d.id === deptId);
                  let safety = 0;
                  while (current && current.parent_id && safety < 10) {
                    if (current.parent_id === user.department_id) {
                      deptRole = 'admin';
                      break;
                    }
                    current = allDepts.find(d => d.id === current.parent_id);
                    safety++;
                  }
                }
              }

              setEffectiveFolderRole(deptRole);

              // 1. Fetch Sub-departments
              const { data: subDepts } = await getDepartments(deptId);

              const mappedSubDepts: FolderItem[] = subDepts?.map(d => ({
                id: `dept-${d.id}`,
                name: d.name,
                type: 'folder' as const,
                departmentId: d.id,
                author: 'System',
                role: 'editor' as 'editor',
                isProtected: true, // Sub-departments are protected
                badge: '部门',
                badgeColor: 'blue',
                children: [],
                updatedAgo: '-'
              })) || [];

              // ISOLATION PRE-CALCULATION:
              // Calculate allow-list (User's Dept + Ancestors)
              const allowedDeptIds = new Set<number>();
              if (user?.department_id && allDepts) {
                allowedDeptIds.add(user.department_id);
                let current = allDepts.find(d => d.id === user.department_id);
                while (current && current.parent_id) {
                  allowedDeptIds.add(current.parent_id);
                  current = allDepts.find(d => d.id === current.parent_id);
                }
              }

              // 2. Fetch Resources (Folders & Files)
              // Strategy: Use the Department's Root Folder ID if available.
              let deptRootFolderId: string | undefined = undefined;
              if (allDepts) {
                const d = allDepts.find(dept => dept.id === deptId);
                // cast to any because we just added root_folder_id to backend but frontend interface might lag slightly vs compilation?
                // Actually strict TS might complain if I don't use 'as any' or updated interface.
                // I updated the interface in useDatabase.tsx, so it should be fine if imported.
                if (d && d.root_folder_id) {
                  deptRootFolderId = d.root_folder_id.toString();
                }
              }

              let mappedFolders: FolderItem[] = [];
              let mappedDocs: FolderItem[] = [];

              if (deptRootFolderId) {
                // Fetch using the Root Folder ID (Standard Mode)
                const { data: folders } = await getFolders(deptRootFolderId);
                const { data: docs } = await getDocuments(deptRootFolderId);

                if (folders) {
                  // DEDUPLICATION:
                  // We already rendered Sub-departments as `mappedSubDepts` using `dept-{id}`.
                  // If `folders` contains the physical root folder of one of those sub-departments,
                  // we must filter it out to avoid duplication.
                  const subDeptIds = new Set(subDepts?.map(d => d.id));

                  mappedFolders = folders
                    .filter(f => !f.department_id || !subDeptIds.has(f.department_id))
                    .map(f => {
                      let folderRole = (f.role || 'viewer') as 'viewer' | 'editor' | 'admin';
                      const isPublicZone = f.name.includes('公共区');
                      // Public privilege logic
                      if (isPublicZone && f.department_id && allowedDeptIds.has(f.department_id)) {
                        folderRole = 'editor';
                      }
                      return {
                        id: f.id.toString(),
                        name: f.name,
                        type: 'folder' as const,
                        isLocked: f.is_locked,
                        isRestricted: f.is_restricted, // Add missing prop
                        departmentId: f.department_id,
                        author: f.owner_name || 'System',
                        role: folderRole,
                        ownerId: f.owner_id || undefined,
                        ownerName: f.owner_name, // Add missing prop
                        isProtected: isPublicZone, // Public zones are protected
                        badge: isPublicZone ? '公共区' : undefined,
                        badgeColor: isPublicZone ? 'amber' : undefined,
                        children: [],
                        updatedAgo: f.updated_at ? formatDate(f.updated_at) : (f.created_at ? formatDate(f.created_at) : '-')
                      };
                    });
                }

                if (docs) {
                  mappedDocs = docs.map(d => ({
                    id: `doc-${d.id}`,
                    name: d.name,
                    type: (d.file_type === 'pdf' ? 'pdf' : d.file_type === 'xlsx' ? 'xlsx' : d.file_type === 'docx' ? 'docx' : 'file') as any,
                    size: d.size ? formatFileSize(d.size) : '-',
                    updatedAgo: d.updated_at ? formatDate(d.updated_at) : (d.created_at ? formatDate(d.created_at) : '-'),
                    author: d.author_name || 'User',
                    ownerId: d.author_id || undefined,
                    role: (d.role || (d.author_id === user?.id ? 'admin' : (effectiveFolderRole === 'admin' ? 'admin' : 'viewer'))) as any,
                    fileUrl: '#',
                    children: []
                  }));
                }

                // Also set currentFolderId context for Upload Dialog if we are in a department root
                if (currentFolderId !== deptRootFolderId) {
                  // This is tricky because currentFolderId state is driven by URL params usually or navigation.
                  // But for UploadDialog we pass 'currentFolderId' prop.
                  // In render, we might be using the state 'currentFolderId' which is 'dept-9'.
                  // But for upload to work, we already fixed backend to handle 'dept-9'.
                  // So we don't strictly need to change the ID we pass to UploadDialog if backend handles 'dept-9'.
                  // BUT, for DISPLAYING the file list, we definitely need to fetch from the real folder ID.
                }

              } else {
                // Fallback: Legacy fetch by department_id
                const { data: deptFolders } = await getFolders(undefined, undefined, deptId);
                if (deptFolders) {
                  const currentFolderName = currentPath[currentPath.length - 1]?.name;
                  mappedFolders = deptFolders
                    .filter(f => f.name !== currentFolderName)
                    .map(f => {
                      let folderRole = (f.role || 'viewer') as 'viewer' | 'editor' | 'admin';
                      const isPublicZone = f.name.includes('公共区');
                      if (isPublicZone && f.department_id && allowedDeptIds.has(f.department_id)) {
                        folderRole = 'editor';
                      }
                      return {
                        id: f.id.toString(),
                        name: f.name,
                        type: 'folder' as const,
                        isLocked: f.is_locked,
                        isRestricted: f.is_restricted, // Add missing prop
                        departmentId: f.department_id,
                        author: f.owner_name || 'System',
                        role: folderRole,
                        ownerId: f.owner_id || undefined,
                        ownerName: f.owner_name, // Add missing prop
                        isProtected: isPublicZone,
                        badge: isPublicZone ? '公共区' : undefined,
                        badgeColor: isPublicZone ? 'amber' : undefined,
                        children: [],
                        updatedAgo: f.updated_at ? formatDate(f.updated_at) : (f.created_at ? formatDate(f.created_at) : '-')
                      };
                    });
                }
              }

              newItems = [...mappedSubDepts, ...mappedFolders, ...mappedDocs];

              // ISOLATION LOGIC (Unified):
              // If user is a 'viewer' of the CURRENT PARENT FOLDER (e.g. Digital Intel),
              // they should only see:
              // 1. Their own department (or folders belonging to it).
              // 2. Public folders.
              // 3. ANCESTOR departments (the path to their department).
              if (deptRole === 'viewer' && user?.department_id) {
                newItems = newItems.filter(f => {
                  // Always show Public / Common zones
                  if (f.name.includes('公共') || (f as any).spaceType === 'public') return true;

                  // Show if it matches user's department OR is an ancestor
                  if (f.departmentId && allowedDeptIds.has(f.departmentId)) return true;

                  return false;
                });
              }
            }
          } else if (currentIdStr === 'public') {
            // Public Resource Library Virtual Root
            // Fetch directly from API using mapped 'public' logic in useDatabase
            const { data: folders } = await getFolders('public');
            const { data: docs } = await getDocuments(); // Root docs? usually public root doesn't have loose docs, but if so. 
            // Better to verify if getDocuments handles 'public' or no folderId. 
            // Usually Documents in Public Root have folder_id=NULL and space_type='public'.
            // useDatabase getDocuments(folderId) -> if folderId? ... else ...
            // We might need to adjust getDocuments too if we want docs in root public space.
            // For now, let's fix Folders first.




            const mappedFolders = folders?.map(f => ({
              id: f.id.toString(),
              name: f.name,
              type: 'folder' as const,
              isLocked: f.is_locked,
              isRestricted: f.is_restricted, // Add missing prop
              author: f.owner_name || 'System',
              ownerId: f.owner_id, // Add missing prop
              ownerName: f.owner_name, // Add missing prop
              role: (f.role || 'viewer') as 'viewer' | 'editor' | 'admin',
              children: [],
              updatedAgo: f.updated_at ? formatDate(f.updated_at) : (f.created_at ? formatDate(f.created_at) : '-')
            })) || [];

            const mappedDocs = docs?.map(d => ({
              id: `doc-${d.id}`,
              name: d.name,
              type: (d.file_type === 'pdf' ? 'pdf' : d.file_type === 'xlsx' ? 'xlsx' : d.file_type === 'docx' ? 'docx' : 'file') as any,
              size: d.size ? formatFileSize(d.size) : '-',
              updatedAgo: d.updated_at ? formatDate(d.updated_at) : (d.created_at ? formatDate(d.created_at) : '-'),
              author: d.author_name || 'User',
              ownerId: d.author_id || undefined,
              role: d.role as any,
              fileUrl: '#',
              children: []
            })) || [];

            newItems = [...mappedFolders, ...mappedDocs];
          } else if (!isNaN(Number(currentId))) {
            // Standard Folder (Public Root 00, or Deep Folder)
            const { data: folders } = await getFolders(currentIdStr);
            const { data: docs } = await getDocuments(currentIdStr);


            const mappedFolders = folders?.map(f => ({
              id: f.id.toString(),
              name: f.name,
              type: 'folder' as const,
              isLocked: f.is_locked,
              isRestricted: f.is_restricted, // Add missing prop
              author: f.owner_name || 'System',
              ownerId: f.owner_id, // Add missing prop
              ownerName: f.owner_name, // Add missing prop
              role: (f.role || 'viewer') as 'viewer' | 'editor' | 'admin',
              projectId: f.project_id,
              children: [],
              updatedAgo: f.updated_at ? formatDate(f.updated_at) : (f.created_at ? formatDate(f.created_at) : '-')
            })) || [];

            const mappedDocs = docs?.map(d => ({
              id: `doc-${d.id}`,
              name: d.name,
              type: (d.file_type === 'pdf' ? 'pdf' : d.file_type === 'xlsx' ? 'xlsx' : d.file_type === 'docx' ? 'docx' : 'file') as any,
              size: d.size ? formatFileSize(d.size) : '-',
              updatedAgo: d.updated_at ? formatDate(d.updated_at) : (d.created_at ? formatDate(d.created_at) : '-'),
              author: d.author_name || 'User',
              ownerId: d.author_id || undefined,
              role: d.role as any,
              fileUrl: '#',
              children: []
            })) || [];

            newItems = [...mappedFolders, ...mappedDocs];
          }
        }

        setCurrentItems(newItems);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    const fetchContent = async (folderId: string | undefined) => {
      setLoading(true);
      try {
        const { data: folders } = await getFolders(folderId);
        const { data: docs } = await getDocuments(folderId);

        const mappedFolders = folders?.map(f => ({
          id: f.id.toString(),
          name: f.name,
          type: 'folder' as const,
          isLocked: f.is_locked,
          author: f.owner_name || 'System',
          role: (f.role || 'viewer') as 'viewer' | 'editor' | 'admin',
          projectId: f.project_id,
          departmentId: f.department_id, // Map backend department_id to frontend departmentId
          ownerId: f.owner_id || undefined,
          children: [],
          updatedAgo: f.updated_at ? formatDate(f.updated_at) : (f.created_at ? formatDate(f.created_at) : '-')
        })) || [];

        const mappedDocs = docs?.map(d => ({
          id: `doc-${d.id}`,
          name: d.name,
          type: (d.file_type === 'pdf' ? 'pdf' : d.file_type === 'xlsx' ? 'xlsx' : d.file_type === 'docx' ? 'docx' : 'file') as any,
          size: d.size ? formatFileSize(d.size) : '-',
          updatedAgo: d.updated_at ? formatDate(d.updated_at) : (d.created_at ? formatDate(d.created_at) : '-'),
          author: d.author_name || 'User',
          ownerId: d.author_id || undefined,
          role: d.role as any,
          fileUrl: '#',
          children: []
        })) || [];

        setCurrentItems([...mappedFolders, ...mappedDocs]);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    const loadSharedContent = async () => {
      setLoading(true);
      // Ensure path is consistent
      if (currentPath.length === 0 || currentPath[currentPath.length - 1].id !== 'shared') {
        setCurrentPath([{ id: 'shared', name: '与我共享', role: 'viewer' }]);
      }

      const { data, error } = await getSharedResources();
      console.log('Shared resources loaded:', data, 'Error:', error); // Debug log

      if (error) {
        toast.error(`获取共享内容失败: ${error.message || '未知错误'}`);
      }

      if (data) {
        // toast.info(`Loaded ${data.length} shared items`); // Temporary debug toast
        const items: FolderItem[] = data.map(item => ({
          id: item.id.toString(),
          name: item.name,
          type: item.type === 'folder' ? 'folder' : (item.file_type as any) || 'file',
          size: item.size ? formatFileSize(item.size) : '-',
          updatedAgo: '-', // Shared endpoint doesn't return time yet
          author: item.owner_name,
          isLocked: false,
          role: item.role as any,
          // Tag shared items so click handler can navigate to original location properly?
          // Actually for folders, we just navigate to /documents?folder=ID
          // This works because getFolder(ID) works regardless of parent.
        }));

        // DEBUG: Inject Fake Item
        items.push({
          id: 'debug-fake-1',
          name: '调试专用-假文件-可见即正常',
          type: 'file',
          size: '0 B',
          updatedAgo: 'Just now',
          author: 'DebugSystem',
          isLocked: false,
          role: 'viewer'
        });

        setCurrentItems(items);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPath, refreshKey, initialFolderId]);

  // Check if current folder contains files (not just folders)
  const hasFiles = useMemo(() => {
    return currentItems.some(item => item.type !== 'folder');
  }, [currentItems]);

  // Auto-switch view mode based on level
  const effectiveViewMode = useMemo(() => {
    // Only force grid for the absolute root level (Overview Dashboard)
    // Allow list mode for Level 2 (e.g., 00_Public Resource Library) and deeper
    if (isRootLevel) return 'grid';
    return viewMode;
  }, [isRootLevel, viewMode]);

  const navigateToFolder = async (item: FolderItem) => {
    if (item.type !== 'folder' || item.isLocked) return;

    // SMART SHORTCUT Logic:
    // If user clicks "01_Functions" (departments root) and has a department, 
    // we want to shortcut them to their Level 2 Department (e.g., Digital Intel R&D),
    // skipping the intermediate "America R&D" step, BUT enabling breadcrumbs to go back.
    if ((item.id === 'departments' || item.name.includes('职能部门')) && user?.department_id && user?.role?.toUpperCase() !== 'SUPER_ADMIN') {
      try {
        const { data: allDepts } = await getDepartments();
        if (allDepts && allDepts.length > 0) {
          let targetDept = allDepts.find(d => d.id === user.department_id);

          // Goal: Find Level 2 Department (Child of Root)
          // Root (Level 1) -> Target (Level 2) -> ... -> User Dept

          let safety = 0;

          // Trace path upwards
          while (targetDept && targetDept.parent_id && safety < 10) {
            const parent = allDepts.find(d => d.id === targetDept?.parent_id);
            if (!parent) break;

            // If parent is Root (no parent), then targetDept is Level 2.
            if (!parent.parent_id) {
              // We found the Level 2 Dept!
              // Construct path: [01_Space, Root, Level2]
              const root = parent;
              const level2 = targetDept;

              const newPath = [
                { id: item.id, name: item.name, role: item.role }, // 01 Space
                { id: `dept-${root.id}`, name: root.name, role: 'viewer' as const }, // Root (America R&D)
                { id: `dept-${level2.id}`, name: level2.name, role: 'viewer' as const } // Level 2 (Digital Intel)
              ];

              setCurrentPath(newPath);
              setEffectiveFolderRole('viewer');
              setViewMode('list');
              return;
            }
            targetDept = parent;
            safety++;
          }
        }
      } catch (e) {
        console.error('Smart shortcut failed', e);
      }
    }




    setEffectiveFolderRole(item.role || 'viewer'); // Pass role down
    setCurrentFolder({ is_restricted: item.isLocked }); // Update currentFolder context for permissions
    setCurrentPath([...currentPath, {
      id: item.id,
      name: item.name,
      role: item.role,
      projectId: item.projectId, // Pass projectId down
      departmentId: item.departmentId // Pass departmentId down
    }]);

    // Auto-switch to list view when entering any folder from root or deeper
    if (currentPath.length >= 0) {
      setViewMode('list');
    }
  };

  const navigateBack = () => {
    if (currentPath.length === 0) return;

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);

    // Restore effective role from the new last breadcrumb
    if (newPath.length > 0) {
      setEffectiveFolderRole(newPath[newPath.length - 1].role || 'viewer');
    } else {
      setEffectiveFolderRole('editor'); // Default for root spaces
    }

    // Do NOT manually set currentItems from rootSpaces/mockData.
    // The useEffect hook dependent on [currentPath] will handle fetching the correct data for the new path.
    // Setting it manually here to potentially empty/mock data caused crashes.
    setLoading(true); // Optimistically set loading
  };

  const navigateToBreadcrumb = async (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
      setEffectiveFolderRole('editor');
      setCurrentItems(rootSpaces);
      return;
    }



    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);

    // Restore effective role from the selected breadcrumb
    setEffectiveFolderRole(newPath[newPath.length - 1].role || 'viewer');

    // Do not synchronously set items from rootSpaces (mock). 
    // Let the useEffect hook handle data fetching based on the new path.
    // Setting loading to true explicitly to smooth transition
    setLoading(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const files: File[] = [];

    const traverseEntry = async (entry: any, path: string = "") => {
      if (entry.isFile) {
        // Filter system files (e.g. .DS_Store, Thumbs.db)
        if (entry.name.startsWith('.') || entry.name === 'Thumbs.db') return;

        const file = await new Promise<File>((resolve) => entry.file(resolve));
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path ? `${path}/${file.name}` : file.name,
          writable: false,
          configurable: true
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise<any[]>((resolve) => {
          const allEntries: any[] = [];
          const readAll = () => {
            reader.readEntries((results: any[]) => {
              if (results.length === 0) {
                resolve(allEntries);
              } else {
                allEntries.push(...results);
                readAll();
              }
            });
          };
          readAll();
        });
        for (const childEntry of entries) {
          await traverseEntry(childEntry, path ? `${path}/${entry.name}` : entry.name);
        }
      }
    };

    const traversePromises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        traversePromises.push(traverseEntry(entry));
      }
    }

    await Promise.all(traversePromises);

    if (files.length > 0) {
      setDroppedFiles(files);
      setUploadDialogOpen(true);
    }
  }, []);

  const handleCreateFolder = async (name: string, permission: string, adminIds?: string[], defaultRole: 'viewer' | 'editor' = 'viewer') => {
    // Determine space type
    let spaceType: 'public' | 'department' | 'project' = 'public';
    if (currentPath.length >= 1) {
      const rootId = currentPath[0].id;
      if (rootId === 'departments') spaceType = 'department';
      else if (rootId === 'projects') spaceType = 'project';
    }

    // Determine parent ID
    let parentId: string | undefined = undefined;
    if (currentPath.length > 0) {
      parentId = currentPath[currentPath.length - 1].id;
      if (isNaN(Number(parentId))) {
        // Keep string ID
      }
    }

    setLoading(true);
    // 1. Create Folder
    const { data: folder, error } = await createFolderApi(name, parentId, spaceType, permission === 'private');

    if (error || !folder) {
      setLoading(false);
      toast.error(error?.message || '创建文件夹失败');
      return;
    }

    // 2. Add Collaborators if provided
    if (adminIds && adminIds.length > 0) {
      let successCount = 0;
      await Promise.all(adminIds.map(async (userId) => {
        const { error: shareError } = await api.post('/share', {
          user_id: parseInt(userId),
          folder_id: folder.id,
          role: defaultRole
        });
        if (!shareError) successCount++;
      }));
      if (successCount < adminIds.length) {
        toast.warning(`文件夹已创建，但部分成员添加失败 (${successCount}/${adminIds.length})`);
      } else {
        toast.success(`文件夹 "${name}" 创建成功，已添加 ${successCount} 位成员`);
      }
    } else {
      toast.success(`文件夹 "${name}" 创建成功`);
    }

    setLoading(false);
    setNewFolderDialogOpen(false);
    setRefreshKey(prev => prev + 1); // Trigger reload
  };
  // Determine if we're at first level of a space (for admin selection)
  const isFirstLevelFolder = currentPath.length === 1;
  const currentSpaceType = useMemo(() => {
    if (currentPath.length === 0) return undefined;
    const rootId = String(currentPath[0]?.id);
    if (rootId === 'public' || rootId === '65' || rootId === '124') return 'public';
    if (rootId === 'departments' || rootId === '64') return 'departments';
    if (rootId === 'projects') return 'project';
    return undefined;
  }, [currentPath]);

  const handleSearch = useCallback((filters: SearchFilters) => {
    if (!filters.query && filters.types.length === 0 && filters.authors.length === 0) {
      setSearchResults(null);
      setSearchActive(false);
      return;
    }

    setSearchActive(true);
    setLoading(true);

    // Global Search Execution
    const performGlobalSearch = async () => {
      try {
        const query = filters.query;
        // Parallel requests to Documents and Folders
        const [docsRes, foldersRes] = await Promise.all([
          getDocuments(undefined, query),
          getFolders(undefined, undefined, undefined, query)
        ]);

        const docs = docsRes.data || [];
        const folders = foldersRes.data || [];

        // Map to FolderItem
        const folderItems = folders.map(f => ({
          id: f.id.toString(),
          name: f.name,
          type: 'folder' as const,
          size: '-',
          updatedAgo: formatDate(f.updated_at || ''),
          author: f.owner_name || 'System',
          isLocked: f.is_restricted,
          spaceType: f.space_type,
          role: f.role as any,
          ancestors: f.ancestors
        }));

        const docItems = docs.map(d => ({
          id: d.id.toString(),
          name: d.name,
          type: d.file_type as any,
          size: d.size ? formatFileSize(d.size) : '0 B',
          updatedAgo: formatDate(d.updated_at || ''),
          author: d.author_name || 'System',
          isLocked: d.is_restricted,
          role: d.role as any,
          ancestors: d.ancestors
        }));

        // Combine and Filter in Memory (for Type/Author filters)
        let combined = [...folderItems, ...docItems];

        // Apply Local Filters (Type/Author)
        if (filters.types.length > 0) {
          combined = combined.filter(item => filters.types.includes(item.type));
        }
        if (filters.authors.length > 0) {
          combined = combined.filter(item => item.author && filters.authors.includes(item.author));
        }

        // Update Search Results State (for Dropdown) instead of filtering main list
        setSearchResults(combined as FolderItem[]);

      } catch (err) {
        console.error("Search failed", err);
        toast.error("搜索失败");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };
    performGlobalSearch();
  }, []);

  const handleNavigateToResult = async (item: FolderItem) => {
    setSearchResults(null);
    setSearchActive(false);

    // Construct path from ancestors
    let newPath: BreadcrumbItem[] = [];
    if (item.ancestors && item.ancestors.length > 0) {
      newPath = item.ancestors.map(a => ({
        id: a.id.toString(),
        name: a.name,
        role: 'viewer' // Default, assuming viewer access at least to see breadcrumbs
      }));
    }

    if (item.type === 'folder') {
      // If folder, navigate INTO it
      newPath.push({
        id: item.id,
        name: item.name,
        role: item.role || 'viewer'
      });
      setCurrentPath(newPath);
      // Update logic to set role from item if possible, or rely on future fetch
      if (item.role) setEffectiveFolderRole(item.role);
    } else {
      // If File, navigate to PARENT folder
      // File ancestors include the parent folder as the last item (usually)
      // Wait, backend logic: ancestors.insert(0, parent) -> [GrandParent, Parent]. Correct.
      // So ancestors IS the path to the file.

      if (newPath.length > 0) {
        setCurrentPath(newPath);
        setEffectiveFolderRole('viewer'); // Default, will be tricky without fetch
        // But we can try to find the last ancestor's role? We don't have it in ancestors list.

        // Trigger Highlight
        navigate(`?highlight=${item.id}`);
        setIsHighlightActive(true);
      } else {
        // Root file
        setCurrentPath([]);
        navigate(`?highlight=${item.id}`);
        setIsHighlightActive(true);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchActive(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDownload = () => {
    toast.success(`正在下载 ${selectedItems.size} 个文件...`);
    setSelectedItems(new Set());
  };

  const handleBatchDelete = () => {
    toast.success(`已删除 ${selectedItems.size} 个项目`);
    setSelectedItems(new Set());
  };

  const handleBatchMove = (targetPath: string) => {
    toast.success(`已移动 ${selectedItems.size} 个项目`);
    setSelectedItems(new Set());
  };

  const handleOpenRename = (item: FolderItem) => {
    setItemToRename(item);
    setRenameDialogOpen(true);
  };

  const handleRename = async (newName: string) => {
    if (!itemToRename) return;

    try {
      const endpoint = itemToRename.type === 'folder'
        ? `/folders/${itemToRename.id.replace('folder-', '')}`
        : `/documents/${itemToRename.id.replace(/^doc-/, '')}`;

      const { data, error } = await api.put<any>(endpoint, { name: newName });

      if (error) {
        toast.error('重命名失败');
        console.error(error);
        return;
      }

      setCurrentItems(prev =>
        prev.map(item =>
          item.id === itemToRename.id
            ? { ...item, name: newName }
            : item
        )
      );
      toast.success(`已重命名为 "${newName}"`);
      // Refresh to ensure sync
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      toast.error('重命名请求异常');
      console.error(err);
    } finally {
      setItemToRename(null);
    }
  };


  const getFileUrl = (item: FolderItem) => {
    // Construct real backend URL
    // Remove 'doc-' prefix if present
    const docId = item.id.replace(/^doc-/, '');
    const apiBase = `http://${window.location.hostname}:8001`;

    // Get token for authentication (since new window won't have headers)
    const token = localStorage.getItem('token');
    return `${apiBase}/documents/${docId}/content?token=${token}`;
  };

  const handlePreviewFile = (item: FolderItem) => {
    if (item.type !== 'folder') {
      const fileUrl = getFileUrl(item);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      toast.info(`正在预览: ${item.name}`);
    }
  };

  const handleDownloadFile = (item: FolderItem) => {
    const apiBase = `http://${window.location.hostname}:8001`;
    const token = localStorage.getItem('token');

    if (item.type === 'folder') {
      const zipUrl = `${apiBase}/folders/${item.id}/zip?token=${token}`;
      // Use _blank to avoid navigating away if application/zip isn't handled by browser download manager immediately (though _self is usually fine for attachments)
      // _self is better for file downloads to avoid empty tabs.
      window.open(zipUrl, '_self');
      toast.success(`正在打包下载文件夹: ${item.name}，请稍候...`);
    } else {
      const fileUrl = getFileUrl(item);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      toast.success(`开始下载: ${item.name}`);
    }
  };

  // Delete Dialog State
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FolderItem | null>(null);

  const handleDeleteItem = (item: FolderItem) => {
    setItemToDelete(item);
    setDeleteConfirmationOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'folder') {
        // Special handling for Projects
        if ((itemToDelete as any).projectId && (currentPath.length === 1 && currentPath[0].id === 'projects')) {
          const projId = (itemToDelete as any).projectId;
          const { error } = await deleteProject(projId);
          if (error) {
            console.error('Delete project error', error);
            toast.error('删除项目失败');
            return;
          }
        } else {
          // Normal Folder
          const { error } = await deleteFolder(itemToDelete.id);
          if (error) {
            console.error('Delete error', error);
            toast.error('删除文件夹失败');
            return;
          }
        }
      } else {
        const idStr = itemToDelete.id.toString();
        const docId = idStr.replace('doc-', '');

        if (!docId) {
          toast.error('无效的文件 ID');
          return;
        }

        const { error } = await deleteDocument(docId);
        if (error) {
          console.error('Delete error', error);
          toast.error('删除文档失败');
          return;
        }
      }

      toast.success('删除成功');
      setDeleteConfirmationOpen(false);
      setItemToDelete(null);
      // Refresh list
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      console.error(e);
      toast.error('删除失败');
    }
  };

  const currentPathString = currentPath.map(p => p.name).join(' / ');
  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : undefined;

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">内部文档</h1>
          <p className="text-muted-foreground mt-1 text-sm">三层空间体系 · 分级权限管理</p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <SearchBar
            onSearch={handleSearch}
            onClear={handleClearSearch}
            isActive={searchActive}
            results={searchResults}
            loading={searchLoading}
            onNavigate={handleNavigateToResult}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4 bg-card/60 backdrop-blur-xl rounded-xl px-4 py-3 border border-border/40">
        {/* Left: Back button + Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {currentPath.length > 0 && (
            <button
              onClick={navigateBack}
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          <div className="flex items-center gap-1 text-sm min-w-0">
            <button
              onClick={() => navigateToBreadcrumb(-1)}
              className={cn(
                'px-2 py-1 rounded-md transition-colors flex-shrink-0',
                isRootLevel
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              根目录
            </button>

            {currentPath.map((crumb, index) => (
              <div key={crumb.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                <button
                  onClick={() => index !== currentPath.length - 1 && navigateToBreadcrumb(index)}
                  className={cn(
                    'px-2 py-1 rounded-md transition-colors max-w-[180px] truncate',
                    index === currentPath.length - 1
                      ? 'text-foreground font-medium cursor-default'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLevel3 && hasFiles && (
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-md transition-all duration-200',
                  viewMode === 'grid'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-md transition-all duration-200',
                  viewMode === 'list'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Hide actions in shared folder or root */}
            {currentPath.length > 0 && currentPath[currentPath.length - 1].id !== 'shared' && isEditable && (
              <>
                <Button onClick={() => setNewFolderDialogOpen(true)} variant="outline" className="gap-2">
                  <FolderPlus className="w-4 h-4" />
                  新建文件夹
                </Button>
              </>
            )}

            {/* New Project Button (Only in Projects Root) */}
            {currentPath.length === 1 && currentPath[0].id === 'projects' && (
              <Button onClick={() => setProjectDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                新建项目
              </Button>
            )}

            {/* Upload Button */}
            {canPerformActions && (currentPath.length !== 1 || currentPath[0].id !== 'projects') && (
              <Button onClick={() => setUploadDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 gap-2 shadow-md">
                <Plus className="w-4 h-4" />
                上传文件/文件夹
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) setDroppedFiles([]);
        }}
        currentPath={currentPathString}
        currentFolderId={currentFolderId}
        parentPermission={parentPermission}
        spaceType={currentSpaceType as any}
        onUploadSuccess={() => setRefreshKey(prev => prev + 1)}
        initialFiles={droppedFiles}
        existingItems={currentItems}
        isParentRestricted={currentFolder?.is_restricted}
      />
      <NewFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        currentPath={currentPathString}
        onCreate={(name, perm, admins, role) => {
          console.log('Creating folder:', { name, perm, admins, role, isParentRestricted: currentFolder?.is_restricted });
          handleCreateFolder(name, perm, admins, role);
        }}
        parentPermission={parentPermission}
        isFirstLevel={isFirstLevelFolder}
        spaceType={currentSpaceType}
        isParentRestricted={currentFolder?.is_restricted}
      />
      <FilePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} file={previewFile} />
      <MoveDialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen} selectedCount={selectedItems.size} onMove={handleBatchMove} />
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentName={itemToRename?.name || ''}
        itemType={itemToRename?.type === 'folder' ? 'folder' : 'file'}
        onRename={handleRename}
      />

      <ProjectDialog
        isOpen={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
      />

      <ProjectMembersDialog
        isOpen={projectMembersDialogState.isOpen}
        onClose={() => setProjectMembersDialogState(prev => ({ ...prev, isOpen: false }))}
        projectId={projectMembersDialogState.projectId}
        projectTitle={projectMembersDialogState.projectTitle}
      />

      <PermissionDialog
        key={permissionTarget?.id || 'empty-dialog'}
        open={permissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
        resourceId={permissionTarget?.id || 0}
        resourceType={permissionTarget?.type === 'folder' ? 'folder' : 'document'}
        resourceName={permissionTarget?.name || ''}
        projectId={currentProjectId ? parseInt(currentProjectId) : undefined}
        projectName={currentProjectName || undefined}
        departmentId={currentDepartmentId}
        isPublic={currentSpaceType === 'public' || permissionTarget?.id.toString() === 'public' || permissionTarget?.id.toString() === '124'}
        initialIsRestricted={permissionTarget?.isRestricted} // Pass restriction status
        initialOwnerId={permissionTarget?.owner_id} // Pass owner ID
        initialOwnerName={permissionTarget?.owner_name} // Pass owner name
      />

      {/* Delete Confirmation Dialog */}
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-0 shadow-xl gap-0">
          <div className="bg-white p-6 flex flex-col items-start">
            <DialogHeader className="mb-4 text-left w-full flex flex-row items-center justify-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-1">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-foreground m-0 leading-none">
                确认删除{itemToDelete?.type === 'folder' ? '文件夹' : '文件'}?
              </DialogTitle>
            </DialogHeader>

            <div className="w-full text-sm text-muted-foreground/80 leading-relaxed text-center">

              <div className="w-full text-left p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-start gap-3 mb-4">
                {itemToDelete && (() => {
                  const { icon: Icon, iconColor } = getFileIcon(itemToDelete.type, false);
                  return <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconColor)} />;
                })()}
                <span className="font-medium text-foreground break-all flex-1 leading-snug">
                  {itemToDelete?.name}
                </span>
              </div>

              {itemToDelete?.type === 'folder' && (
                <div className="w-full text-left flex items-start gap-2 p-2.5 rounded bg-amber-50 text-amber-700 text-xs border border-amber-100/50">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>该操作将 <b>永久删除</b> 文件夹内的所有内容。</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50/50 flex justify-end gap-3 border-t">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmationOpen(false)}
              className="h-9 px-4 hover:bg-white hover:text-foreground"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="h-9 px-4 shadow-sm bg-red-600 hover:bg-red-700"
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BatchActions selectedCount={selectedItems.size} onDownload={handleBatchDownload} onMove={() => setMoveDialogOpen(true)} onDelete={handleBatchDelete} onClear={() => setSelectedItems(new Set())} />


      {/* Content Area */}
      {
        currentItems.length === 0 && !(currentSpaceType === 'project' && currentPath.length === 1 && currentPath[0].id === 'projects') ? (
          /* Empty State with Drag & Drop Zone */
          <div
            className={cn(
              'flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/60 hover:border-border hover:bg-accent/5'
            )}
            onClick={() => setUploadDialogOpen(true)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors',
              isDragOver ? 'bg-primary/10' : 'bg-accent/50'
            )}>
              <Upload className={cn(
                'w-8 h-8 transition-colors',
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <p className="text-foreground font-medium mb-1">拖拽文件/文件夹至此</p>
            <p className="text-muted-foreground text-sm">或 点击上传/上传文件夹</p>
          </div>
        ) : currentItems.length === 0 && (currentSpaceType === 'project' && currentPath.length === 1 && currentPath[0].id === 'projects') ? (
          /* Empty State - Project Root */
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/40 rounded-2xl bg-muted/10">
            <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4 text-muted-foreground">
              <FolderPlus className="w-8 h-8" />
            </div>
            <p className="text-foreground font-medium mb-2">暂无项目</p>
          </div>
        ) : effectiveViewMode === 'list' && !isRootLevel ? (
          /* List View - Table Style */
          <div
            className={cn(
              'bg-card/60 backdrop-blur-xl rounded-xl border border-border/40 overflow-hidden',
              isDragOver && 'ring-2 ring-primary ring-offset-2'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_140px_80px_100px_48px] gap-4 px-4 py-3 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div>名称</div>
              <div>修改日期</div>
              <div>大小</div>
              <div>上传者</div>
              <div className="text-center">操作</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border/20">
              {displayItems.map((item) => {
                const isFolder = item.type === 'folder';
                const { icon: Icon, bgColor, iconColor } = getFileIcon(item.type, item.isLocked);
                const isEditable = user?.role?.toLowerCase() === 'super_admin' ||
                  (item.ownerId === user?.id) ||
                  (item.role === 'editor' || item.role === 'admin');
                const canManageMembers = user?.role?.toLowerCase() === 'super_admin' ||
                  (item.ownerId === user?.id) ||
                  (item.role === 'admin');

                // Normalize IDs for comparison to handle string/number and potential prefixes
                const rawHighlightId = highlightId?.replace(/^(doc-|file-|folder-)/, '');
                const rawItemId = item.id.toString().replace(/^(doc-|file-|folder-)/, '');
                const isHighlighted = highlightId && isHighlightActive && (rawItemId === rawHighlightId);

                return (
                  <div
                    key={item.id}
                    id={`file-row-${item.id}`} // Add ID for scrolling
                    onClick={() => isFolder ? navigateToFolder(item) : handlePreviewFile(item)}
                    className={cn(
                      'grid grid-cols-[1fr_140px_80px_100px_48px] gap-4 px-4 py-3 items-center transition-all duration-500 cursor-pointer', // slower transition for fade
                      'hover:bg-accent/30',
                      item.isLocked && 'opacity-60',
                      isHighlighted && 'bg-yellow-100/80 dark:bg-yellow-900/40 ring-2 ring-yellow-500/50 z-10 scale-[1.005] shadow-sm' // Highlight styles (Yellow flash)
                    )}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        bgColor
                      )}>
                        <Icon className={cn('w-4 h-4', iconColor)} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          'text-sm font-medium text-foreground truncate',
                          isFolder && !item.isLocked && 'hover:text-primary'
                        )}>
                          {item.name}
                        </span>
                        {/* Search Path Breadcrumbs */}
                        {item.ancestors && item.ancestors.length > 0 && (
                          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            {item.ancestors.map(a => a.name).join(' / ')}
                          </span>
                        )}
                      </div>
                      {item.isLocked && (
                        <span className="text-xs text-red-500 flex-shrink-0">需要权限</span>
                      )}
                    </div>

                    {/* Date Modified */}
                    <div className="text-sm text-muted-foreground">
                      {item.updatedAgo || '-'}
                    </div>

                    {/* Size */}
                    <div className="text-sm text-muted-foreground">
                      {item.size || '-'}
                    </div>

                    {/* Author */}
                    <div className="text-sm text-muted-foreground truncate">
                      {item.author || '-'}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {/* Project Member Management */}
                          {(item as any).projectId && canManageMembers && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => setProjectMembersDialogState({
                                isOpen: true,
                                projectId: (item as any).projectId,
                                projectTitle: item.name
                              })}
                            >
                              <Users className="w-4 h-4" />
                              成员管理
                            </DropdownMenuItem>
                          )}

                          {canManageMembers && !item.isProtected && !isNaN(Number(item.id.toString().replace(/^(doc-|folder-|file-)/, ''))) && !(item as any).projectId && currentSpaceType !== 'public' && currentSpaceType !== 'project' && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => handleOpenPermissions(item)}
                            >
                              <Shield className="w-4 h-4" />
                              {((item.id as any) === 'public' || (item.id as any).toString() === '124') ? '权限管理' : '协作与成员管理'}

                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => {
                              const link = `${window.location.origin}/share/${item.type}/${item.id}`;
                              copyToClipboard(link);
                            }}
                          >
                            <Share2 className="w-4 h-4 ml-[0.5px]" />
                            分享链接
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => handleDownloadFile(item)}
                          >
                            <Download className="w-4 h-4" />
                            下载
                          </DropdownMenuItem>
                          {isEditable && !item.isProtected && !isNaN(Number(item.id.toString().replace(/^(doc-|folder-|file-)/, ''))) && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => handleOpenRename(item)}
                              >
                                <Pencil className="w-4 h-4" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="w-4 h-4" />
                                删除
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Grid View */
          <div
            className={cn(
              'grid gap-3',
              isRootLevel ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
              isDragOver && isLevel3 && 'ring-2 ring-primary ring-offset-4 rounded-2xl'
            )}
            onDragOver={isLevel3 ? handleDragOver : undefined}
            onDragLeave={isLevel3 ? handleDragLeave : undefined}
            onDrop={isLevel3 ? handleDrop : undefined}
          >
            {currentItems.map((item) => {
              const isFolder = item.type === 'folder';
              const isRoot = isRootLevel;
              const { icon: Icon, bgColor, iconColor } = getFileIcon(item.type, item.isLocked);
              const RootIcon = isRoot ? getRootIcon(item) : Icon;
              const isEditable = user?.role?.toLowerCase() === 'super_admin' ||
                (item.ownerId === user?.id) ||
                (item.role === 'editor' || item.role === 'admin');
              const canManageMembers = user?.role?.toLowerCase() === 'super_admin' ||
                (item.ownerId === user?.id) ||
                (item.role === 'admin');

              // Normalize IDs for comparison
              const rawHighlightId = highlightId?.replace(/^(doc-|file-|folder-)/, '');
              const rawItemId = item.id.toString().replace(/^(doc-|file-|folder-)/, '');
              const isHighlighted = highlightId && isHighlightActive && (rawItemId === rawHighlightId);

              return (
                <div
                  key={item.id}
                  id={`file-row-${item.id}`}
                  className={cn(
                    'group relative text-left transition-all duration-200',
                    isRoot
                      ? 'bg-card rounded-2xl p-6 border border-border/40 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-border/60'
                      : 'bg-card rounded-xl p-4 border border-border/30 hover:bg-accent/30 hover:border-border/50',
                    item.isLocked && 'opacity-60 cursor-not-allowed',
                    isHighlighted && 'bg-yellow-100/80 dark:bg-yellow-900/40 ring-2 ring-yellow-500/50 z-10 scale-[1.05] shadow-md'
                  )}
                >
                  {/* Action Menu - Top Right */}
                  {!item.isLocked && (isRoot ? canManageMembers : true) && (
                    <div
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md bg-background/80 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground shadow-sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {/* Project Member Management */}
                          {(item as any).projectId && canManageMembers && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => setProjectMembersDialogState({
                                isOpen: true,
                                projectId: (item as any).projectId,
                                projectTitle: item.name
                              })}
                            >
                              <Users className="w-4 h-4" />
                              成员管理
                            </DropdownMenuItem>
                          )}

                          {canManageMembers && !item.isProtected && !isNaN(Number(item.id.toString().replace(/^(doc-|folder-|file-)/, ''))) && !(item as any).projectId && currentSpaceType !== 'public' && currentSpaceType !== 'project' && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => handleOpenPermissions(item)}
                            >
                              <Shield className="w-4 h-4" />
                              {((item.id as any) === 'public' || (item.id as any).toString() === '124') ? '权限管理' : '协作与成员管理'}

                            </DropdownMenuItem>
                          )}

                          {!isRoot && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => {
                                  const link = `${window.location.origin}/share/${item.type}/${item.id}`;
                                  copyToClipboard(link);
                                }}
                              >
                                <Share2 className="w-4 h-4 ml-[0.5px]" />
                                分享链接
                              </DropdownMenuItem>
                              {isEditable && !isNaN(Number(item.id.toString().replace(/^(doc-|folder-|file-)/, ''))) && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer"
                                  onClick={() => handleOpenRename(item)}
                                >
                                  <Pencil className="w-4 h-4" />
                                  重命名
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => handleDownloadFile(item)}
                              >
                                <Download className="w-4 h-4" />
                                下载
                              </DropdownMenuItem>
                              {isEditable && !isNaN(Number(item.id.toString().replace(/^(doc-|folder-|file-)/, ''))) && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  删除
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  {/* Clickable Content */}
                  <button
                    onClick={() => isFolder ? navigateToFolder(item) : handlePreviewFile(item)}
                    disabled={item.isLocked}
                    className="w-full text-left"
                  >
                    {isRoot ? (
                      // Root level cards - New Design
                      <div className="flex flex-col h-full min-h-[120px]">
                        {/* Top: Header Row (Icon + Title + Badge) */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
                              item.id === 'public' && 'bg-blue-50 text-blue-600',
                              item.id === 'departments' && 'bg-amber-50 text-amber-600',
                              item.id === 'projects' && 'bg-green-50 text-green-600',
                              item.id === 'shared' && 'bg-rose-50 text-rose-600',
                              (item as any).bgColor
                            )}>
                              <RootIcon className={cn(
                                'w-6 h-6',
                                (item as any).iconColor
                              )} />
                            </div>

                            <h3 className={cn(
                              "text-[17px] font-semibold tracking-tight transition-colors",
                              item.id === 'public' && 'text-blue-900',
                              item.id === 'departments' && 'text-amber-900',
                              item.id === 'projects' && 'text-green-900',
                              item.id === 'shared' && 'text-rose-900',
                              !['public', 'departments', 'projects', 'shared'].includes(item.id.toString()) && 'text-foreground'
                            )}>
                              {item.name}
                            </h3>
                          </div>

                          {/* Badge */}
                          <span className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full bg-opacity-60 whitespace-nowrap',
                            (item.id === 'public' || item.name.includes('公共资源库')) && 'bg-blue-100 text-blue-700',
                            (item.id === 'departments' || item.name.includes('部门')) && 'bg-amber-100 text-amber-700',
                            (item.id === 'projects' || item.name.includes('项目')) && 'bg-green-100 text-green-700',
                            (item.id === 'shared' || item.name.includes('与我共享')) && 'bg-rose-100 text-rose-700',
                            (!['public', 'departments', 'projects', 'shared'].includes(item.id.toString()) && !item.name.includes('公共资源库') && !item.name.includes('部门') && !item.name.includes('项目') && !item.name.includes('与我共享')) && 'bg-gray-100 text-gray-500'
                          )}>
                            {item.id === 'public' && '全员可见'}
                            {item.id === 'departments' && '部门隔离'}
                            {item.id === 'projects' && '跨部门'}
                            {item.id === 'shared' && '跨部门'}
                            {(!['public', 'departments', 'projects', 'shared'].includes(item.id.toString())) && '全员可见'}
                          </span>
                        </div>

                        <div className="flex-1 mt-4 pl-1">
                          <p className="text-[13px] text-muted-foreground/80 leading-7 line-clamp-2 font-normal">
                            {(item.id === 'public' || item.name.includes('公共资源库')) && '内部公开的政策规范、技术标准与通用模板'}
                            {(item.id === 'departments' || item.name.includes('部门')) && '各业务部门的内部专属工作区'}
                            {(item.id === 'projects' || item.name.includes('项目')) && '跨部门项目组、临时专项小组工作区'}
                            {(item.id === 'shared' || item.name.includes('与我共享')) && '协作文档（仅显示添加协同人方式的文件/文件夹）'}
                            {(!['public', 'departments', 'projects', 'shared'].includes(item.id.toString()) && !item.name.includes('公共资源库') && !item.name.includes('部门') && !item.name.includes('项目') && !item.name.includes('与我共享')) && '文件夹包含归档和协作内容'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Normal Grid Item
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          bgColor
                        )}>
                          <Icon className={cn('w-5 h-5', iconColor)} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={cn(
                            'font-medium text-foreground truncate transition-colors',
                            isFolder && !item.isLocked && 'group-hover:text-primary'
                          )}>
                            {item.name}
                          </span>
                          {item.updatedAgo && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3" />
                              {item.updatedAgo}
                            </span>
                          )}
                          {item.author && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <User className="w-3 h-3" />
                              {item.author}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div >
        )
      }
    </div >
  );
}
