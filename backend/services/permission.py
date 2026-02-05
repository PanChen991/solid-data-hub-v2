from sqlmodel import Session, select
from models import User, Folder, Document, SpaceType, Role, ProjectRole, CollaboratorRole, Project, ProjectMember, Collaborator, Department
from typing import Union, Optional

class PermissionService:
    def __init__(self, session: Session):
        self.session = session

    def _get_collaborator_role(self, user: User, folder: Folder) -> Optional[CollaboratorRole]:
        """
        Recursive check for collaborator role up the folder tree (Inheritance).
        """
        current = folder
        # Limit depth to prevent issues with cycles or deep trees (infinite hierarchy but practical limit)
        for _ in range(10): 
            if not current:
                break
                
            stmt = select(Collaborator).where(
                Collaborator.user_id == user.id,
                Collaborator.folder_id == current.id
            )
            collab = self.session.exec(stmt).first()
            if collab:
                return collab.role
            
            if current.parent_id:
                current = self.session.get(Folder, current.parent_id)
            else:
                break
        return None

    def check_permission(self, user: User, resource: Union[Folder, Document], action: str) -> bool:
        """
        Refactored Unified Permission System.
        Action: 'read' or 'write'
        """
        # 1. SuperAdmin (God Mode)
        if user.role == Role.SUPER_ADMIN:
            return True

        # 2. Ownership (Author of Doc or Owner of Folder)
        # Author/Owner always has full permissions
        if isinstance(resource, Document):
            if resource.author_id == user.id:
                return True
        elif isinstance(resource, Folder):
            if resource.owner_id == user.id:
                return True

        # Resolve Folder from Document if needed
        folder = resource if isinstance(resource, Folder) else resource.folder
        
        if not folder:
            # If no folder, it's at the absolute root. 
            # In our system, absolute root files are considered PUBLIC.
            if action == 'read':
                # If it's restricted, only the author (checked root above) or SuperAdmin sees it.
                is_restricted = getattr(resource, 'is_restricted', False)
                return not is_restricted
            return False 

        space_type = str(folder.space_type).lower()
        
        # 3. Check Collaborator White List (with Inheritance)
        collab_role = self._get_collaborator_role(user, folder)
        if collab_role:
            # Handle Enum or string
            raw_role = collab_role.value if hasattr(collab_role, 'value') else str(collab_role)
            c_role_str = raw_role.lower()
            
            if c_role_str in ['editor', 'admin']:
                return True
            if c_role_str == 'viewer':
                if action == 'read':
                    return True
        
        # 4. Space Specific Logic
        if space_type == 'project':
            return self._check_project_permission(user, folder, action)
        elif space_type == 'public':
            return self._check_public_permission(user, folder, action)
        else: # Department or Default
            return self._check_department_permission(user, folder, action, resource)

    def get_effective_role(self, user: User, resource: Union[Folder, Document]) -> str:
        """
        Returns 'admin', 'editor', or 'viewer' for the UI.
        """
        if user.role == Role.SUPER_ADMIN:
            return 'admin'
        
        # Ownership
        if isinstance(resource, Document):
            if resource.author_id == user.id: return 'admin'
        elif isinstance(resource, Folder):
            if resource.owner_id == user.id: return 'admin'

        # Resolve Folder for collaborator check
        folder = resource if isinstance(resource, Folder) else resource.folder
        
        if not folder:
            # Root documents? Use check_permission as fallback for logic
            return 'editor' if self.check_permission(user, resource, 'write') else 'viewer'

        # Check Collaborator (with Inheritance)
        collab_role = self._get_collaborator_role(user, folder)
        if collab_role:
            # Handle Enum or string
            raw_role = collab_role.value if hasattr(collab_role, 'value') else str(collab_role)
            c_role_str = raw_role.lower()
            
            if c_role_str == 'admin':
                return 'admin'
            if c_role_str == 'editor':
                return 'editor'
            if c_role_str == 'viewer':
                return 'viewer'

        # Space Logic for role
        if self.check_permission(user, resource, 'write'):
            return 'editor'
            
        return 'viewer'

    def _check_project_permission(self, user: User, folder: Folder, action: str) -> bool:
        """
        Project Logic: Ignore department/collaborator table. Only ProjectMember.
        """
        # 1. Find the Project this folder belongs to.
        # This requires traversing up to the root folder of the project, which is linked to Project table.
        # Or querying Project where root_folder_id is one of the ancestors.
        
        # Optimization: Maybe Project is linked to Folder? 
        # Current Schema: Project -> root_folder_id. 
        # So we need to find if 'folder' is a descendant of any Project's root_folder.
        # This traversal can be expensive. 
        # Alternative: We add `project_id` to Folder? Use `department_id`?
        # The prompt says "Project Space - Independent Kingdom".
        # Let's assume for now we can find the project.
        
        # FOR MVP: We assume the folder ITSELF might be the root or we traverse parents.
        # To avoid complex traversal in every check, usually we denormalize project_id.
        # BUT adhering to provided schema, we traverse.
        
        current = folder
        project = None
        while current:
            # Check if this folder is a project root
            statement = select(Project).where(Project.root_folder_id == current.id)
            project = self.session.exec(statement).first()
            if project:
                break
            if not current.parent_id:
                break
            # Fetch parent
            current = self.session.get(Folder, current.parent_id)
            
        if not project:
            # If no project found, check if it's the specific "Project Space" root folder
            # The root folder "02_项目协作空间" is space_type=PROJECT but belongs to no project.
            # It should be visible to everyone (or at least Admin).
            # If user is traversing root folders, they need to see this container.
            
            # Simple check: If it has no parent and is type PROJECT, allow Read for all internal users?
            # Or check owner (Admin).
            
            if not folder.parent_id and folder.space_type == SpaceType.PROJECT:
                 # This is the "Root Container" for all projects.
                 # Allow all logged in users to SEE it (Read), but only Admin can Write (create projects/folders in root).
                 if action == 'read':
                     return True
                 if action == 'write':
                     return user.role == Role.SUPER_ADMIN
            
            return False
            
        # 2. Check ProjectMember
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id
        )
        member = self.session.exec(stmt).first()
        
        if not member:
            return False
            
        if member.role == ProjectRole.ADMIN:
            return True
        if member.role == ProjectRole.EDITOR:
            return True # Both read and write
        if member.role == ProjectRole.VIEWER:
            return action == 'read'
            
        return False

    def _check_public_permission(self, user: User, folder: Folder, action: str) -> bool:
        if action == 'read':
            return True # Open to all logged-in users
        
        # Write: SuperAdmin or Owner
        if user.role == Role.SUPER_ADMIN:
            return True
        if folder.owner_id == user.id:
            return True
        
        return False

    def _check_department_permission(self, user: User, folder: Folder, action: str, resource: Union[Folder, Document]) -> bool:
        """
        Department Logic: SuperAdmin OR Owner OR Dept Member OR Collaborator
        """
        # 1. SuperAdmin
        if user.role == Role.SUPER_ADMIN:
            return True

        # Special Case: Root of Department Space (01_职能部门空间)
        # ID 2 is the root. Or check if it has no parent and is Dept Space.
        # Allow Read for all internal users to navigate.
        if folder.parent_id is None and folder.space_type == SpaceType.DEPARTMENT:
            if action == 'read':
                return True
            # If write, fall through to Owner check or strict Admin check.

            
        # 2. Owner
        # Check resource ownership (Document author or Folder owner)
        if isinstance(resource, Document):
            if resource.author_id == user.id: return True
        elif isinstance(resource, Folder):
            if resource.owner_id == user.id: return True
            
        # Check Restricted Status
        # If restricted, skip Department-wide checks (including Manager Downward).
        # Access falls through to Collaborator check (Step 4) if not Owner/Admin.
        is_restricted = getattr(resource, 'is_restricted', False)

        # 3. Department Member (Only if NOT restricted)
        # Folder department match
        if not is_restricted and folder.department_id is not None:
             # STRICT WRITE CONTROL: If action is WRITE, Viewers are DENIED.
             # Only Manager (Admin) or Editor (Collaborator) can write.
             if action == 'write' and user.role == Role.VIEWER:
                 return False

             # If not restricted, Department Members get access.
             # For 'read', all members allowed (passed above/implicit).
             # For 'write', we filtered Viewer, so Manager/Editor allowed.
             # Wait, logic check:
             # If I am an Editor in Dept A, and this folder is in Dept A.
             # I matched "folder.department_id == user.department_id".
             # So I return True.
             # Correct.
             
             # Exact match
             if folder.department_id == user.department_id:
                 return True
             
             # Hierarchy match (Parent Dept sees Child Dept)
             # ... (existing hierarchy logic)
             current_dept_id = user.department_id
             # Limit depth to avoid infinite loops (though DAG expected)
             for _ in range(5): 
                 if current_dept_id is None:
                     break
                 dept = self.session.get(Department, current_dept_id)
                 if not dept:
                     break
                 if dept.parent_id == folder.department_id:
                     return True
                 current_dept_id = dept.parent_id

             # NEW: Manager Downward Access (Parent Manager sees Child)
             # If User is MANAGER, check if Folder's Dept is a sub-department of User's Dept
             if user.role == Role.MANAGER:
                 # Traverse up from FOLDER'S department to see if we hit USER'S department
                 check_dept_id = folder.department_id
                 for _ in range(10): # Depth limit
                     if check_dept_id is None:
                         break
                     if check_dept_id == user.department_id:
                         return True # Found! User's dept is ancestor of Folder's dept
                     
                     dept_obj = self.session.get(Department, check_dept_id)
                     if not dept_obj:
                         break
                     check_dept_id = dept_obj.parent_id

        return False
