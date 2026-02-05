import { useState, useMemo } from 'react';
import { Search, ChevronRight, X, Users, UserPlus, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { organizationStaff, departments, StaffMember } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MemberManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentMembers: string[]; // staff IDs
  onSave: (memberIds: string[]) => void;
}

export function MemberManagementDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentMembers,
  onSave,
}: MemberManagementDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(currentMembers);

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelectedMembers(currentMembers);
      setSearchQuery('');
    }
    onOpenChange(open);
  };

  // Group staff by department
  const staffByDepartment = useMemo(() => {
    const grouped: Record<string, StaffMember[]> = {};
    departments.forEach(dept => {
      grouped[dept.name] = organizationStaff.filter(s => s.department === dept.name);
    });
    return grouped;
  }, []);

  // Filter available staff (not yet selected)
  const availableStaff = useMemo(() => {
    return organizationStaff.filter(staff => {
      const notSelected = !selectedMembers.includes(staff.id);
      const matchesSearch = 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchQuery.toLowerCase());
      return notSelected && matchesSearch;
    });
  }, [selectedMembers, searchQuery]);

  // Get selected staff details
  const selectedStaffDetails = useMemo(() => {
    return organizationStaff.filter(staff => selectedMembers.includes(staff.id));
  }, [selectedMembers]);

  const toggleDepartment = (deptName: string) => {
    setExpandedDepartments(prev => 
      prev.includes(deptName) 
        ? prev.filter(d => d !== deptName)
        : [...prev, deptName]
    );
  };

  const addMember = (staffId: string) => {
    setSelectedMembers(prev => [...prev, staffId]);
  };

  const removeMember = (staffId: string) => {
    setSelectedMembers(prev => prev.filter(id => id !== staffId));
  };

  const addAllFromDepartment = (deptName: string) => {
    const deptStaff = staffByDepartment[deptName];
    const newIds = deptStaff
      .filter(s => !selectedMembers.includes(s.id))
      .map(s => s.id);
    setSelectedMembers(prev => [...prev, ...newIds]);
  };

  const handleSave = () => {
    onSave(selectedMembers);
    toast.success('成员已更新', {
      description: `${projectName} 现有 ${selectedMembers.length} 名成员`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            成员管理 - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Available Staff */}
          <div className="flex-1 border-r border-border/50 flex flex-col">
            <div className="p-4 border-b border-border/50 bg-muted/20">
              <p className="text-sm font-medium text-foreground mb-2">可用人员</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索姓名、工号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2">
                {departments.map(dept => {
                  const deptAvailable = availableStaff.filter(s => s.department === dept.name);
                  const isExpanded = expandedDepartments.includes(dept.name);
                  
                  if (deptAvailable.length === 0) return null;
                  
                  return (
                    <div key={dept.id} className="mb-1">
                      <button
                        onClick={() => toggleDepartment(dept.name)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <ChevronRight 
                          className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                          )} 
                        />
                        <span className="text-sm font-medium text-foreground flex-1 text-left">
                          {dept.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {deptAvailable.length}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            addAllFromDepartment(dept.name);
                          }}
                        >
                          全选
                        </Button>
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-6 space-y-0.5">
                          {deptAvailable.map(staff => (
                            <button
                              key={staff.id}
                              onClick={() => addMember(staff.id)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group"
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                                <span className="text-xs font-medium text-foreground">
                                  {staff.name.charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-sm text-foreground">{staff.name}</p>
                                <p className="text-xs text-muted-foreground">{staff.role}</p>
                              </div>
                              <UserPlus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {availableStaff.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? '未找到匹配的人员' : '所有人员已添加'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Selected Members */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-border/50 bg-muted/20">
              <p className="text-sm font-medium text-foreground">
                项目成员
                <Badge variant="secondary" className="ml-2">
                  {selectedMembers.length}
                </Badge>
              </p>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {selectedStaffDetails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">从左侧选择成员添加到项目</p>
                  </div>
                ) : (
                  selectedStaffDetails.map(staff => (
                    <div
                      key={staff.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 group"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-foreground">
                          {staff.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {staff.department} · {staff.role}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeMember(staff.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Check className="w-4 h-4" />
            保存成员 ({selectedMembers.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
