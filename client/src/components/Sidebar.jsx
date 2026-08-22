import { Hash, Volume2, ChevronDown, MessageSquare, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({ channels, activeChannel, onSelectChannel }) {
    const { user, logout } = useAuth();

    const textChannels = channels.filter((c) => c.type === 'text');
    const voiceChannels = channels.filter((c) => c.type === 'voice');

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
                {voiceChannels.map((channel) => (
                    <div
                        key={channel.id}
                        id={`voice-channel-${channel.id}`}
                        className={`channel-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                        onClick={() => onSelectChannel(channel)}
                    >
                        <Volume2 className="channel-icon" size={18} />
                        <span className="channel-name">{channel.name}</span>
                    </div>
                ))}
            </div>

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
                    <button className="icon-btn" title="Configurações" id="settings-btn">
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
