
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocuments } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileIcon, Loader2, Download, Folder } from 'lucide-react';
import { toast } from 'sonner';

export const FileLandingPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { getDocument, getDocumentUrl } = useDocuments();
    const { user, loading: authLoading } = useAuth(); // Get auth state
    const [loading, setLoading] = useState(true);
    const [doc, setDoc] = useState<any>(null);

    useEffect(() => {
        // 1. Wait for Auth Check
        if (authLoading) return;

        // 2. Redirect to Login if not authenticated
        if (!user) {
            const currentUrl = encodeURIComponent(window.location.pathname);
            navigate(`/login?redirect=${currentUrl}`);
            return;
        }

        // 3. Fetch Document
        const fetchDoc = async () => {
            if (!id) return;
            setLoading(true);

            // Clean ID (remove 'doc-' prefix if present)
            const cleanId = id.toString().replace('doc-', '');
            const docId = parseInt(cleanId);

            if (isNaN(docId)) {
                toast.error('无效的文件ID');
                setLoading(false);
                return;
            }

            const { data, error } = await getDocument(docId);
            if (error) {
                // If 403, might be permission issue for logged in user
                toast.error('无法获取文件信息，可能已被删除或权限不足');
                setLoading(false);
                return;
            }
            setDoc(data);
            setLoading(false);
        };
        fetchDoc();
    }, [id, user, authLoading, navigate]);

    const handleDownload = async () => {
        if (!doc) return;
        try {
            const { data } = await getDocumentUrl(doc.id);
            if (data?.url) {
                window.open(data.url, '_blank');
            }
        } catch (e) {
            toast.error('下载失败');
        }
    };

    const handleOpenFolder = () => {
        if (doc?.folder_id) {
            navigate(`/share/folder/${doc.folder_id}?highlight=${doc.id}`);
        } else {
            navigate('/');
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Card className="w-[400px]">
                    <CardHeader>
                        <CardTitle className="text-center text-red-500">文件未找到</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground">
                        该文件可能已被删除，或者您没有权限访问。
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button variant="outline" onClick={() => navigate('/')}>返回首页</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-blue-50 p-4 rounded-full w-fit mb-4">
                        <FileIcon className="h-10 w-10 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl break-all">{doc.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {(doc.size / 1024).toFixed(1)} KB • {doc.file_type.toUpperCase()}
                    </p>
                </CardHeader>
                <CardContent className="text-center py-6">
                    <p className="text-sm text-secondary-foreground mb-6">
                        这是一个内部共享文件，您可以直接下载或进入所在文件夹查看。
                    </p>

                    <div className="space-y-3">
                        <Button className="w-full" size="lg" onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" /> 下载文件
                        </Button>
                        <Button variant="outline" className="w-full" onClick={handleOpenFolder}>
                            <Folder className="mr-2 h-4 w-4" /> 打开所在文件夹
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
