import { Hash, Volume2, ChevronDown, MessageSquare, LogOut, Settings, MicOff, HeadphoneOff, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import VoiceControls from './VoiceControls';

export default function Sidebar({
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
}) {
    const { user, logout } = useAuth();

    const textChannels = channels.filter((c) => c.type === 'text');
    const voiceChannelsList = channels.filter((c) => c.type === 'voice');

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <MessageSquare className="logo-icon" size={20} />
                <span>Discord2</span>
            </div>

            {/* Text Channels */}
            <div className="channel-section">
                <div className="channel-section-title">
                    <ChevronDown size={10} />
                    Canais de Texto
                </div>
                {textChannels.map((channel) => (
                    <div
                        key={channel.id}
                        id={`channel-${channel.id}`}
                        className={`channel-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                        onClick={() => onSelectChannel(channel)}
                    >
                        <Hash className="channel-icon" size={18} />
                        <span className="channel-name">{channel.name}</span>
                    </div>
                ))}
            </div>

            {/* Voice Channels */}
            <div className="channel-section">
                <div className="channel-section-title">
                    <ChevronDown size={10} />
                    Canais de Voz
                </div>
                {voiceChannelsList.map((channel) => {
                    const users = voiceUsers[channel.id] || [];

                    return (
                        <div key={channel.id}>
                            <div
                                id={`voice-channel-${channel.id}`}
                                className={`channel-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                                onClick={() => onSelectChannel(channel)}
                            >
                                <Volume2 className="channel-icon" size={18} />
                                <span className="channel-name">{channel.name}</span>
                                {users.length > 0 && (
                                    <span className="voice-user-count">{users.length}</span>
                                )}
                            </div>

                            {/* Voice users connected to this channel */}
                            {users.length > 0 && (
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
                })}
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
