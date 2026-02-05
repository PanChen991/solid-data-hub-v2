import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Shield,
    Users,
    KeyRound,
    Building2,
    HardDrive,
    Sparkles,
    Brain,
    Info,
    FileCheck,
    Globe,
    Share2,
    Lock,
    Eye,
    FileText,
    AlertCircle,
    UserCog
} from 'lucide-react';

export function Guide() {
    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">新手指南</h1>
                <p className="text-muted-foreground mt-1 text-sm">研发知识库 平台快速入门手册</p>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full h-auto grid-cols-2 md:grid-cols-4 bg-muted/50 p-1 mb-8">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">平台简介</TabsTrigger>
                    <TabsTrigger value="start" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">快速开始</TabsTrigger>
                    <TabsTrigger value="permissions" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 text-blue-600 font-medium"><Lock className="w-3 h-3 mr-1" />权限说明</TabsTrigger>
                    <TabsTrigger value="faq" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">常见问题</TabsTrigger>
                </TabsList>

                {/* 1. System Overview */}
                <TabsContent value="overview" className="space-y-8">
                    {/* Hero Section */}
                    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-8 md:p-12 text-center shadow-sm">
                        <div className="mx-auto flex max-w-[600px] flex-col items-center gap-4">
                            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                                <HardDrive className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                企业级知识资产库
                            </h2>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                本平台不仅仅是一个网盘，更是全员共建的研发智慧大脑。<br className="hidden md:block" />
                                连接数据、协同团队，让隐形经验显性化。
                            </p>
                        </div>
                    </div>

                    {/* Feature Grid */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="border-t-4 border-t-blue-500 shadow-sm transition-all hover:shadow-md">
                            <CardHeader>
                                <div className="mb-2 w-fit rounded-lg bg-blue-100 p-2 text-blue-600">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg">资产安全</CardTitle>
                                <CardDescription>告别散乱丢失</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    解决文件散落在个人电脑、微信聊天记录中容易丢失的痛点。统一归档，多地备份，确保每一份实验数据都有迹可循。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-t-4 border-t-emerald-500 shadow-sm transition-all hover:shadow-md">
                            <CardHeader>
                                <div className="mb-2 w-fit rounded-lg bg-emerald-100 p-2 text-emerald-600">
                                    <FileCheck className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg">版本权威</CardTitle>
                                <CardDescription>拒绝版本混乱</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    确保所有人看到的 SOP、标准都是最新版。彻底消除“V1、V2、最终版、绝对最终版”的文件命名噩梦。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-t-4 border-t-amber-500 shadow-sm transition-all hover:shadow-md">
                            <CardHeader>
                                <div className="mb-2 w-fit rounded-lg bg-amber-100 p-2 text-amber-600">
                                    <Users className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg">经验传承</CardTitle>
                                <CardDescription>让新人快速上手</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    沉淀研发过程资产，形成组织智慧。让前人的经验可复用，教训可规避，帮助新成员迅速融入核心业务。
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 2. Quick Start */}
                <TabsContent value="start" className="space-y-6">
                    <Card className="border-t-4 border-t-purple-500 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl"><KeyRound className="w-6 h-6 text-purple-600" /> 快速上手指引</CardTitle>
                            <CardDescription>只需三步，开启高效研发之旅</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Step 1 */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">1</div>
                                <div className="flex-1 space-y-2">
                                    <h3 className="font-semibold text-lg">登录您的账号</h3>
                                    <div className="bg-muted/50 p-4 rounded-lg border border-border/50 grid md:grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-muted-foreground block mb-1">账号</span>
                                            <span className="font-mono font-medium text-foreground">您的工号</span>
                                            <p className="text-[10px] text-muted-foreground mt-1">无需添加前缀，直接输入数字/字母</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground block mb-1">初始密码</span>
                                            <span className="font-mono font-medium text-foreground">123456</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Separator />
                            {/* Step 2 */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                                <div className="flex-1 space-y-2">
                                    <h3 className="font-semibold text-lg">安全设置 (强制)</h3>
                                    <p className="text-sm text-muted-foreground">首次登录后，请立即点击左下角头像 → <strong>修改密码</strong>。</p>
                                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded border border-blue-100 flex items-start gap-2">
                                        <KeyboardIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>
                                            <strong>安全小贴士：</strong> 在公共电脑输入密码前，请先按 <kbd className="bg-white/50 px-1 rounded">Cmd+A</kbd> + <kbd className="bg-white/50 px-1 rounded">Del</kbd> 清理输入框，防止浏览器自动填充导致的账号泄露。
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Separator />
                            {/* Step 3 */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">3</div>
                                <div className="flex-1 space-y-2">
                                    <h3 className="font-semibold text-lg">找到你的组织</h3>
                                    <p className="text-sm text-muted-foreground">
                                        进入 <strong>部门专属空间</strong> (01_部门专属空间)，您默认拥有所在部门文件夹的 **查看与下载权限**。
                                        <br />
                                        若需参与跨部门项目，请联系项目相关负责人将您加入对应的  **02_项目协作空间**。
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. Permissions Scope (Replaced Resource Map & AI) */}
                <TabsContent value="permissions" className="space-y-6">
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-900">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <strong>核心原则：</strong> 数据安全是第一生命线。所有权限遵循“最小可用”原则，即只给员工开通完成工作所需的最少权限。
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {/* 00_Public */}
                        <Card>
                            <CardHeader className="bg-blue-50/50 pb-3 border-b">
                                <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-700">
                                    <Globe className="w-5 h-5" /> 00_公共资源库
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">存放内容：</span>
                                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                                            <li>公司级红头文件</li>
                                            <li>行政/人事/财务规章制度</li>
                                            <li>通用技术标准与模板</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">权限规则：</span>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Eye className="w-4 h-4 text-emerald-600" />
                                                <span><strong>全员可见</strong>：所有通过实名认证的员工均可查看、预览。</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="w-4 h-4 text-blue-500" />
                                                <span><strong>共同维护</strong>：全员均拥有上传、下载与编辑权限，管理员仅负责人员管控。</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 border-t pt-3 mt-1">
                                        <div className="flex items-start gap-2 text-xs bg-muted/30 p-2 rounded">
                                            <UserCog className="w-4 h-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <span className="font-semibold text-foreground">权限管理：</span>
                                                <span className="text-muted-foreground">由 <strong>默认管理员</strong> 管理。操作入口：00 文件夹右上角的 <code className="bg-background px-1 rounded border">权限配置</code>。</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 01_Department */}
                        <Card>
                            <CardHeader className="bg-amber-50/50 pb-3 border-b">
                                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700">
                                    <Building2 className="w-5 h-5" /> 01_部门专属空间
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">存放内容：</span>
                                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                                            <li>部门内部工作文档 (如周报、月报)</li>
                                            <li>部门专属的技术资料与 SOP</li>
                                            <li>尚未公开的研究过程数据</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">权限规则：</span>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Shield className="w-4 h-4 text-amber-600" />
                                                <span><strong>部门隔离</strong>：只有本部门成员可以进入。其他部门人员(包括平级部门)默认<strong>不可见</strong>。</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <FileText className="w-4 h-4 text-blue-500" />
                                                <span><strong>内部协作</strong>：部门主管拥有管理权，成员一般拥有上传/编辑权（视具体设定而定）。</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 border-t pt-3 mt-1">
                                        <div className="flex items-start gap-2 text-xs bg-muted/30 p-2 rounded">
                                            <UserCog className="w-4 h-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <span className="font-semibold text-foreground">权限管理：</span>
                                                <span className="text-muted-foreground">需 <strong>Admin 权限</strong>。操作入口：<code className="bg-background px-1 rounded border">组织架构</code> 界面进行人员配置。</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 02_Project */}
                        <Card>
                            <CardHeader className="bg-lime-50/50 pb-3 border-b">
                                <CardTitle className="text-base font-bold flex items-center gap-2 text-lime-700">
                                    <Users className="w-5 h-5" /> 02_项目协作空间
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">存放内容：</span>
                                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                                            <li>跨部门项目的立项书、计划表</li>
                                            <li>项目组共同维护的技术方案</li>
                                            <li>需多方评审的交付物</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground block mb-1">权限规则：</span>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <KeyRound className="w-4 h-4 text-purple-600" />
                                                <span><strong>邀请制</strong>：打破组织架构限制。只有被项目经理<strong>手动邀请</strong>添加的人员才能看到该文件夹。</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Share2 className="w-4 h-4 text-emerald-500" />
                                                <span><strong>灵活授权</strong>：可对不同成员设置“仅查看”、“可编辑”或“管理者”权限。</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 border-t pt-3 mt-1">
                                        <div className="flex items-start gap-2 text-xs bg-muted/30 p-2 rounded">
                                            <UserCog className="w-4 h-4 text-muted-foreground mt-0.5" />
                                            <div>
                                                <span className="font-semibold text-foreground">权限管理：</span>
                                                <span className="text-muted-foreground">由 <strong>项目发起人 (文件夹创建人)</strong> 负责。新增组员并配置权限。</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 4. FAQ */}
                <TabsContent value="faq" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5" /> 常见问题解答</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <span className="bg-muted w-5 h-5 rounded-full flex items-center justify-center text-xs">Q</span>
                                    为什么我点开文件夹是空的，或者提示“无权限”？
                                </h4>
                                <p className="text-sm text-muted-foreground pl-7">
                                    这说明您当前不在该文件夹的授权范围内。请联系该文件夹的 **所有者**（通常是部门主管或项目经理），请他们将您添加为 **协作者**。单纯发送链接是无法打开私有文件的。
                                </p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <span className="bg-muted w-5 h-5 rounded-full flex items-center justify-center text-xs">Q</span>
                                    如何分享文件给其他部门的同事？
                                </h4>
                                <p className="text-sm text-muted-foreground pl-7">
                                    请选中文件 → 点击右侧菜单 → 选择 **分享** → 搜索同事姓名 → 添加权限。
                                    <br />
                                    <strong>注意：</strong> 请勿直接截图或通过微信发送机密文件，系统内的分享操作全程留痕，合规安全。
                                </p>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <span className="bg-muted w-5 h-5 rounded-full flex items-center justify-center text-xs">Q</span>
                                    我上传的文件误删了怎么办？
                                </h4>
                                <p className="text-sm text-muted-foreground pl-7">
                                    系统并非物理删除。请立即联系 **系统管理员 (Super Admin)**，管理员可在后台的回收站中找回您的数据。
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function KeyboardIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="16" x="2" y="4" rx="2" ry="2" />
            <path d="M6 8h.001" />
            <path d="M10 8h.001" />
            <path d="M14 8h.001" />
            <path d="M18 8h.001" />
            <path d="M6 12h.001" />
            <path d="M10 12h.001" />
            <path d="M14 12h.001" />
            <path d="M18 12h.001" />
            <path d="M7 16h10" />
        </svg>
    )
}
