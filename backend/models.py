from typing import List, Optional
from datetime import datetime
from enum import Enum
from sqlmodel import Field, Relationship, SQLModel

class Role(str, Enum):
    SUPER_ADMIN = "super_admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"

class SpaceType(str, Enum):
    # FORCE definition to ensure lowercase values
    PUBLIC = "public"
    DEPARTMENT = "department"
    PROJECT = "project"

class CollaboratorRole(str, Enum):
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"

class ProjectRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

class Department(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="department.id")
    
    users: List["User"] = Relationship(back_populates="department")
    folders: List["Folder"] = Relationship(
        back_populates="department",
        sa_relationship_kwargs={"foreign_keys": "Folder.department_id"}
    )
    root_folder_id: Optional[int] = Field(default=None, foreign_key="folder.id")
    root_folder: Optional["Folder"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Department.root_folder_id"}
    )

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    employee_id: Optional[str] = Field(default=None, index=True)
    email: Optional[str] = Field(default=None)
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    role: Role = Field(default=Role.VIEWER)
    
    department: Optional[Department] = Relationship(back_populates="users")
    documents: List["Document"] = Relationship(back_populates="author")
    owned_folders: List["Folder"] = Relationship(back_populates="owner")
    
    # Relationships for collaboration
    collaborations: List["Collaborator"] = Relationship(back_populates="user")
    project_memberships: List["ProjectMember"] = Relationship(back_populates="user")

class Folder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="folder.id")
    # Relaxed type to str to avoid Enum mapping issues with existing data
    space_type: str = Field(default="public")
    is_locked: bool = Field(default=False)
    is_restricted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # New fields
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id")
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    
    # Relationships
    parent: Optional["Folder"] = Relationship(
        back_populates="children", 
        sa_relationship_kwargs={"remote_side": "Folder.id"}
    )
    children: List["Folder"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    
    owner: Optional[User] = Relationship(back_populates="owned_folders")
    department: Optional[Department] = Relationship(
        back_populates="folders",
        sa_relationship_kwargs={"foreign_keys": "Folder.department_id"}
    )
    
    documents: List["Document"] = Relationship(back_populates="folder", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    collaborators: List["Collaborator"] = Relationship(back_populates="folder", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    # Note: A Project logic root folder might link back to a project, but we handle that in Project model

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    
    # Replaces file_url in logic, though we might keep file_url or computed property
    oss_key: str 
    file_type: str
    size: int = Field(default=0)
    is_deleted: bool = Field(default=False)
    is_restricted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    folder_id: Optional[int] = Field(default=None, foreign_key="folder.id")
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    folder: Optional[Folder] = Relationship(back_populates="documents")
    author: Optional[User] = Relationship(back_populates="documents")
    collaborators: List["Collaborator"] = Relationship(back_populates="document", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Collaborator(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    folder_id: Optional[int] = Field(default=None, foreign_key="folder.id")
    document_id: Optional[int] = Field(default=None, foreign_key="document.id")
    role: CollaboratorRole = Field(default=CollaboratorRole.VIEWER)
    
    user: User = Relationship(back_populates="collaborations")
    folder: Optional[Folder] = Relationship(back_populates="collaborators")
    document: Optional[Document] = Relationship(back_populates="collaborators")

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE)
    root_folder_id: int = Field(foreign_key="folder.id")
    
    # We can link the root folder directly. 
    # Note: Folder doesn't strictly need a back-populates to Project unless we want to access project from folder easily.
    # But usually we access Folder from Project. 
    
    members: List["ProjectMember"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ProjectMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    user_id: int = Field(foreign_key="user.id")
    role: ProjectRole = Field(default=ProjectRole.VIEWER)
    
    project: Project = Relationship(back_populates="members")
    user: User = Relationship(back_populates="project_memberships")
