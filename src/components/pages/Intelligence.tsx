import { useState } from 'react';
import { Search, BookOpen, FileCheck, Calendar, ExternalLink, Users } from 'lucide-react';
import { intelligences } from '@/data/mockData';
import { cn } from '@/lib/utils';

export function IntelligencePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'paper' | 'patent'>('all');

  const filteredIntelligences = intelligences.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.includes(searchQuery)) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || item.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">外部情报</h1>
        <p className="text-muted-foreground mt-1 text-sm">追踪前沿论文与专利动态</p>
      </div>

      {/* Search Bar - Apple Style */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索 Nature/Science 论文或专利..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-14 pl-12 pr-4 bg-white/70 backdrop-blur-lg rounded-2xl border border-border/30 shadow-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: '全部' },
          { id: 'paper', label: '论文' },
          { id: 'patent', label: '专利' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              filter === tab.id
                ? 'bg-foreground text-background'
                : 'bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Masonry-style Cards */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
        {filteredIntelligences.map((item) => (
          <div
            key={item.id}
            className="break-inside-avoid bg-card rounded-2xl p-5 border border-border/30 hover:border-border/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            {/* Type Badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                item.type === 'paper' ? 'bg-purple-100' : 'bg-amber-100'
              )}>
                {item.type === 'paper' ? (
                  <BookOpen className={cn('w-4 h-4', item.type === 'paper' ? 'text-purple-600' : 'text-amber-600')} />
                ) : (
                  <FileCheck className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                item.type === 'paper' ? 'text-purple-600' : 'text-amber-600'
              )}>
                {item.source}
              </span>
              {item.status && (
                <span className="text-xs text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-full">
                  {item.status}
                </span>
              )}
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Title */}
            <h3 className="font-medium text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">
              {item.title}
            </h3>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {item.publishedAt}
              </span>
              {item.authors && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {item.authors.slice(0, 2).join(', ')}
                  {item.authors.length > 2 && ' 等'}
                </span>
              )}
            </div>

            {/* Abstract */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
              {item.abstract}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/50 text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredIntelligences.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-accent/50 mx-auto flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">未找到匹配的结果</p>
        </div>
      )}
    </div>
  );
}
