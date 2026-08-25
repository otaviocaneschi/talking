import { useRef, useEffect } from 'react';
import { Maximize2, Minimize2, MonitorOff } from 'lucide-react';
import { useState } from 'react';

/**
 * Visualização do compartilhamento de tela.
 * Mostra o vídeo do stream compartilhado com controles overlay.
 */
export default function ScreenShareView({
    stream,
    displayName,
    isLocal,
    onStopSharing,
}) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Conecta o stream ao elemento de vídeo
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }

        return () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [stream]);

    // Escuta mudança de fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            containerRef.current.requestFullscreen();
        }
    };

    if (!stream) return null;

    return (
        <div className="screen-share-view" ref={containerRef}>
            {/* Header */}
            <div className="screen-share-header">
                <div className="screen-share-info">
                    <div className="screen-share-live-badge">AO VIVO</div>
                    <span className="screen-share-user">
                        {isLocal ? 'Você está' : `${displayName} está`} compartilhando a tela
                    </span>
                </div>
                <div className="screen-share-actions">
                    <button
                        className="screen-share-action-btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                        id="screen-share-fullscreen-btn"
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    {isLocal && (
                        <button
                            className="screen-share-stop-btn"
                            onClick={onStopSharing}
                            id="screen-share-stop-btn"
                        >
                            <MonitorOff size={14} />
                            Parar Compartilhamento
                        </button>
                    )}
                </div>
            </div>

            {/* Video */}
            <video
                ref={videoRef}
                className="screen-share-video"
                autoPlay
                playsInline
                muted={isLocal}
            />
        </div>
    );
}
