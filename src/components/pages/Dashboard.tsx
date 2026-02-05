import { FileText, Globe, Bot, TrendingUp, Clock, ArrowUpRight, Zap } from 'lucide-react';
import { intelligences, activities } from '@/data/mockData';
import { cn } from '@/lib/utils';

const stats = [
  {
    label: '内部文档',
    value: '128',
    change: '+12',
    changeLabel: '较上周',
    icon: FileText,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    label: '论文收录',
    value: intelligences.filter(i => i.type === 'paper').length.toString(),
    change: '+5',
    changeLabel: '较上周',
    icon: Globe,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    label: '专利追踪',
    value: intelligences.filter(i => i.type === 'patent').length.toString(),
    change: '+3',
    changeLabel: '较上周',
    icon: TrendingUp,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    label: 'AI 对话',
    value: '256',
    change: '+48',
    changeLabel: '较上周',
    icon: Bot,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
];

const quickActions = [
  { label: '上传文档', icon: FileText, page: 'documents' },
  { label: '检索论文', icon: Globe, page: 'intelligence' },
  { label: '专利分析', icon: TrendingUp, page: 'intelligence' },
  { label: 'AI 问答', icon: Bot, page: 'assistant' },
];

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">欢迎回来</h1>
        <p className="text-muted-foreground mt-1 text-sm">固态电池知识管理系统 · 研发效率提升平台</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card rounded-xl p-4 border border-border/30 hover:border-border/50 transition-all duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', stat.iconBg)}>
                  <Icon className={cn('w-4 h-4', stat.iconColor)} />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title={stat.changeLabel}>
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                  <span className="text-green-500 ml-0.5">{stat.changeLabel}</span>
                </span>
              </div>
              <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border/30">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">最近动态</h2>
          </div>
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  activity.type === 'document' && 'bg-blue-50 text-blue-600',
                  activity.type === 'intelligence' && 'bg-purple-50 text-purple-600',
                  activity.type === 'ai' && 'bg-green-50 text-green-600',
                )}>
                  {activity.type === 'document' && <FileText className="w-4 h-4" />}
                  {activity.type === 'intelligence' && <Globe className="w-4 h-4" />}
                  {activity.type === 'ai' && <Bot className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{activity.action}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">{activity.target}</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0">{activity.timestamp}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl p-5 border border-border/30">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">快速入口</h2>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.page)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 text-left transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-card border border-border/30 flex items-center justify-center group-hover:border-border/50 transition-colors">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
