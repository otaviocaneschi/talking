// Em dev usa localhost:3001, em produção (ngrok) usa a mesma origem
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    signup: (username, display_name, password) =>
        request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ username, display_name, password }),
        }),

    // Servers
    getServers: () => request('/servers'),
    createServer: (name) => request('/servers', { method: 'POST', body: JSON.stringify({ name }) }),
    joinServer: (invite_code) => request('/servers/join', { method: 'POST', body: JSON.stringify({ invite_code }) }),

    // Channels
    getChannels: (serverId) => request(`/servers/${serverId}/channels`),

    // Users
    getUsers: () => request('/users'),
    getMe: () => request('/users/me'),

    // Friends
    getFriends: () => request('/friends'),
    addFriend: (username) => request('/friends/add', {
        method: 'POST',
        body: JSON.stringify({ username })
    }),
    acceptFriend: (targetUserId) => request('/friends/accept', {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
    }),
    rejectFriend: (targetUserId) => request('/friends/reject', {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
    }),
};

export { API_URL };
