import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/useDatabase';

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { updateSelf } = useUsers();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || !confirmPassword) {
            toast.error('请输入密码');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('两次输入的密码不一致');
            return;
        }
        if (password.length < 6) {
            toast.error('密码长度至少需要6位');
            return;
        }

        setLoading(true);
        try {
            const { error } = await updateSelf(password);
            if (error) {
                toast.error('修改密码失败');
            } else {
                toast.success('修改密码成功，请重新登录');
                onOpenChange(false);
                setPassword('');
                setConfirmPassword('');
                // Optional: Trigger logout? Or let user do it.
                // Usually good UX to force re-login or just let them stay.
                // Plan says "Logout and login with new password" -> Manual. 
                // We can just close dialog.
            }
        } catch (error) {
            console.error(error);
            toast.error('修改失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>修改密码</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">新密码</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="输入新密码"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">确认新密码</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次输入新密码"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        <Button type="submit" disabled={!password || !confirmPassword || loading}>
                            {loading ? '提交中...' : '确认修改'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
