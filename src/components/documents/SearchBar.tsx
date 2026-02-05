import { useState, useRef, useEffect } from 'react';
import { Search, X, FileText, FileSpreadsheet, FileType, Folder, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface SearchFilters {
  query: string;
  types: string[]; // Keep interface compatible for now, pass empty
  authors: string[];
}

// Need to import FolderItem type or define compatible one
interface FolderItemStub {
  id: string;
  name: string;
  type: string;
  ancestors?: { id: number; name: string }[];
  [key: string]: any;
}

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  isActive: boolean;
  results?: FolderItemStub[] | null;
  loading?: boolean;
  onNavigate?: (item: FolderItemStub) => void;
}

export function SearchBar({ onSearch, onClear, isActive, results, loading, onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        onSearch({
          query: query.trim(),
          types: [],
          authors: [],
        });
        setOpen(true);
      } else {
        if (open) setOpen(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    onClear();
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="全局搜索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && results.length > 0) setOpen(true); }}
          className="pl-9 pr-9 bg-background/50 w-full"
        />
        {(query || isActive) && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Dropdown Results */}
        {open && query && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-md border shadow-md z-50 max-h-[400px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                搜索中...
              </div>
            ) : results && results.length > 0 ? (
              <div className="py-2">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col gap-0.5"
                    onClick={() => {
                      if (onNavigate) onNavigate(item);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {item.type === 'folder' ? <Folder className="w-4 h-4 text-amber-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    {item.ancestors && item.ancestors.length > 0 && (
                      <div className="text-[10px] text-muted-foreground pl-6 truncate">
                        {item.ancestors.map(a => a.name).join(' / ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                未找到相关结果
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
