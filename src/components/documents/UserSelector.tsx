import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Folder, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useDepartments, Department } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Input } from '@/components/ui/input';

export interface UserResult {
    id: number;
    username: string;
    email: string;
    department_id?: number;
}

interface UserSelectorProps {
    selectedUserIds: Set<number>;
    onToggleUser: (user: UserResult) => void;
    className?: string;
    defaultExpandedDeptId?: number;
}

export function UserSelector({ selectedUserIds, onToggleUser, className, defaultExpandedDeptId }: UserSelectorProps) {
    const { getDepartments } = useDepartments();

    // Unified Selection State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);

    // Tree View State
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
    const [usersCache, setUsersCache] = useState<Map<number, UserResult[]>>(new Map());
    const [loadingDeptId, setLoadingDeptId] = useState<number | null>(null);

    // Initial Load
    useEffect(() => {
        getDepartments().then(({ data }) => {
            if (data) setAllDepartments(data);
        });
    }, []);

    // Auto-Expand Logic
    useEffect(() => {
        if (allDepartments.length > 0) {
            const nextExpanded = new Set(expandedDepts);

            // 1. Always expand Root (Americas R&D) if found (Legacy behavior, good for context)
            const rootDept = allDepartments.find(d => d.name === "美洲研发中心");
            if (rootDept) nextExpanded.add(rootDept.id);

            // 2. Expand Target Dept and Ancestors
            if (defaultExpandedDeptId) {
                let currentId: number | null = defaultExpandedDeptId;
                // Safety loop
                let loopCount = 0;
                while (currentId && loopCount < 10) {
                    nextExpanded.add(currentId);
                    const dept = allDepartments.find(d => d.id === currentId);
                    currentId = dept?.parent_id || null;
                    loopCount++;
                }

                // Pre-load users for the target dept
                if (!usersCache.has(defaultExpandedDeptId)) {
                    api.get<UserResult[]>(`/users?department_id=${defaultExpandedDeptId}&recursive=false`).then(({ data }) => {
                        if (data) setUsersCache(prev => new Map(prev).set(defaultExpandedDeptId, data));
                    });
                }

                // Scroll to target (delayed slightly to allow rendering)
                setTimeout(() => {
                    const el = document.getElementById(`dept-${defaultExpandedDeptId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }

            setExpandedDepts(nextExpanded);
        }
    }, [allDepartments, defaultExpandedDeptId]);

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

    // Recursive Tree Renderer
    const renderTree = (parentId: number | null, depth = 0) => {
        const children = allDepartments.filter(d => d.parent_id === parentId);
        const users = parentId ? usersCache.get(parentId) : null;
        const nodes: JSX.Element[] = [];

        // 1. Users
        if (parentId && users) {
            if (users.length === 0) {
                nodes.push(
                    <div key={`empty-${parentId}`} style={{ paddingLeft: `${depth * 20 + 24}px` }} className="text-[11px] text-muted-foreground/50 py-1.5 italic">
                        (暂无成员)
                    </div>
                )
            } else {
                users.forEach(u => {
                    const isSelected = selectedUserIds.has(u.id);
                    nodes.push(
                        <div
                            key={`user-${u.id}`}
                            className={cn(
                                "flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm group transition-all duration-200 mb-0.5",
                                isSelected
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted text-foreground/90 hover:text-foreground"
                            )}
                            style={{ paddingLeft: `${depth * 20 + 24}px` }}
                            onClick={() => onToggleUser(u)}
                        >
                            <UserAvatar name={u.username} size="xs" />
                            <span className={cn("flex-1 text-sm leading-none transition-colors", isSelected ? "font-bold" : "font-medium")}>{u.username}</span>
                            {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                    );
                });
            }
            if (loadingDeptId === parentId) {
                nodes.push(
                    <div key={`loading-${parentId}`} style={{ paddingLeft: `${depth * 20 + 24}px` }} className="text-[11px] text-muted-foreground/40 py-1.5 animate-pulse">
                        加载成员中...
                    </div>
                )
            }
        }

        // 2. Sub-Departments
        children.forEach(d => {
            const isExpanded = expandedDepts.has(d.id);
            nodes.push(
                <div key={`dept-${d.id}`} className="mb-0.5">
                    <div
                        className="flex items-center gap-1 p-1.5 rounded-md cursor-pointer hover:bg-muted text-sm select-none transition-colors text-foreground/80 hover:text-foreground"
                        style={{ paddingLeft: `${depth * 20}px` }}
                        onClick={() => handleToggleExpand(d.id)}
                    >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                        <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                        <span className={cn("truncate text-sm tracking-tight leading-none", isExpanded ? "font-bold" : "font-semibold")}>{d.name}</span>
                    </div>
                    {isExpanded && renderTree(d.id, depth + 1)}
                </div>
            );
        });
        return nodes;
    };

    return (
        <div className={cn("flex flex-col border rounded-md bg-background overflow-hidden", className)}>
            {/* Search Bar */}
            <div className="p-2 border-b bg-muted/10">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="搜索成员..."
                        className="pl-8 h-8 text-xs"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {searchQuery.length > 0 ? (
                    <div className="space-y-0.5 p-2">
                        {searchResults.length === 0 ? (
                            <div className="text-center py-4 text-xs text-muted-foreground">未找到用户</div>
                        ) : (
                            searchResults.map(u => {
                                const isSelected = selectedUserIds.has(u.id);
                                return (
                                    <div
                                        key={u.id}
                                        className={cn(
                                            "flex items-center gap-2 p-1.5 rounded-md cursor-pointer hover:bg-muted text-sm transition-all mb-0.5",
                                            isSelected ? "bg-primary/10 text-primary" : "text-foreground/90 hover:text-foreground"
                                        )}
                                        onClick={() => onToggleUser(u)}
                                    >
                                        <UserAvatar name={u.username} size="xs" />
                                        <span className={cn("flex-1 text-sm leading-none", isSelected ? "font-bold" : "font-medium")}>{u.username}</span>
                                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                                    </div>
                                )
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-0.5 p-2">
                        {allDepartments.length === 0 ? (
                            <div className="text-center py-8 text-xs text-muted-foreground">加载组织架构...</div>
                        ) : renderTree(null)}
                    </div>
                )}
            </div>
        </div>
    );
}
