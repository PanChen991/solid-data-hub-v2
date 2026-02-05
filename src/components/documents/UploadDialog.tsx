import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, FileText, FileSpreadsheet, FileType, Trash2, CheckCircle2, Info, Folder, Lock, Building2, Users, Globe, UserPlus, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ParentPermission } from './NewFolderDialog';
import { useDocuments, useFolders, useSharing } from '@/hooks/useDatabase';
import { toast } from 'sonner';
import { UserSelector } from '@/components/documents/UserSelector';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Add type for webkitdirectory
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    directory?: string;
    webkitdirectory?: string;
  }
}

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  errorMessage?: string; // Add error message field
}

// ... (inside component)



interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  currentFolderId?: string;
  parentPermission?: ParentPermission;
  spaceType?: 'public' | 'department' | 'project' | 'personal' | 'departments' | 'projects';
  onUploadSuccess?: () => void;
  initialFiles?: File[];
  existingItems?: { name: string; type: string }[];
  isParentRestricted?: boolean;
}

const permissionOptions = [
  { value: 'inherit', label: '继承父文件夹', icon: Folder, description: '与上级目录权限一致' },
  { value: 'private', label: '仅自己可见', icon: Lock, description: '仅创建者可访问' },
  { value: 'department', label: '部门可见', icon: Building2, description: '本部门成员可访问' },
  { value: 'project', label: '项目组可见', icon: Users, description: '项目成员可访问' },
  { value: 'department', label: '部门可见', icon: Building2, description: '本部门成员可访问' },
  { value: 'project', label: '项目组可见', icon: Users, description: '项目成员可访问' },
  { value: 'part', label: '特定人员可见', icon: UserPlus, description: '指定成员可访问' },
  { value: 'all', label: '全员可见', icon: Globe, description: '所有人可访问' },
];

const getFileIcon = (fileName: string, isFolder?: boolean) => {
  if (isFolder) {
    return { icon: Folder, color: 'text-amber-500', bg: 'bg-amber-50' };
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' };
    case 'xlsx':
    case 'xls':
      return { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50' };
    case 'docx':
    case 'doc':
      return { icon: FileType, color: 'text-blue-600', bg: 'bg-blue-50' };
    default:
      return { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getPermissionIcon = (type: string) => {
  switch (type) {
    case 'private': return Lock;
    case 'department': return Building2;
    case 'project': return Users;
    case 'all': return Globe;
    default: return Folder;
  }
};

const getPermissionColor = (type: string) => {
  switch (type) {
    case 'private': return { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200' };
    case 'department': return { bg: 'bg-amber-50', text: 'text-amber-500', border: 'border-amber-200' };
    case 'project': return { bg: 'bg-green-50', text: 'text-green-500', border: 'border-green-200' };
    case 'all': return { bg: 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-200' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
  }
};

export function UploadDialog({ open, onOpenChange, currentPath, currentFolderId, parentPermission, spaceType, onUploadSuccess, initialFiles, existingItems = [], isParentRestricted }: UploadDialogProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [permission, setPermission] = useState('inherit');
  const [permissionLevel, setPermissionLevel] = useState<'read' | 'write'>('write');
  const [selectedUserSets, setSelectedUserSets] = useState<Set<number>>(new Set());

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      if (initialFiles && initialFiles.length > 0) {
        addFiles(initialFiles);
      } else {
        setFiles([]);
      }
      setPermission('inherit');
      setPermissionLevel('write');
      setSelectedUserSets(new Set());
    }
  }, [open, initialFiles]);

  // Custom Permissions Logic
  const displayedOptions = useMemo(() => {
    const isDeptSpace = spaceType === 'department' || spaceType === 'departments';
    if (!isDeptSpace) return permissionOptions;

    const lastFolderName = currentPath.split(' / ').pop()?.trim() || '本部门';

    return permissionOptions
      .filter(opt => opt.value === 'inherit' || opt.value === 'private' || opt.value === 'part')
      .map(opt => {
        if (opt.value === 'inherit') {
          return { ...opt, label: `继承父文件夹权限 (${lastFolderName}全员可见)` };
        }
        return opt;
      });
  }, [spaceType, currentPath]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

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
        // Manually set webkitRelativePath since it's read-only, we'll store it in a custom property 
        // or just use the browser's native structure if available.
        // For dropped files, webkitRelativePath is often empty. 
        // We'll "fake" it by defining a property or using our own type.
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
    addFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Filter system files
      const selectedFiles = Array.from(e.target.files).filter(f =>
        !f.name.startsWith('.') && f.name !== 'Thumbs.db'
      );
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    // Collect duplicate folders set for reference (no blocking)
    const duplicateFolders = new Set<string>();

    if (existingItems && existingItems.length > 0) {
      newFiles.forEach(f => {
        if (f.webkitRelativePath) {
          const isRootFolder = f.webkitRelativePath.split('/').length > 1; // It has parts
          if (isRootFolder) {
            const rootFolderName = f.webkitRelativePath.split('/')[0];
            // Check if this root folder exists
            // Only for top-level folders being uploaded
            const exists = existingItems.some(item => item.name === rootFolderName && item.type === 'folder');
            if (exists) {
              duplicateFolders.add(rootFolderName);
            }
          }
        }
      });
    }

    const uploadFiles: UploadFile[] = newFiles.map(file => {
      let status: UploadFile['status'] = 'pending';
      let errorMsg: string | undefined;

      // Check duplicates for files at root level
      const isRootFile = !file.webkitRelativePath || !file.webkitRelativePath.includes('/');

      if (isRootFile && existingItems && existingItems.length > 0) {
        // Check against existingItems
        // We do a loose check. existingItems has {name, type}.
        const exists = existingItems.some(item => item.name === file.name && item.type !== 'folder');
        if (exists) {
          status = 'error';
          errorMsg = '文件已存在';
        }
      }

      // Check if file belongs to a duplicate folder
      if (file.webkitRelativePath) {
        const rootFolderName = file.webkitRelativePath.split('/')[0];
        if (duplicateFolders.has(rootFolderName)) {
          status = 'error';
          errorMsg = '文件夹已存在';
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        progress: 0,
        status,
        errorMessage: errorMsg
      };
    });
    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const { createDocument } = useDocuments();
  const { createFolder, getFolders } = useFolders();

  // Recursive folder creation helper
  const ensureDirectoriesExist = async (files: File[], rootFolderId: string): Promise<Record<string, string>> => {
    // 1. Extract unique paths and sort by depth
    const dirPaths = new Set<string>();

    files.forEach(f => {
      if (f.webkitRelativePath) {
        const parts = f.webkitRelativePath.split('/');
        parts.pop(); // remove filename
        if (parts.length > 0) {
          let current = "";
          parts.forEach(p => {
            current = current ? `${current}/${p}` : p;
            dirPaths.add(current);
          });
        }
      }
    });

    const sortedPaths = Array.from(dirPaths).sort((a, b) => {
      return a.split('/').length - b.split('/').length;
    });

    // 2. Create folders sequentially
    const pathIdMap: Record<string, string> = { "": rootFolderId };
    let createdCount = 0;

    for (const path of sortedPaths) {
      const parts = path.split('/');
      const folderName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const parentId = parentPath === "" ? rootFolderId : pathIdMap[parentPath];

      if (!parentId) continue;

      try {
        // Inherit permission for subfolders
        const isTopLevel = parts.length === 1;
        const folderPerm = isTopLevel ? permission : 'inherit';

        // Determine isRestricted based on folderPerm
        // 'private' or 'part' usually implies restricted logic if we support it on folder level
        // But for now, let's keep it simple: if permission is 'private', restrict it.
        const isRestrictedFolder = folderPerm === 'private' || folderPerm === 'part';

        // Map plural types to singular for backend
        const normalizedSpaceType = (spaceType === 'departments' ? 'department' :
          spaceType === 'projects' ? 'project' :
            spaceType) as 'public' | 'department' | 'project';

        const { data, error } = await createFolder(
          folderName,
          parentId.toString(),
          normalizedSpaceType || 'public',
          isRestrictedFolder
        );

        if (error) {
          // If error is "Already Exists", try to fetch the existing folder ID
          // Error message from backend is usually "该位置已存在同名文件夹" or "Folder with this name already exists"
          const isDuplicate = error.message?.includes('exist') || error.message?.includes('已存在');

          if (isDuplicate) {
            console.log(`Folder ${folderName} exists, fetching ID...`);
            // Fetch existing folder
            const { data: searchData } = await getFolders(parentId.toString(), undefined, undefined, folderName);
            if (searchData && searchData.length > 0) {
              // Exact match check just in case
              const match = searchData.find(f => f.name === folderName);
              if (match) {
                pathIdMap[path] = match.id.toString();
                continue; // Success, proceed to next
              }
            }
          }


          // Log detailed error for debugging
          console.error(`Creating folder ${folderName} failed:`, error);
          // Show specific error to user to debug "Parent folder creation failed" cause
          if (error.message) {
            toast.error(`创建文件夹 "${folderName}" 失败: ${error.message}`);
          }
          continue;
        }

        if (data) {
          pathIdMap[path] = data.id.toString();
          createdCount++;

          // If this is a top-level folder in the upload (parent is the target folder), apply permissions
          if (parentId.toString() === rootFolderId) {
            await applyPermissions(data.id, 'folder');
          }
        }
      } catch (err) {
        console.error(`Error creating folder ${path}`, err);
      }
    }


    if (createdCount > 0) {
      toast.success(`已创建 ${createdCount} 个文件夹结构`);
    }

    return pathIdMap;
  };

  const { shareResource } = useSharing();

  // Helper to apply permissions to a resource
  const applyPermissions = async (resourceId: number, type: 'folder' | 'document') => {
    // Only apply if "Specific People" (part) is selected
    if (permission !== 'part') return;

    const userIds = Array.from(selectedUserSets);
    if (userIds.length === 0) return;

    try {
      const promises = userIds.map(userId =>
        shareResource(userId, type === 'folder' ? resourceId : undefined, type === 'document' ? resourceId : undefined, permissionLevel === 'read' ? 'viewer' : 'editor')
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Error applying permissions:", err);
      toast.error("权限设置部分失败，请稍后重试");
    }
  };

  // NOTE: We need to capture the 'role' selected in UI. 
  // If no role selector exists in UploadDialog for specific people, we default to viewer.
  // Unless we find a `role` state. I'll search for it.


  const handleUpload = async () => {
    if (!currentFolderId) {
      toast.error('无法确认当前文件夹上传位置');
      return;
    }

    // Identify if this is a folder upload (only valid pending files)
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    const hasFolderStructure = pendingFiles.some(f => f.file.webkitRelativePath);
    let pathIdMap: Record<string, string> = {};

    if (hasFolderStructure) {
      toast.loading('正在构建文件夹目录...', { id: 'folder-creation' });
      pathIdMap = await ensureDirectoriesExist(pendingFiles.map(f => f.file), currentFolderId);
      toast.dismiss('folder-creation');
    }

    // Process files
    for (const f of files) {
      if (f.status === 'pending') {
        // Determine target folder ID
        let targetFolderId = currentFolderId;
        if (f.file.webkitRelativePath) {
          const parts = f.file.webkitRelativePath.split('/');
          parts.pop();
          const dirPath = parts.join('/');

          if (dirPath) {
            if (pathIdMap[dirPath]) {
              targetFolderId = pathIdMap[dirPath];
            } else {
              setFiles(prev => prev.map(file =>
                file.id === f.id ? { ...file, status: 'error', progress: 0, errorMessage: '父文件夹创建失败' } : file
              ));
              continue;
            }
          }
        }

        // Initialize progress
        setFiles(prev => prev.map(file =>
          file.id === f.id ? { ...file, status: 'uploading', progress: 0 } : file
        ));


        // --- SIMULATED PROGRESS LOGIC ---
        const assumedSpeed = 3 * 1024 * 1024; // 3MB/s
        const calculatedDuration = f.file.size / assumedSpeed;
        const durationSeconds = Math.max(1.5, Math.min(files.length > 1 ? 2 : 10, calculatedDuration));
        const totalSteps = durationSeconds * 20;
        const incrementPerStep = 95 / totalSteps;

        let visualProgress = 0;
        let uploadComplete = false;
        let apiComplete = false;
        let isError = false;

        // Start Animation Timer
        const progressTimer = setInterval(() => {
          setFiles(prev => prev.map(file => {
            if (file.id !== f.id) return file;

            if (uploadComplete && !isError) {
              let next = file.progress + 5;
              if (next >= 100) next = 100;
              return { ...file, progress: next };
            }

            if (isError) return file;

            let next = file.progress + incrementPerStep;
            if (next > 95) next = 95;
            visualProgress = next;

            return { ...file, progress: next };
          }));
        }, 50);

        try {
          const { error } = await createDocument(
            f.file,
            targetFolderId.toString(),
            permission === 'private'
          );

          if (error) {
            console.error(error);
            isError = true;
            clearInterval(progressTimer);
            const isDuplicate = error.message.includes('exist') || error.message.includes('已存在');
            const errorMsg = isDuplicate ? '文件已存在' : (error.message || '上传失败');

            // Do not toast for every error if it is duplicate, just show in UI
            if (!isDuplicate) toast.error(errorMsg);

            setFiles(prev => prev.map(file =>
              file.id === f.id ? { ...file, status: 'error', errorMessage: errorMsg } : file
            ));
          } else {
            uploadComplete = true; // Signal timer to accelerate
            await new Promise<void>(resolve => {
              const checkDone = setInterval(() => {
                setFiles(prev => {
                  const file = prev.find(p => p.id === f.id);
                  if (file && file.progress >= 100) {
                    clearInterval(checkDone);
                    resolve();
                  }
                  return prev;
                });
              }, 50);
            });

            clearInterval(progressTimer);
            // toast.success(`文件 ${f.file.name} 上传成功`); // Reduce toast spam
            setFiles(prev => prev.map(file =>
              file.id === f.id ? { ...file, status: 'complete', progress: 100 } : file
            ));

            if (onUploadSuccess) onUploadSuccess();
          }
        } catch (e) {
          isError = true;
          clearInterval(progressTimer);
          setFiles(prev => prev.map(file =>
            file.id === f.id ? { ...file, status: 'error', errorMessage: '网络或系统异常' } : file
          ));
        }
      }
    }
  };

  const handleClose = () => {
    setFiles([]);
    setPermission('inherit');
    onOpenChange(false);
  };

  const allComplete = files.length > 0 && files.every(f => f.status === 'complete');
  const hasPending = files.some(f => f.status === 'pending');

  const ParentIcon = parentPermission ? getPermissionIcon(parentPermission.type) : Folder;
  const parentColors = parentPermission ? getPermissionColor(parentPermission.type) : getPermissionColor('inherit');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden transition-all duration-300 flex flex-col",
        permission === 'part' ? "sm:max-w-4xl sm:h-[680px] sm:max-h-[90vh]" : "sm:max-w-[500px] sm:max-h-[min(800px,90vh)]"
      )}>
        <div className="flex flex-col lg:flex-row h-full min-h-0">
          {/* Left Panel: Upload Info & Actions */}
          <div className={cn(
            "p-6 flex-shrink-0 transition-all duration-300 flex flex-col min-h-0",
            permission === 'part' ? "lg:w-[380px] border-b lg:border-b-0 lg:border-r border-border/50 bg-muted/20" : "w-full"
          )}>
            <div className="flex items-center gap-3 h-10 mb-5 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm flex-shrink-0">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">上传文件/文件夹</h2>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
              {/* Current Path */}
              <div className="flex flex-col gap-2 py-1">
                <div className="flex items-center gap-1.5 px-1">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/60">当前上传位置</span>
                </div>
                <div className="font-medium text-sm text-foreground bg-background/50 backdrop-blur-sm px-3 py-2.5 rounded-xl border border-border/40 break-all whitespace-normal shadow-sm leading-relaxed">
                  {currentPath || '根目录'}
                </div>
              </div>

              <div
                className={cn(
                  'border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer bg-background/20',
                  isDragOver
                    ? 'border-primary bg-primary/5 ring-4 ring-primary/5'
                    : 'border-border/60 hover:border-border hover:bg-background/40'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  id="folder-input"
                  type="file"
                  multiple
                  webkitdirectory="true"
                  directory="true"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors shadow-sm',
                  isDragOver ? 'bg-primary/20' : 'bg-background'
                )}>
                  <Upload className={cn(
                    'w-6 h-6',
                    isDragOver ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <p className="text-foreground font-semibold text-sm">拖拽文件/文件夹至此，或点击选择文件</p>
              </div>

              {/* Grouped File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <List className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/60">待上传列表</span>
                  </div>
                  {(() => {
                    // Grouping logic
                    const groups: Record<string, {
                      id: string;
                      name: string;
                      size: number;
                      count: number;
                      status: UploadFile['status'];
                      progress: number;
                      isFolder: boolean;
                      originalIds: string[];
                    }> = {};

                    files.forEach(f => {
                      const relPath = f.file.webkitRelativePath;
                      const isUnderFolder = relPath && relPath.includes('/');

                      if (isUnderFolder) {
                        const folderName = relPath.split('/')[0];
                        if (!groups[folderName]) {
                          groups[folderName] = {
                            id: `group-${folderName}`,
                            name: folderName,
                            size: 0,
                            count: 0,
                            status: 'complete',
                            progress: 0,
                            isFolder: true,
                            originalIds: []
                          };
                        }
                        groups[folderName].size += f.file.size;
                        groups[folderName].count += 1;
                        groups[folderName].originalIds.push(f.id);
                        if (f.status === 'error') groups[folderName].status = 'error';
                        else if (f.status === 'uploading' && groups[folderName].status !== 'error') groups[folderName].status = 'uploading';
                        else if (f.status === 'pending' && groups[folderName].status === 'complete') groups[folderName].status = 'pending';

                        groups[folderName].progress += f.progress;
                      } else {
                        groups[f.id] = {
                          id: f.id,
                          name: f.file.name,
                          size: f.file.size,
                          count: 1,
                          status: f.status,
                          progress: f.progress,
                          isFolder: false,
                          originalIds: [f.id]
                        };
                      }
                    });

                    return Object.values(groups).map((group) => {
                      const avgProgress = group.count > 0 ? group.progress / group.count : 0;
                      const { icon: Icon, color, bg } = getFileIcon(group.name, group.isFolder);

                      return (
                        <div
                          key={group.id}
                          className="flex items-center gap-3 p-3 bg-background border border-border/40 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-200"
                        >
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                            <Icon className={cn('w-4 h-4', color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5">
                              <p className="text-sm font-semibold text-foreground line-clamp-2 break-all leading-snug" title={group.name}>
                                {group.name}
                              </p>
                              {group.isFolder && (
                                <span className="text-[10px] text-muted-foreground/60 font-black flex-shrink-0">
                                  {group.count}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap min-w-[3.5rem]">
                                {group.status === 'uploading' ? `${Math.round(avgProgress)}%` : formatFileSize(group.size)}
                              </span>
                              {group.status === 'uploading' && (
                                <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden border border-border/20">
                                  <div
                                    className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                                    style={{ width: `${Math.max(5, avgProgress)}%` }}
                                  />
                                </div>
                              )}
                              {group.status === 'complete' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              )}
                              {group.status === 'error' && (
                                <div className="flex items-center gap-1.5 min-w-0 bg-red-50/50 px-2 py-0.5 rounded-full border border-red-100">
                                  <div className="w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 text-[8px] font-bold">!</div>
                                  <span className="text-[10px] text-red-600 font-medium truncate max-w-[120px]" title={(() => {
                                    if (group.id.startsWith('group-')) {
                                      const firstFile = files.find(f => f.id === group.originalIds[0]);
                                      return firstFile?.errorMessage || '部分失败';
                                    }
                                    return files.find(f => f.id === group.id)?.errorMessage || '上传失败';
                                  })()}>
                                    {(() => {
                                      if (group.id.startsWith('group-')) {
                                        const firstFile = files.find(f => f.id === group.originalIds[0]);
                                        return firstFile?.errorMessage || '部分失败';
                                      }
                                      return files.find(f => f.id === group.id)?.errorMessage || '上传失败';
                                    })()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {group.status === 'pending' && (
                            <button
                              onClick={() => {
                                group.originalIds.forEach(id => removeFile(id));
                              }}
                              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-all active:scale-95"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Permission Selection (Basic) */}
              {spaceType !== 'public' && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">访问权限设置</span>
                  </div>

                  {isParentRestricted ? (
                    /* LOCKED STATE: Restricted Parent */
                    <div className="flex items-center gap-3 p-3 bg-red-50/50 border border-red-100 border-dashed rounded-lg mt-1">
                      <Lock className="w-4 h-4 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">已继承私密属性</p>
                        <p className="text-[11px] text-red-600/80">父级目录为私密，上传文件自动设为私密</p>
                      </div>
                    </div>
                  ) : (spaceType === 'project' || spaceType === 'projects') ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50/50 border border-green-100/50 rounded-xl mt-1 shadow-sm">
                      <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-green-700">继承项目权限</p>
                        <p className="text-[11px] text-green-600/70 font-medium mt-0.5">项目组成员均可访问</p>
                      </div>
                      <Lock className="w-3.5 h-3.5 text-green-600/30" />
                    </div>
                  ) : (
                    <Select value={permission} onValueChange={setPermission}>
                      <SelectTrigger className="bg-background/50 h-11 transition-all hover:bg-background border-border/40 rounded-xl mt-1 shadow-sm px-4 focus:ring-0 focus:ring-offset-0 focus:border-primary">
                        <SelectValue>
                          {(() => {
                            const selected = displayedOptions.find(p => p.value === permission);
                            if (selected) {
                              return (
                                <div className="flex items-center gap-3">
                                  <selected.icon className="w-4 h-4 text-muted-foreground/80" />
                                  <span className="text-sm font-semibold">{selected.label}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40 shadow-xl p-1">
                        {displayedOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="rounded-lg">
                            <div className="flex items-center gap-3 py-1.5">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-primary/10">
                                <option.icon className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">{option.label}</p>
                                <p className="text-[11px] text-muted-foreground/60 font-medium leading-tight">{option.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Actions (Simple View) */}
            {permission !== 'part' && (
              <div className="flex justify-end gap-3 pt-6 border-t border-border/50 flex-shrink-0">
                <Button variant="outline" className="h-10 px-6 rounded-xl font-semibold border-border/50" onClick={handleClose}>
                  {(allComplete || (!hasPending && files.length > 0)) ? '完成' : '取消'}
                </Button>
                {!allComplete && (
                  <Button
                    onClick={handleUpload}
                    disabled={files.length === 0 || !hasPending}
                    className="bg-primary hover:bg-primary/90 h-10 px-8 rounded-xl font-bold shadow-[0_4px_12px_rgba(var(--primary),0.3)] transition-all hover:translate-y-[-1px] active:translate-y-[0px]"
                  >
                    开始上传 {files.length > 0 && `(${files.length})`}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Advanced Permissions */}
          {permission === 'part' && (
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden animate-in fade-in lg:slide-in-from-right-4">
              <div className="p-8 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between h-10 mb-6 flex-shrink-0">
                  <h2 className="text-xl font-bold flex items-center gap-3 text-foreground">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm flex-shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <span>配置可见人员</span>
                  </h2>
                  <Select value={permissionLevel} onValueChange={(val: 'read' | 'write') => setPermissionLevel(val)}>
                    <SelectTrigger className="h-9 w-[110px] bg-background/50 border-border/40 text-xs font-medium shadow-sm rounded-lg focus:ring-0 focus:ring-offset-0 focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[110px]">
                      <SelectItem value="read" className="text-xs">只读</SelectItem>
                      <SelectItem value="write" className="text-xs">编辑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-h-0 flex flex-col basis-0">
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden border border-border/50 rounded-xl shadow-sm bg-muted/10">
                    <UserSelector
                      selectedUserIds={selectedUserSets}
                      defaultExpandedDeptId={user?.department_id}
                      onToggleUser={(u) => {
                        setSelectedUserSets(prev => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id);
                          else next.add(u.id);
                          return next;
                        });
                      }}
                      className="h-full border-0 bg-transparent"
                    />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground/60 mt-4 px-1 italic flex items-center gap-1.5 flex-shrink-0">
                    <Info className="w-3 h-3" />
                    <span>选中的成员将被赋予“{permissionLevel === 'read' ? '只读' : '编辑'}”权限</span>
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-border/50 flex-shrink-0">
                  <Button variant="outline" className="h-10 px-6 rounded-xl font-semibold border-border/50" onClick={handleClose}>
                    {(allComplete || (!hasPending && files.length > 0)) ? '完成' : '取消'}
                  </Button>
                  {!allComplete && (
                    <Button
                      onClick={handleUpload}
                      disabled={files.length === 0 || !hasPending || selectedUserSets.size === 0}
                      className="bg-primary hover:bg-primary/90 h-10 px-10 rounded-xl font-bold shadow-[0_4px_12px_rgba(var(--primary),0.3)] transition-all hover:translate-y-[-1px] active:translate-y-[0px]"
                    >
                      开始上传 {files.length > 0 && `(${files.length})`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
