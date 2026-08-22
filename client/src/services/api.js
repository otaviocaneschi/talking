const API_URL = 'http://localhost:3001/api';

/**
 * Wrapper para chamadas HTTP à API.
 * Adiciona automaticamente o token JWT se disponível.
 */
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Auth
    login: (username, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    // Channels
    getChannels: () => request('/channels'),

    // Users
    getUsers: () => request('/users'),
    getMe: () => request('/users/me'),
};

export { API_URL };
