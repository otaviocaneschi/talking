import { useState } from 'react';
import { Hash, Volume2, ChevronDown, MessageSquare, LogOut, Settings, MicOff, HeadphoneOff, Monitor, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import VoiceControls from './VoiceControls';

export default function Sidebar({
    server,
    channels,
    activeChannel,
    onSelectChannel,
    voiceUsers = {},
    voiceChannelId,
    isMuted,
    isDeafened,
    isScreenSharing,
    connectedVoiceChannelName,
    onToggleMute,
    onToggleDeafen,
    onToggleScreenShare,
    onDisconnectVoice,
    onOpenAudioSettings,
    noiseSuppressionEnabled,
    onToggleNoiseSuppression,
    onEditChannel,
    onDeleteChannel,
}) {
    const { user, logout } = useAuth();

    const textChannels = channels.filter((c) => c.type === 'text');
    const voiceChannelsList = channels.filter((c) => c.type === 'voice');

    const isOwnerOrAdmin = server && (server.owner_id === user?.id || user?.is_admin);

    // Estado para edição inline de canal
    const [editingChannelId, setEditingChannelId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [deletingChannelId, setDeletingChannelId] = useState(null);

    const handleStartEdit = (e, channel) => {
        e.stopPropagation();
        setEditingChannelId(channel.id);
        setEditingName(channel.name);
        setDeletingChannelId(null);
    };

    const handleConfirmEdit = async (e) => {
        e.stopPropagation();
        if (editingName.trim() && onEditChannel) {
            await onEditChannel(editingChannelId, editingName.trim());
        }
        setEditingChannelId(null);
        setEditingName('');
    };

    const handleCancelEdit = (e) => {
        e.stopPropagation();
        setEditingChannelId(null);
        setEditingName('');
    };

    const handleStartDelete = (e, channelId) => {
        e.stopPropagation();
        setDeletingChannelId(channelId);
        setEditingChannelId(null);
    };

    const handleConfirmDelete = async (e, channelId) => {
        e.stopPropagation();
        if (onDeleteChannel) {
            await onDeleteChannel(channelId);
        }
        setDeletingChannelId(null);
    };

    const handleCancelDelete = (e) => {
        e.stopPropagation();
        setDeletingChannelId(null);
    };

    const renderChannelItem = (channel, icon) => {
        const isEditing = editingChannelId === channel.id;
        const isDeleting = deletingChannelId === channel.id;
        const isVoice = channel.type === 'voice';
        const users = isVoice ? (voiceUsers[channel.id] || []) : [];

        return (
            <div key={channel.id}>
                <div
                    id={`${isVoice ? 'voice-' : ''}channel-${channel.id}`}
                    className={`channel-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                    onClick={() => !isEditing && !isDeleting && onSelectChannel(channel)}
                >
                    {icon}

                    {isEditing ? (
                        <div className="channel-edit-inline" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmEdit(e);
                                    if (e.key === 'Escape') handleCancelEdit(e);
                                }}
                                autoFocus
                                className="channel-edit-input"
                            />
                            <button className="channel-edit-btn confirm" onClick={handleConfirmEdit} title="Salvar">
                                <Check size={14} />
                            </button>
                            <button className="channel-edit-btn cancel" onClick={handleCancelEdit} title="Cancelar">
                                <X size={14} />
                            </button>
                        </div>
                    ) : isDeleting ? (
                        <div className="channel-delete-confirm" onClick={(e) => e.stopPropagation()}>
                            <span className="channel-delete-text">Excluir?</span>
                            <button className="channel-edit-btn confirm" onClick={(e) => handleConfirmDelete(e, channel.id)} title="Confirmar exclusão">
                                <Check size={14} />
                            </button>
                            <button className="channel-edit-btn cancel" onClick={handleCancelDelete} title="Cancelar">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="channel-name">{channel.name}</span>
                            {isVoice && users.length > 0 && (
                                <span className="voice-user-count">{users.length}</span>
                            )}
                            {isOwnerOrAdmin && (
                                <div className="channel-actions">
                                    <button className="channel-action-btn" onClick={(e) => handleStartEdit(e, channel)} title="Editar canal">
                                        <Pencil size={12} />
                                    </button>
                                    <button className="channel-action-btn danger" onClick={(e) => handleStartDelete(e, channel.id)} title="Excluir canal">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Voice users connected to this channel */}
                {isVoice && users.length > 0 && (
                    <div className="voice-users">
                        {users.map((u) => (
                            <div key={u.socketId} className="voice-user">
                                <div
                                    className="voice-avatar"
                                    style={{ backgroundColor: u.avatar_color || '#5865F2' }}
                                >
                                    {u.display_name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="voice-user-name">{u.display_name}</span>
                                {u.screenSharing && <Monitor size={12} className="voice-user-screen-icon" />}
                                {u.muted && <MicOff size={12} className="voice-user-muted-icon" />}
                                {u.deafened && <HeadphoneOff size={12} className="voice-user-muted-icon" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {server ? server.name : 'Selecione um Servidor'}
                </span>
                <ChevronDown size={16} />
            </div>

            {/* Text Channels */}
            <div className="channel-section">
                <div className="channel-section-title">
                    <ChevronDown size={10} />
                    Canais de Texto
                </div>
                {textChannels.map((channel) =>
                    renderChannelItem(channel, <Hash className="channel-icon" size={18} />)
                )}
            </div>

            {/* Voice Channels */}
            <div className="channel-section">
                <div className="channel-section-title">
                    <ChevronDown size={10} />
                    Canais de Voz
                </div>
                {voiceChannelsList.map((channel) =>
                    renderChannelItem(channel, <Volume2 className="channel-icon" size={18} />)
                )}
            </div>

            {/* Voice Controls (when connected) */}
            {voiceChannelId && connectedVoiceChannelName && (
                <VoiceControls
                    channelName={connectedVoiceChannelName}
                    isMuted={isMuted}
                    isDeafened={isDeafened}
                    isScreenSharing={isScreenSharing}
                    onToggleMute={onToggleMute}
                    onToggleDeafen={onToggleDeafen}
                    onToggleScreenShare={onToggleScreenShare}
                    onDisconnect={onDisconnectVoice}
                    onOpenSettings={onOpenAudioSettings}
                    noiseSuppressionEnabled={noiseSuppressionEnabled}
                    onToggleNoiseSuppression={onToggleNoiseSuppression}
                />
            )}

            {/* User Panel */}
            <div className="sidebar-user-panel">
                <div
                    className="user-avatar"
                    style={{ backgroundColor: user?.avatar_color || '#5865F2' }}
                >
                    {user?.display_name?.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                    <div className="user-name">{user?.display_name}</div>
                    <div className="user-status">Online</div>
                </div>
                <div className="user-panel-actions">
                    <button
                        className="icon-btn"
                        title="Configurações de áudio"
                        onClick={onOpenAudioSettings}
                        id="settings-btn"
                    >
                        <Settings size={18} />
                    </button>
                    <button className="icon-btn" title="Sair" onClick={logout} id="logout-btn">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
