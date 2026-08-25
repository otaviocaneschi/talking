import { Volume2, Mic, MicOff, Headphones, HeadphoneOff, PhoneCall, Monitor } from 'lucide-react';
import ScreenShareView from './ScreenShareView';

/**
 * View principal de um canal de voz.
 * Mostra grid de participantes com indicadores de estado.
 */
export default function VoiceChannel({
    channel,
    voiceUsers,
    speakingUsers,
    voiceChannelId,
    onJoin,
    currentUser,
    isScreenSharing,
    screenShareStream,
    remoteScreenShare,
    onStopScreenShare,
}) {
    if (!channel) return null;

    const channelUsers = voiceUsers[channel.id] || [];
    const isConnected = voiceChannelId === channel.id;

    // Determina se há screen share ativo (local ou remoto)
    const hasLocalScreenShare = isScreenSharing && screenShareStream && isConnected;
    const hasRemoteScreenShare = remoteScreenShare?.stream && isConnected;
    const hasScreenShare = hasLocalScreenShare || hasRemoteScreenShare;

    return (
        <div className="voice-channel-view">
            {/* Header */}
            <div className="voice-channel-header fade-in">
                <div className="voice-channel-icon">
                    <Volume2 />
                </div>
                <div className="voice-channel-info">
                    <h2 className="voice-channel-name">{channel.name}</h2>
                    <p className="voice-channel-status">
                        {channelUsers.length === 0
                            ? 'Ninguém conectado'
                            : `${channelUsers.length} ${channelUsers.length === 1 ? 'pessoa' : 'pessoas'} conectada${channelUsers.length === 1 ? '' : 's'}`
                        }
                    </p>
                </div>
            </div>

            {/* Screen Share View */}
            {hasScreenShare && (
                <ScreenShareView
                    stream={hasLocalScreenShare ? screenShareStream : remoteScreenShare.stream}
                    displayName={hasLocalScreenShare ? currentUser?.display_name : remoteScreenShare.displayName}
                    isLocal={hasLocalScreenShare}
                    onStopSharing={onStopScreenShare}
                />
            )}

            {/* Participants Grid */}
            {channelUsers.length > 0 && (
                <div className="voice-participants-grid">
                    {channelUsers.map((user) => {
                        const isLocal = user.id === currentUser?.id;
                        const isSpeaking = isLocal
                            ? speakingUsers.has('local')
                            : speakingUsers.has(user.socketId);

                        return (
                            <div
                                key={user.socketId}
                                className={`voice-participant ${isSpeaking ? 'speaking' : ''} ${user.muted ? 'is-muted' : ''} ${user.deafened ? 'is-deafened' : ''}`}
                            >
                                <div className="voice-participant-avatar-wrapper">
                                    <div
                                        className="voice-participant-avatar"
                                        style={{ backgroundColor: user.avatar_color || '#5865F2' }}
                                    >
                                        {user.display_name?.charAt(0).toUpperCase()}
                                    </div>
                                    {isSpeaking && <div className="speaking-ring" />}
                                </div>

                                <span className="voice-participant-name">
                                    {user.display_name}
                                    {isLocal && <span className="voice-you-badge">(Você)</span>}
                                </span>

                                <div className="voice-participant-indicators">
                                    {user.screenSharing && (
                                        <span className="voice-indicator screen-sharing" title="Compartilhando tela">
                                            <Monitor size={14} />
                                        </span>
                                    )}
                                    {user.muted && (
                                        <span className="voice-indicator muted" title="Mutado">
                                            <MicOff size={14} />
                                        </span>
                                    )}
                                    {user.deafened && (
                                        <span className="voice-indicator deafened" title="Ensurdecido">
                                            <HeadphoneOff size={14} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty State (Connected but alone) */}
            {channelUsers.length === 0 && isConnected && (
                <div className="voice-join-prompt fade-in">
                    <div className="voice-join-icon connected">
                        <Volume2 />
                    </div>
                    <h3>Conectado</h3>
                    <p>Aguardando outros participantes entrarem...</p>
                </div>
            )}

            {/* Join Prompt / Button (Disconnected) */}
            {!isConnected && (
                <div className="voice-join-prompt fade-in" style={channelUsers.length > 0 ? { padding: '32px 20px', flex: 'none' } : {}}>
                    {channelUsers.length === 0 && (
                        <>
                            <div className="voice-join-icon">
                                <PhoneCall />
                            </div>
                            <h3>Canal de Voz</h3>
                            <p>Clique no botão abaixo para entrar e conversar com seus amigos.</p>
                        </>
                    )}
                    <button
                        className="voice-join-btn"
                        onClick={() => onJoin(channel.id)}
                        id="voice-join-btn"
                    >
                        <PhoneCall size={18} />
                        Entrar no Canal
                    </button>
                </div>
            )}
        </div>
    );
}
