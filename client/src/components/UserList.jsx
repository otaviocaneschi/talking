import { useState } from 'react';

export default function UserList({ onlineUsers, friends, onAddFriend, onAcceptFriend, onRejectFriend, currentUserId }) {
    const [friendUsername, setFriendUsername] = useState('');
    const [addStatus, setAddStatus] = useState(null);

    // Separa online e offline
    const onlineIds = new Set(onlineUsers.map((u) => u.id));

    const safeFriends = friends || [];
    
    // Filtros
    const pendingRequests = safeFriends.filter((f) => f.status === 'pending');
    const acceptedFriends = safeFriends.filter((f) => f.status === 'accepted');

    const online = acceptedFriends.filter((f) => onlineIds.has(f.id));
    const offline = acceptedFriends.filter((f) => !onlineIds.has(f.id));

    const handleAddFriend = async (e) => {
        e.preventDefault();
        if (!friendUsername.trim()) return;
        
        try {
            await onAddFriend(friendUsername);
            setAddStatus({ type: 'success', message: 'Pedido enviado!' });
            setFriendUsername('');
            setTimeout(() => setAddStatus(null), 3000);
        } catch (err) {
            setAddStatus({ type: 'error', message: err.message || 'Erro ao adicionar' });
            setTimeout(() => setAddStatus(null), 3000);
        }
    };

    return (
        <div className="user-list-panel">
            {/* Add Friend Form */}
            <div style={{ padding: '0 16px', marginBottom: '16px' }}>
                <form onSubmit={handleAddFriend} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="user-list-section-title" style={{ padding: 0 }}>Adicionar Amigo</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Username"
                            value={friendUsername}
                            onChange={(e) => setFriendUsername(e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '8px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-normal)'
                            }}
                        />
                        <button type="submit" className="button button-primary" style={{ padding: '8px', minWidth: '40px' }}>+</button>
                    </div>
                    {addStatus && (
                        <div style={{ fontSize: '12px', color: addStatus.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)' }}>
                            {addStatus.message}
                        </div>
                    )}
                </form>
            </div>

            <div className="chat-header-divider" style={{ margin: '0 16px 16px', opacity: 0.5 }} />

            {/* Pedidos Pendentes */}
            {pendingRequests.length > 0 && (
                <>
                    <div className="user-list-section-title">
                        Pedidos Pendentes — {pendingRequests.length}
                    </div>
                    {pendingRequests.map((req) => {
                        const isIncoming = req.sender_id !== currentUserId;
                        return (
                            <div key={req.id} className="user-list-item" style={{ cursor: 'default' }}>
                                <div
                                    className="user-list-avatar"
                                    style={{ backgroundColor: req.avatar_color || '#5865F2' }}
                                >
                                    {req.display_name?.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                    <span className="user-list-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {req.display_name}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {isIncoming ? 'Quer ser seu amigo' : 'Aguardando...'}
                                    </span>
                                </div>
                                {isIncoming && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button 
                                            onClick={() => onAcceptFriend(req.id)}
                                            style={{ background: 'var(--accent-success)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Aceitar"
                                        >✓</button>
                                        <button 
                                            onClick={() => onRejectFriend(req.id)}
                                            style={{ background: 'var(--accent-danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Recusar"
                                        >✕</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="chat-header-divider" style={{ margin: '16px', opacity: 0.5 }} />
                </>
            )}

            {/* Online */}
            {online.length > 0 && (
                <>
                    <div className="user-list-section-title">
                        Amigos Online — {online.length}
                    </div>
                    {online.map((user) => (
                        <div key={user.id} className="user-list-item" id={`user-${user.id}`}>
                            <div
                                className="user-list-avatar"
                                style={{ backgroundColor: user.avatar_color || '#5865F2' }}
                            >
                                {user.display_name?.charAt(0).toUpperCase()}
                                <span className="online-indicator" />
                            </div>
                            <span className="user-list-name">
                                {user.display_name}
                            </span>
                        </div>
                    ))}
                </>
            )}

            {/* Offline */}
            {offline.length > 0 && (
                <>
                    <div className="user-list-section-title" style={{ marginTop: online.length > 0 ? 16 : 0 }}>
                        Amigos Offline — {offline.length}
                    </div>
                    {offline.map((user) => (
                        <div
                            key={user.id}
                            className="user-list-item"
                            style={{ opacity: 0.5 }}
                        >
                            <div
                                className="user-list-avatar"
                                style={{ backgroundColor: user.avatar_color || '#5865F2' }}
                            >
                                {user.display_name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="user-list-name">
                                {user.display_name}
                            </span>
                        </div>
                    ))}
                </>
            )}

            {safeFriends.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhum amigo ainda.
                </div>
            )}
        </div>
    );
}
