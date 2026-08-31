import { useState, useEffect } from 'react';
import { X, Shield, ShieldOff, Trash2, Search, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel({ isOpen, onClose }) {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadUsers();
        }
    }, [isOpen]);

    const loadUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) {
            setError(err.message || 'Erro ao carregar usuários.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAdmin = async (userId, currentStatus) => {
        try {
            await api.updateUserAdmin(userId, currentStatus ? 0 : 1);
            setUsers((prev) => 
                prev.map(u => u.id === userId ? { ...u, is_admin: currentStatus ? 0 : 1 } : u)
            );
        } catch (err) {
            alert(err.message || 'Erro ao alterar permissão.');
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`ATENÇÃO: Você tem certeza que deseja excluir permanentemente o usuário "${username}"? Todas as suas mensagens e dados serão perdidos.`)) {
            return;
        }

        try {
            await api.deleteUser(userId);
            setUsers((prev) => prev.filter(u => u.id !== userId));
        } catch (err) {
            alert(err.message || 'Erro ao excluir usuário.');
        }
    };

    if (!isOpen) return null;

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(search.toLowerCase()) || 
        u.display_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="modal-overlay">
            <div className="modal-container admin-modal">
                <button className="modal-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Shield className="admin-icon" size={24} color="#ef4444" />
                        <h2>Painel de Administração</h2>
                    </div>
                    <p>Gerencie todos os usuários cadastrados na plataforma.</p>
                </div>

                <div className="modal-body">
                    {/* Search */}
                    <div className="admin-search">
                        <Search size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar por username ou apelido..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {error && <div className="modal-error">{error}</div>}

                    {/* Users List */}
                    <div className="admin-users-list">
                        {loading ? (
                            <div className="admin-loading">Carregando usuários...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="admin-empty">Nenhum usuário encontrado.</div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Usuário</th>
                                        <th>Username</th>
                                        <th>Cadastrado em</th>
                                        <th>Cargo</th>
                                        <th style={{ textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className={u.id === currentUser.id ? 'current-user' : ''}>
                                            <td>
                                                <div className="admin-user-cell">
                                                    <div 
                                                        className="admin-avatar"
                                                        style={{ backgroundColor: u.avatar_color || '#5865F2' }}
                                                    >
                                                        {u.display_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span>{u.display_name}</span>
                                                    {u.id === currentUser.id && <span className="admin-you-badge">Você</span>}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>@{u.username}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                {u.is_admin ? (
                                                    <span className="admin-badge">Admin</span>
                                                ) : (
                                                    <span className="member-badge">Membro</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {u.id !== currentUser.id && (
                                                    <div className="admin-actions">
                                                        <button 
                                                            className={`admin-action-btn ${u.is_admin ? 'demote' : 'promote'}`}
                                                            onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                                                            title={u.is_admin ? "Remover admin" : "Promover a admin"}
                                                        >
                                                            {u.is_admin ? <ShieldOff size={16} /> : <Shield size={16} />}
                                                        </button>
                                                        <button 
                                                            className="admin-action-btn delete"
                                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                                            title="Excluir usuário"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
