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
    updateServer: (serverId, name) => request(`/servers/${serverId}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
    }),
    deleteServer: (serverId) => request(`/servers/${serverId}`, { method: 'DELETE' }),

    // Channels
    getChannels: (serverId) => request(`/servers/${serverId}/channels`),
    createChannel: (serverId, name, type) => request('/channels', {
        method: 'POST',
        body: JSON.stringify({ server_id: serverId, name, type })
    }),
    updateChannel: (channelId, name) => request(`/channels/${channelId}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
    }),
    deleteChannel: (channelId) => request(`/channels/${channelId}`, {
        method: 'DELETE'
    }),

    // Users
    getUsers: () => request('/users'),
    deleteUser: (userId) => request(`/users/${userId}`, { method: 'DELETE' }),
    updateUserAdmin: (userId, isAdmin) => request(`/users/${userId}/admin`, {
        method: 'PUT',
        body: JSON.stringify({ is_admin: isAdmin })
    }),
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

    // Version
    getVersion: () => request('/version'),
};

export { API_URL };
