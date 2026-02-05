import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useUsers, UserProfile } from '@/hooks/useDatabase';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemName: string;
    onShare: (userId: number, role: 'viewer' | 'editor') => Promise<void>;
}

export function ShareDialog({ open, onOpenChange, itemName, onShare }: ShareDialogProps) {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<UserProfile[]>([]);

    const { getUsers } = useUsers();

    useEffect(() => {
        if (open) {
            getUsers().then(({ data }) => {
                if (data) setUsers(data);
            });
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return;

        setLoading(true);
        try {
            await onShare(parseInt(selectedUserId), role);
            onOpenChange(false);
            toast.success('分享成功');
        } catch (error) {
            // Error handled by parent or here
            console.error(error);
            toast.error('分享失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>分享 "{itemName}"</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>选择用户</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="搜索用户..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user) => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                        {user.username} {user.department_name ? `(${user.department_name})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>权限</Label>
                        <Select value={role} onValueChange={(v: 'viewer' | 'editor') => setRole(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="viewer">仅查看</SelectItem>
                                <SelectItem value="editor">可编辑</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        <Button type="submit" disabled={!selectedUserId || loading}>
                            {loading ? '处理中...' : '确认分享'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
