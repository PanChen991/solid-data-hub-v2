import { useState } from 'react';
import { FileText, FileSpreadsheet, FileType, X, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
// import { FolderItem } from '@/data/mockData'; // Removed to avoid conflict

interface PreviewFile {
  name: string;
  type: string;
  size?: string;
  author?: string;
  updatedAgo?: string;
}

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: PreviewFile | null;
}

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' };
    case 'xlsx':
      return { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50' };
    case 'docx':
      return { icon: FileType, color: 'text-blue-600', bg: 'bg-blue-50' };
    default:
      return { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
};

const getMockContent = (file: PreviewFile) => {
  if (file.type === 'pdf') {
    return {
      type: 'pdf',
      pages: 12,
      content: `
## ${file.name}

### 文档摘要
本报告详细分析了 LPSC 材料的 XRD 图谱特征，验证了 502 批次样品的晶体结构纯度。

### 主要发现
1. **晶体结构确认**: Li₆PS₅Cl 立方相结构，空间群 F-43m
2. **杂质检测**: 未发现 Li₂S 或 P₂S₅ 残留峰
3. **结晶度评估**: 晶化度达到 98.5%

### 测试条件
- 设备: Rigaku SmartLab 9kW
- 辐射源: Cu Kα (λ = 1.5406 Å)
- 扫描范围: 10° - 80° (2θ)
- 步进: 0.02°
- 扫描速度: 2°/min

### 结论
502 批次 LPSC 样品结构纯净，符合量产标准。
      `
    };
  }

  if (file.type === 'xlsx') {
    return {
      type: 'excel',
      sheets: ['电导率数据', '温度依赖性', '循环测试'],
      data: [
        { 样品编号: 'LPSC-502-01', 电导率: '2.35 mS/cm', 温度: '25°C', 测试日期: '2025-01-10' },
        { 样品编号: 'LPSC-502-02', 电导率: '2.41 mS/cm', 温度: '25°C', 测试日期: '2025-01-10' },
        { 样品编号: 'LPSC-502-03', 电导率: '2.28 mS/cm', 温度: '25°C', 测试日期: '2025-01-11' },
        { 样品编号: 'LPSC-502-04', 电导率: '2.52 mS/cm', 温度: '25°C', 测试日期: '2025-01-11' },
        { 样品编号: 'LPSC-502-05', 电导率: '2.38 mS/cm', 温度: '25°C', 测试日期: '2025-01-12' },
      ]
    };
  }

  if (file.type === 'docx') {
    return {
      type: 'word',
      content: `
## ${file.name}

### 设备信息
- **设备名称**: Fritsch Pulverisette 7 Premium Line
- **设备编号**: EQ-2024-0156
- **所属部门**: 无机电解质部

### 维护记录

| 日期 | 维护类型 | 执行人 | 备注 |
|------|----------|--------|------|
| 2025-01-15 | 常规保养 | 张工 | 更换密封圈 |
| 2025-01-08 | 清洁 | 李工 | 球磨罐清洗 |
| 2025-01-01 | 检查 | 王工 | 运转正常 |
| 2024-12-25 | 大修 | 外包 | 电机轴承更换 |

### 下次维护
- **日期**: 2025-02-01
- **类型**: 常规保养
- **负责人**: 张工
      `
    };
  }

  return { type: 'unknown', content: '无法预览此文件类型' };
};

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
  const [zoom, setZoom] = useState(100);
  const [activeSheet, setActiveSheet] = useState(0);

  if (!file) return null;

  const { icon: Icon, color, bg } = getFileIcon(file.type);
  const mockContent = getMockContent(file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] h-[80vh] flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="sr-only">
          <DialogTitle>文件预览 - {file.name}</DialogTitle>
          <DialogDescription>预览文件内容并提供下载选项。</DialogDescription>
        </DialogHeader>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{file.name}</h3>
              <p className="text-xs text-muted-foreground">
                {file.size} · {file.author} · {file.updatedAgo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-1.5 rounded-md hover:bg-background transition-colors"
              >
                <ZoomOut className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1.5 rounded-md hover:bg-background transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              下载
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              新窗口打开
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {mockContent.type === 'excel' && (
            <div className="h-full flex flex-col">
              {/* Sheet Tabs */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-muted/30">
                {mockContent.sheets?.map((sheet, idx) => (
                  <button
                    key={sheet}
                    onClick={() => setActiveSheet(idx)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md transition-colors',
                      activeSheet === idx
                        ? 'bg-background shadow-sm text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    )}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
              {/* Table Content */}
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      {mockContent.data && Object.keys(mockContent.data[0]).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-2 text-left text-xs font-medium text-muted-foreground border border-border/30"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockContent.data?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        {Object.values(row).map((value, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-4 py-2 text-sm text-foreground border border-border/30"
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(mockContent.type === 'pdf' || mockContent.type === 'word') && (
            <div
              className="h-full overflow-auto p-8 bg-background"
              style={{ fontSize: `${zoom}%` }}
            >
              <div className="max-w-3xl mx-auto bg-card rounded-lg shadow-sm border border-border/30 p-8">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {mockContent.content?.split('\n').map((line, idx) => {
                    if (line.startsWith('## ')) {
                      return <h2 key={idx} className="text-xl font-semibold text-foreground mt-6 mb-4">{line.replace('## ', '')}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={idx} className="text-lg font-medium text-foreground mt-4 mb-2">{line.replace('### ', '')}</h3>;
                    }
                    if (line.startsWith('- **')) {
                      const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
                      if (match) {
                        return (
                          <p key={idx} className="text-sm text-muted-foreground my-1">
                            <span className="font-medium text-foreground">{match[1]}</span>: {match[2]}
                          </p>
                        );
                      }
                    }
                    if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
                      const match = line.match(/\d+\. \*\*(.+?)\*\*: (.+)/);
                      if (match) {
                        return (
                          <p key={idx} className="text-sm text-muted-foreground my-1 ml-4">
                            <span className="font-medium text-foreground">{match[1]}</span>: {match[2]}
                          </p>
                        );
                      }
                    }
                    if (line.startsWith('| ')) {
                      return null; // Skip table rows, would need proper table parsing
                    }
                    if (line.trim()) {
                      return <p key={idx} className="text-sm text-foreground my-2">{line}</p>;
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}

          {mockContent.type === 'unknown' && (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">{mockContent.content}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {mockContent.type === 'pdf' && (
          <div className="px-4 py-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>第 1 页 / 共 {mockContent.pages} 页</span>
            <span>PDF 预览模式</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
