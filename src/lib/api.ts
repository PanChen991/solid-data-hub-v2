// Docker/Production: Use current origin (relative path)
// Local Dev: Default to 8001 if needed, but Vite proxy is better.
// For now, let's detect if we are on 5173 (Dev) or 8989 (Docker).
const isDev = window.location.port === '5173';
const API_BASE_URL = isDev ? `http://${window.location.hostname}:8001` : '';
// Empty string means relative path for Docker (e.g. /documents/...), served by same origin.

export interface ApiResponse<T> {
    data: T | null;
    error: Error | null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    // Only set Content-Type if it's not already set and it's not a FormData/other non-json body
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            cache: 'no-store',
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Session expired or invalid
                localStorage.removeItem('token');
                // Only redirect if not already on login page to avoid loops
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                throw new Error('Session expired');
            }
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            const detail = errorData.detail;
            const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
            throw new Error(message || 'Request failed');
        }

        const data = await response.json();
        return { data, error: null };
    } catch (error) {
        // If error is 401 Unauthorized (detail="Incorrect username or password" or "Could not validate credentials")
        // But here we just catch Error.
        // Ideally we check response status. 
        // Refactoring request to check status before throwing generic Error.
        return { data: null, error: error as Error };
    }
}


export const api = {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body: any, isFormData: boolean = false) => request<T>(endpoint, {
        method: 'POST',
        body: isFormData ? body : JSON.stringify(body),
    }),
    put: <T>(endpoint: string, body: any) => request<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
    }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export default api;
