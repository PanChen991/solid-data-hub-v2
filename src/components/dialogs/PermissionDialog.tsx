
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Shield, User as UserIcon, Search, Folder, ChevronRight, ChevronDown, Info, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDepartments, Department } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';

// Helper Component for Consistent Avatar Style
const UserAvatar = ({ name, size = "md" }: { name: string, size?: "xs" | "sm" | "md" | "lg" }) => {
    let dim = "w-8 h-8";
    let textSize = "text-xs";

    if (size === 'xs') { dim = "w-4 h-4"; textSize = "text-[9px]"; }
    else if (size === 'sm') { dim = "w-5 h-5"; textSize = "text-[10px]"; }
    else if (size === 'lg') { dim = "w-10 h-10"; textSize = "text-sm"; }

    return (
        <div className={cn(dim, "rounded-full bg-gradient-to-br from-blue-500/80 to-blue-600 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/20")}>
            <span className={cn(textSize, "font-medium text-white leading-none")}>
                {name ? name.charAt(0) : '?'}
            </span>
        </div>
    )
}

interface Collaborator {
    id: number; // share_id, or -1 for implicit
    user_id: number;
    username: string;
    role: 'viewer' | 'editor' | 'admin';
    isDefault?: boolean; // If true, this is an implicit department member
}

interface UserResult {
    id: number;
    username: string;
    email: string;
    role?: string; // Add role for project member mapping
}

interface PermissionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resourceId: number;
    resourceType: 'folder' | 'document';
    resourceName: string;
    projectId?: number;
    projectName?: string;
    departmentId?: number; // Added for department context
    isPublic?: boolean;
    initialIsRestricted?: boolean;
    initialOwnerId?: number;
    initialOwnerName?: string;
}

export function PermissionDialog({
    open,
    onOpenChange,
    resourceId,
    resourceType,
    resourceName,
    projectId,
    projectName,
    departmentId,
    isPublic = false,
    initialIsRestricted,
    initialOwnerId,
    initialOwnerName
}: PermissionDialogProps) {
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const { getDepartments } = useDepartments();

    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [loading, setLoading] = useState(false);
    const [departmentContext, setDepartmentContext] = useState<{ id: number; name: string } | null>(null);
    const [ownerInfo, setOwnerInfo] = useState<{ id: number; name: string } | null>(
        initialOwnerId && initialOwnerName ? { id: initialOwnerId, name: initialOwnerName } : null
    );

    // Unified Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
    const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');

    // Tree View State
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
    const [usersCache, setUsersCache] = useState<Map<number, UserResult[]>>(new Map());
    const [loadingDeptId, setLoadingDeptId] = useState<number | null>(null);

    const [isRestricted, setIsRestricted] = useState(initialIsRestricted || false);

    // Fetch Resource Context (Department & Owner)
    const fetchContext = async () => {
        if (resourceType === 'folder') {
            const { data } = await api.get<{ department_id?: number; is_restricted?: boolean; owner_id?: number; owner_name?: string }>(`/folders/${resourceId}`);
            if (data) {
                if (data.is_restricted !== undefined) setIsRestricted(data.is_restricted);
                if (data.owner_id && data.owner_name) setOwnerInfo({ id: data.owner_id, name: data.owner_name });
                // Legacy fallback or joined data
                if ((data as any).owner?.username) setOwnerInfo({ id: data.owner_id!, name: (data as any).owner.username });

                if (data.department_id) {
                    // Fetch Dept Name
                    const { data: dept } = await api.get<Department>(`/departments/${data.department_id}`);
                    if (dept) setDepartmentContext({ id: dept.id, name: dept.name });
                }
            }
        } else {
            const { data } = await api.get<{ folder_id?: number; is_restricted?: boolean; author_id?: number; author_name?: string }>(`/documents/${resourceId}`);
            if (data) {
                if (data.is_restricted !== undefined) setIsRestricted(data.is_restricted);
                if (data.author_id && data.author_name) setOwnerInfo({ id: data.author_id, name: data.author_name });

                if (data.folder_id) {
                    // Get folder then dept
                    const { data: folder } = await api.get<{ department_id?: number }>(`/folders/${data.folder_id}`);
                    if (folder?.department_id) {
                        const { data: dept } = await api.get<Department>(`/departments/${folder.department_id}`);
                        if (dept) setDepartmentContext({ id: dept.id, name: dept.name });
                    }
                }
            }
        }
    };

    const fetchSeqRef = useRef(0);

    const fetchCollaborators = async () => {
        const currentSeq = fetchSeqRef.current + 1;
        fetchSeqRef.current = currentSeq;

        setLoading(true);
        let endpoint = `/collaborators?`;
        if (resourceType === 'folder') endpoint += `folder_id=${resourceId}`;
        else endpoint += `document_id=${resourceId}`;

        const { data: explicitCollabs, error } = await api.get<Collaborator[]>(endpoint);

        // Race Condition Check 1
        if (fetchSeqRef.current !== currentSeq) return;

        let finalCollabs: Collaborator[] = explicitCollabs || [];

        // If we have a department context (Implicit or Explicit), AND resource is NOT restricted
        const activeDeptId = departmentContext?.id || departmentId;

        // ONLY fetch implicit department members if NOT restricted
        if (activeDeptId && !isRestricted) {
            const { data: deptUsers } = await api.get<UserResult[]>(`/users?department_id=${activeDeptId}`);

            // Race Condition Check 2
            if (fetchSeqRef.current !== currentSeq) return;

            if (deptUsers) {
                // Merge Logic
                const explicitMap = new Map(finalCollabs.map(c => [c.user_id, c]));

                deptUsers.forEach(u => {
                    if (!explicitMap.has(u.id)) {
                        // Map Department Role to Folder Role (Case-insensitive)
                        let mappedRole: 'viewer' | 'editor' | 'admin' = 'viewer';
                        const userRole = u.role?.toUpperCase() || 'VIEWER';

                        // MANAGER and ADMIN are both treated as Folder Admins
                        if (userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
                            mappedRole = 'admin';
                        }
                        else if (userRole === 'EDITOR') {
                            mappedRole = 'editor';
                        }

                        // Add as Implicit Member with Correct Role
                        finalCollabs.push({
                            id: -1, // Flag for implicit
                            user_id: u.id,
                            username: u.username,
                            role: mappedRole,
                            isDefault: true
                        });
                    }
                });
            }
        }

        // Project Members Logic
        if (projectId && !isRestricted) {
            const { data: projectMembers } = await api.get<{ id: number, user_id: number, username: string, role: string, user: { username: string } }[]>(`/projects/${projectId}/members`);

            // Race Condition Check 3
            if (fetchSeqRef.current !== currentSeq) return;

            if (projectMembers) {
                const explicitMap = new Map(finalCollabs.map(c => [c.user_id, c]));
                projectMembers.forEach(m => {
                    if (!explicitMap.has(m.user_id)) {
                        finalCollabs.push({
                            id: -1,
                            user_id: m.user_id,
                            username: m.user.username || m.username,
                            role: m.role as any,
                            isDefault: true
                        });
                    }
                });
            }
        }

        // FORCE ADD OWNER if known and not present
        if (ownerInfo) {
            const exists = finalCollabs.find(c => c.user_id === ownerInfo.id);
            if (!exists) {
                finalCollabs.push({
                    id: -1,
                    user_id: ownerInfo.id,
                    username: ownerInfo.name,
                    role: 'admin', // Owner is always admin
                    isDefault: true // Treated as implicit system permission
                });
            }
        }


        // Sort: Admin first, then Editor, then Viewer. Within role, alphabetical.
        finalCollabs.sort((a, b) => {
            const roleOrder = { admin: 0, editor: 1, viewer: 2 };
            if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
            return a.username.localeCompare(b.username);
        });

        if (!error) {
            setCollaborators(finalCollabs);
        }
        setLoading(false);
    };

    // Reset on Open
    useEffect(() => {
        if (open) {
            console.log('[PermissionDialog] OPENING', {
                resourceId,
                resourceName,
                initialIsRestricted,
                initialOwnerName,
                departmentId
            });

            // 1. HARD RESET ALL STATE
            setCollaborators([]);
            setLoading(true); // Start as loading to prevent flash

            // Reset to props or default
            setIsRestricted(initialIsRestricted || false);
            setOwnerInfo(initialOwnerId && initialOwnerName ? { id: initialOwnerId, name: initialOwnerName } : null);
            setDepartmentContext(null);

            setSearchQuery('');
            setSelectedUser(null);
            setExpandedDepts(new Set());
            setUsersCache(new Map());

            // 2. Fetch Fresh Context
            fetchContext();

            // 3. Load Departments if needed
            if (allDepartments.length === 0) {
                getDepartments().then(({ data }) => {
                    if (data) setAllDepartments(data);
                });
            }
        } else {
            // Optional: delayed cleanup or keep cache
        }
    }, [open, resourceId, resourceType]);

    // Re-fetch collaborators when context or restriction changes
    useEffect(() => {
        if (open) {
            console.log('[PermissionDialog] Fetching Collaborators', {
                isRestricted,
                departmentContext,
                departmentId
            });
            fetchCollaborators();
        }
    }, [departmentContext, isRestricted, open]);

    // Auto-Expand "Americas R&D"
    useEffect(() => {
        if (open && allDepartments.length > 0) {
            const targetDept = allDepartments.find(d => d.name === "美洲研发中心");
            if (targetDept) {
                setExpandedDepts(prev => {
                    const next = new Set(prev);
                    next.add(targetDept.id);
                    return next;
                });
                if (!usersCache.has(targetDept.id)) {
                    api.get<UserResult[]>(`/users?department_id=${targetDept.id}&recursive=false`).then(({ data }) => {
                        if (data) setUsersCache(prev => new Map(prev).set(targetDept.id, data));
                    })
                }
            }
        }
    }, [open, allDepartments]);

    // Global Search
    useEffect(() => {
        const searchUsers = async () => {
            if (searchQuery.length < 1) {
                setSearchResults([]);
                return;
            }
            const { data } = await api.get<UserResult[]>(`/users?q=${encodeURIComponent(searchQuery)}`);
            if (data) setSearchResults(data);
        };
        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);


    const handleToggleExpand = async (deptId: number) => {
        const newExpanded = new Set(expandedDepts);
        if (newExpanded.has(deptId)) {
            newExpanded.delete(deptId);
            setExpandedDepts(newExpanded);
        } else {
            newExpanded.add(deptId);
            setExpandedDepts(newExpanded);

            // Lazy load users if not in cache
            if (!usersCache.has(deptId)) {
                setLoadingDeptId(deptId);
                const { data } = await api.get<UserResult[]>(`/users?department_id=${deptId}&recursive=false`);
                if (data) {
                    setUsersCache(prev => new Map(prev).set(deptId, data));
                }
                setLoadingDeptId(null);
            }
        }
    };

    const handleAddParams = async () => {
        if (!selectedUser) return;

        const payload = {
            user_id: selectedUser.id,
            role: selectedRole,
            folder_id: resourceType === 'folder' ? resourceId : null,
            document_id: resourceType === 'document' ? resourceId : null
        };

        const { error } = await api.post('/share', payload);

        if (error) {
            toast({ title: "Failed to add permission", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Permission added" });
            fetchCollaborators();
            setSelectedUser(null);
            setSearchQuery('');
        }
    };

    const handleRemove = async (c: Collaborator) => {
        if (c.isDefault) {
            // Can't remove implicit member, basically it's already "removed" (default state)
            // But UI allows "removing" if they want to ensure no access? 
            // For now, let's say "Remove" means "Restore to Default". 
            // If it is ALREADY default, button should be disabled or show "Default".
            return;
        }

        const { error } = await api.delete(`/share/${c.id}`);
        if (error) {
            toast({ title: "移除失败", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "已移除", description: "恢复为默认权限" });
            fetchCollaborators();
        }
    };

    const handleRoleUpdate = async (c: Collaborator, newRole: string) => {
        if (c.isDefault) {
            // Create New Permission (Implicit -> Explicit)
            const payload = {
                user_id: c.user_id,
                role: newRole,
                folder_id: resourceType === 'folder' ? resourceId : null,
                document_id: resourceType === 'document' ? resourceId : null
            };
            const { error } = await api.post('/share', payload);
            if (error) toast({ title: "设置失败", description: error.message, variant: "destructive" });
            else {
                toast({ title: "权限已更新" });
                fetchCollaborators();
            }
        } else {
            // Update Existing
            const { error } = await api.put(`/share/${c.id}`, { role: newRole });
            if (error) {
                toast({ title: "设置失败", description: error.message, variant: "destructive" });
            } else {
                toast({ title: "权限已更新" });
                fetchCollaborators();
            }
        }
    };

    // Recursive Tree Renderer
    const renderTree = (parentId: number | null, depth = 0) => {
        const children = allDepartments.filter(d => d.parent_id === parentId);

        // If not root, also render users of THIS parent (if expanded)
        const users = parentId && usersCache.get(parentId);

        // DEBUG LOG
        if (parentId) {
            console.log(`RenderTree: Parent=${parentId}, Users=${users?.length}, Children=${children.length}`);
        }

        const nodes: JSX.Element[] = [];

        // 1. Users
        if (parentId && users) {
            if (users.length === 0) {
                nodes.push(
                    <div key={`empty-${parentId}`} style={{ paddingLeft: `${depth * 20 + 24}px` }} className="text-xs text-muted-foreground py-1 italic">
                        (暂无成员)
                    </div>
                )
            } else {
                users.forEach(u => {
                    nodes.push(
                        <div
                            key={`user-${u.id}`}
                            className={cn(
                                "flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm group transition-all duration-200",
                                selectedUser?.id === u.id
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                            style={{ paddingLeft: `${depth * 20 + 24}px` }}
                            onClick={() => setSelectedUser(u)}
                        >
                            <UserAvatar name={u.username} size="sm" />
                            <span>{u.username}</span>
                            {selectedUser?.id === u.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                    );
                });
            }

            if (loadingDeptId === parentId) {
                nodes.push(
                    <div key={`loading-${parentId}`} style={{ paddingLeft: `${depth * 20 + 24}px` }} className="text-xs text-muted-foreground py-1 animate-pulse">
                        加载成员中...
                    </div>
                )
            }
        }

        // 2. Sub-Departments
        children.forEach(d => {
            const isExpanded = expandedDepts.has(d.id);
            nodes.push(
                <div key={`dept-${d.id}`}>
                    <div
                        className="flex items-center gap-1 p-1.5 rounded-md cursor-pointer hover:bg-muted text-sm select-none transition-colors text-foreground/80 hover:text-foreground"
                        style={{ paddingLeft: `${depth * 20}px` }}
                        onClick={() => handleToggleExpand(d.id)}
                    >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                        <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                        <span className="truncate">{d.name}</span>
                    </div>
                    {isExpanded && renderTree(d.id, depth + 1)}
                </div>
            );
        });
        return nodes;
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0 space-y-2">
                    <DialogTitle>{isPublic ? '权限管理' : '协作与成员管理'} - {resourceName}</DialogTitle>
                    <div className="flex items-center justify-between">
                        <DialogDescription>
                            配置协作者访问权限
                        </DialogDescription>
                        {/* Moved Legend Here */}
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border min-w-fit">
                            <span className="font-medium text-foreground/80 hidden sm:inline-block">权限说明:</span>
                            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> <span className="font-medium text-foreground">只读</span>(查看/下载)</div>
                            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> <span className="font-medium text-foreground">编辑</span>(上传/修改)</div>
                            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> <span className="font-medium text-foreground">管理</span>(完全控制)</div>
                        </div>
                    </div>
                </DialogHeader>



                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COLUMN: Selector */}
                    <div className="w-[400px] flex flex-col border-r bg-muted/10">
                        {/* 1. Slim Header */}
                        <div className="h-[50px] px-4 border-b flex items-center bg-muted/20 shrink-0">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <UserPlus className="w-4 h-4" /> 添加成员
                            </h4>
                        </div>

                        {/* 2. Floating Search Bar */}
                        <div className="p-3 bg-background border-b z-10">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="搜索用户或组织..."
                                    className="pl-8 bg-muted/30 h-9 border-muted"
                                    value={searchQuery}
                                    onChange={e => {
                                        setSearchQuery(e.target.value);
                                        setSelectedUser(null);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Tree/List Area */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {searchQuery.length > 0 ? (
                                <ScrollArea className="flex-1 p-2">
                                    {searchResults.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-muted-foreground">未找到用户</div>
                                    ) : (
                                        searchResults.map(u => (
                                            <div
                                                key={u.id}
                                                className={cn(
                                                    "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted text-sm transition-colors mb-1",
                                                    selectedUser?.id === u.id && "bg-primary/10 text-primary"
                                                )}
                                                onClick={() => setSelectedUser(u)}
                                            >
                                                <UserAvatar name={u.username} size="sm" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{u.username}</span>
                                                    <span className="text-[10px] opacity-70">{u.email}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </ScrollArea>
                            ) : (
                                <ScrollArea className="flex-1 p-2">
                                    {allDepartments.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-muted-foreground">加载组织架构中...</div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            {renderTree(null)}
                                        </div>
                                    )}
                                </ScrollArea>
                            )}
                        </div>

                        {/* Selected User Action Footer */}
                        <div className="p-3 border-t bg-background shrink-0 space-y-3">
                            {selectedUser ? (
                                <div className="flex items-center gap-3 justify-between animate-in slide-in-from-bottom-2 fade-in duration-200">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <UserAvatar name={selectedUser.username} size="sm" />
                                        <span className="text-sm font-medium truncate">{selectedUser.username}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                                            <SelectTrigger className="w-[85px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="viewer">只读</SelectItem>
                                                <SelectItem value="editor">编辑</SelectItem>
                                                <SelectItem value="admin">管理</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" onClick={handleAddParams} className="h-8">添加</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-center items-center h-8 text-xs text-muted-foreground">
                                    请从上方选择成员以添加
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Existing Permissions */}
                    <div className="flex-1 flex flex-col bg-background">
                        <div className="h-[50px] px-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                {departmentContext || departmentId ? (departmentContext?.name || "部门") + " 成员及协作者" : "现有权限"}
                                <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{collaborators.length} 人</span>
                            </h4>

                            {/* {!departmentContext && (
                                <div className="text-[10px] text-amber-600/90 font-medium bg-amber-50 px-2 py-0.5 rounded">
                                    ⚠️ 默认全员只读
                                </div>
                            )} */}
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            {collaborators.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                        <UserIcon className="w-6 h-6 opacity-20" />
                                    </div>
                                    <p className="text-sm">暂无协作者</p>
                                    <p className="text-xs opacity-50">添加成员后将显示在此处</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {collaborators.map(c => (
                                        <div key={c.id === -1 ? `implicit-${c.user_id}` : c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors group shadow-sm">
                                            {/* Left: User Info */}
                                            <div className="flex items-center gap-3">
                                                <UserAvatar name={c.username} size="md" />
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium text-foreground">{c.username}</span>
                                                    {!isPublic && (
                                                        c.isDefault ? (
                                                            <span className="w-fit px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                                部门成员
                                                            </span>
                                                        ) : (
                                                            <span className="w-fit px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                                                协作者
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    defaultValue={c.role}
                                                    onValueChange={(v) => handleRoleUpdate(c, v)}
                                                >
                                                    <SelectTrigger className="h-8 w-[90px] text-xs bg-muted/50 border-transparent hover:border-input focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="viewer">只读</SelectItem>
                                                        <SelectItem value="editor">编辑</SelectItem>
                                                        <SelectItem value="admin">管理</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-8 w-8 text-muted-foreground",
                                                        c.isDefault ? "opacity-20 cursor-not-allowed" : "hover:text-destructive hover:bg-destructive/10"
                                                    )}
                                                    onClick={() => !c.isDefault && handleRemove(c)}
                                                    disabled={c.isDefault}
                                                    title={c.isDefault ? "默认权限，无法移除" : "移除权限 (恢复默认)"}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div >

                <DialogFooter className="border-t p-4 bg-muted/10 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>完成配置</Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}
