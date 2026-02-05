import { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Folder, FileText, Share2, Shield, History, Building2, ChevronRight, ChevronDown, Archive, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface UserDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: any;
}

interface PermissionItem {
    resource_type: string;
    resource_id: number;
    resource_name: string;
    effective_role: string;
    access_sources: string[];
    parent_id: number | null;
    is_explicit_share: boolean;
    share_id: number | null;
    level?: number;
    hasChildren?: boolean;
}

interface ShareHistoryItem {
    direction: string;
    resource_type: string;
    resource_id: number;
    resource_name: string;
    target_user_name: string;
    role: string;
    shared_at: string;
}

export function UserDetailDialog({ open, onOpenChange, user }: UserDetailDialogProps) {
    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [history, setHistory] = useState<ShareHistoryItem[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && user) {
            fetchData();
        }
    }, [open, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Fetch Permissions
            const permRes = await fetch(`http://localhost:8000/users/${user.id}/permissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (permRes.ok) {
                setPermissions(await permRes.json());
            }

            // Fetch Share History
            const histRes = await fetch(`http://localhost:8000/users/${user.id}/shares`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (histRes.ok) {
                setHistory(await histRes.json());
            }
        } catch (error) {
            console.error('Failed to fetch user details:', error);
            toast.error('获取用户详情失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeShare = async (shareId: number, resourceName: string) => {
        if (!confirm(`确定要移除对 "${resourceName}" 的单独授权吗？`)) return;

        try {
            const res = await fetch(`http://localhost:8000/share/${shareId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                toast.success('权限已移除');
                fetchData(); // Refresh
            } else {
                toast.error('移除失败');
            }
        } catch (e) {
            toast.error('操作异常');
        }
    };

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedFolders);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedFolders(newSet);
    };

    // Build Hierarchy for Table
    const treeData = useMemo(() => {
        // Helper to find children
        const getChildren = (parentId: number | null) => permissions.filter(p => p.parent_id === parentId);

        // Find absolute roots (parent_id is null)
        let roots = getChildren(null);

        // Also find "orphaned roots" - items whose parent_id exists but is NOT in the permissions list
        // (e.g. user sees /A/B but not /A)
        const allIds = new Set(permissions.map(p => p.resource_id));
        const orphans = permissions.filter(p => p.parent_id !== null && !allIds.has(p.parent_id!));

        roots = [...roots, ...orphans];

        const result: PermissionItem[] = [];

        const traverse = (nodes: PermissionItem[], level: number) => {
            for (const node of nodes) {
                // Find children in *this permission set*
                const children = permissions.filter(p => p.parent_id === node.resource_id);
                const hasChildren = children.length > 0;

                result.push({ ...node, level, hasChildren });

                if (hasChildren && expandedFolders.has(node.resource_id)) {
                    traverse(children, level + 1);
                }
            }
        };

        traverse(roots, 0);
        return result;

    }, [permissions, expandedFolders]);


    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        成员详情视图: {user.username}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="permissions" className="h-full flex flex-col">
                        <div className="px-6 border-b">
                            <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                                <TabsTrigger
                                    value="permissions"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-2"
                                >
                                    权限全景 ({permissions.length})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-2"
                                >
                                    分享记录 ({history.length})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="profile"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-2"
                                >
                                    个人概览
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 p-0">
                            <TabsContent value="permissions" className="mt-0 p-0">
                                <div className="border-b px-6 py-2 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    展示该用户所有可见资源。'Effective Role' 显示其最高权限。部分权限继承自部门或项目。
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[400px] pl-6">资源名称</TableHead>
                                            <TableHead>最高权限</TableHead>
                                            <TableHead>权限来源</TableHead>
                                            <TableHead className="text-right pr-6">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {treeData.map((item) => (
                                            <TableRow key={`${item.resource_type}-${item.resource_id}`} className="hover:bg-muted/50">
                                                <TableCell className="py-2 pl-6">
                                                    <div
                                                        className="flex items-center gap-2"
                                                        style={{ paddingLeft: `${(item.level || 0) * 20}px` }}
                                                    >
                                                        {item.resource_type === 'folder' && item.hasChildren ? (
                                                            <button onClick={() => toggleExpand(item.resource_id)} className="p-0.5 hover:bg-muted rounded">
                                                                {expandedFolders.has(item.resource_id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                                            </button>
                                                        ) : <span className="w-5" />}

                                                        {item.resource_type === 'folder' ?
                                                            <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" /> :
                                                            <FileText className="w-4 h-4 text-blue-500" />
                                                        }
                                                        <span className="font-medium text-sm truncate max-w-[200px]" title={item.resource_name}>{item.resource_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Badge variant={item.effective_role === 'owner' ? 'default' : 'secondary'} className="capitalize border-none">
                                                        {item.effective_role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.access_sources.map((src, i) => (
                                                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 h-5 bg-background text-muted-foreground font-normal">
                                                                {src}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-2 pr-6">
                                                    {item.is_explicit_share && item.share_id ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRevokeShare(item.share_id!, item.resource_name)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                            移除
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/30 italic">继承权限</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {treeData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                    暂无可见资源
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 p-6">
                                {/* Reusing previous History Layout */}
                                <div className="space-y-4">
                                    {history.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.direction === 'outbound' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                    {item.direction === 'outbound' ? <Share2 className="w-4 h-4" /> : <History className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{item.resource_name}</span>
                                                        <Badge variant="outline" className="text-[10px] h-5">
                                                            {item.resource_type}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {item.direction === 'outbound'
                                                            ? `分享给: ${item.target_user_name}`
                                                            : `来自: ${item.target_user_name}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="mb-1 capitalize">{item.role}</Badge>
                                                <p className="text-[10px] text-muted-foreground">{item.shared_at}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {history.length === 0 && (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                            <p>暂无分享记录</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="profile" className="mt-0 p-6 space-y-6">
                                {/* Reusing previous Profile Layout */}
                                <div className="flex items-start gap-6">
                                    <Avatar className="w-24 h-24 border-4 border-muted/20">
                                        <AvatarImage src="" />
                                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                                            {user.username?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <h3 className="text-2xl font-bold">{user.username}</h3>
                                            <p className="text-muted-foreground">{user.email}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground font-medium uppercase">工号</label>
                                                <div className="font-mono text-sm">{user.employee_id || '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground font-medium uppercase">角色</label>
                                                <div>
                                                    <Badge variant="outline" className="capitalize">
                                                        {user.role}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground font-medium uppercase">部门</label>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                                    <span>{user.department_name || '无部门'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
