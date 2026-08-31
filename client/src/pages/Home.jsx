import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import ServerList from '../components/ServerList';
import ServerModals from '../components/ServerModals';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import MessageInput from '../components/MessageInput';
import UserList from '../components/UserList';
import VoiceChannel from '../components/VoiceChannel';
import AudioSettings from '../components/AudioSettings';
import AdminPanel from '../components/AdminPanel';

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
    const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(
        () => localStorage.getItem('noiseSuppression') !== 'false'
    );

    const toggleNoiseSuppression = () => {
        setNoiseSuppressionEnabled(prev => {
            const next = !prev;
            localStorage.setItem('noiseSuppression', next.toString());
            return next;
        });
    };

    const {
        voiceChannelId,
        isMuted,
        isDeafened,
        voiceUsers: webrtcVoiceUsers,
        speakingUsers,
        isScreenSharing,
        screenShareStream,
        remoteScreenShares,
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
    } = useWebRTC(socket, {
        audioInputDeviceId,
        audioOutputDeviceId,
        noiseSuppressionEnabled,
    });

    const [servers, setServers] = useState([]);
    const [activeServerId, setActiveServerId] = useState(null);
    const [isServerModalOpen, setIsServerModalOpen] = useState(false);

    const [channels, setChannels] = useState([]);
    const [friends, setFriends] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    // Merge voice users from socket context and webrtc hook
    const voiceUsers = { ...socketVoiceUsers, ...webrtcVoiceUsers };

    // Carrega servidores iniciais
    const loadServers = useCallback(async () => {
        try {
            const data = await api.getServers();
            setServers(data);
        } catch (err) {
            console.error('Failed to load servers', err);
        }
    }, []);

    const loadFriends = useCallback(async () => {
        try {
            const data = await api.getFriends();
            setFriends(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load friends', err);
        }
    }, []);

    useEffect(() => {
        loadServers();
        loadFriends();
    }, [loadServers, loadFriends]);

    // Carrega canais quando o servidor muda
    useEffect(() => {
        if (!activeServerId) {
            setChannels([]);
            setActiveChannel(null);
            setMessages([]);
            return;
        }

        api.getChannels(activeServerId).then((data) => {
            setChannels(data.all || []);
            // Seleciona o primeiro canal de texto por padrão
            const firstText = (data.text || [])[0];
            if (firstText) {
                handleSelectChannel(firstText);
            }
        });
    }, [activeServerId]);

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

        const handleFriendUpdate = () => {
            loadFriends();
        };

        socket.on('message:new', handleNewMessage);
        socket.on('channel:history', handleHistory);
        socket.on('message:typing', handleTyping);
        socket.on('message:stop-typing', handleStopTyping);
        socket.on('friend:update', handleFriendUpdate);

        return () => {
            socket.off('message:new', handleNewMessage);
            socket.off('channel:history', handleHistory);
            socket.off('message:typing', handleTyping);
            socket.off('message:stop-typing', handleStopTyping);
            socket.off('friend:update', handleFriendUpdate);
        };
    }, [socket, loadFriends]);

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

    const handleCreateServer = async (name) => {
        const newServer = await api.createServer(name);
        await loadServers();
        setActiveServerId(newServer.id);
    };

    const handleJoinServer = async (code) => {
        const joinedServer = await api.joinServer(code);
        await loadServers();
        setActiveServerId(joinedServer.id);
    };

    const handleAddFriend = async (username) => {
        await api.addFriend(username);
        await loadFriends();
    };

    const handleAcceptFriend = async (id) => {
        await api.acceptFriend(id);
        await loadFriends();
    };

    const handleRejectFriend = async (id) => {
        await api.rejectFriend(id);
        await loadFriends();
    };

    const handleEditChannel = async (channelId, name) => {
        try {
            await api.updateChannel(channelId, name);
            // Refresh channels
            if (activeServerId) {
                const data = await api.getChannels(activeServerId);
                setChannels(data.all || []);
            }
        } catch (err) {
            console.error('Erro ao editar canal:', err);
        }
    };

    const handleDeleteChannel = async (channelId) => {
        try {
            await api.deleteChannel(channelId);
            // If we deleted the active channel, deselect it
            if (activeChannel?.id === channelId) {
                setActiveChannel(null);
                setMessages([]);
            }
            // Refresh channels
            if (activeServerId) {
                const data = await api.getChannels(activeServerId);
                setChannels(data.all || []);
                // Select first text channel if we had the deleted one active
                if (activeChannel?.id === channelId) {
                    const firstText = (data.text || [])[0];
                    if (firstText) handleSelectChannel(firstText);
                }
            }
        } catch (err) {
            console.error('Erro ao excluir canal:', err);
        }
    };
    const handleCreateChannel = async (type) => {
        if (!activeServerId) return;
        const name = prompt(`Qual o nome do novo canal de ${type === 'text' ? 'texto' : 'voz'}?`);
        if (!name || !name.trim()) return;

        try {
            await api.createChannel(activeServerId, name.trim(), type);
            // Refresh channels
            const data = await api.getChannels(activeServerId);
            setChannels(data.all || []);
        } catch (err) {
            console.error('Erro ao criar canal:', err);
            alert('Erro ao criar canal: ' + (err.message || 'Desconhecido'));
        }
    };

    const handleEditServer = async (serverToEdit) => {
        const name = prompt('Qual o novo nome do servidor?', serverToEdit.name);
        if (!name || !name.trim() || name === serverToEdit.name) return;

        try {
            await api.updateServer(serverToEdit.id, name.trim());
            // Refresh servers
            const data = await api.getServers();
            setServers(data);
        } catch (err) {
            console.error('Erro ao editar servidor:', err);
            alert('Erro ao editar servidor: ' + (err.message || 'Desconhecido'));
        }
    };

    const handleDeleteServer = async (serverToDelete) => {
        if (!window.confirm(`ATENÇÃO: Você tem certeza que deseja excluir o servidor "${serverToDelete.name}"? Todos os canais e mensagens serão perdidos.`)) {
            return;
        }

        try {
            await api.deleteServer(serverToDelete.id);
            // Go back to friends list
            if (activeServerId === serverToDelete.id) {
                setActiveServerId('friends');
                setActiveChannel(null);
                setMessages([]);
                setChannels([]);
            }
            // Refresh servers
            const data = await api.getServers();
            setServers(data);
        } catch (err) {
            console.error('Erro ao excluir servidor:', err);
            alert('Erro ao excluir servidor: ' + (err.message || 'Desconhecido'));
        }
    };


    const connectedVoiceChannel = channels.find((c) => c.id === voiceChannelId);
    const activeServer = servers.find((s) => s.id === activeServerId);

    return (
        <div className="app-layout">
            <ServerList 
                servers={servers} 
                activeServerId={activeServerId} 
                onSelectServer={setActiveServerId} 
                onOpenModal={() => setIsServerModalOpen(true)}
            />

            <Sidebar
                server={activeServer}
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
                noiseSuppressionEnabled={noiseSuppressionEnabled}
                onToggleNoiseSuppression={toggleNoiseSuppression}
                onEditChannel={handleEditChannel}
                onDeleteChannel={handleDeleteChannel}
                onCreateChannel={handleCreateChannel}
                onEditServer={handleEditServer}
                onDeleteServer={handleDeleteServer}
                onOpenAdminPanel={() => setShowAdminPanel(true)}
            />
            <div className="main-content">
                {/* Header */}
                <div className="chat-header">
                    {activeChannel ? (
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
                            {activeServer && activeChannel.name === 'geral' && (
                                <>
                                    <div className="chat-header-divider" />
                                    <span className="channel-description" style={{ color: 'var(--accent-primary)' }}>
                                        Convite: {activeServer.invite_code}
                                    </span>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="channel-title">
                            {activeServer ? 'Selecione um canal para conversar' : 'Selecione ou crie um servidor para começar'}
                        </span>
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
                            remoteScreenShares={remoteScreenShares}
                            onStopScreenShare={stopScreenShare}
                            setPeerVolume={setPeerVolume}
                            peerConnectionStates={peerConnectionStates}
                        />
                    ) : (
                        <>
                            <div className="chat-area">
                                {activeChannel ? (
                                    <>
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
                                    </>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        Nenhum canal selecionado
                                    </div>
                                )}
                            </div>
                            <UserList
                                onlineUsers={onlineUsers}
                                friends={friends}
                                onAddFriend={handleAddFriend}
                                onAcceptFriend={handleAcceptFriend}
                                onRejectFriend={handleRejectFriend}
                                currentUserId={user.id}
                            />
                        </>
                    )}
                </div>
            </div>

            <ServerModals 
                isOpen={isServerModalOpen}
                onClose={() => setIsServerModalOpen(false)}
                onCreateServer={handleCreateServer}
                onJoinServer={handleJoinServer}
            />

            {/* Audio Settings Modal */}
            <AudioSettings
                isOpen={showAudioSettings}
                onClose={() => setShowAudioSettings(false)}
                audioInputDeviceId={audioInputDeviceId}
                audioOutputDeviceId={audioOutputDeviceId}
                onChangeInput={handleChangeInput}
                onChangeOutput={handleChangeOutput}
            />

            {/* Admin Panel Modal */}
            <AdminPanel 
                isOpen={showAdminPanel} 
                onClose={() => setShowAdminPanel(false)} 
            />
        </div>
    );
}
