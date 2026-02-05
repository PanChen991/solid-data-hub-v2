import { useState } from 'react';
import { Settings, Users, UserPlus, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { organizationStaff, projectMembers } from '@/data/mockData';
import { MemberManagementDialog } from './MemberManagementDialog';

interface ProjectSettingsCardProps {
  projectId: string;
  projectName: string;
}

export function ProjectSettingsCard({ projectId, projectName }: ProjectSettingsCardProps) {
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [members, setMembers] = useState<string[]>(
    projectMembers
      .filter(pm => pm.projectId === projectId)
      .map(pm => pm.staffId)
  );

  const memberDetails = organizationStaff.filter(staff => members.includes(staff.id));

  const handleSaveMembers = (newMembers: string[]) => {
    setMembers(newMembers);
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">成员管理</CardTitle>
              <CardDescription className="text-xs">管理项目访问权限</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">当前成员</span>
            </div>
            <Badge variant="secondary">{members.length} 人</Badge>
          </div>

          {/* Member Preview */}
          {memberDetails.length > 0 ? (
            <div className="space-y-2">
              {memberDetails.slice(0, 3).map(member => (
                <div 
                  key={member.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.department}</p>
                  </div>
                </div>
              ))}
              {memberDetails.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  还有 {memberDetails.length - 3} 名成员...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无成员</p>
            </div>
          )}

          <Button 
            onClick={() => setMemberDialogOpen(true)}
            className="w-full gap-2"
          >
            <UserPlus className="w-4 h-4" />
            添加成员
          </Button>
        </CardContent>
      </Card>

      <MemberManagementDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        projectId={projectId}
        projectName={projectName}
        currentMembers={members}
        onSave={handleSaveMembers}
      />
    </>
  );
}
