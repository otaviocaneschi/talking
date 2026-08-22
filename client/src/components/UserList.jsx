export default function UserList({ onlineUsers, allUsers }) {
    // Separa online e offline
    const onlineIds = new Set(onlineUsers.map((u) => u.id));

    const online = onlineUsers;
    const offline = (allUsers || []).filter((u) => !onlineIds.has(u.id));

    return (
        <div className="user-list-panel">
            {/* Online */}
            <div className="user-list-section-title">
                Online — {online.length}
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
                        {user.is_admin ? <span className="admin-badge">👑</span> : ''}
                    </span>
                </div>
            ))}

            {/* Offline */}
            {offline.length > 0 && (
                <>
                    <div className="user-list-section-title" style={{ marginTop: 16 }}>
                        Offline — {offline.length}
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
                                {user.is_admin ? <span className="admin-badge">👑</span> : ''}
                            </span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
