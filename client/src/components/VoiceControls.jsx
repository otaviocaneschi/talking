import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Signal } from 'lucide-react';

/**
 * Barra de controles de voz.
 * Aparece na sidebar quando conectado a um canal de voz.
 */
export default function VoiceControls({
    channelName,
    isMuted,
    isDeafened,
    onToggleMute,
    onToggleDeafen,
    onDisconnect,
}) {
    return (
        <div className="voice-controls slide-in">
            {/* Connection Info */}
            <div className="voice-connection-info">
                <div className="voice-connection-status">
                    <Signal size={14} className="voice-signal-icon" />
                    <span className="voice-connected-text">Conectado</span>
                </div>
                <span className="voice-connected-channel">{channelName}</span>
            </div>

            {/* Control Buttons */}
            <div className="voice-control-buttons">
                <button
                    className={`control-btn ${isMuted ? 'active-danger' : ''}`}
                    onClick={onToggleMute}
                    title={isMuted ? 'Desmutar' : 'Mutar'}
                    id="voice-mute-btn"
                >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                    className={`control-btn ${isDeafened ? 'active-danger' : ''}`}
                    onClick={onToggleDeafen}
                    title={isDeafened ? 'Ativar áudio' : 'Desativar áudio'}
                    id="voice-deafen-btn"
                >
                    {isDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
                </button>

                <button
                    className="control-btn disconnect-btn"
                    onClick={onDisconnect}
                    title="Desconectar"
                    id="voice-disconnect-btn"
                >
                    <PhoneOff size={18} />
                </button>
            </div>
        </div>
    );
}
