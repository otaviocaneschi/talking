import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

/**
 * Hook que gerencia toda a lógica WebRTC para canais de voz.
 * Topologia mesh: cada peer conecta com todos os outros.
 * 
 * @param {import('socket.io-client').Socket} socket — Socket.io já autenticado
 * @returns API de controle de voz
 */
export function useWebRTC(socket) {
    // ─── Estado ──────────────────────────────────────────
    const [voiceChannelId, setVoiceChannelId] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [voiceUsers, setVoiceUsers] = useState({}); // { channelId: [users] }
    const [speakingUsers, setSpeakingUsers] = useState(new Set());

    // ─── Refs ────────────────────────────────────────────
    const peerConnections = useRef(new Map()); // Map<socketId, RTCPeerConnection>
    const remoteStreams = useRef(new Map());    // Map<socketId, MediaStream>
    const localStream = useRef(null);
    const audioElements = useRef(new Map());   // Map<socketId, HTMLAudioElement>
    const audioContext = useRef(null);
    const analyserNode = useRef(null);
    const vadInterval = useRef(null);
    const isConnected = useRef(false);

    // ─── Cleanup de um peer ──────────────────────────────
    const cleanupPeer = useCallback((socketId) => {
        const pc = peerConnections.current.get(socketId);
        if (pc) {
            pc.close();
            peerConnections.current.delete(socketId);
        }

        remoteStreams.current.delete(socketId);

        const audio = audioElements.current.get(socketId);
        if (audio) {
            audio.srcObject = null;
            audio.remove();
            audioElements.current.delete(socketId);
        }
    }, []);

    // ─── Cleanup total ───────────────────────────────────
    const cleanupAll = useCallback(() => {
        // Para todas as peer connections
        for (const socketId of peerConnections.current.keys()) {
            cleanupPeer(socketId);
        }

        // Para o stream local
        if (localStream.current) {
            localStream.current.getTracks().forEach((track) => track.stop());
            localStream.current = null;
        }

        // Para o VAD
        if (vadInterval.current) {
            clearInterval(vadInterval.current);
            vadInterval.current = null;
        }

        if (audioContext.current) {
            audioContext.current.close().catch(() => {});
            audioContext.current = null;
            analyserNode.current = null;
        }

        isConnected.current = false;
        setSpeakingUsers(new Set());
    }, [cleanupPeer]);

    // ─── Reproduz áudio remoto ───────────────────────────
    const playRemoteStream = useCallback((socketId, stream) => {
        let audio = audioElements.current.get(socketId);
        if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audioElements.current.set(socketId, audio);
        }
        audio.srcObject = stream;
    }, []);

    // ─── Cria PeerConnection para um peer ────────────────
    const createPeerConnection = useCallback((targetSocketId) => {
        if (peerConnections.current.has(targetSocketId)) {
            cleanupPeer(targetSocketId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Adiciona tracks locais
        if (localStream.current) {
            localStream.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStream.current);
            });
        }

        // Recebe tracks remotos
        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (remoteStream) {
                remoteStreams.current.set(targetSocketId, remoteStream);
                playRemoteStream(targetSocketId, remoteStream);
            }
        };

        // Envia ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('webrtc:ice-candidate', {
                    targetSocketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.warn(`⚠️ Peer ${targetSocketId}: ${pc.connectionState}`);
            }
        };

        peerConnections.current.set(targetSocketId, pc);
        return pc;
    }, [socket, cleanupPeer, playRemoteStream]);

    // ─── Voice Activity Detection (VAD) ──────────────────
    const startVAD = useCallback(() => {
        if (!localStream.current) return;

        try {
            audioContext.current = new AudioContext();
            const source = audioContext.current.createMediaStreamSource(localStream.current);
            analyserNode.current = audioContext.current.createAnalyser();
            analyserNode.current.fftSize = 512;
            analyserNode.current.smoothingTimeConstant = 0.4;
            source.connect(analyserNode.current);

            const dataArray = new Uint8Array(analyserNode.current.frequencyBinCount);

            vadInterval.current = setInterval(() => {
                if (!analyserNode.current) return;

                analyserNode.current.getByteFrequencyData(dataArray);

                // Calcula o volume médio
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Threshold de ~15 para detectar fala
                const isSpeaking = average > 15;

                setSpeakingUsers((prev) => {
                    const next = new Set(prev);
                    if (isSpeaking) {
                        next.add('local');
                    } else {
                        next.delete('local');
                    }
                    // Só atualiza se mudou
                    if (next.size !== prev.size || ![...next].every((v) => prev.has(v))) {
                        return next;
                    }
                    return prev;
                });
            }, 100);
        } catch (err) {
            console.error('Erro no VAD:', err);
        }
    }, []);

    // ─── Join Voice Channel ──────────────────────────────
    const joinVoice = useCallback(async (channelId) => {
        if (isConnected.current) {
            // Já está em um canal, sai primeiro
            leaveVoice();
        }

        try {
            // Captura áudio do microfone
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            localStream.current = stream;
            isConnected.current = true;
            setVoiceChannelId(channelId);

            // Inicia detecção de voz
            startVAD();

            // Pede ao server para entrar no canal
            socket.emit('voice:join', channelId);
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            isConnected.current = false;
            throw err;
        }
    }, [socket, startVAD]);

    // ─── Leave Voice Channel ─────────────────────────────
    const leaveVoice = useCallback(() => {
        if (socket && voiceChannelId) {
            socket.emit('voice:leave');
        }
        cleanupAll();
        setVoiceChannelId(null);
        setIsMuted(false);
        setIsDeafened(false);
    }, [socket, voiceChannelId, cleanupAll]);

    // ─── Toggle Mute ─────────────────────────────────────
    const toggleMute = useCallback(() => {
        if (!localStream.current) return;

        const newMuted = !isMuted;
        localStream.current.getAudioTracks().forEach((track) => {
            track.enabled = !newMuted;
        });

        setIsMuted(newMuted);
        socket?.emit('voice:mute', newMuted);
    }, [isMuted, socket]);

    // ─── Toggle Deafen ───────────────────────────────────
    const toggleDeafen = useCallback(() => {
        const newDeafened = !isDeafened;

        // Silencia todos os áudios remotos
        for (const audio of audioElements.current.values()) {
            audio.muted = newDeafened;
        }

        // Deafen implica mute
        if (newDeafened && !isMuted) {
            localStream.current?.getAudioTracks().forEach((track) => {
                track.enabled = false;
            });
            setIsMuted(true);
        } else if (!newDeafened && isMuted) {
            localStream.current?.getAudioTracks().forEach((track) => {
                track.enabled = true;
            });
            setIsMuted(false);
        }

        setIsDeafened(newDeafened);
        socket?.emit('voice:deafen', newDeafened);
    }, [isDeafened, isMuted, socket]);

    // ─── Socket Event Listeners ──────────────────────────
    useEffect(() => {
        if (!socket) return;

        // Lista de peers já no canal (ao entrar)
        const handlePeers = async ({ peers }) => {
            for (const peer of peers) {
                const pc = createPeerConnection(peer.socketId);

                // Cria offer para cada peer existente
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    socket.emit('webrtc:offer', {
                        targetSocketId: peer.socketId,
                        offer: pc.localDescription,
                    });
                } catch (err) {
                    console.error('Erro ao criar offer:', err);
                }
            }
        };

        // Novo peer entrou (ele vai nos enviar um offer)
        const handleUserJoined = ({ socketId }) => {
            // Apenas prepara a connection, o novo peer enviará o offer
            createPeerConnection(socketId);
        };

        // Peer saiu
        const handleUserLeft = ({ socketId }) => {
            cleanupPeer(socketId);
        };

        // Recebe offer de um peer
        const handleOffer = async ({ fromSocketId, offer }) => {
            let pc = peerConnections.current.get(fromSocketId);
            if (!pc) {
                pc = createPeerConnection(fromSocketId);
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('webrtc:answer', {
                    targetSocketId: fromSocketId,
                    answer: pc.localDescription,
                });
            } catch (err) {
                console.error('Erro ao processar offer:', err);
            }
        };

        // Recebe answer de um peer
        const handleAnswer = async ({ fromSocketId, answer }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error('Erro ao processar answer:', err);
                }
            }
        };

        // Recebe ICE candidate de um peer
        const handleIceCandidate = async ({ fromSocketId, candidate }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('Erro ao adicionar ICE candidate:', err);
                }
            }
        };

        // Atualização de usuários nos canais de voz
        const handleVoiceUsers = ({ channelId, users }) => {
            setVoiceUsers((prev) => ({
                ...prev,
                [channelId]: users,
            }));
        };

        socket.on('voice:peers', handlePeers);
        socket.on('voice:user-joined', handleUserJoined);
        socket.on('voice:user-left', handleUserLeft);
        socket.on('webrtc:offer', handleOffer);
        socket.on('webrtc:answer', handleAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('voice:users', handleVoiceUsers);

        return () => {
            socket.off('voice:peers', handlePeers);
            socket.off('voice:user-joined', handleUserJoined);
            socket.off('voice:user-left', handleUserLeft);
            socket.off('webrtc:offer', handleOffer);
            socket.off('webrtc:answer', handleAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('voice:users', handleVoiceUsers);
        };
    }, [socket, createPeerConnection, cleanupPeer]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            cleanupAll();
        };
    }, [cleanupAll]);

    return {
        voiceChannelId,
        isMuted,
        isDeafened,
        voiceUsers,
        speakingUsers,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
    };
}
