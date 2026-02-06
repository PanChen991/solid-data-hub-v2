from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from pydantic import BaseModel
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, SQLModel
from typing import List, Optional, Union
from datetime import datetime
from database import get_session, create_db_and_tables
from models import User, Document, Folder, Department, Project
from auth_utils import verify_password, create_access_token, get_password_hash
from jose import jwt
from auth_utils import SECRET_KEY, ALGORITHM
import shutil
import os
import uuid
import zipfile
import io
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from services.storage import StorageService
from services.permission import PermissionService
from services.permission import PermissionService
from models import Role, SpaceType, ProjectMember, ProjectRole, Collaborator, CollaboratorRole
from fastapi.staticfiles import StaticFiles
import mimetypes

# Fix for Docker/Slim images missing mime types
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')

# Ensure uploads directory exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app = FastAPI(title="Solid Data Hub API")
if os.path.exists(UPLOAD_DIR):
    app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="static")

# Force Reload Trigger (Update)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Ensure uploads directory exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_superuser(current_user: User = Depends(get_current_user)):
    from models import Role
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user

@app.post("/documents", response_model=Document)
async def create_document(
    file: UploadFile = File(...),
    folder_id: str = Form(...),
    is_restricted: bool = Form(False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Handle 'dept-X' ID format from frontend
    real_folder_id = None
    
    if folder_id.startswith('dept-'):
        try:
            dept_id = int(folder_id.replace('dept-', ''))
            # Find the department first
            dept = session.get(Department, dept_id)
            if not dept:
                 raise HTTPException(status_code=404, detail=f"Department {dept_id} not found")
            
            real_folder_id = dept.root_folder_id
            if not real_folder_id:
                # Fallback: Find ANY folder for this dept (legacy behavior, but safer to error if no root)
                folder = session.exec(select(Folder).where(Folder.department_id == dept_id)).first()
                if not folder:
                     raise HTTPException(status_code=404, detail=f"No root folder found for department {dept_id}")
                real_folder_id = folder.id
            
            folder = session.get(Folder, real_folder_id)
            if not folder:
                 raise HTTPException(status_code=404, detail=f"Target folder {real_folder_id} not found")

        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid department ID format")
    else:
        try:
            real_folder_id = int(folder_id)
            folder = session.get(Folder, real_folder_id)
            if not folder:
                raise HTTPException(status_code=404, detail="Folder not found")
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid folder ID format")

    if not real_folder_id:
         raise HTTPException(status_code=400, detail="Valid Folder ID is required")
        
        
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, folder, 'write'):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Generate OSS Key
    oss_key = StorageService.generate_oss_key(file.filename)
    
    # STRICT ENFORCEMENT: Force restricted if parent is restricted
    if folder.is_restricted:
        is_restricted = True
    
    # Ensure directory exists (Mock OSS)
    # Save file and calculate size
    try:
        content = await file.read()
        file_size = len(content)
        success = StorageService.upload_file(oss_key, content)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
        
    # Determine file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_type = file_ext[1:] if file_ext else 'unknown'

    # Check for duplicate file name in the same folder
    existing_doc = session.exec(select(Document).where(
        Document.name == file.filename,
        Document.folder_id == real_folder_id,
        Document.is_deleted == False # Only check active files
    )).first()

    if existing_doc:
        raise HTTPException(status_code=400, detail="File with this name already exists in this location")

    doc = Document(
        name=file.filename,
        oss_key=oss_key,
        file_type=file_type,
        size=file_size,
        folder_id=real_folder_id,
        author_id=current_user.id,
        is_restricted=is_restricted
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    session.refresh(doc)
    return doc

# --- NEW: Frontend Direct Upload Endpoints ---

class DocumentRead(BaseModel):
    id: int
    name: str
    oss_key: str
    file_type: str
    size: int
    folder_id: Optional[int] = None
    author_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    is_restricted: bool

class UploadTokenRequest(BaseModel):
    filename: str
    file_size: int
    folder_id: int
    content_type: str = "application/octet-stream"

class UploadTokenResponse(BaseModel):
    upload_url: str
    oss_key: str
    method: str

@app.post("/files/upload-token", response_model=UploadTokenResponse)
async def get_upload_token(
    req: UploadTokenRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Get Presigned URL for Direct Upload
    """
    # 1. Validate Target Folder & Permissions
    folder = session.get(Folder, req.folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Target folder not found")
        
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, folder, 'write'):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    # 2. Check Duplicates
    existing = session.exec(select(Document).where(
        Document.folder_id == req.folder_id,
        Document.name == req.filename,
        Document.is_deleted == False
    )).first()
    if existing:
        raise HTTPException(status_code=409, detail="File already exists") # 409 Conflict

    # 3. Generate Key & URL
    oss_key = StorageService.generate_oss_key(req.filename)
    url = StorageService.generate_upload_url(oss_key, req.content_type)
    
    return UploadTokenResponse(
        upload_url=url,
        oss_key=oss_key,
        method="PUT"
    )

class UploadCompleteRequest(BaseModel):
    oss_key: str
    filename: str
    folder_id: int
    file_size: int
    is_restricted: bool = False

@app.post("/files/upload-complete", response_model=DocumentRead)
async def complete_upload(
    req: UploadCompleteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Step 3: Finalize Upload (Create DB Record)
    """
    # 1. Validate Folder
    folder = session.get(Folder, req.folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    # 2. Duplicate Check again to be safe
    existing = session.exec(select(Document).where(
        Document.folder_id == req.folder_id,
        Document.name == req.filename,
        Document.is_deleted == False
    )).first()
    if existing:
         raise HTTPException(status_code=409, detail="File already exists")

    # 3. Create Document Record
    file_type = "unknown"
    ext = os.path.splitext(req.filename)[1].lower()
    if ext: file_type = ext[1:]

    new_doc = Document(
        name=req.filename,
        folder_id=req.folder_id,
        author_id=current_user.id,
        oss_key=req.oss_key,
        file_type=file_type,
        size=req.file_size,
        version=1,
        is_restricted=req.is_restricted or folder.is_restricted, 
    )
    
    session.add(new_doc)
    session.commit()
    session.refresh(new_doc)
    
    return new_doc

# --- Local Dev: PUT Handler ---
@app.put("/files/local-upload/{oss_key:path}")
async def local_upload_handler(
    oss_key: str,
    request: Request
):
    """
    Handle 'direct upload' for local dev environment.
    Mimics OSS PUT behavior.
    """
    # Stream payload to file
    local_path = os.path.join("uploads", oss_key)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    
    body = await request.body()
    with open(local_path, "wb") as f:
        f.write(body)
        
    return {"status": "ok"}


class SharedResourceItem(SQLModel):
    type: str # "folder" or "document"
    id: int
    name: str
    size: Optional[int] = None
    file_type: Optional[str] = None
    role: str # "viewer" or "editor"
    owner_name: str

@app.get("/documents/shared-with-me", response_model=List[SharedResourceItem])
async def get_shared_documents(
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    shared_items = []

    # 1. Get Shared Documents
    doc_stmt = select(Document, Collaborator, User).join(Collaborator, Collaborator.document_id == Document.id).join(User, Document.author_id == User.id).where(
        Collaborator.user_id == current_user.id
    )
    doc_results = session.exec(doc_stmt).all()
    
    for doc, collab, owner in doc_results:
        shared_items.append(SharedResourceItem(
            type="document",
            id=doc.id,
            name=doc.name,
            size=doc.size,
            file_type=doc.file_type,
            role=collab.role,
            owner_name=owner.username
        ))

    # 2. Get Shared Folders
    folder_stmt = select(Folder, Collaborator, User).join(Collaborator, Collaborator.folder_id == Folder.id).join(User, Folder.owner_id == User.id).where(
        Collaborator.user_id == current_user.id
    )
    folder_results = session.exec(folder_stmt).all()

    for folder, collab, owner in folder_results:
        # Filter: Do not show Public Root Folders in "Shared with me" 
        # (They are system spaces, shouldn't appear even if shared)
        if folder.space_type == SpaceType.PUBLIC and folder.parent_id is None:
            continue
            
        shared_items.append(SharedResourceItem(
            type="folder",
            id=folder.id,
            name=folder.name,
            size=0,
            file_type=None,
            role=collab.role,
            owner_name=owner.username
        ))

    return shared_items




@app.get("/documents/{document_id}/url")
async def get_document_url(
    document_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Permission Check (Read)
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, doc, 'read'):
         raise HTTPException(status_code=403, detail="Permission denied")
         
    return {"url": StorageService.get_presigned_url(doc.oss_key)}

@app.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: int,
    token: Optional[str] = None,
    session: Session = Depends(get_session),
    # Remove Depends(get_current_user) to prevent auto-401 for missing header
):
    """
    Download/Serve the actual file content.
    - Check Read Permission
    - Serve local file if exists (FileResponse)
    - Redirect to OSS URL if not local (RedirectResponse)
    """
    user = None
    
    # Authenticate via query param token
    if token:
        try:
             payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
             username: str = payload.get("sub")
             if username:
                 user = session.exec(select(User).where(User.username == username)).first()
        except Exception:
            pass
            
    if not user:
         raise HTTPException(status_code=401, detail="Not authenticated")

    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(user, doc, 'read'):
         raise HTTPException(status_code=403, detail="Permission denied")

    # Construct local path
    if doc.oss_key.startswith(f"{UPLOAD_DIR}/"):
        local_path = doc.oss_key
    else:
        local_path = os.path.join(UPLOAD_DIR, doc.oss_key)
    
    # If file exists locally, serve it
    if os.path.exists(local_path):
        return FileResponse(local_path, filename=doc.name, content_disposition_type="attachment")
    
    
    # If not local, try OSS Redirection
    url = StorageService.get_presigned_url(doc.oss_key)
    return RedirectResponse(url)

@app.get("/folders/{folder_id}/zip")
async def get_folder_zip(
    folder_id: int, 
    token: Optional[str] = None, 
    session: Session = Depends(get_session)
):
    """
    Download a folder as a ZIP archive.
    Recursive traversal of subfolders.
    """
    user = None
    if token:
         try:
             payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
             username: str = payload.get("sub")
             if username:
                 user = session.exec(select(User).where(User.username == username)).first()
         except Exception:
             pass
             
    if not user:
         raise HTTPException(status_code=401, detail="Not authenticated")

    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    perm_service = PermissionService(session)
    if not perm_service.check_permission(user, folder, 'read'):
        raise HTTPException(status_code=403, detail="Permission denied")

    # In-memory ZIP buffer
    mem_zip = io.BytesIO()

    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Helper to add files recursively
        def add_folder_to_zip(folder_obj, current_path):
            # 1. Add Files
            files = session.exec(select(Document).where(Document.folder_id == folder_obj.id, Document.is_deleted == False)).all()
            for file in files:
                # ROBUST PATH RESOLUTION:
                # Handle cases where oss_key might unintentionally start with UPLOAD_DIR
                if file.oss_key.startswith(f"{UPLOAD_DIR}/"):
                    local_path = file.oss_key
                else:
                    local_path = os.path.join(UPLOAD_DIR, file.oss_key)
                
                archive_name = f"{current_path}/{file.name}"
                
                if os.path.exists(local_path):
                    zf.write(local_path, arcname=archive_name)
                else:
                    # Log missing file but DO NOT rename it to .txt
                    print(f"[Warning] File missing during zip: {local_path}")
                    # Keep original extension for the entry if we keep it, or just skip.
                    # Skipping is cleaner than a broken txt file.
                    pass

            # 2. Recurse Subfolders
            subfolders = session.exec(select(Folder).where(Folder.parent_id == folder_obj.id)).all()
            for sub in subfolders:
                # Check read permission for subfolder (Optional, but safer. Though usually implicit for Dept)
                # But for simplicity and speed, if you have Read on Parent, you usually see Children in Dept space.
                # However, safe approach:
                if perm_service.check_permission(user, sub, 'read'):
                    add_folder_to_zip(sub, f"{current_path}/{sub.name}")

        add_folder_to_zip(folder, folder.name)

    mem_zip.seek(0)
    
    # Filename encoding for Content-Disposition
    from urllib.parse import quote
    encoded_filename = quote(f"{folder.name}.zip")
    
    return StreamingResponse(
        iter([mem_zip.getvalue()]), 
        media_type="application/x-zip-compressed", 
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )


@app.delete("/documents/{document_id}")
async def delete_document(document_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    from models import Role # ensure import
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, doc, 'write'):
        raise HTTPException(status_code=403, detail="No write permission")
        
    # SAFE DELETION POLICY: Only Admin (Manager/Super) can delete others' files
    if current_user.role not in [Role.SUPER_ADMIN, Role.MANAGER]:
        if doc.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="Safe Deletion: You can only delete your own files.")
    
    # Remove file from disk
    # Use OSS Key to find file
    # SOFT DELETE: We do NOT delete from OSS. We just mark as deleted.
    # if doc.oss_key:
    #     StorageService.delete_file(doc.oss_key)
                
    doc.is_deleted = True
    session.add(doc)
    session.commit()
    return {"ok": True}

@app.get("/users")
async def read_users(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    department_id: Optional[int] = None,
    recursive: bool = True,
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    statement = select(User)
    if department_id:
        if recursive:
            # RECURSIVE: Get all descendant departments
            all_depts = session.exec(select(Department.id, Department.parent_id)).all()
            
            dept_tree = {}
            for d_id, p_id in all_depts:
                if p_id not in dept_tree:
                    dept_tree[p_id] = []
                dept_tree[p_id].append(d_id)
                
            target_ids = {department_id}
            queue = [department_id]
            while queue:
                current = queue.pop(0)
                if current in dept_tree:
                    children = dept_tree[current]
                    for child in children:
                         if child not in target_ids:
                             target_ids.add(child)
                             queue.append(child)
            
            
            statement = statement.where(User.department_id.in_(target_ids))
        else:
            # NON-RECURSIVE: Match exact department_id
            statement = statement.where(User.department_id == department_id)
            
    if q:
        statement = statement.where(User.username.contains(q))
    
    statement = statement.offset(skip).limit(limit)
    results = session.exec(statement)
    users = results.all()
    user_list = []
    for u in users:
        u_dict = u.dict()
        if u.department:
            u_dict["department_name"] = u.department.name
        else:
            u_dict["department_name"] = None
        user_list.append(u_dict)
    return user_list

from pydantic import BaseModel

class FolderAncestor(BaseModel):
    id: int
    name: str

class DocumentRead(BaseModel):
    id: int
    name: str
    oss_key: str
    file_type: str
    size: int
    folder_id: Optional[int]
    author_id: Optional[int]
    author_name: Optional[str] = None
    is_restricted: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    role: Optional[str] = None
    ancestors: List[FolderAncestor] = [] # Breadcrumbs for search context
    
    class Config:
        from_attributes = True

@app.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Permission Check
    perm_service = PermissionService(session)
    if perm_service.check_permission(current_user, doc, 'read'):
        # Populate role
        doc_dict = doc.dict()
        doc_dict['role'] = perm_service.get_effective_role(current_user, doc.folder if doc.folder else doc)
        
        return DocumentRead(**doc_dict)
    
    raise HTTPException(status_code=403, detail="Permission denied")

class ProjectRead(BaseModel):
    id: int
    name: str
    status: str
    root_folder_id: int
    owner_name: Optional[str] = None
    owner_id: Optional[int] = None
    role: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str
    employee_id: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    role: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    employee_id: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    role: Optional[str] = None

@app.post("/users", response_model=User)
async def create_user(
    user_in: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    from models import Role
    db_user = session.exec(select(User).where(User.username == user_in.username)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        employee_id=user_in.employee_id,
        email=user_in.email,
        department_id=user_in.department_id,
        role=Role(user_in.role)
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@app.put("/users/me", response_model=User)
async def update_self(
    user_in: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Allow users to update their own profile (e.g., password).
    """
    update_data = user_in.dict(exclude_unset=True)
    
    # Security: Users can only update their own password or basic info if needed.
    # Prevent changing role or department via this endpoint if not desired.
    # For now, we only care about password.
    if "role" in update_data:
        del update_data["role"] # Security: Cannot change own role
    if "department_id" in update_data:
        del update_data["department_id"] # Security: Cannot change own department
        
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

@app.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    from models import Role
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_in.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    if "role" in update_data:
        update_data["role"] = Role(update_data["role"])
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete self")
        
    session.delete(db_user)
    session.commit()
    return {"ok": True}

class DepartmentCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class DepartmentRead(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    root_folder_id: Optional[int] = None
    
    class Config:
        from_attributes = True

@app.get("/departments", response_model=List[DepartmentRead])
async def read_departments(
    parent_id: Optional[int] = None, 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    query = select(Department)
    if parent_id is not None:
        query = query.where(Department.parent_id == parent_id)
        
    results = session.exec(query).all()
    
    return [DepartmentRead.from_orm(dept) for dept in results]

@app.get("/departments/{department_id}", response_model=DepartmentRead)
async def read_department(
    department_id: int, 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    dept = session.get(Department, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return DepartmentRead.from_orm(dept)

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

@app.post("/departments", response_model=Department)
async def create_department(
    dept_in: DepartmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    # Check if parent exists
    if dept_in.parent_id:
        parent = session.get(Department, dept_in.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent department not found")
            
    # Check duplicate name under same parent
    statement = select(Department).where(
        Department.name == dept_in.name,
        Department.parent_id == dept_in.parent_id
    )
    if session.exec(statement).first():
        raise HTTPException(status_code=400, detail="Department name already exists in this level")

    dept = Department(name=dept_in.name, parent_id=dept_in.parent_id)
    session.add(dept)
    session.commit()
    session.refresh(dept)

    # --- AUTO-SYNC: Create corresponding folder ---
    try:
        parent_folder_id = None
        
        # Determine Parent Folder
        if dept.parent_id:
            # Normal Sub-Department, find Parent Department's root folder
            parent_dept = session.get(Department, dept.parent_id)
            if parent_dept and parent_dept.root_folder_id:
                parent_folder_id = parent_dept.root_folder_id
            else:
                # Fallback: find any folder belonging to parent dept
                parent_dept_folder = session.exec(select(Folder).where(Folder.department_id == dept.parent_id)).first()
                if parent_dept_folder:
                    parent_folder_id = parent_dept_folder.id
                else:
                    # Fallback to Root Department Space
                    root_dept_space = session.exec(select(Folder).where(Folder.space_type == SpaceType.DEPARTMENT, Folder.parent_id == None)).first()
                    if root_dept_space:
                        parent_folder_id = root_dept_space.id
        else:
            # Root Department -> Place in Root Department Space (Functional Space)
            root_dept_space = session.exec(select(Folder).where(Folder.space_type == SpaceType.DEPARTMENT, Folder.parent_id == None, Folder.department_id == None)).first()
            if root_dept_space:
                parent_folder_id = root_dept_space.id
        
        # Create Folder if we found a place to put it
        if parent_folder_id:
            new_folder = Folder(
                name=dept.name,
                parent_id=parent_folder_id,
                space_type=SpaceType.DEPARTMENT,
                department_id=dept.id,
                owner_id=current_user.id,
                is_restricted=False # Default to public within department
            )
            session.add(new_folder)
            session.commit()
            session.refresh(new_folder)
            
            # Sync root_folder_id back to Department
            dept.root_folder_id = new_folder.id
            session.add(dept)
            session.commit()
    except Exception as e:
        print(f"Error auto-creating folder for dept {dept.name}: {e}")

    return dept

@app.put("/departments/{dept_id}", response_model=Department)
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    dept = session.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = dept_in.dict(exclude_unset=True)
    
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        # Prevent circular dependency
        pid = update_data["parent_id"]
        if pid == dept_id:
            raise HTTPException(status_code=400, detail="Cannot set parent to self")
        # Check if new parent is a descendant of current dept (prevent loop)
        # Simple BFS/DFS check could be added here, but for now just Basic Check
        
    for field, value in update_data.items():
        setattr(dept, field, value)

    # Sync name change to linked folder
    if "name" in update_data:
        folder = session.exec(select(Folder).where(Folder.department_id == dept_id)).first()
        if folder:
            folder.name = update_data["name"]
            session.add(folder)

    session.add(dept)
    session.commit()
    session.refresh(dept)
    return dept

@app.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    dept = session.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    # Check for sub-departments
    if session.exec(select(Department).where(Department.parent_id == dept_id)).first():
         raise HTTPException(status_code=400, detail="Cannot delete department with sub-departments")
         
    # Check for members
    if session.exec(select(User).where(User.department_id == dept_id)).first():
         raise HTTPException(status_code=400, detail="Cannot delete department with members")

    session.delete(dept)
    session.commit()
    return {"ok": True}

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.post("/token")
@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    # Try finding by username first
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    # If not found, try finding by employee_id
    if not user:
        user = session.exec(select(User).where(User.employee_id == form_data.username)).first()
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    is_valid = verify_password(form_data.password, user.hashed_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    
    user_dict = user.dict()
    if user.department:
        user_dict["department_name"] = user.department.name
    else:
        user_dict["department_name"] = None
        
    return {"access_token": access_token, "token_type": "bearer", "user": user_dict}

@app.get("/auth/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    user_dict = current_user.dict()
    if current_user.department:
        user_dict["department_name"] = current_user.department.name
    else:
        user_dict["department_name"] = None
    return user_dict



class FolderRead(BaseModel):
    id: int
    name: str
    space_type: str
    parent_id: Optional[int]
    department_id: Optional[int]
    owner_id: Optional[int] = None
    is_locked: bool
    is_restricted: bool = False
    owner_name: Optional[str] = None
    role: str = "viewer"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ancestors: List[FolderAncestor] = []  # New Field
    project_id: Optional[int] = None
    
    class Config:
        from_attributes = True

from sqlalchemy import func

@app.get("/folders", response_model=List[FolderRead])
async def read_folders(
    q: Optional[str] = Query(None),
    parent_id: Optional[Union[int, str]] = Query(None), 
    space_type: Optional[str] = None, 
    department_id: Optional[int] = None,
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    # Resolve parent_id if it's a virtual ID (e.g. 'dept-9')
    real_parent_id = None
    if isinstance(parent_id, str) and parent_id.startswith('dept-'):
        try:
            target_dept_id = int(parent_id.replace('dept-', ''))
            dept = session.get(Department, target_dept_id)
            if dept and dept.root_folder_id:
                real_parent_id = dept.root_folder_id
            else:
                # Fallback
                target = session.exec(select(Folder).where(Folder.department_id == target_dept_id, Folder.parent_id == None)).first()
                if target:
                    real_parent_id = target.id
        except ValueError:
            pass
    elif parent_id is not None:
        if parent_id == 'public':
            real_parent_id = None
            space_type = 'public'
        elif parent_id == 'departments':
            real_parent_id = None
            space_type = 'department'
        elif parent_id == 'projects':
            real_parent_id = None
            space_type = 'project'
        else:
            try:
                real_parent_id = int(parent_id)
            except ValueError:
                pass
    
    # Join User to get owner_name, and Project to get project_id
    query = select(Folder, User.username, Project.id).join(User, Folder.owner_id == User.id, isouter=True).join(Project, Project.root_folder_id == Folder.id, isouter=True)
    
    if q:
        # Search Mode
        query = query.where(Folder.name.contains(q))
        if real_parent_id is not None:
             query = query.where(Folder.parent_id == real_parent_id)
        # If no parent_id -> Global Search
    elif real_parent_id is not None:
        query = query.where(Folder.parent_id == real_parent_id)
    elif parent_id is None or parent_id in ['public', 'departments', 'projects']:
        # Root query for specific space or global
        query = query.where(Folder.parent_id == None)
    else:
        # Invalid ID mapping to None
        query = query.where(Folder.parent_id == None)
    
    if space_type:
        # RAW SQL FALLBACK for robustness against ORM/Enum issues
        if space_type.lower() == 'public':
             from sqlalchemy import text
             # Manually select ID to get Folder objects? 
             # No, easier to just use text inside where
             query = query.where(text("lower(folder.space_type) = 'public'"))
        else:
             query = query.where(func.lower(Folder.space_type) == space_type.lower())
        
    if department_id:
        query = query.where(Folder.department_id == department_id)
        
    results = session.exec(query).all()
    
    # Filter by permission
    perm_service = PermissionService(session)
    accessible_folders = []
    
    for folder, username, project_id in results:
        # Check Read Permission
        if perm_service.check_permission(current_user, folder, 'read'):
            folder_dict = folder.dict()
            folder_dict['owner_name'] = username or "System"
            
            # Calculate Effective Role for UI
            folder_dict['role'] = perm_service.get_effective_role(current_user, folder)
            folder_dict['project_id'] = project_id
            
            # Calculate Ancestors (if searching)
            if q and folder.parent_id:
                ancestors = []
                current_parent_id = folder.parent_id
                for _ in range(10): # Depth Limit
                    if not current_parent_id: break
                    parent = session.get(Folder, current_parent_id)
                    if not parent: break
                    ancestors.insert(0, FolderAncestor(id=parent.id, name=parent.name))
                    current_parent_id = parent.parent_id
                folder_dict['ancestors'] = ancestors
                
            accessible_folders.append(FolderRead(**folder_dict))
            
    return accessible_folders


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[Union[int, str]] = None
    space_type: SpaceType = SpaceType.PUBLIC
    is_restricted: bool = False

@app.post("/folders", response_model=Folder)
async def create_folder(folder_in: FolderCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    real_parent_id = None
    
    # Resolve parent_id from string input (e.g. 'dept-9')
    if isinstance(folder_in.parent_id, str):
        if folder_in.parent_id == 'projects':
            real_parent_id = None
            # Ensure space type is correct if not strictly provided?
            # Usually frontend sends space_type correctly.
        elif folder_in.parent_id == 'public':
            real_parent_id = None
        elif folder_in.parent_id.startswith('dept-'):
            try:
                dept_id = int(folder_in.parent_id.replace('dept-', ''))
                dept = session.get(Department, dept_id)
                
                if dept and dept.root_folder_id:
                    real_parent_id = dept.root_folder_id
                else:
                     # Fallback: Find root folder by query
                     target = session.exec(select(Folder).where(Folder.department_id == dept_id, Folder.parent_id == None)).first()
                     if target:
                         real_parent_id = target.id
                     else:
                         raise HTTPException(status_code=404, detail="Department root folder not found")
            except ValueError:
                 raise HTTPException(status_code=400, detail="部门ID格式无效")
        else:
             # Try parsing as int string
             try:
                 real_parent_id = int(folder_in.parent_id)
             except ValueError:
                 raise HTTPException(status_code=400, detail="父目录ID格式无效")
            
    elif folder_in.parent_id is not None:
        real_parent_id = folder_in.parent_id

    # Create Folder Object
    # Check for duplicate name in the same location
    existing_folder = session.exec(select(Folder).where(
        Folder.name == folder_in.name, 
        Folder.parent_id == real_parent_id,
        Folder.space_type == folder_in.space_type # Optional: ensuring strict space check
    )).first()
    
    if existing_folder:
        raise HTTPException(status_code=400, detail="该位置已存在同名文件夹")

    folder = Folder(
        name=folder_in.name,
        parent_id=real_parent_id,
        space_type=folder_in.space_type,
        is_restricted=folder_in.is_restricted,
        owner_id=current_user.id
    )

    # Permission Check: Write access to Parent Folder
    perm_service = PermissionService(session)
    if folder.parent_id:
        parent = session.get(Folder, folder.parent_id)
        if not parent:
             raise HTTPException(status_code=404, detail="未找到父目录")
        if not perm_service.check_permission(current_user, parent, 'write'):
            raise HTTPException(status_code=403, detail="没有父目录的写入权限")
            
        # STRICT ENFORCEMENT: Force restricted if parent is restricted
        if parent.is_restricted:
            folder.is_restricted = True
            
        # INHERITANCE: Inherit Department context from parent
        # This fixes the issue where a sub-dept user creating a folder in parent-dept space
        # incorrectly narrowed the scope to their own sub-dept.
        if folder.space_type == SpaceType.DEPARTMENT and parent.department_id:
            folder.department_id = parent.department_id

    else:
        # Root folder creation: Only Admin or Special Logic
        if folder.space_type == SpaceType.DEPARTMENT and current_user.role == Role.VIEWER:
             raise HTTPException(status_code=403, detail="访客无法创建根目录")

    # Set department if in department space (Fallback to user's dept if not inherited)
    if folder.space_type == SpaceType.DEPARTMENT and not folder.department_id:
        folder.department_id = current_user.department_id
    
    session.add(folder)
    session.commit()
    session.refresh(folder)
    session.refresh(folder)
    return folder

@app.get("/folders/{folder_id}", response_model=FolderRead)
async def get_folder(folder_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Join User to get owner_name, Project to get project_id
    query = select(Folder, User.username, Project.id).join(User, Folder.owner_id == User.id, isouter=True).join(Project, Project.root_folder_id == Folder.id, isouter=True).where(Folder.id == folder_id)
    result = session.exec(query).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    folder, username, project_id = result
    
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, folder, 'read'):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    folder_dict = folder.dict()
    folder_dict['owner_name'] = username or "System"
    folder_dict['role'] = perm_service.get_effective_role(current_user, folder)
    folder_dict['project_id'] = project_id
    
    # Calculate Ancestors (Breadcrumbs)
    ancestors = []
    current_parent_id = folder.parent_id
    
    # Limit depth to prevent infinite loops (e.g. 10 levels)
    for _ in range(10):
        if not current_parent_id:
            break
        parent = session.get(Folder, current_parent_id)
        if parent:
            # Check read permission for parent? 
            # Usually users can see breadcrumbs even if they don't have explicit access to intermediate folders?
            # Or at least they should see names.
            # For simplicity, we just add name/id.
            ancestors.insert(0, FolderAncestor(id=parent.id, name=parent.name)) # Push to front
            current_parent_id = parent.parent_id
        else:
            break
            
    folder_dict['ancestors'] = ancestors
    
    return FolderRead(**folder_dict)



@app.get("/documents/{document_id}", response_model=Document)
async def get_document(document_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, doc, 'read'):
         raise HTTPException(status_code=403, detail="Permission denied")
         
    return doc

@app.put("/folders/{folder_id}", response_model=Folder)
async def update_folder(folder_id: int, folder_data: Folder, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, folder, 'write'):
        raise HTTPException(status_code=403, detail="No write permission")
    
    folder.name = folder_data.name
    # Update restricted status if provided (and allowed? For now allow owner to toggle)
    if hasattr(folder_data, 'is_restricted'): # Basic check, though Schema might not have it in Pydantic model yet if not updated. 
        # Actually Folder model has it.
        folder.is_restricted = folder_data.is_restricted

    session.add(folder)
    session.commit()
    session.refresh(folder)
    session.refresh(folder)
    return folder

@app.put("/documents/{document_id}", response_model=Document)
async def update_document(
    document_id: int, 
    doc_in: Document, 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, doc, 'write'):
        raise HTTPException(status_code=403, detail="No write permission")
    
    # Update fields
    if doc_in.name:
        doc.name = doc_in.name
    
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc

@app.delete("/folders/{folder_id}")
async def delete_folder(folder_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    # Permission Check
    perm_service = PermissionService(session)
    if not perm_service.check_permission(current_user, folder, 'write'):
        raise HTTPException(status_code=403, detail="No write permission")

    # SAFE DELETION POLICY: Only Admin (Manager/Super) can delete others' folders
    from models import Role
    if current_user.role not in [Role.SUPER_ADMIN, Role.MANAGER]:
        # Check ownership
        # Note: If folder has no owner (system folder), only Admin can delete usually provided by permissions, but here explicitly check
        if folder.owner_id != current_user.id:
             raise HTTPException(status_code=403, detail="Safe Deletion: You can only delete your own folders.")
        
    session.delete(folder)
    session.commit()
    return {"ok": True}

@app.get("/projects", response_model=List[ProjectRead])
async def read_projects(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Base statement: Project + Owner Name + Owner ID + Root Folder Updated At from root folder
    statement = select(Project, User.username, Folder.owner_id, Folder.updated_at).join(Folder, Project.root_folder_id == Folder.id).join(User, Folder.owner_id == User.id, isouter=True)
    
    if current_user.role == Role.SUPER_ADMIN:
        # SuperAdmin sees all and is effectively admin of all
        results = session.exec(statement).all()
        projects_read = []
        for project, owner_name, owner_id, updated_at in results:
            p_dict = project.dict()
            p_dict['owner_name'] = owner_name or "System"
            p_dict['owner_id'] = owner_id
            p_dict['role'] = 'admin'
            p_dict['updated_at'] = updated_at
            projects_read.append(ProjectRead(**p_dict))
        return projects_read
    else:
        # Filter by membership and get specific role
        statement = statement.join(ProjectMember, Project.id == ProjectMember.project_id).where(ProjectMember.user_id == current_user.id).add_columns(ProjectMember.role)
        results = session.exec(statement).all()
        projects_read = []
        for project, owner_name, owner_id, updated_at, role in results:
            p_dict = project.dict()
            p_dict['owner_name'] = owner_name or "System"
            p_dict['owner_id'] = owner_id
            p_dict['role'] = role
            p_dict['updated_at'] = updated_at
            projects_read.append(ProjectRead(**p_dict))
        return projects_read

@app.post("/projects", response_model=Project)
async def create_project(
    name: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Create Root Folder
    root_folder = Folder(
        name=name,
        space_type=SpaceType.PROJECT,
        owner_id=current_user.id
    )
    session.add(root_folder)
    session.commit()
    session.refresh(root_folder)
    
    # 2. Create Project
    project = Project(
        name=name,
        root_folder_id=root_folder.id
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    
    # 3. Create Project Member (Admin)
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.ADMIN
    )
    session.add(member)
    session.commit()
    
    return project

class ProjectMemberCreate(SQLModel):
    user_id: int
    role: ProjectRole = ProjectRole.VIEWER

class ProjectMemberUpdate(SQLModel):
    role: ProjectRole

class ProjectMemberRead(SQLModel):
    id: int
    project_id: int
    user_id: int
    role: ProjectRole
    username: str
    department_name: Optional[str] = None

@app.get("/projects/{project_id}/members", response_model=List[ProjectMemberRead])
async def read_project_members(
    project_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Check if project exists (and user can see it?)
    # For now, allow any internal user to see members if they can see the project?
    # Or strict: Only members can see members?
    # Let's be open for 'add member' dialogs where you might need to know who is already there?
    # Actually, usually only Admins manage members.
    
    stmt = select(ProjectMember, User, Department).join(User, ProjectMember.user_id == User.id).outerjoin(Department, User.department_id == Department.id).where(ProjectMember.project_id == project_id)
    results = session.exec(stmt).all()
    
    members = []
    for pm, user, dept in results:
        members.append(ProjectMemberRead(
            id=pm.id,
            project_id=pm.project_id,
            user_id=pm.user_id,
            role=pm.role,
            username=user.username,
            department_name=dept.name if dept else None
        ))
    return members

@app.post("/projects/{project_id}/members", response_model=ProjectMemberRead)
async def add_project_member(
    project_id: int,
    member_in: ProjectMemberCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Permission Check: Only Project Admin or Super Admin
    if current_user.role != Role.SUPER_ADMIN:
        # Check if current user is Project Admin
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.ADMIN
        )
        if not session.exec(stmt).first():
             raise HTTPException(status_code=403, detail="Only Project Admins can add members")

    # Check existence
    existing = session.exec(select(ProjectMember).where(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member_in.user_id
    )).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    # Create
    member = ProjectMember(
        project_id=project_id,
        user_id=member_in.user_id,
        role=member_in.role
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    
    # Fetch details for return
    user = session.get(User, member.user_id)
    dept = session.get(Department, user.department_id) if user.department_id else None
    
    return ProjectMemberRead(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        username=user.username,
        department_name=dept.name if dept else None
    )

@app.put("/projects/{project_id}/members/{user_id}", response_model=ProjectMemberRead)
async def update_project_member(
    project_id: int,
    user_id: int,
    member_in: ProjectMemberUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Permission Check
    if current_user.role != Role.SUPER_ADMIN:
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.ADMIN
        )
        if not session.exec(stmt).first():
             raise HTTPException(status_code=403, detail="Only Project Admins can update members")

    # Find Member
    stmt = select(ProjectMember).where(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    )
    member = session.exec(stmt).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    member.role = member_in.role
    session.add(member)
    session.commit()
    session.refresh(member)
    
    user_obj = session.get(User, member.user_id)
    dept = session.get(Department, user_obj.department_id) if user_obj.department_id else None
    
    return ProjectMemberRead(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        username=user_obj.username,
        department_name=dept.name if dept else None
    )

@app.delete("/projects/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: int,
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Permission Check
    if current_user.role != Role.SUPER_ADMIN:
        # Check if current user is Project Admin
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.ADMIN
        )
        if not session.exec(stmt).first():
             # Exception: Users can leave project themselves?
             if current_user.id != user_id:
                 raise HTTPException(status_code=403, detail="Only Project Admins can remove members")
    
    # Find Member
    stmt = select(ProjectMember).where(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    )
    member = session.exec(stmt).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    session.delete(member)
    session.commit()
    return {"ok": True}

@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Permission Check: Super Admin or Project Admin
    if current_user.role != Role.SUPER_ADMIN:
        # Check Project Admin
        admin_member = session.exec(select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == ProjectRole.ADMIN
        )).first()
        if not admin_member:
            raise HTTPException(status_code=403, detail="Only Project Admins can delete the project")

    # 1. Delete associated root folder
    root_folder = session.get(Folder, project.root_folder_id) if project.root_folder_id else None
    
    session.delete(project)
    
    if root_folder:
        session.delete(root_folder)
        
    session.commit()
    return {"ok": True}

@app.get("/documents", response_model=List[DocumentRead])
async def read_documents(
    q: Optional[str] = Query(None),
    folder_id: Optional[Union[int, str]] = Query(None), 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    # Resolve folder_id if it's a virtual ID (e.g. 'dept-9')
    real_folder_id = None
    is_virtual_public = False
    
    # Priority: Search Mode (ignores folder_id usually, but let's allow filtering if both present? 
    # Valid use case: Search inside a folder.
    # But user asked for "Global Search". 
    # If q is present, we might relax the strict folder requirement OR apply it as a filter.
    # Let's support both: Global if folder_id is None, Scoped if folder_id is set.
    
    if isinstance(folder_id, str) and folder_id.startswith('dept-'):
        try:
            target_dept_id = int(folder_id.replace('dept-', ''))
            dept = session.get(Department, target_dept_id)
            if dept and dept.root_folder_id:
                real_folder_id = dept.root_folder_id
            else:
                target = session.exec(select(Folder).where(Folder.department_id == target_dept_id, Folder.parent_id == None)).first()
                if target:
                    real_folder_id = target.id
        except ValueError:
            pass
    elif folder_id == 'public':
        real_folder_id = None
        is_virtual_public = True
    elif folder_id == 'departments' or folder_id == 'projects':
        # Usually these levels don't show documents directly, but let's be safe
        real_folder_id = -1 # Return nothing for these top containers
    elif folder_id is not None:
        try:
            real_folder_id = int(folder_id)
        except ValueError:
            pass

    statement = select(Document, User.username).join(User, Document.author_id == User.id, isouter=True)
    statement = statement.where(Document.is_deleted == False) # Soft Delete Filter
    
    if q:
        # Search Mode
        statement = statement.where(Document.name.contains(q))
        # If folder_id provided -> Scoped Search
        if real_folder_id:
            statement = statement.where(Document.folder_id == real_folder_id)
        elif is_virtual_public:
             statement = statement.where(Document.folder_id == None)
        # If no folder_id -> Global Search (No folder constraint)
    
    elif real_folder_id:
        statement = statement.where(Document.folder_id == real_folder_id)
    elif folder_id is None or is_virtual_public:
        statement = statement.where(Document.folder_id == None)
    else:
         # Invalid ID
         statement = statement.where(Document.folder_id == -1) # Return nothing
        
    results = session.exec(statement).all()
    
    # Filter by permission
    perm_service = PermissionService(session)
    accessible_docs = []
    for doc, username in results:
        if perm_service.check_permission(current_user, doc, 'read'):
            # Convert to Read Model
            doc_dict = doc.dict()
            doc_dict['author_name'] = username or "Unknown"
            
            # Calculate Effective Role for UI
            doc_dict['role'] = perm_service.get_effective_role(current_user, doc)
            
            # Calculate Ancestors (if searching)
            if q and doc.folder_id:
                ancestors = []
                current_parent_id = doc.folder_id
                for _ in range(10): # Depth Limit
                    if not current_parent_id: break
                    parent = session.get(Folder, current_parent_id)
                    if not parent: break
                    
                    # Optimization: Maybe current_user shouldn't know about parents they can't see?
                    # BUT "Search" usually implies revealing path to navigate.
                    # We only show name & ID. 
                    ancestors.insert(0, FolderAncestor(id=parent.id, name=parent.name))
                    current_parent_id = parent.parent_id
                doc_dict['ancestors'] = ancestors

            accessible_docs.append(DocumentRead(**doc_dict))
            
    return accessible_docs



class ShareRequest(SQLModel):
    user_id: int
    folder_id: Optional[int] = None
    document_id: Optional[int] = None
    role: str

@app.post("/share")
async def share_resource(
    share_in: ShareRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Verify resource existence and ownership/permission
    # Only Admin or Owner can share?
    perm_service = PermissionService(session)
    
    target_resource = None
    if share_in.folder_id:
        target_resource = session.get(Folder, share_in.folder_id)
    elif share_in.document_id:
        target_resource = session.get(Document, share_in.document_id)
        
    if not target_resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    # Check if current user has 'write' permission or 'admin' 
    # Usually sharing requires higher privilege? 
    # For now, let's say "write" permission implies can share, or restrict to Owner/Admin.
    # Implementation Plan says "Unified Permission System"... doesn't explicitly restrict sharing.
    # Let's assume Owner/Admin.
    
    # Authorization Logic
    # 1. Super Admin: Always Yes
    # 2. Owner: Always Yes
    # 3. Manager/Editor: Check 'write' permission via PermissionService
    
    can_share = False
    
    # Check basic ownership
    if isinstance(target_resource, Folder) and target_resource.owner_id == current_user.id:
        can_share = True
    elif isinstance(target_resource, Document) and target_resource.author_id == current_user.id:
        can_share = True
        
    # Check 'Write' Permission (includes Managers, Dept Admins)
    if not can_share:
        perm_service = PermissionService(session)
        if perm_service.check_permission(current_user, target_resource, 'write'):
            can_share = True
            
    if not can_share:
         detail_msg = f"Permission denied: You do not have 'Editor' (Write) access to this resource. Role: {current_user.role}"
         raise HTTPException(status_code=403, detail=detail_msg)
         
    # Create or Update Collaborator
    # Safer with nullable
    from sqlalchemy import and_
    filters = [Collaborator.user_id == share_in.user_id]
    if share_in.folder_id: filters.append(Collaborator.folder_id == share_in.folder_id)
    else: filters.append(Collaborator.folder_id == None)
    if share_in.document_id: filters.append(Collaborator.document_id == share_in.document_id)
    else: filters.append(Collaborator.document_id == None)
    
    stmt = select(Collaborator).where(and_(*filters))
    existing = session.exec(stmt).first()
    
    if existing:
        existing.role = CollaboratorRole(share_in.role)
        session.add(existing)
    else:
        collab = Collaborator(
            user_id=share_in.user_id,
            folder_id=share_in.folder_id,
            document_id=share_in.document_id,
            role=CollaboratorRole(share_in.role)
        )
        session.add(collab)
        
    session.commit()
    return {"ok": True}

@app.get("/collaborators", response_model=List[dict])
async def get_collaborators(
    folder_id: Optional[int] = None,
    document_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of collaborators for a specific resource.
    """
    if not folder_id and not document_id:
        return []

    # 1. Identify all ancestor folders to check for inherited permissions
    ancestor_folder_ids = []
    
    current_folder_id = folder_id
    
    # If checking a document, start with its folder
    if document_id:
        doc = session.get(Document, document_id)
        if doc and doc.folder_id:
             current_folder_id = doc.folder_id
             ancestor_folder_ids.append(doc.folder_id)
    
    # Walk up the tree
    if current_folder_id:
        # Avoid infinite loops with depth limit
        next_id = current_folder_id
        # If we started with folder_id, we already added it? No, if folder_id is passed, we should add it.
        if folder_id:
             ancestor_folder_ids.append(folder_id)
             
        for _ in range(20):
             curr = session.get(Folder, next_id)
             if not curr or not curr.parent_id:
                 break
             next_id = curr.parent_id
             ancestor_folder_ids.append(next_id)
             
    # Deduplicate
    ancestor_folder_ids = list(set(ancestor_folder_ids))
        
    query = select(Collaborator).join(User)
    
    # Build conditions: (document_id match) OR (folder_id IN ancestors)
    from sqlalchemy import or_
    conditions = []
    if document_id:
        conditions.append(Collaborator.document_id == document_id)
    if ancestor_folder_ids:
        conditions.append(Collaborator.folder_id.in_(ancestor_folder_ids))
        
    if conditions:
        query = query.where(or_(*conditions))
    else:
        # Returns nothing if no doc and no ancestors
        return []
        
    results = session.exec(query).all()
    
    # Process results to handle overriding (Nearest wins? Or Max wins?)
    # Usually: Explicit on item overrides parent. Parent overrides grandparent.
    # We should process from Root -> Leaf.
    # But `results` is unordered.
    # Let's map user_id -> best_role.
    # Simpler approach: Just list everyone who has access. 
    # Frontend just lists members. 
    # If same user appears twice (on parent and child), which role?
    # Let's merge them.
    
    collaborators_map = {}
    
    for c in results:
        # Logic: If user already in map...
        # If we stick to simple "Show all", we can just ignore dupes or show most specific?
        # Let's show unique users. 
        if c.user_id not in collaborators_map:
             collaborators_map[c.user_id] = {
                "id": c.id, 
                "user_id": c.user_id,
                "username": c.user.username,
                "role": c.role
            }
        else:
            # Conflict resolution: Maybe show 'admin' if one is admin?
            # Or assume child setting overrides. 
            # For now, keep existing.
            pass
            
    return list(collaborators_map.values())

@app.delete("/share/{share_id}")
async def revoke_share(
    share_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    collab = session.get(Collaborator, share_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Share record not found")
        
    # Permission check: can current user manage this resource?
    perm_service = PermissionService(session)
    resource = None
    if collab.folder_id:
        resource = session.get(Folder, collab.folder_id)
    elif collab.document_id:
        resource = session.get(Document, collab.document_id)
    
    # Use effective role to see if current user is 'admin' of this resource
    if not resource or perm_service.get_effective_role(current_user, resource) != 'admin':
         # Super Admin fallback
         if current_user.role != Role.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Only folder administrators or super admins can manage permissions")

    session.delete(collab)
    session.commit()
    return {"ok": True}

class ShareUpdate(SQLModel):
    role: str

@app.put("/share/{share_id}", response_model=Collaborator)
async def update_share(
    share_id: int,
    share_update: ShareUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    collab = session.get(Collaborator, share_id)
    if not collab:
        raise HTTPException(status_code=404, detail="Share record not found")
        
    # Permission check: can current user manage this resource?
    perm_service = PermissionService(session)
    resource = None
    if collab.folder_id:
        resource = session.get(Folder, collab.folder_id)
    elif collab.document_id:
        resource = session.get(Document, collab.document_id)
    
    # Use effective role to see if current user is 'admin' of this resource
    if not resource or perm_service.get_effective_role(current_user, resource) != 'admin':
         # Super Admin fallback
         if current_user.role != Role.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Only folder administrators or super admins can update permissions")
        
    collab.role = share_update.role
    session.add(collab)
    session.commit()
    session.refresh(collab)
    return collab



# --- User 360 View APIs ---

class UserPermissionItem(SQLModel):
    resource_type: str  # "folder" or "document"
    resource_id: int
    resource_name: str
    effective_role: str  # "viewer", "editor", "admin", "owner"
    access_sources: List[str]  # e.g. ["Owner", "Department"]
    parent_id: Optional[int] = None
    is_explicit_share: bool = False
    share_id: Optional[int] = None # ID of the Collaborator entry if explicit

class UserShareHistoryItem(SQLModel):
    direction: str  # "inbound" (shared with me) or "outbound" (shared by me)
    resource_type: str
    resource_id: int
    resource_name: str
    target_user_name: str
    role: str
    shared_at: str = "2024-01-01"  # Mock date for now

@app.get("/users/{user_id}/permissions", response_model=List[UserPermissionItem])
async def get_user_permissions(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Dictionary to aggregate permissions: keys (type, id) -> data
    # Role priority: Owner > Admin > Editor > Viewer
    role_priority = {"owner": 4, "admin": 3, "editor": 2, "viewer": 1}
    
    perm_map = {} # (type, id) -> {role_val, role_str, sources, name, parent_id, explicit_share_id}

    def add_perm(res_type, res_id, res_name, role, source, parent_id, share_id=None):
        key = (res_type, res_id)
        current_val = role_priority.get(role, 0)
        
        if key not in perm_map:
            perm_map[key] = {
                "role_val": current_val,
                "role_str": role,
                "sources": {source},
                "name": res_name,
                "parent_id": parent_id,
                "share_id": share_id if source == "shared" else None
            }
        else:
            entry = perm_map[key]
            # Update role coverage
            if current_val > entry["role_val"]:
                entry["role_val"] = current_val
                entry["role_str"] = role
            
            # Add source
            entry["sources"].add(source)
            
            # If we find an explicit share ID, track it (even if we have other permissions)
            if share_id:
                entry["share_id"] = share_id

    # 1. Owned Folders
    owned_folders = session.exec(select(Folder).where(Folder.owner_id == user_id)).all()
    for f in owned_folders:
        add_perm("folder", f.id, f.name, "owner", "Owner", f.parent_id)

    # 2. Department Folders (Hierarchy)
    # Fix: User should see folders from their department AND all ancestor departments.
    # Fix: Role should be dynamic (Editor/Viewer), not hardcoded.
    perm_service = PermissionService(session)
    if target_user.department_id:
        current_dept_id = target_user.department_id
        ancestors = []
        dept_names = {}
        
        # Traverse up: Collect all parent departments
        for _ in range(10): # Depth limit
            if current_dept_id is None:
                break
            dept = session.get(Department, current_dept_id)
            if not dept:
                break
            ancestors.append(current_dept_id)
            dept_names[current_dept_id] = dept.name
            current_dept_id = dept.parent_id
            
        if ancestors:
            # Fetch all folders belonging to these departments
            dept_folders = session.exec(select(Folder).where(
                Folder.space_type == SpaceType.DEPARTMENT, 
                Folder.department_id.in_(ancestors)
            )).all()
            
            for f in dept_folders:
                # Calculate effective role (e.g. Editor if member, or Viewer if just browsing)
                # Note: get_effective_role checks strict write permissions
                eff_role = perm_service.get_effective_role(target_user, f)
                
                # Format Source
                src_dept_name = dept_names.get(f.department_id, "Department")
                source_desc = f"Department: {src_dept_name}"
                if f.department_id != target_user.department_id:
                     source_desc += " (Inherited)"
                
                add_perm("folder", f.id, f.name, eff_role, source_desc, f.parent_id)
            
    # 3. Project Memberships
    project_memberships = session.exec(select(ProjectMember).where(ProjectMember.user_id == user_id)).all()
    for pm in project_memberships:
        project = session.get(Project, pm.project_id)
        if project:
            root_folder = session.get(Folder, project.root_folder_id)
            if root_folder:
                # Map Project Role to Folder Permission
                # Project Admin -> Folder Editor (or Admin if we had that concept fully mapped)
                folder_role = "viewer"
                if pm.role == ProjectRole.ADMIN: folder_role = "editor" # Simplified
                elif pm.role == ProjectRole.EDITOR: folder_role = "editor"
                
                add_perm("folder", root_folder.id, root_folder.name, folder_role, f"Project: {project.name}", root_folder.parent_id)

    # 4. Explicit Shares (Collaborator)
    collaborations = session.exec(select(Collaborator).where(Collaborator.user_id == user_id)).all()
    for c in collaborations:
        if c.folder_id:
            folder = session.get(Folder, c.folder_id)
            if folder:
                # Get Sharer Name
                sharer = "Unknown"
                if folder.owner: sharer = folder.owner.username
                add_perm("folder", folder.id, folder.name, c.role, f"Shared by {sharer}", folder.parent_id, share_id=c.id)
        elif c.document_id:
            doc = session.get(Document, c.document_id)
            if doc:
                sharer = "Unknown"
                if doc.author: sharer = doc.author.username
                # Documents often don't have parent_id in this view context unless we fetch folder
                # But for tree view, we might need it. Sticky point: Doc might be in a folder user also has access to.
                add_perm("document", doc.id, doc.name, c.role, f"Shared by {sharer}", doc.folder_id, share_id=c.id)
                
    # Convert to List
    result = []
    for (rtype, rid), data in perm_map.items():
        result.append(UserPermissionItem(
            resource_type=rtype,
            resource_id=rid,
            resource_name=data["name"],
            effective_role=data["role_str"],
            access_sources=list(data["sources"]),
            parent_id=data["parent_id"],
            is_explicit_share=data["share_id"] is not None,
            share_id=data["share_id"]
        ))
        
    return result

@app.get("/users/{user_id}/shares", response_model=List[UserShareHistoryItem])
async def get_user_shares(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser)
):
    history = []
    
    # 1. Inbound Shares (Shared WITH this user)
    inbound = session.exec(select(Collaborator).where(Collaborator.user_id == user_id)).all()
    for c in inbound:
        sharer_name = "Unknown"
        res_name = "Unknown"
        res_type = "unknown"
        res_id = 0
        
        if c.folder_id:
            folder = session.get(Folder, c.folder_id)
            if folder and folder.owner:
                sharer_name = folder.owner.username
                res_name = folder.name
                res_type = "folder"
                res_id = folder.id
        elif c.document_id:
            doc = session.get(Document, c.document_id)
            if doc and doc.author:
                sharer_name = doc.author.username
                res_name = doc.name
                res_type = "document"
                res_id = doc.id
                
        history.append(UserShareHistoryItem(
            direction="inbound",
            resource_type=res_type,
            resource_id=res_id,
            resource_name=res_name,
            target_user_name=sharer_name, # In this context, it's the "From" user
            role=c.role
        ))

    # 2. Outbound Shares (Shared BY this user)
    # Find folders owned by user that have collaborators
    owned_folders = session.exec(select(Folder).where(Folder.owner_id == user_id)).all()
    for f in owned_folders:
        folder_collabs = session.exec(select(Collaborator).where(Collaborator.folder_id == f.id)).all()
        for c in folder_collabs:
            target = session.get(User, c.user_id)
            if target:
                history.append(UserShareHistoryItem(
                    direction="outbound",
                    resource_type="folder",
                    resource_id=f.id,
                    resource_name=f.name,
                    target_user_name=target.username,
                    role=c.role
                ))
                
    # Find documents authored by user that have collaborators
    owned_docs = session.exec(select(Document).where(Document.author_id == user_id)).all()
    for d in owned_docs:
        doc_collabs = session.exec(select(Collaborator).where(Collaborator.document_id == d.id)).all()
        for c in doc_collabs:
            target = session.get(User, c.user_id)
            if target:
                history.append(UserShareHistoryItem(
                    direction="outbound",
                    resource_type="document",
                    resource_id=d.id,
                    resource_name=d.name,
                    target_user_name=target.username,
                    role=c.role
                ))

    return history

# --- SPA Static File Serving (Production) ---
# Check if 'static' folder exists (created by Docker build)
if os.path.exists("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    
    # Manifest or other root files
    # Catch-all for SPA: Serve index.html for any known non-api path
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API calls to pass through (though they should match above routes first)
        if full_path.startswith("api") or full_path.startswith("static"):
            raise HTTPException(status_code=404, detail="Not found")
            
        # Check if actual file exists in static (e.g. favicon.ico)
        possible_path = os.path.join("static", full_path)
        if os.path.exists(possible_path) and os.path.isfile(possible_path):
            return FileResponse(possible_path)
            
        # Fallback to index.html
        return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    # Local Dev: Run on 8001 to distinguish from Docker(8989) and DeckPilot(8000)
    uvicorn.run(app, host="0.0.0.0", port=8001)
