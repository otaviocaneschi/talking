import { useState, useEffect, useCallback } from 'react';
import { Hash } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import MessageInput from '../components/MessageInput';
import UserList from '../components/UserList';

export default function Home() {
    const { socket, onlineUsers, joinChannel, sendMessage, sendTyping, sendStopTyping } = useSocket();

    const [channels, setChannels] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);

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
        if (channel.type === 'voice') {
            // Voice channels serão implementados na Fase 4
            setActiveChannel(channel);
            return;
        }

        setActiveChannel(channel);
        setMessages([]);
        setTypingUsers([]);
        joinChannel(channel.id);
    }, [joinChannel]);

    return (
        <div className="app-layout">
            <Sidebar
                channels={channels}
                activeChannel={activeChannel}
                onSelectChannel={handleSelectChannel}
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
                                    ? 'Canal de voz — em breve!'
                                    : `Conversando em #${activeChannel.name}`
                                }
                            </span>
                        </>
                    )}
                </div>

                {/* Chat + Users */}
                <div className="chat-container">
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
                </div>
            </div>
        </div>
    );
}
