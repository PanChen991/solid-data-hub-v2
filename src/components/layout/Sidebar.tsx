import { useState, useEffect } from 'react';
import { Home, FolderOpen, Globe, Sparkles, Settings, Users, LogOut, KeyRound, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import gotionLogo from '@/assets/gotion-logo.png';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChangePasswordDialog } from '@/components/dialogs/ChangePasswordDialog';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: '概览', icon: Home },
  { id: 'documents', label: '内部文档', icon: FolderOpen },
  { id: 'intelligence', label: '外部情报', icon: Globe },
  { id: 'assistant', label: 'AI 助手', icon: Sparkles },
  { id: 'guide', label: '使用说明', icon: BookOpen },
];

const adminItems = [
  { id: 'organization', label: '组织架构', icon: Users },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // Demo Mode State (Persisted)
  const [showDemoFeatures, setShowDemoFeatures] = useState(() => {
    return localStorage.getItem('show_demo_features') === 'true';
  });

  // Check for Magic Link activation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'demo') {
      if (!showDemoFeatures) {
        setShowDemoFeatures(true);
        localStorage.setItem('show_demo_features', 'true');
        toast.success('已通过链接激活演示模式');
      }
    }
  }, []);

  const toggleDemoFeatures = () => {
    const newValue = !showDemoFeatures;
    setShowDemoFeatures(newValue);
    localStorage.setItem('show_demo_features', String(newValue));
    toast.success(newValue ? '已开启演示模式：显示所有功能入口' : '已关闭演示模式：隐藏未发布功能');
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white/70 backdrop-blur-xl border-r border-border/30 z-50 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border/30">
        <div className="flex flex-col items-center gap-2">
          <img src={gotionLogo} alt="国轩高科" className="h-12 w-auto" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight text-center">固态电池知识库管理平台</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          // Demo Feature Logic
          const isDemoFeature = ['dashboard', 'intelligence', 'assistant'].includes(item.id);
          const isDisabled = isDemoFeature && !showDemoFeatures;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (isDisabled) {
                  toast.info('该功能模块正在建设中，敬请期待...');
                  return;
                }
                onNavigate(item.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 relative',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px]', isActive && 'text-primary')} />
              <span className="text-sm">{item.label}</span>
              {item.id === 'documents' && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {isDisabled && (
                <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                  建设中
                </span>
              )}
            </button>
          );
        })}

        {/* Admin Section */}
        <div className="pt-4 mt-4 border-t border-border/30">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Settings className="w-3.5 h-3.5" />
            管理设置
          </div>
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className={cn('w-[18px] h-[18px]', isActive && 'text-primary')} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-border/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer w-full">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-sm">
                <span className="text-sm font-medium text-white">{(user?.username || '用户').charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">{user?.username || '未登录'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.department_name || '部门'}</p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} className="cursor-pointer">
              <KeyRound className="w-4 h-4 mr-2" />
              修改密码
            </DropdownMenuItem>

            {/* Super Admin Debug Toggle */}
            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleDemoFeatures} className="cursor-pointer">
                  {showDemoFeatures ? (
                    <>
                      <LogOut className="w-4 h-4 mr-2 rotate-180 text-muted-foreground" /> {/* Just an icon */}
                      <span>隐藏未发布功能</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                      <span>显示调试入口</span>
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      </div>
    </aside>
  );
}
