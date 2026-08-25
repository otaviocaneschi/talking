import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
};

/**
 * Hook que gerencia toda a lógica WebRTC para canais de voz.
 * Topologia mesh: cada peer conecta com todos os outros.
 * 
 * @param {import('socket.io-client').Socket} socket — Socket.io já autenticado
 * @param {object} options — Configurações de dispositivos
 * @param {string} options.audioInputDeviceId — ID do microfone selecionado
 * @param {string} options.audioOutputDeviceId — ID da saída de áudio selecionada
 * @returns API de controle de voz
 */
export function useWebRTC(socket, options = {}) {
    const { audioInputDeviceId, audioOutputDeviceId } = options;

    // ─── Estado ──────────────────────────────────────────
    const [voiceChannelId, setVoiceChannelId] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [voiceUsers, setVoiceUsers] = useState({}); // { channelId: [users] }
    const [speakingUsers, setSpeakingUsers] = useState(new Set());
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenShareStream, setScreenShareStream] = useState(null);
    const [remoteScreenShare, setRemoteScreenShare] = useState(null);
    const [peerConnectionStates, setPeerConnectionStates] = useState({}); // { socketId, displayName, stream }

    // ─── Refs ────────────────────────────────────────────
    const peerConnections = useRef(new Map()); // Map<socketId, RTCPeerConnection>
    const remoteStreams = useRef(new Map());    // Map<socketId, MediaStream>
    const localStream = useRef(null);
    const audioElements = useRef(new Map());   // Map<socketId, HTMLAudioElement>
    const audioContext = useRef(null);
    const analyserNode = useRef(null);
    const vadInterval = useRef(null);
    const isConnected = useRef(false);
    const screenStream = useRef(null);         // MediaStream da tela compartilhada
    const screenSenders = useRef(new Map());   // Map<socketId, RTCRtpSender> (video senders)
    const currentOutputDeviceId = useRef(audioOutputDeviceId || '');
    const makingOffer = useRef(new Map());     // Map<socketId, boolean>
    const ignoreOffer = useRef(new Map());     // Map<socketId, boolean>

    // ─── Cleanup de um peer ──────────────────────────────
    const cleanupPeer = useCallback((socketId) => {
        const pc = peerConnections.current.get(socketId);
        if (pc) {
            pc.close();
            peerConnections.current.delete(socketId);
        }

        remoteStreams.current.delete(socketId);
        screenSenders.current.delete(socketId);

        const audio = audioElements.current.get(socketId);
        if (audio) {
            audio.srcObject = null;
            audio.remove();
            audioElements.current.delete(socketId);
        }

        makingOffer.current.delete(socketId);
        ignoreOffer.current.delete(socketId);
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

        // Para screen share se ativo
        if (screenStream.current) {
            screenStream.current.getTracks().forEach((track) => track.stop());
            screenStream.current = null;
        }
        setIsScreenSharing(false);
        setScreenShareStream(null);
        setRemoteScreenShare(null);
        screenSenders.current.clear();

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

        makingOffer.current.clear();
        ignoreOffer.current.clear();

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
        audio.play().catch((e) => console.warn('Autoplay blocked:', e));

        // Aplica o dispositivo de saída atual
        if (currentOutputDeviceId.current && typeof audio.setSinkId === 'function') {
            audio.setSinkId(currentOutputDeviceId.current).catch((err) => {
                console.warn('Erro ao definir saída de áudio:', err);
            });
        }
    }, []);

    // ─── Controla o volume remoto ────────────────────────
    const setPeerVolume = useCallback((socketId, volume) => {
        const audio = audioElements.current.get(socketId);
        if (audio) {
            audio.volume = volume;
        }
    }, []);

    // ─── Cria PeerConnection para um peer ────────────────
    const createPeerConnection = useCallback((targetSocketId) => {
        if (peerConnections.current.has(targetSocketId)) {
            cleanupPeer(targetSocketId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        
        setPeerConnectionStates(prev => ({
            ...prev,
            [targetSocketId]: 'new'
        }));

        // 1. Bind Listeners BEFORE adding tracks
        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (!remoteStream) return;

            const track = event.track;

            if (track.kind === 'audio') {
                remoteStreams.current.set(targetSocketId, remoteStream);
                playRemoteStream(targetSocketId, remoteStream);
            } else if (track.kind === 'video') {
                setRemoteScreenShare((prev) => {
                    if (prev?.socketId === targetSocketId) {
                        return { ...prev, stream: remoteStream };
                    }
                    return {
                        socketId: targetSocketId,
                        displayName: '',
                        stream: remoteStream,
                    };
                });

                track.onended = () => {
                    setRemoteScreenShare((prev) => {
                        if (prev?.socketId === targetSocketId) return null;
                        return prev;
                    });
                };

                track.onmute = () => {
                    setRemoteScreenShare((prev) => {
                        if (prev?.socketId === targetSocketId) return null;
                        return prev;
                    });
                };
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('webrtc:ice-candidate', {
                    targetSocketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            setPeerConnectionStates(prev => ({
                ...prev,
                [targetSocketId]: pc.connectionState
            }));
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.warn(`⚠️ Peer ${targetSocketId}: ${pc.connectionState}`);
            }
        };

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current.set(targetSocketId, true);
                const offer = await pc.createOffer();
                if (pc.signalingState !== 'stable') return;
                await pc.setLocalDescription(offer);

                socket?.emit('webrtc:offer', {
                    targetSocketId,
                    offer: pc.localDescription,
                });
            } catch (err) {
                console.error('Erro na renegociação:', err);
            } finally {
                makingOffer.current.set(targetSocketId, false);
            }
        };

        // 2. Add Tracks (this will now reliably fire onnegotiationneeded)
        if (localStream.current) {
            localStream.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStream.current);
            });
        }

        if (screenStream.current) {
            const videoTrack = screenStream.current.getVideoTracks()[0];
            if (videoTrack) {
                const sender = pc.addTrack(videoTrack, screenStream.current);
                screenSenders.current.set(targetSocketId, sender);
            }
        }

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
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('⚠️ Canais de voz requerem conexão segura (HTTPS).\n\nO navegador bloqueia o acesso ao microfone em sites sem HTTPS.\nPeça ao administrador para configurar um domínio com SSL.');
            return;
        }

        if (isConnected.current) {
            // Já está em um canal, sai primeiro
            leaveVoice();
        }

        try {
            // Captura áudio do microfone com o device selecionado
            const audioConstraints = {
                echoCancellation: true,
                noiseSuppression: options.noiseSuppressionEnabled !== false,
                autoGainControl: true,
            };

            if (audioInputDeviceId) {
                audioConstraints.deviceId = { exact: audioInputDeviceId };
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
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
    }, [socket, startVAD, audioInputDeviceId]);

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

    // ─── Trocar Dispositivo de Entrada (Microfone) ───────
    const changeAudioInput = useCallback(async (deviceId) => {
        if (!isConnected.current || !localStream.current) return;

        try {
            // Captura novo stream com o device selecionado
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: options.noiseSuppressionEnabled !== false,
                    autoGainControl: true,
                },
                video: false,
            });

            const newTrack = newStream.getAudioTracks()[0];

            // Substitui a track em todas as peer connections
            for (const [, pc] of peerConnections.current) {
                const senders = pc.getSenders();
                const audioSender = senders.find((s) => s.track?.kind === 'audio');
                if (audioSender) {
                    await audioSender.replaceTrack(newTrack);
                }
            }

            // Para o track antigo
            localStream.current.getAudioTracks().forEach((t) => t.stop());

            // Substitui no localStream
            localStream.current.removeTrack(localStream.current.getAudioTracks()[0]);
            localStream.current.addTrack(newTrack);

            // Aplica o estado de mute atual
            newTrack.enabled = !isMuted;

            // Reinicia o VAD com o novo stream
            if (vadInterval.current) {
                clearInterval(vadInterval.current);
                vadInterval.current = null;
            }
            if (audioContext.current) {
                audioContext.current.close().catch(() => {});
                audioContext.current = null;
                analyserNode.current = null;
            }
            startVAD();
        } catch (err) {
            console.error('Erro ao trocar microfone:', err);
        }
    }, [isMuted, startVAD]);

    // ─── Trocar Dispositivo de Saída (Alto-falante) ──────
    const changeAudioOutput = useCallback(async (deviceId) => {
        currentOutputDeviceId.current = deviceId;

        // Aplica em todos os audio elements existentes
        for (const [, audio] of audioElements.current) {
            if (typeof audio.setSinkId === 'function') {
                try {
                    await audio.setSinkId(deviceId);
                } catch (err) {
                    console.warn('Erro ao trocar saída de áudio:', err);
                }
            }
        }
    }, []);

    // ─── Iniciar Screen Share ────────────────────────────
    const startScreenShare = useCallback(async () => {
        if (!isConnected.current || isScreenSharing) return;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 },
                },
                audio: false,
            });

            screenStream.current = stream;
            const videoTrack = stream.getVideoTracks()[0];

            // Adiciona video track em todas as peer connections
            for (const [socketId, pc] of peerConnections.current) {
                try {
                    const sender = pc.addTrack(videoTrack, stream);
                    screenSenders.current.set(socketId, sender);
                } catch (err) {
                    console.error(`Erro ao adicionar screen track para ${socketId}:`, err);
                }
            }

            setIsScreenSharing(true);
            setScreenShareStream(stream);

            // Notifica o server
            socket?.emit('screen:start');

            // Quando o user para pelo botão nativo do browser/electron
            videoTrack.onended = () => {
                stopScreenShare();
            };
        } catch (err) {
            // User cancelou o dialog de seleção de tela
            if (err.name !== 'NotAllowedError') {
                console.error('Erro ao compartilhar tela:', err);
            }
        }
    }, [isScreenSharing, socket]);

    // ─── Parar Screen Share ──────────────────────────────
    const stopScreenShare = useCallback(() => {
        if (!screenStream.current) return;

        // Remove video tracks de todas as peer connections
        for (const [socketId, pc] of peerConnections.current) {
            const sender = screenSenders.current.get(socketId);
            if (sender) {
                try {
                    pc.removeTrack(sender);
                } catch (err) {
                    console.warn(`Erro ao remover screen track de ${socketId}:`, err);
                }
            }
        }
        screenSenders.current.clear();

        // Para o stream
        screenStream.current.getTracks().forEach((track) => track.stop());
        screenStream.current = null;

        setIsScreenSharing(false);
        setScreenShareStream(null);

        // Notifica o server
        socket?.emit('screen:stop');
    }, [socket]);

    // ─── Atualiza output device quando prop muda ─────────
    useEffect(() => {
        if (audioOutputDeviceId) {
            changeAudioOutput(audioOutputDeviceId);
        }
    }, [audioOutputDeviceId, changeAudioOutput]);

    // ─── Socket Event Listeners ──────────────────────────
    useEffect(() => {
        if (!socket) return;

        // Lista de peers já no canal (ao entrar)
        const handlePeers = async ({ peers }) => {
            for (const peer of peers) {
                createPeerConnection(peer.socketId);
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

            // Se era quem estava compartilhando tela, limpa
            setRemoteScreenShare((prev) => {
                if (prev?.socketId === socketId) return null;
                return prev;
            });
        };

        // Recebe offer de um peer
        const handleOffer = async ({ fromSocketId, offer }) => {
            let pc = peerConnections.current.get(fromSocketId);
            if (!pc) {
                pc = createPeerConnection(fromSocketId);
            }

            const polite = socket.id > fromSocketId;
            const offerCollision = makingOffer.current.get(fromSocketId) || pc.signalingState !== 'stable';

            ignoreOffer.current.set(fromSocketId, !polite && offerCollision);
            if (ignoreOffer.current.get(fromSocketId)) {
                return;
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
                    if (!ignoreOffer.current.get(fromSocketId)) {
                        console.error('Erro ao adicionar ICE candidate:', err);
                    }
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

        // Screen sharing de outro peer
        const handleScreenStarted = ({ socketId, display_name }) => {
            setRemoteScreenShare((prev) => ({
                ...prev,
                socketId,
                displayName: display_name,
            }));
        };

        const handleScreenStopped = ({ socketId }) => {
            setRemoteScreenShare((prev) => {
                if (prev?.socketId === socketId) return null;
                return prev;
            });
        };

        socket.on('voice:peers', handlePeers);
        socket.on('voice:user-joined', handleUserJoined);
        socket.on('voice:user-left', handleUserLeft);
        socket.on('webrtc:offer', handleOffer);
        socket.on('webrtc:answer', handleAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('voice:users', handleVoiceUsers);
        socket.on('screen:started', handleScreenStarted);
        socket.on('screen:stopped', handleScreenStopped);

        return () => {
            socket.off('voice:peers', handlePeers);
            socket.off('voice:user-joined', handleUserJoined);
            socket.off('voice:user-left', handleUserLeft);
            socket.off('webrtc:offer', handleOffer);
            socket.off('webrtc:answer', handleAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('voice:users', handleVoiceUsers);
            socket.off('screen:started', handleScreenStarted);
            socket.off('screen:stopped', handleScreenStopped);
        };
    }, [socket, createPeerConnection, cleanupPeer]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            cleanupAll();
        };
    }, [cleanupAll]);

    // ─── Atualiza constraint de supressão de ruído ────────
    useEffect(() => {
        if (localStream.current) {
            const track = localStream.current.getAudioTracks()[0];
            if (track) {
                track.applyConstraints({
                    noiseSuppression: options.noiseSuppressionEnabled !== false,
                    echoCancellation: true,
                    autoGainControl: true,
                }).catch(err => console.error("Error applying noise suppression constraint", err));
            }
        }
    }, [options.noiseSuppressionEnabled]);

    return {
        voiceChannelId,
        isMuted,
        isDeafened,
        voiceUsers,
        speakingUsers,
        isScreenSharing,
        screenShareStream,
        remoteScreenShare,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        changeAudioInput,
        changeAudioOutput,
        startScreenShare,
        stopScreenShare,
        setPeerVolume,
        peerConnectionStates,
    };
}
