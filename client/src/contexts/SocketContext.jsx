import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = 'http://localhost:3001';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const socketRef = useRef(null);

    // Conecta ao servidor quando tem token
    useEffect(() => {
        if (!token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        const newSocket = io(SOCKET_URL, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log('🟢 Socket conectado:', newSocket.id);
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('🔴 Socket desconectado');
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Erro de conexão:', err.message);
        });

        // Usuários online
        newSocket.on('user:online', (users) => {
            setOnlineUsers(users);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    // Entrar em um canal
    const joinChannel = useCallback((channelId) => {
        if (socketRef.current) {
            socketRef.current.emit('channel:join', channelId);
        }
    }, []);

    // Enviar mensagem
    const sendMessage = useCallback((channelId, content) => {
        if (socketRef.current) {
            socketRef.current.emit('message:send', { channelId, content });
        }
    }, []);

    // Indicador de digitação
    const sendTyping = useCallback((channelId) => {
        if (socketRef.current) {
            socketRef.current.emit('message:typing', channelId);
        }
    }, []);

    const sendStopTyping = useCallback((channelId) => {
        if (socketRef.current) {
            socketRef.current.emit('message:stop-typing', channelId);
        }
    }, []);

    return (
        <SocketContext.Provider value={{
            socket,
            connected,
            onlineUsers,
            joinChannel,
            sendMessage,
            sendTyping,
            sendStopTyping,
        }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
