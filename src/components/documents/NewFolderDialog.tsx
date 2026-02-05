import { useState, useEffect, useMemo } from 'react';
import { Folder, Lock, Users, Building2, Globe, Info, UserPlus, X, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUsers, useDepartments, UserProfile } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { UserSelector } from '@/components/documents/UserSelector';

export interface ParentPermission {
  type: 'all' | 'department' | 'project' | 'private' | 'inherit';
  label: string;
  description: string;
}

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  onCreate: (name: string, permission: string, adminIds?: string[], defaultRole?: 'viewer' | 'editor') => void;
  parentPermission?: ParentPermission;
  isFirstLevel?: boolean; // Whether we're creating a first-level folder (project/department)
  spaceType?: 'projects' | 'departments' | 'public' | 'project' | 'department'; // Type of space we're in
  isParentRestricted?: boolean; // Enforcement for restricted parents
}

const permissionOptions = [
  { value: 'inherit', label: '继承父文件夹', icon: Folder, description: '与上级目录权限一致' },
  { value: 'private', label: '仅自己可见', icon: Lock, description: '仅创建者可访问' },
  { value: 'department', label: '部门可见', icon: Building2, description: '本部门成员可访问' },
  { value: 'project', label: '项目组可见', icon: Users, description: '项目成员可访问' },
  { value: 'part', label: '特定人员可见', icon: UserPlus, description: '指定成员可访问' },
  { value: 'all', label: '全员可见', icon: Globe, description: '所有人可访问' },
];

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

export function NewFolderDialog({
  open,
  onOpenChange,
  currentPath,
  onCreate,
  parentPermission,
  isFirstLevel = false,
  spaceType,
  isParentRestricted
}: NewFolderDialogProps) {
  const [folderName, setFolderName] = useState('');
  const [permission, setPermission] = useState('inherit');
  const [error, setError] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminPopoverOpen, setAdminPopoverOpen] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);

  // Real data state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const { getUsers } = useUsers();
  const { getDepartments } = useDepartments();

  // Show admin selection for first-level folders in project or department spaces
  const showAdminSelection = isFirstLevel && (spaceType === 'projects' || spaceType === 'departments' || spaceType === 'project' || spaceType === 'department');

  // Fetch data when dialog is opened and admin selection is needed
  useEffect(() => {
    if (open && showAdminSelection) {
      const fetchData = async () => {
        const { data: usersData } = await getUsers();
        const { data: deptsData } = await getDepartments();
        if (usersData) setUsers(usersData);
        if (deptsData) setDepartments(deptsData);
      };
      fetchData();
    }
  }, [open, showAdminSelection]);

  // Filter available staff
  const filteredStaff = useMemo(() => {
    return users.filter(staff => {
      const notSelected = !selectedAdmins.includes(staff.id.toString());
      const matchesSearch =
        staff.username.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
        (staff.employee_id || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
        staff.role.toLowerCase().includes(adminSearchQuery.toLowerCase());
      return notSelected && matchesSearch;
    });
  }, [selectedAdmins, adminSearchQuery, users]);

  // Get selected admin details
  const selectedAdminDetails = useMemo(() => {
    return users.filter(staff => selectedAdmins.includes(staff.id.toString()));
  }, [selectedAdmins, users]);

  // Build hierarchical departments
  const hierarchicalDepartments = useMemo(() => {
    const result: any[] = [];
    const buildTree = (parentId: number | null, depth: number) => {
      departments
        .filter(d => d.parent_id === parentId)
        .forEach(d => {
          result.push({ ...d, depth });
          buildTree(d.id, depth + 1);
        });
    };
    buildTree(null, 0);
    return result;
  }, [departments]);

  const [selectedUserSets, setSelectedUserSets] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('editor');

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

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      console.log('NewFolderDialog Open:', { isParentRestricted, spaceType, permission });
      setFolderName('');
      setPermission('inherit');
      setError('');
      setSelectedAdmins([]);
      setAdminSearchQuery('');
      setExpandedDepartments([]);
      setSelectedUserSets(new Set());
    }
  }, [open]);

  const handleCreate = () => {
    if (!folderName.trim()) {
      setError('请输入文件夹名称');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(folderName)) {
      setError('文件夹名称不能包含特殊字符');
      return;
    }

    const finalPermission = permission === 'part' ? 'private' : permission;
    const collaboratorIds = permission === 'part' ? Array.from(selectedUserSets).map(id => id.toString()) : (showAdminSelection ? selectedAdmins : undefined);

    onCreate(folderName.trim(), finalPermission, collaboratorIds, selectedRole);
    handleClose();
  };

  const handleClose = () => {
    setFolderName('');
    setPermission('inherit');
    setError('');
    setSelectedAdmins([]);
    onOpenChange(false);
  };

  const addAdmin = (staffId: string) => {
    setSelectedAdmins(prev => [...prev, staffId]);
  };

  const removeAdmin = (staffId: string) => {
    setSelectedAdmins(prev => prev.filter(id => id !== staffId));
  };

  const toggleDepartment = (deptIdentifier: string) => {
    setExpandedDepartments(prev =>
      prev.includes(deptIdentifier)
        ? prev.filter(d => d !== deptIdentifier)
        : [...prev, deptIdentifier]
    );
  };

  const selectedPermission = displayedOptions.find(p => p.value === permission);
  const ParentIcon = parentPermission ? getPermissionIcon(parentPermission.type) : Folder;
  const parentColors = parentPermission ? getPermissionColor(parentPermission.type) : getPermissionColor('inherit');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden transition-all duration-300",
        (permission === 'part' || showAdminSelection) ? "sm:max-w-4xl" : "sm:max-w-[480px]"
      )}>
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Panel: Basic Info */}
          <div className={cn(
            "p-8 flex-shrink-0 transition-all duration-300",
            (permission === 'part' || showAdminSelection) ? "lg:w-[380px] border-b lg:border-b-0 lg:border-r border-border/50 bg-muted/20" : "w-full"
          )}>
            <div className="flex flex-col">
              <div className="flex items-center gap-3 h-10 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Folder className="w-5 h-5 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">新建文件夹</h2>
              </div>

              <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight mb-1 opacity-70">创建于</p>
                <p className="text-xs text-foreground font-medium leading-relaxed line-clamp-2">
                  {currentPath || '根目录'}
                </p>
              </div>
            </div>

            <div className="space-y-6 mt-8">
              {/* Folder Name Input */}
              <div className="space-y-2.5 px-3">
                <Label htmlFor="folder-name" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                  文件夹名称
                </Label>
                <Input
                  id="folder-name"
                  placeholder="输入文件夹名称..."
                  value={folderName}
                  onChange={(e) => {
                    setFolderName(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className={cn(
                    'bg-background/50 h-11 transition-all',
                    error && 'border-destructive focus-visible:ring-destructive'
                  )}
                  autoFocus
                />
                {error && (
                  <p className="text-[11px] text-destructive animate-in fade-in slide-in-from-top-1">{error}</p>
                )}
              </div>

              {/* Permission Selection */}
              {spaceType !== 'public' && (
                <div className="space-y-2.5 px-3">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">访问权限</Label>

                  {isParentRestricted ? (
                    /* LOCKED STATE: Restricted Parent */
                    <div className="flex items-center gap-3 p-3 bg-red-50/50 border border-red-100 border-dashed rounded-lg">
                      <Lock className="w-4 h-4 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">已继承私密属性</p>
                        <p className="text-[11px] text-red-600/80">父级目录为私密，子目录必须保持私密</p>
                      </div>
                    </div>
                  ) : (spaceType === 'project' || spaceType === 'projects') ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50/50 border border-green-100 border-dashed rounded-lg">
                      <Users className="w-4 h-4 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-700">继承项目权限</p>
                        <p className="text-[11px] text-green-600/80">项目组成员均可访问</p>
                      </div>
                      <Lock className="w-3.5 h-3.5 text-green-600/40" />
                    </div>
                  ) : (
                    <Select value={permission} onValueChange={setPermission}>
                      <SelectTrigger className="bg-background/50 h-11">
                        <SelectValue>
                          {selectedPermission && (
                            <div className="flex items-center gap-2">
                              <selectedPermission.icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{selectedPermission.label}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {displayedOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-3 py-1">
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <option.icon className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{option.label}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{option.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Actions for basic view */}
              {!(permission === 'part' || showAdminSelection) && (
                <div className="flex justify-end gap-2 pt-6 px-3 border-t border-border/50">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCreate()}
                    disabled={!folderName.trim()}
                    className="bg-primary hover:bg-primary/90 px-6"
                  >
                    创建
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Advanced Permissions / Selection */}
          {(permission === 'part' || showAdminSelection) && (
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden animate-in fade-in lg:slide-in-from-right-4">
              <div className="p-8 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between h-10 mb-4 flex-shrink-0">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0",
                      showAdminSelection ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"
                    )}>
                      {showAdminSelection ? <Users className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                    </div>
                    <span>{showAdminSelection ? '配置管理员' : '配置可见人员'}</span>
                  </h3>

                  {permission === 'part' && (
                    <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                      <SelectTrigger className="h-9 w-[100px] text-xs bg-muted/30 border-0 transition-colors hover:bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">只读</SelectItem>
                        <SelectItem value="editor">编辑</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex-1 min-h-0 flex flex-col gap-5">
                  {/* Selected Items Summary if any */}
                  {selectedAdminDetails.length > 0 && showAdminSelection && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border border-border/50">
                      {selectedAdminDetails.map(admin => (
                        <Badge
                          key={admin.id}
                          variant="secondary"
                          className="pl-1.5 pr-1 py-0.5 gap-1.5 bg-background border-border/50"
                        >
                          <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                            {admin.username.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-[11px]">{admin.username}</span>
                          <button
                            onClick={() => removeAdmin(admin.id.toString())}
                            className="p-0.5 hover:bg-muted rounded-full transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex-1 border border-border/50 rounded-xl overflow-hidden shadow-sm bg-muted/10">
                    {showAdminSelection ? (
                      /* Combined UI for First Level Admin Selection */
                      <div className="h-full flex flex-col">
                        <div className="p-2.5 border-b border-border/50 bg-background/50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                              placeholder="搜索人员..."
                              value={adminSearchQuery}
                              onChange={(e) => setAdminSearchQuery(e.target.value)}
                              className="pl-9 h-8 text-xs bg-background"
                            />
                          </div>
                        </div>
                        <ScrollArea className="flex-1 h-[300px]">
                          <div className="p-2">
                            {hierarchicalDepartments.map((dept) => {
                              const deptIdentifier = dept.id.toString();
                              const isExpanded = expandedDepartments.includes(deptIdentifier);
                              const directStaff = filteredStaff.filter(s => s.department_id === dept.id);
                              const hasStaff = directStaff.length > 0;
                              const paddingLeft = `${dept.depth * 12 + 8}px`;

                              return (
                                <div key={dept.id} className="mb-0.5">
                                  <button
                                    onClick={() => toggleDepartment(deptIdentifier)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                                    style={{ paddingLeft }}
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "w-3 h-3 text-muted-foreground transition-transform flex-shrink-0",
                                        isExpanded && "rotate-90",
                                        !hasStaff && "opacity-30"
                                      )}
                                    />
                                    <span className="text-xs font-medium flex-1 text-left truncate">{dept.name}</span>
                                    {hasStaff && (
                                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-background/50 text-muted-foreground leading-none">
                                        {directStaff.length}
                                      </Badge>
                                    )}
                                  </button>

                                  {isExpanded && hasStaff && (
                                    <div className="space-y-0.5 mt-0.5 mb-1">
                                      {directStaff.map(person => (
                                        <button
                                          key={person.id}
                                          onClick={() => addAdmin(person.id.toString())}
                                          className="w-full flex items-center gap-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors text-xs"
                                          style={{ paddingLeft: `${dept.depth * 12 + 28}px`, paddingRight: '12px' }}
                                        >
                                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] font-bold text-primary">
                                              {person.username.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                          <span className="flex-1 text-left font-medium">{person.username}</span>
                                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{person.role}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      /* Permission 'part' Selection */
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
                        className="h-[350px] border-0"
                      />
                    )}
                  </div>

                  {!showAdminSelection && (
                    <p className="text-[10px] text-muted-foreground px-1 italic">
                      * 选中的成员将被赋予“{selectedRole === 'viewer' ? '只读' : '编辑'}”权限
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-6 mt-2 border-t border-border/50">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCreate()}
                    disabled={!folderName.trim() || (permission === 'part' && selectedUserSets.size === 0)}
                    className="bg-primary hover:bg-primary/90 px-8"
                  >
                    完成并创建
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
