import { Download, Trash2, FolderInput, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BatchActionsProps {
  selectedCount: number;
  onDownload: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BatchActions({ selectedCount, onDownload, onMove, onDelete, onClear }: BatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
      'bg-card/95 backdrop-blur-xl rounded-2xl shadow-lg border border-border/50',
      'px-4 py-3 flex items-center gap-4',
      'animate-in slide-in-from-bottom-4 fade-in duration-200'
    )}>
      {/* Selection Info */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          已选择 <span className="text-primary">{selectedCount}</span> 个项目
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border/50" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onDownload}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          下载
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onMove}
          className="gap-2"
        >
          <FolderInput className="w-4 h-4" />
          移动到
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onDelete}
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </Button>
      </div>

      {/* Clear Selection */}
      <button
        onClick={onClear}
        className="p-1.5 rounded-md hover:bg-muted transition-colors ml-2"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
