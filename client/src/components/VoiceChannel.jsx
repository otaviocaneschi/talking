import { Volume2, Mic, MicOff, Headphones, HeadphoneOff, PhoneCall, Monitor } from 'lucide-react';
import ScreenShareView from './ScreenShareView';
import { useEffect, useRef } from 'react';

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
    remoteScreenShares,
    onStopScreenShare,
    setPeerVolume,
    peerConnectionStates,
}) {
    if (!channel) return null;

    const channelUsers = voiceUsers[channel.id] || [];
    const isConnected = voiceChannelId === channel.id;

    // Monta a lista de screen shares ativos (local + remotos)
    const activeScreenShares = [];

    if (isScreenSharing && screenShareStream && isConnected) {
        activeScreenShares.push({
            key: 'local',
            stream: screenShareStream,
            displayName: currentUser?.display_name,
            isLocal: true,
        });
    }

    if (isConnected && remoteScreenShares) {
        for (const [socketId, data] of remoteScreenShares) {
            if (data.stream) {
                activeScreenShares.push({
                    key: socketId,
                    stream: data.stream,
                    displayName: data.displayName || '',
                    isLocal: false,
                });
            }
        }
    }

    const hasScreenShare = activeScreenShares.length > 0;

    // Aplica volumes salvos (até 200%) quando os usuários entram no canal
    const prevUsers = useRef(new Set());
    useEffect(() => {
        if (!setPeerVolume || !isConnected) return;
        
        const currentSocketIds = new Set(channelUsers.map(u => u.socketId));
        
        channelUsers.forEach(user => {
            // Só aplica se o socket acabou de aparecer
            if (!prevUsers.current.has(user.socketId)) {
                const saved = localStorage.getItem(`volume_${user.id}`);
                if (saved !== null) {
                    setPeerVolume(user.socketId, parseFloat(saved), user.id);
                }
            }
        });
        
        prevUsers.current = currentSocketIds;
    }, [channelUsers, setPeerVolume, isConnected]);

    return (
        <div className="voice-channel-view" style={{ position: 'relative', paddingBottom: !isConnected && channelUsers.length > 0 ? '80px' : '0' }}>
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

            {/* Screen Share Views — Discord-style grid */}
            {hasScreenShare && (
                <div className={`screen-share-grid ${activeScreenShares.length > 1 ? 'multi' : ''}`}>
                    {activeScreenShares.map((ss) => (
                        <ScreenShareView
                            key={ss.key}
                            stream={ss.stream}
                            displayName={ss.displayName}
                            isLocal={ss.isLocal}
                            onStopSharing={onStopScreenShare}
                        />
                    ))}
                </div>
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
                                    {!isLocal && peerConnectionStates && peerConnectionStates[user.socketId] && (
                                        <span className="voice-indicator" style={{ fontSize: '10px', background: 'transparent' }} title={`Estado da Conexão: ${peerConnectionStates[user.socketId]}`}>
                                            {peerConnectionStates[user.socketId] === 'connected' ? '✅' : '⏳'}
                                        </span>
                                    )}
                                </div>

                                {!isLocal && isConnected && (
                                    <div className="voice-participant-volume" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.01"
                                            defaultValue={localStorage.getItem(`volume_${user.id}`) || "1"}
                                            onChange={(e) => setPeerVolume && setPeerVolume(user.socketId, parseFloat(e.target.value), user.id)}
                                            className="volume-slider"
                                            title="Ajustar volume (0% a 200%)"
                                        />
                                    </div>
                                )}
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
                <div 
                    className="voice-join-prompt fade-in" 
                    style={channelUsers.length > 0 ? { 
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        background: 'rgba(30, 31, 34, 0.9)', 
                        borderTop: '1px solid rgba(255,255,255,0.1)', 
                        padding: '16px', 
                        flexDirection: 'row', 
                        justifyContent: 'space-between',
                        backdropFilter: 'blur(8px)',
                        zIndex: 10
                    } : {}}
                >
                    {channelUsers.length === 0 ? (
                        <>
                            <div className="voice-join-icon">
                                <PhoneCall />
                            </div>
                            <h3>Canal de Voz</h3>
                            <p>Clique no botão abaixo para entrar e conversar com seus amigos.</p>
                        </>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                            <h3 style={{margin: 0, fontSize: '16px'}}>Junte-se à chamada</h3>
                            <p style={{margin: 0, fontSize: '12px', color: '#b5bac1'}}>Amigos estão conversando agora mesmo.</p>
                        </div>
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

