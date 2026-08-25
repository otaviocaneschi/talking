import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import MessageInput from '../components/MessageInput';
import UserList from '../components/UserList';
import VoiceChannel from '../components/VoiceChannel';
import AudioSettings from '../components/AudioSettings';

export default function Home() {
    const { socket, onlineUsers, voiceUsers: socketVoiceUsers, joinChannel, sendMessage, sendTyping, sendStopTyping } = useSocket();
    const { user } = useAuth();

    // ─── Audio Device State ─────────────────────────────
    const [audioInputDeviceId, setAudioInputDeviceId] = useState(
        () => localStorage.getItem('audioInputDeviceId') || ''
    );
    const [audioOutputDeviceId, setAudioOutputDeviceId] = useState(
        () => localStorage.getItem('audioOutputDeviceId') || ''
    );
    const [showAudioSettings, setShowAudioSettings] = useState(false);

    const {
        voiceChannelId,
        isMuted,
        isDeafened,
        voiceUsers: webrtcVoiceUsers,
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
    } = useWebRTC(socket, {
        audioInputDeviceId,
        audioOutputDeviceId,
    });

    const [channels, setChannels] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);

    // Merge voice users from socket context and webrtc hook
    const voiceUsers = { ...socketVoiceUsers, ...webrtcVoiceUsers };

    // Carrega canais e usuários na montagem
    useEffect(() => {
        api.getChannels().then((data) => {
            setChannels(data.all || []);
            // Seleciona o primeiro canal de texto por padrão
            const firstText = (data.text || [])[0];
            if (firstText) {
                handleSelectChannel(firstText);
            }
        });

        api.getUsers().then((data) => {
            setAllUsers(Array.isArray(data) ? data : []);
        });
    }, []);

    // Escuta novas mensagens
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg) => {
            setMessages((prev) => [...prev, msg]);
        };

        const handleHistory = (data) => {
            setMessages(data.messages || []);
        };

        const handleTyping = (data) => {
            setTypingUsers((prev) => {
                if (prev.includes(data.display_name)) return prev;
                return [...prev, data.display_name];
            });
        };

        const handleStopTyping = (data) => {
            setTypingUsers((prev) => prev.filter((name) => name !== data.display_name));
        };

        socket.on('message:new', handleNewMessage);
        socket.on('channel:history', handleHistory);
        socket.on('message:typing', handleTyping);
        socket.on('message:stop-typing', handleStopTyping);

        return () => {
            socket.off('message:new', handleNewMessage);
            socket.off('channel:history', handleHistory);
            socket.off('message:typing', handleTyping);
            socket.off('message:stop-typing', handleStopTyping);
        };
    }, [socket]);

    // Limpa typing indicators após 3 segundos (fallback)
    useEffect(() => {
        if (typingUsers.length === 0) return;

        const timeout = setTimeout(() => {
            setTypingUsers([]);
        }, 3000);

        return () => clearTimeout(timeout);
    }, [typingUsers]);

    const handleSelectChannel = useCallback((channel) => {
        setActiveChannel(channel);

        if (channel.type === 'voice') {
            // Não faz join automaticamente — o usuário decide via botão
            return;
        }

        setMessages([]);
        setTypingUsers([]);
        joinChannel(channel.id);
    }, [joinChannel]);

    const handleJoinVoice = useCallback(async (channelId) => {
        try {
            await joinVoice(channelId);
        } catch (err) {
            console.error('Erro ao entrar no canal de voz:', err);
        }
    }, [joinVoice]);

    const handleToggleScreenShare = useCallback(() => {
        if (isScreenSharing) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare]);

    const handleChangeInput = useCallback((deviceId) => {
        setAudioInputDeviceId(deviceId);
        changeAudioInput(deviceId);
    }, [changeAudioInput]);

    const handleChangeOutput = useCallback((deviceId) => {
        setAudioOutputDeviceId(deviceId);
        changeAudioOutput(deviceId);
    }, [changeAudioOutput]);

    // Encontra o nome do canal de voz conectado
    const connectedVoiceChannel = channels.find((c) => c.id === voiceChannelId);

    return (
        <div className="app-layout">
            <Sidebar
                channels={channels}
                activeChannel={activeChannel}
                onSelectChannel={handleSelectChannel}
                voiceUsers={voiceUsers}
                voiceChannelId={voiceChannelId}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isScreenSharing={isScreenSharing}
                connectedVoiceChannelName={connectedVoiceChannel?.name}
                onToggleMute={toggleMute}
                onToggleDeafen={toggleDeafen}
                onToggleScreenShare={handleToggleScreenShare}
                onDisconnectVoice={leaveVoice}
                onOpenAudioSettings={() => setShowAudioSettings(true)}
            />

            <div className="main-content">
                {/* Header */}
                <div className="chat-header">
                    {activeChannel && (
                        <>
                            <span className="channel-hash">
                                {activeChannel.type === 'text' ? '#' : '🔊'}
                            </span>
                            <span className="channel-title">{activeChannel.name}</span>
                            <div className="chat-header-divider" />
                            <span className="channel-description">
                                {activeChannel.type === 'voice'
                                    ? `Canal de voz${voiceChannelId === activeChannel.id ? ' — conectado' : ''}`
                                    : `Conversando em #${activeChannel.name}`
                                }
                            </span>
                        </>
                    )}
                </div>

                {/* Chat + Users / Voice Channel */}
                <div className="chat-container">
                    {activeChannel?.type === 'voice' ? (
                        <VoiceChannel
                            channel={activeChannel}
                            voiceUsers={voiceUsers}
                            speakingUsers={speakingUsers}
                            voiceChannelId={voiceChannelId}
                            onJoin={handleJoinVoice}
                            currentUser={user}
                            isScreenSharing={isScreenSharing}
                            screenShareStream={screenShareStream}
                            remoteScreenShare={remoteScreenShare}
                            onStopScreenShare={stopScreenShare}
                        />
                    ) : (
                        <>
                            <div className="chat-area">
                                <ChatArea
                                    messages={messages}
                                    channel={activeChannel}
                                    typingUsers={typingUsers}
                                />
                                {activeChannel?.type === 'text' && (
                                    <MessageInput
                                        channelId={activeChannel?.id}
                                        onSend={sendMessage}
                                        onTyping={sendTyping}
                                        onStopTyping={sendStopTyping}
                                    />
                                )}
                            </div>
                            <UserList
                                onlineUsers={onlineUsers}
                                allUsers={allUsers}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Audio Settings Modal */}
            <AudioSettings
                isOpen={showAudioSettings}
                onClose={() => setShowAudioSettings(false)}
                audioInputDeviceId={audioInputDeviceId}
                audioOutputDeviceId={audioOutputDeviceId}
                onChangeInput={handleChangeInput}
                onChangeOutput={handleChangeOutput}
            />
        </div>
    );
}
