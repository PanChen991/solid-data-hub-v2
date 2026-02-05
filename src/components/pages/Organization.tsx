import { useState, useMemo, useEffect } from 'react';
import { Search, Users, Plus, Edit2, Trash2, MoreHorizontal, Settings, Folder, ChevronRight, ChevronDown, CornerDownRight, ChevronsRight, RefreshCw, FolderTree, Filter, Check, X, Shield, Eye } from 'lucide-react';
import { UserDetailDialog } from '@/components/dialogs/UserDetailDialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useUsers, useDepartments, UserProfile } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function Organization() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'manager';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // User 360 View State
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);

  // Data Hooks
  const {
    createUser,
    updateUser,
    deleteUser,
    getUsers
  } = useUsers();
  const { getDepartments, createDepartment, updateDepartment, deleteDepartment } = useDepartments();

  // ----- Member Dialog State -----
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    username: '',
    employee_id: '',
    email: '',
    department_id: '',
    role: 'viewer',
    password: ''
  });

  // ----- Department Form Dialog State -----
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    parent_id: '0'
  });

  // Deletion Dialog States
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  const [deleteDeptDialogOpen, setDeleteDeptDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<any | null>(null);

  // Load Data
  const fetchData = async () => {
    const { data: usersData } = await getUsers();
    const { data: deptsData } = await getDepartments();
    if (usersData) setUsers(usersData);
    if (deptsData) setDepartments(deptsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Computed Data ---
  const level1Departments = useMemo(() => {
    return departments.filter(d => !d.parent_id);
  }, [departments]);

  const hierarchicalDepartments = useMemo(() => {
    const result: any[] = [];
    const buildTree = (parentId: number | null, depth: number) => {
      departments
        .filter(d => d.parent_id === parentId)
        .forEach(d => {
          result.push({ ...d, depth });
          buildTree(d.id, depth + 1);
        });
    };
    buildTree(null, 0);
    return result;
  }, [departments]);

  const getDescendantDepartmentIds = (deptId: number, allDepartments: any[]): number[] => {
    let descendantIds: number[] = [deptId];
    const children = allDepartments.filter(d => d.parent_id === deptId);
    children.forEach(child => {
      descendantIds = descendantIds.concat(getDescendantDepartmentIds(child.id, allDepartments));
    });
    return descendantIds;
  };

  const filteredStaff = useMemo(() => {
    return users.filter(staff => {
      const matchesSearch =
        staff.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.department_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesDepartment = true;
      if (selectedDepartmentId !== null) {
        // Include users in the selected department AND its sub-departments
        const descendantIds = getDescendantDepartmentIds(selectedDepartmentId, departments);
        matchesDepartment = staff.department_id !== null && descendantIds.includes(staff.department_id);
      }

      return matchesSearch && matchesDepartment;
    });
  }, [searchQuery, selectedDepartmentId, users, departments]);

  // --- Member Handlers ---
  const handleOpenAddMember = () => {
    setEditingUser(null);
    setMemberFormData({
      username: '',
      employee_id: '',
      email: '',
      department_id: selectedDepartmentId ? selectedDepartmentId.toString() : '',
      role: 'viewer',
      password: ''
    });
    setIsMemberDialogOpen(true);
  };

  const handleOpenEditMember = (member: UserProfile) => {
    setEditingUser(member);
    setMemberFormData({
      username: member.username,
      employee_id: member.employee_id || '',
      email: member.email || '',
      department_id: member.department_id?.toString() || '',
      role: member.role,
      password: ''
    });
    setIsMemberDialogOpen(true);
  };

  const handleViewDetails = (member: any) => {
    setDetailUser(member);
    setDetailDialogOpen(true);
  };

  const handleEditMemberSuccess = () => {
    setIsMemberDialogOpen(false);
    fetchData();
  };

  const handleSubmitMember = async () => {
    const payload = {
      ...memberFormData,
      department_id: memberFormData.department_id ? parseInt(memberFormData.department_id) : null
    };

    if (editingUser) {
      if (!payload.password) delete payload.password;
      const { error } = await updateUser(editingUser.id, payload);
      if (error) toast.error('更新失败');
      else {
        toast.success('更新成功');
        setIsMemberDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await createUser(payload);
      if (error) toast.error('添加失败');
      else {
        toast.success('添加成功');
        setIsMemberDialogOpen(false);
        fetchData();
      }
    }
  };

  // --- Role Update Handler ---
  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const { error } = await api.put(`/users/${userId}`, { role: newRole });
      if (error) throw error;
      toast.success("角色权限已更新");
      fetchData(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || "更新失败");
    }
  };

  const handleDeleteClick = (id: number) => {
    setUserToDelete(id);
    setDeleteUserDialogOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!userToDelete) return;

    const { error } = await deleteUser(userToDelete);
    if (error) toast.error('删除失败');
    else {
      toast.success('删除成功');
      fetchData();
    }
    setDeleteUserDialogOpen(false);
    setUserToDelete(null);
  };

  // --- Department Handlers ---
  const handleOpenAddDept = (parentId: number | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDept(null);
    setDeptFormData({
      name: '',
      parent_id: parentId ? parentId.toString() : '0'
    });
    setIsDeptFormOpen(true);
  };

  const handleOpenEditDept = (dept: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDept(dept);
    setDeptFormData({
      name: dept.name,
      parent_id: dept.parent_id ? dept.parent_id.toString() : '0'
    });
    setIsDeptFormOpen(true);
  };

  const handleSubmitDept = async () => {
    const parentId = deptFormData.parent_id === '0' ? null : parseInt(deptFormData.parent_id);
    const payload = { ...deptFormData, parent_id: parentId };

    if (editingDept) {
      const { error } = await updateDepartment(editingDept.id, payload);
      if (error) toast.error(error.message || '更新部门失败');
      else {
        toast.success('部门更新成功');
        setIsDeptFormOpen(false);
        fetchData();
      }
    } else {
      const { error } = await createDepartment(payload);
      if (error) toast.error(error.message || '创建部门失败');
      else {
        toast.success('部门创建成功');
        setIsDeptFormOpen(false);
        fetchData();
      }
    }
  };

  const handleDeleteDeptClick = (dept: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeptToDelete(dept);
    setDeleteDeptDialogOpen(true);
  };

  const confirmDeleteDept = async () => {
    if (!deptToDelete) return;

    // Check if department has children
    const hasChildren = departments.some(d => d.parent_id === deptToDelete.id);
    if (hasChildren) {
      toast.error('无法删除：该部门下还有子部门');
      setDeleteDeptDialogOpen(false);
      return;
    }

    // Check if department has users
    const hasUsers = users.some(user => user.department_id === deptToDelete.id);
    if (hasUsers) {
      toast.error('无法删除：该部门下还有员工');
      setDeleteDeptDialogOpen(false);
      return;
    }

    const { error } = await deleteDepartment(deptToDelete.id);
    if (error) {
      toast.error(error.message || '删除失败，请确保部门为空');
    } else {
      toast.success('部门删除成功');
      // If deleted dept was selected, reset selection
      if (selectedDepartmentId === deptToDelete.id) setSelectedDepartmentId(null);
      fetchData();
    }
    setDeleteDeptDialogOpen(false);
    setDeptToDelete(null);
  };


  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">组织架构</h1>
          <p className="text-sm text-muted-foreground mt-1">管理并查看美洲研发中心的人员组成</p>
        </div>
      </div>

      {/* Split View Content */}
      <div className="flex flex-1 items-stretch gap-6 h-full overflow-hidden border rounded-xl bg-card shadow-sm">

        {/* Left: Department Tree */}
        <div className="w-[280px] flex flex-col border-r bg-muted/5/30">
          <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card/50 backdrop-blur-sm z-10">
            <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">部门结构</span>
            {selectedDepartmentId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedDepartmentId(null)}
              >
                查看全部
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 p-3">
            <div className="space-y-1">
              {/* "All" Node */}
              <div
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors mb-2",
                  selectedDepartmentId === null ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                )}
                onClick={() => setSelectedDepartmentId(null)}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">全部成员</span>
                <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">{users.length}</Badge>
              </div>

              <Separator className="my-2" />

              {/* Dept Tree Roots */}
              {level1Departments.map(dept => (
                <DeptTreeNode
                  key={dept.id}
                  dept={dept}
                  departments={departments}
                  selectedDepartmentId={selectedDepartmentId}
                  setSelectedDepartmentId={setSelectedDepartmentId}
                  isAdmin={isAdmin}
                  onAddSub={handleOpenAddDept}
                  onEdit={handleOpenEditDept}
                  onDelete={handleDeleteDeptClick}
                />
              ))}

              {level1Departments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">暂无部门</div>
              )}
            </div>
          </ScrollArea>

          {isAdmin && (
            <div className="p-3 border-t bg-muted/10">
              <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-primary" onClick={() => handleOpenAddDept(null)}>
                <Plus className="w-4 h-4 mr-2" />
                添加一级部门
              </Button>
            </div>
          )}
        </div>

        {/* Right: Member List */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* List Toolbar */}
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={selectedDepartmentId
                    ? `在 ${departments.find(d => d.id === selectedDepartmentId)?.name || '未知部门'} 中搜索...`
                    : "搜索姓名、工号、部门..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {isAdmin && (
              <Button onClick={handleOpenAddMember} className="gap-2 shrink-0 h-9">
                <Plus className="w-4 h-4" />
                添加成员
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[30%]">姓名 & 邮箱</TableHead>
                  <TableHead>工号</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>职位</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-[300px] text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-10 h-10 opacity-20" />
                        <p>暂无相关成员</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map(staff => (
                    <TableRow key={staff.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-primary-foreground">
                              {staff.username.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{staff.username}</p>
                            <p className="text-xs text-muted-foreground truncate">{staff.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{staff.employee_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal font-mono text-xs">
                          {staff.department_name}
                          {!staff.department_name && <span className="text-muted-foreground/50">无部门</span>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select
                            defaultValue={staff.role}
                            onValueChange={(newRole) => handleRoleChange(staff.id, newRole)}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="super_admin" className="text-xs">系统运维</SelectItem>
                              <SelectItem value="manager" className="text-xs">管理员</SelectItem>
                              <SelectItem value="editor" className="text-xs">协作成员</SelectItem>
                              <SelectItem value="viewer" className="text-xs">只读成员</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn(
                            "capitalize text-xs font-normal",
                            staff.role === 'manager' && "border-primary/50 text-primary bg-primary/5",
                            staff.role === 'super_admin' && "border-purple-500/50 text-purple-600 bg-purple-50"
                          )}>
                            {staff.role === 'super_admin' && '系统运维'}
                            {staff.role === 'manager' && '管理员'}
                            {staff.role === 'editor' && '协作成员'}
                            {staff.role === 'viewer' && '只读成员'}
                            {!['super_admin', 'manager', 'editor', 'viewer'].includes(staff.role) && staff.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(staff)}>
                                <Eye className="w-4 h-4 mr-2" /> 查看详情
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleOpenEditMember(staff)}>
                                <Edit2 className="w-4 h-4 mr-2" /> 编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick(staff.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> 删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 border-t bg-muted/5 text-xs text-muted-foreground flex justify-between">
            <span>共 {filteredStaff.length} 位成员</span>
            {selectedDepartmentId && (
              <span>
                当前部门: {departments.find(d => d.id === selectedDepartmentId)?.name} (ID: {selectedDepartmentId})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- Dialogs --- */}

      {/* 1. Member Dialog */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑成员' : '添加成员'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">姓名</Label>
              <Input
                id="username"
                value={memberFormData.username}
                onChange={(e) => setMemberFormData({ ...memberFormData, username: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee_id" className="text-right">工号</Label>
              <Input
                id="employee_id"
                value={memberFormData.employee_id}
                onChange={(e) => setMemberFormData({ ...memberFormData, employee_id: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={memberFormData.email}
                onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">部门</Label>
              <Select
                value={memberFormData.department_id}
                onValueChange={(value) => setMemberFormData({ ...memberFormData, department_id: value })}
                disabled={!isSuperAdmin && !!editingUser} // Only SuperAdmin can move existing employees (Create is flexible or restricted too? Prompt says 'move' behavior, implies existing)
              // If create, maybe manager can add to their own dept? 
              // Let's restrict 'move' (edit) specifically.
              // Actually user said 'move employee behavior... System Ops can operate'.
              // Safest to restrict editing department for existing users.
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    <span className="text-muted-foreground italic">无部门</span>
                  </SelectItem>
                  {hierarchicalDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      <span className="flex items-center gap-2">
                        {Array.from({ length: dept.depth }).map((_, i) => (
                          <span key={i} className="w-3 border-l h-3 ml-1" />
                        ))}
                        {dept.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">角色</Label>
              <Select
                value={memberFormData.role}
                onValueChange={(value) => setMemberFormData({ ...memberFormData, role: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">系统运维 (Super Admin)</SelectItem>
                  <SelectItem value="manager">管理员 (Admin)</SelectItem>
                  <SelectItem value="editor">协作成员 (Editor)</SelectItem>
                  <SelectItem value="viewer">只读成员 (Viewer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                {editingUser ? '重置密码' : '密码'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={editingUser ? '留空表示不修改' : '输入密码'}
                value={memberFormData.password}
                onChange={(e) => setMemberFormData({ ...memberFormData, password: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmitMember}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Department Form Dialog */}
      <Dialog open={isDeptFormOpen} onOpenChange={setIsDeptFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingDept ? '编辑部门' : '创建部门'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid items-center gap-2">
              <Label htmlFor="dept-name">部门名称</Label>
              <Input
                id="dept-name"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                placeholder="输入部门名称"
              />
            </div>

            <div className="grid items-center gap-2">
              <Label htmlFor="parent-dept">上级部门</Label>
              <Select
                value={deptFormData.parent_id}
                onValueChange={(value) => setDeptFormData({ ...deptFormData, parent_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择上级部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    <span className="text-muted-foreground italic">无 (设为一级部门)</span>
                  </SelectItem>
                  {hierarchicalDepartments.map((dept) => (
                    <SelectItem
                      key={dept.id}
                      value={dept.id.toString()}
                      disabled={editingDept?.id === dept.id}
                    >
                      <span className="flex items-center gap-2">
                        {Array.from({ length: dept.depth }).map((_, i) => (
                          <span key={i} className="w-3 border-l h-3 ml-1" />
                        ))}
                        {dept.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeptFormOpen(false)}>取消</Button>
            <Button onClick={handleSubmitDept}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User 360 Dialog */}
      <UserDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        user={detailUser}
      />
      {/* User Deletion Alert Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该成员?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。该成员将被永久删除，其个人数据可能由于关联约束而无法直接删除，建议先禁用账号。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserDialogOpen(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMember} className="bg-destructive hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Department Deletion Alert Dialog */}
      <AlertDialog open={deleteDeptDialogOpen} onOpenChange={setDeleteDeptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除部门 "{deptToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ 请注意：只有当该部门下没有员工且没有子部门时才能删除成功。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDeptDialogOpen(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDept} className="bg-destructive hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Extracted Component to prevent re-mounting on parent render
function DeptTreeNode({
  dept,
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  isAdmin,
  onAddSub,
  onEdit,
  onDelete
}: {
  dept: any,
  departments: any[],
  selectedDepartmentId: number | null,
  setSelectedDepartmentId: (id: number | null) => void,
  isAdmin: boolean,
  onAddSub: (id: number, e: React.MouseEvent) => void,
  onEdit: (dept: any, e: React.MouseEvent) => void,
  onDelete: (dept: any, e: React.MouseEvent) => void
}) {
  const children = departments.filter(d => d.parent_id === dept.id);
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedDepartmentId === dept.id;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors mb-0.5",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
        )}
        onClick={() => setSelectedDepartmentId(isSelected ? null : dept.id)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {children.length > 0 ? (
            <div
              className="p-0.5 hover:bg-muted rounded-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </div>
          ) : <div className="w-4" />}

          <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "fill-primary/20" : "fill-none text-muted-foreground")} />
          <span className="text-sm truncate font-medium">{dept.name}</span>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => onAddSub(dept.id, e)}>
                <Plus className="w-3.5 h-3.5 mr-2" /> 添加子部门
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => onEdit(dept, e)}>
                <Edit2 className="w-3.5 h-3.5 mr-2" /> 编辑部门
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => onDelete(dept, e)}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> 删除部门
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div className="pl-4 border-l border-border/40 ml-2.5 mt-0.5">
          {children.map(child => (
            <DeptTreeNode
              key={child.id}
              dept={child}
              departments={departments}
              selectedDepartmentId={selectedDepartmentId}
              setSelectedDepartmentId={setSelectedDepartmentId}
              isAdmin={isAdmin}
              onAddSub={onAddSub}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
