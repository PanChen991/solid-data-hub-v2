import { api } from '@/lib/api';
import { useAuth } from './useAuth';

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  space_type: 'public' | 'department' | 'project';
  is_locked: boolean;
  owner_id: number | null;
  owner_name: string | null;
  role?: 'viewer' | 'editor' | 'admin';
  updated_at?: string;
  created_at?: string;
  ancestors?: { id: number; name: string }[];
  department_id?: number | null;
  is_restricted?: boolean;
  project_id?: number | null;
}

export interface Document {
  id: number;
  name: string;
  oss_key: string;
  file_type: string;
  size: number;
  folder_id: number | null;
  author_id: number | null;
  author_name: string | null;
  is_restricted: boolean;
  updated_at?: string;
  created_at?: string;
  role?: string;
  ancestors?: { id: number; name: string }[];
}

export interface Project {
  id: number;
  name: string;
  root_folder_id: number;
  status: string;
  owner_name?: string | null;
  owner_id?: number | null;
  role?: string; updated_at?: string;
}

export interface SharedResourceItem {
  type: 'document' | 'folder';
  id: number;
  name: string;
  size?: number;
  file_type?: string;
  role: string;
  owner_name: string;
  ancestors?: { id: number; name: string }[];
}

// Folder operations
export function useFolders() {
  const getFolders = async (parentId?: string, spaceType?: string, departmentId?: number, query?: string) => {
    let endpoint = '/folders';
    const params = new URLSearchParams();

    if (query) {
      params.append('q', query);
    }

    // Handle virtual root IDs
    if (parentId === 'public' || parentId === 'departments' || parentId === 'projects') {
      // Map virtual ID to space_type
      if (parentId === 'public') params.append('space_type', 'public');
      else if (parentId === 'departments') params.append('space_type', 'department');
      else if (parentId === 'projects') params.append('space_type', 'project');

      // Do NOT append parent_id, so it defaults to root (null) in backend
    } else {
      // Regular numeric ID
      if (parentId) params.append('parent_id', parentId);
      if (spaceType) params.append('space_type', spaceType);
    }

    if (departmentId) params.append('department_id', departmentId.toString());

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const { data, error } = await api.get<Folder[]>(endpoint);
    return { data, error };
  };

  const createFolder = async (name: string, parentId?: string, spaceType: 'public' | 'department' | 'project' = 'public', isRestricted: boolean = false) => {
    const { data, error } = await api.post<Folder>('/folders', {
      name,
      parent_id: parentId ? (isNaN(Number(parentId)) ? parentId : Number(parentId)) : null,
      space_type: spaceType,
      is_locked: false,
      is_restricted: isRestricted,
    });
    return { data, error };
  };

  const updateFolder = async (id: string, name: string) => {
    const { data, error } = await api.put<Folder>(`/folders/${id}`, { name, id, space_type: 'public', is_locked: false });
    return { data, error };
  };

  const getFolder = async (id: string) => {
    const { data, error } = await api.get<Folder & { role?: string }>(`/folders/${id}`);
    return { data, error };
  };

  const deleteFolder = async (id: string) => {
    const { error } = await api.delete(`/folders/${id}`);
    return { error };
  };

  return { getFolders, getFolder, createFolder, updateFolder, deleteFolder };
}

// Document operations
export function useDocuments() {
  const getDocuments = async (folderId?: string, query?: string) => {
    let endpoint = '/documents';
    const params = new URLSearchParams();

    if (folderId) params.append('folder_id', folderId);
    if (query) params.append('q', query);

    if (params.toString()) endpoint += `?${params.toString()}`;

    const { data, error } = await api.get<Document[]>(endpoint);
    return { data, error };
  };

  const createDocument = async (file: File, folderId?: string, isRestricted: boolean = false, onProgress?: (percent: number) => void) => {
    return new Promise<{ data: Document | null, error: any }>(async (resolve) => {
      const formData = new FormData();
      formData.append('file', file);
      if (folderId) {
        formData.append('folder_id', folderId);
      }
      formData.append('is_restricted', String(isRestricted));

      const xhr = new XMLHttpRequest();
      // Construct API URL dynamically based on api.ts logic
      const API_BASE_URL = `http://${window.location.hostname}:8001`;
      xhr.open('POST', `${API_BASE_URL}/documents`, true);

      // Add Authorization header
      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Monitor Upload Progress
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ data, error: null });
          } catch (e) {
            resolve({ data: null, error: new Error('Invalid JSON response') });
          }
        } else {
          let errorMsg = 'Upload failed';
          try {
            const errResp = JSON.parse(xhr.responseText);
            errorMsg = errResp.detail || errorMsg;
          } catch (e) { }
          // Handle 401 specifically if needed, but for now generic error
          if (xhr.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
          resolve({ data: null, error: new Error(errorMsg) });
        }
      };

      xhr.onerror = () => {
        resolve({ data: null, error: new Error('Network error during upload') });
      };

      xhr.send(formData);
    });
  };

  const deleteDocument = async (id: string) => {
    const { error } = await api.delete(`/documents/${id}`);
    return { error };
  };

  const getDocumentUrl = async (id: number) => {
    const { data, error } = await api.get<{ url: string }>(`/documents/${id}/url`);
    return { data, error };
  };

  const getDocument = async (id: number) => {
    const { data, error } = await api.get<Document>(`/documents/${id}`);
    return { data, error };
  };

  const getSharedResources = async () => {
    const { data, error } = await api.get<SharedResourceItem[]>('/documents/shared-with-me');
    return { data, error };
  };

  return { getDocuments, getDocument, createDocument, deleteDocument, getDocumentUrl, getSharedResources };
}

// Project Operations
export function useProjects() {
  const getProjects = async () => {
    const { data, error } = await api.get<Project[]>('/projects');
    return { data, error };
  };

  const createProject = async (name: string) => {
    const { data, error } = await api.post<Project>('/projects?name=' + encodeURIComponent(name), {});
    return { data, error };
  };

  const deleteProject = async (id: number) => {
    const { error } = await api.delete(`/projects/${id}`);
    return { error };
  };

  return { getProjects, createProject, deleteProject };
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'admin' | 'editor' | 'viewer';
  username: string;
  department_name?: string | null;
}

export function useProjectMembers() {
  const getProjectMembers = async (projectId: number) => {
    const { data, error } = await api.get<ProjectMember[]>(`/projects/${projectId}/members`);
    return { data, error };
  };

  const addProjectMember = async (projectId: number, userId: number, role: string) => {
    const { data, error } = await api.post<ProjectMember>(`/projects/${projectId}/members`, { user_id: userId, role });
    return { data, error };
  };

  const updateProjectMember = async (projectId: number, userId: number, role: string) => {
    const { data, error } = await api.put<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role });
    return { data, error };
  };

  const removeProjectMember = async (projectId: number, userId: number) => {
    const { error } = await api.delete(`/projects/${projectId}/members/${userId}`);
    return { error };
  };

  return { getProjectMembers, addProjectMember, updateProjectMember, removeProjectMember };
}

export interface SharedResource {
  type: 'folder' | 'document';
  id: number;
  name: string;
  size: number | null;
  file_type: string | null;
  role: 'viewer' | 'editor' | 'admin';
  owner_name: string;
}

// Sharing Operations
export function useSharing() {
  const shareResource = async (userId: number, folderId?: number, documentId?: number, role: 'viewer' | 'editor' | 'admin' = 'viewer') => {
    const { data, error } = await api.post('/share', {
      user_id: userId,
      folder_id: folderId,
      document_id: documentId,
      role
    });
    return { data, error };
  };

  const getSharedDocuments = async () => {
    const { data, error } = await api.get<SharedResource[]>('/documents/shared-with-me');
    return { data, error };
  };

  return { shareResource, getSharedDocuments };
}

export interface UserProfile {
  id: number;
  username: string;
  role: string;
  department_id: number | null;
  department_name?: string | null;
  employee_id?: string | null;
  email?: string | null;
}

export function useUsers() {
  const getUsers = async () => {
    // Increase limit to prevent truncation (default is 100)
    const { data, error } = await api.get<UserProfile[]>('/users?limit=1000');
    return { data, error };
  };

  const createUser = async (userData: any) => {
    const { data, error } = await api.post<UserProfile>('/users', userData);
    return { data, error };
  };

  const updateUser = async (userId: number, userData: any) => {
    const { data, error } = await api.put<UserProfile>(`/users/${userId}`, userData);
    return { data, error };
  };

  const deleteUser = async (userId: number) => {
    const { error } = await api.delete(`/users/${userId}`);
    return { error };
  };

  const updateSelf = async (password: string) => {
    const { data, error } = await api.put<UserProfile>('/users/me', { password });
    return { data, error };
  };

  return { getUsers, createUser, updateUser, deleteUser, updateSelf };
}

export interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  root_folder_id?: number | null;
}

// Department operations
export function useDepartments() {
  const getDepartments = async (parentId?: number) => {
    let endpoint = '/departments';
    if (parentId) endpoint += `?parent_id=${parentId}`;

    const { data, error } = await api.get<Department[]>(endpoint);
    return { data, error };
  };

  const createDepartment = async (deptData: { name: string, parent_id?: number | null }) => {
    const { data, error } = await api.post<Department>('/departments', deptData);
    return { data, error };
  };

  const updateDepartment = async (id: number, deptData: { name?: string, parent_id?: number | null }) => {
    const { data, error } = await api.put<any>(`/departments/${id}`, deptData);
    return { data, error };
  };

  const deleteDepartment = async (id: number) => {
    const { error } = await api.delete(`/departments/${id}`);
    return { error };
  };

  return { getDepartments, createDepartment, updateDepartment, deleteDepartment };
}

export function useProfiles() {
  return { getProfile: async (id: string) => ({ data: null, error: null }) };
}

export function useActivityLogs() {
  return { getRecentActivities: async () => ({ data: [], error: null }) };
}

export function useIntelligences() {
  return { getIntelligences: async () => ({ data: [], error: null }) };
}
