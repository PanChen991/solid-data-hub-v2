import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User as UserIcon } from 'lucide-react';
import gotionLogo from '@/assets/gotion-logo.png';

export default function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchParams] = useSearchParams(); // Needs import
  const redirectUrl = searchParams.get('redirect');

  useEffect(() => {
    // Only redirect if user is already logged in AND we are visiting the auth page
    // If there is a redirect URL, we might want to prioritize that over default '/'
    if (user) {
      navigate(redirectUrl || '/');
    }
  }, [user, navigate, redirectUrl]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: '请填写完整信息',
        description: '请输入用户名和密码',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(username, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: '登录失败',
        description: '用户名或密码错误',
        variant: 'destructive',
      });
    } else {
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
      // Navigation handled by useEffect
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={gotionLogo}
            alt="Gotion Logo"
            className="h-12 mb-4"
          />
          <h1 className="text-2xl font-semibold text-foreground">
            SSB-KMS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            固态电池研发知识管理系统
          </p>
        </div>

        <Card className="shadow-apple-lg border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-username">用户名</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2025 国轩高科. All rights reserved.
        </p>
      </div>
    </div>
  );
}
