import { useState, useEffect, useRef } from 'react';
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
import { Pencil, AlertTriangle } from 'lucide-react';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  itemType: 'folder' | 'file';
  onRename: (newName: string) => void;
}

export function RenameDialog({
  open,
  onOpenChange,
  currentName,
  itemType,
  onRename
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset name and handle selection when dialog opens
  useEffect(() => {
    if (open) {
      setName(currentName);

      // Use a timeout to ensure DOM is ready and override any default behavior
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();

          if (itemType === 'file') {
            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex > 0) {
              inputRef.current.setSelectionRange(0, lastDotIndex);
            } else {
              inputRef.current.select();
            }
          } else {
            inputRef.current.select();
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [open, currentName, itemType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
      onOpenChange(false);
    }
  };

  const getExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.slice(lastDotIndex) : '';
  };

  const originalExtension = itemType === 'file' ? getExtension(currentName) : '';
  const newExtension = itemType === 'file' ? getExtension(name) : '';
  const isExtensionChanged = itemType === 'file' && originalExtension !== newExtension;

  const isValid = name.trim().length > 0 && name.trim() !== currentName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            重命名{itemType === 'folder' ? '文件夹' : '文件'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">新名称</Label>
            <Input
              id="name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`输入${itemType === 'folder' ? '文件夹' : '文件'}名称`}
            />
          </div>

          {isExtensionChanged && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-100">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">扩展名已更改</p>
                <p className="text-xs mt-0.5 opacity-90">
                  您将扩展名从 "{originalExtension}" 改为了 "{newExtension || '(无)'}"。这可能导致文件无法正常打开。
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={!isValid} variant={isExtensionChanged ? "destructive" : "default"}>
              {isExtensionChanged ? "确认修改" : "确认重命名"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
