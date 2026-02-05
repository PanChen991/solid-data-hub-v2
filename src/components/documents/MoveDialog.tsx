import { useState } from 'react';
import { Folder, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { rootSpaces, FolderItem } from '@/data/mockData';

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onMove: (targetPath: string) => void;
}

export function MoveDialog({ open, onOpenChange, selectedCount, onMove }: MoveDialogProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleMove = () => {
    if (selectedFolder) {
      onMove(selectedFolder);
      onOpenChange(false);
    }
  };

  const renderFolder = (folder: FolderItem, depth = 0): JSX.Element | null => {
    if (folder.type !== 'folder' || folder.isLocked) return null;
    
    const isExpanded = expandedFolders.includes(folder.id);
    const isSelected = selectedFolder === folder.id;
    const hasChildren = folder.children?.some(c => c.type === 'folder' && !c.isLocked);

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            setSelectedFolder(folder.id);
            if (hasChildren) {
              toggleExpand(folder.id);
            }
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left',
            isSelected 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-accent/50 text-foreground',
            depth > 0 && 'ml-4'
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren ? (
            <ChevronRight className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )} />
          ) : (
            <div className="w-4" />
          )}
          <Folder className="w-4 h-4 text-amber-500" />
          <span className="flex-1 text-sm truncate">{folder.name}</span>
          {isSelected && <Check className="w-4 h-4 text-primary" />}
        </button>
        
        {isExpanded && folder.children?.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">移动文件</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            将 <span className="font-medium text-foreground">{selectedCount}</span> 个项目移动到...
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[300px] overflow-y-auto border border-border/30 rounded-lg">
          {rootSpaces.map(space => renderFolder(space))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleMove}
            disabled={!selectedFolder}
            className="bg-primary hover:bg-primary/90"
          >
            移动到此处
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
