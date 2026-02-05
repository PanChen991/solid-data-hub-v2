import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjects } from '@/hooks/useDatabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ProjectDialog({ isOpen, onClose, onSuccess }: ProjectDialogProps) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const { createProject } = useProjects();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        const { error } = await createProject(name);
        setLoading(false);

        if (error) {
            toast.error('创建项目失败');
        } else {
            toast.success('项目创建成功');
            setName('');
            onSuccess();
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>新建项目</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">项目名称</Label>
                        <Input
                            id="name"
                            placeholder="请输入项目名称..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            autoComplete="off"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            取消
                        </Button>
                        <Button type="submit" disabled={!name.trim() || loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            创建项目
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
