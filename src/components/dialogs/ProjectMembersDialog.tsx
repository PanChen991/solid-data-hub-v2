import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { X, UserPlus, ArrowLeft, Loader2, Info } from 'lucide-react';
import { useProjectMembers, ProjectMember } from '@/hooks/useDatabase';
import { UserSelector } from '@/components/documents/UserSelector';
import { toast } from 'sonner';

interface ProjectMembersDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    projectTitle: string;
}

const RoleDescriptions = () => (
    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg text-[11px] space-y-1.5 mb-4">
        <div className="flex items-center gap-1.5 font-semibold text-blue-700 mb-1">
            <Info className="w-3.5 h-3.5" />
            角色权限说明
        </div>
        <div className="flex gap-2 text-slate-600">
            <span className="font-bold text-blue-600 min-w-[40px]">观察者:</span>
            <span>仅查看项目内容，无法修改或上传文件。</span>
        </div>
        <div className="flex gap-2 text-slate-600">
            <span className="font-bold text-blue-600 min-w-[40px]">编辑者:</span>
            <span>可查看并上传、修改文件，但无法管理成员。</span>
        </div>
        <div className="flex gap-2 text-slate-600">
            <span className="font-bold text-blue-600 min-w-[40px]">管理员:</span>
            <span>拥有全部权限，包括文件管理和项目成员维护。</span>
        </div>
    </div>
);

export function ProjectMembersDialog({ isOpen, onClose, projectId, projectTitle }: ProjectMembersDialogProps) {
    const { getProjectMembers, addProjectMember, updateProjectMember, removeProjectMember } = useProjectMembers();
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'list' | 'add'>('list');

    // Add Member State
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchMembers = async () => {
        setLoading(true);
        const { data, error } = await getProjectMembers(projectId);
        if (data) {
            setMembers(data);
        } else {
            toast.error('加载成员列表失败');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchMembers();
            setView('list');
            setSelectedUserIds(new Set());
        }
    }, [isOpen, projectId]);

    const handleRoleChange = async (userId: number, newRole: string) => {
        // Optimistic update
        setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole as any } : m));

        const { error } = await updateProjectMember(projectId, userId, newRole);
        if (error) {
            toast.error('更新角色失败');
            fetchMembers(); // Revert
        } else {
            toast.success('角色已更新');
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!confirm('确定要移除该项目成员吗？')) return;

        const { error } = await removeProjectMember(projectId, userId);
        if (error) {
            toast.error('移除成员失败');
        } else {
            toast.success('成员已移除');
            setMembers(prev => prev.filter(m => m.user_id !== userId));
        }
    };

    const handleAddMembers = async () => {
        if (selectedUserIds.size === 0) return;
        setIsSubmitting(true);

        // Add sequentially
        let successCount = 0;
        for (const userId of selectedUserIds) {
            const { error } = await addProjectMember(projectId, userId, 'editor'); // Changed default to 'editor'
            if (!error) successCount++;
        }

        if (successCount > 0) {
            toast.success(`已成功添加 ${successCount} 名成员`);
            fetchMembers();
            setView('list');
            setSelectedUserIds(new Set());
        } else {
            toast.error('添加成员失败');
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        {view === 'add' && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={() => setView('list')}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        {view === 'list' ? `项目成员管理: ${projectTitle}` : '添加项目成员'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {view === 'list' ? (
                        <>
                            <div className="flex-1 overflow-hidden p-6 pt-4 flex flex-col">
                                <RoleDescriptions />

                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm text-muted-foreground">共 {members.length} 名成员</span>
                                    <Button size="sm" onClick={() => setView('add')} className="gap-1">
                                        <UserPlus className="w-4 h-4" />
                                        添加成员
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <ScrollArea className="flex-1 pr-4">
                                        <div className="space-y-4 pb-4">
                                            {members.map(member => (
                                                <div key={member.id} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar name={member.username} />
                                                        <div>
                                                            <div className="font-medium text-sm">{member.username}</div>
                                                            <div className="text-xs text-muted-foreground">{member.department_name || '无部门'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={member.role}
                                                            onValueChange={(val) => handleRoleChange(member.user_id, val)}
                                                            disabled={member.role === 'admin' && members.filter(m => m.role === 'admin').length === 1}
                                                        >
                                                            <SelectTrigger className="w-[85px] h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="viewer">观察者</SelectItem>
                                                                <SelectItem value="editor">编辑者</SelectItem>
                                                                <SelectItem value="admin">管理员</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleRemoveMember(member.user_id)}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col p-6 pt-4 min-h-0">
                            <RoleDescriptions />

                            <UserSelector
                                selectedUserIds={selectedUserIds}
                                onToggleUser={(u) => {
                                    const newSet = new Set(selectedUserIds);
                                    if (newSet.has(u.id)) newSet.delete(u.id);
                                    else newSet.add(u.id);
                                    setSelectedUserIds(newSet);
                                }}
                                className="flex-1 border shadow-sm"
                            />
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button variant="outline" onClick={() => setView('list')}>取消</Button>
                                <Button onClick={handleAddMembers} disabled={selectedUserIds.size === 0 || isSubmitting}>
                                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    确认添加 ({selectedUserIds.size})
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
