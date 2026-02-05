import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/components/pages/Dashboard';
import { Documents } from '@/components/pages/Documents';
import { IntelligencePage } from '@/components/pages/Intelligence';
import { AIAssistant } from '@/components/pages/AIAssistant';
import { Organization } from '@/components/pages/Organization';
import { Guide } from '@/components/pages/Guide';
import { Loader2 } from 'lucide-react';

const Index = ({ initialPage, initialFolderId }: { initialPage?: string; initialFolderId?: string }) => {
  const [currentPage, setCurrentPage] = useState(initialPage || 'documents');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialPage) setCurrentPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (!loading && !user) {
      const currentUrl = encodeURIComponent(window.location.pathname);
      navigate(`/auth?redirect=${currentUrl}`);
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'documents':
        return <Documents initialFolderId={initialFolderId} />;
      case 'intelligence':
        return <IntelligencePage />;
      case 'assistant':
        return <AIAssistant />;
      case 'organization':
        return <Organization />;
      case 'guide':
        return <Guide />;
      default:
        return <Documents initialFolderId={initialFolderId} />;
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    // Sync URL with page state
    if (page === 'documents') {
      navigate('/');
    } else if (page === 'dashboard') {
      navigate('/');
      // Ideally dashboard should have its own route, but for now '/' defaults to dashboard or documents depending on logic.
      // Wait, Index handles all these locally.
      // If we want to clear the /share/folder url, we must navigate to a cleaner URL.
      // Let's assume '/' maps to Index default.
    } else {
      // For other pages, we can just clear the specific share path or keep it simple
      navigate('/');
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </AppLayout>
  );
};

export default Index;
