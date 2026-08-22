import { useEffect, useRef } from 'react';
import { Hash } from 'lucide-react';

/**
 * Formata a data para exibição na mensagem.
 */
function formatTimestamp(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Hoje às ${time}`;
    if (isYesterday) return `Ontem às ${time}`;
    return `${date.toLocaleDateString('pt-BR')} às ${time}`;
}

/**
 * Verifica se uma mensagem deve mostrar o header (avatar + nome).
 * Agrupa mensagens do mesmo autor com menos de 5 min de diferença.
 */
function shouldShowHeader(message, prevMessage) {
    if (!prevMessage) return true;
    if (message.user_id !== prevMessage.user_id) return true;

    const timeDiff = new Date(message.created_at) - new Date(prevMessage.created_at);
    return timeDiff > 5 * 60 * 1000; // 5 minutos
}

export default function ChatArea({ messages, channel, typingUsers }) {
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);

    // Auto-scroll para o final quando novas mensagens chegam
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    if (!channel) {
        return (
            <div className="chat-area">
                <div className="empty-state">
                    <Hash size={48} />
                    <p>Selecione um canal para começar</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-area">
            {/* Messages */}
            <div className="messages-container" ref={containerRef}>
                {/* Welcome message */}
                <div className="welcome-message fade-in">
                    <div className="welcome-icon">
                        <Hash />
                    </div>
                    <h2 className="welcome-title">Bem-vindo ao #{channel.name}!</h2>
                    <p className="welcome-text">
                        Este é o início do canal #{channel.name}. Comece a conversa!
                    </p>
                </div>

                {/* Message list */}
                <div className="messages-list">
                    {messages.map((msg, index) => {
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const showHeader = shouldShowHeader(msg, prevMsg);

                        return (
                            <div
                                key={msg.id}
                                className={`message ${showHeader ? 'has-header' : ''}`}
                            >
                                <div className="message-avatar-col">
                                    {showHeader && (
                                        <div
                                            className="message-avatar"
                                            style={{ backgroundColor: msg.avatar_color || '#5865F2' }}
                                        >
                                            {msg.display_name?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="message-content-col">
                                    {showHeader && (
                                        <div className="message-header">
                                            <span
                                                className={`message-author ${msg.is_admin ? 'admin' : ''}`}
                                                style={{ color: msg.avatar_color }}
                                            >
                                                {msg.display_name}
                                            </span>
                                            <span className="message-timestamp">
                                                {formatTimestamp(msg.created_at)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="message-text">{msg.content}</div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Typing indicator */}
            <div className="typing-indicator">
                {typingUsers.length > 0 && (
                    <>
                        <div className="typing-dots">
                            <span />
                            <span />
                            <span />
                        </div>
                        <span>
                            {typingUsers.length === 1
                                ? `${typingUsers[0]} está digitando...`
                                : `${typingUsers.join(', ')} estão digitando...`
                            }
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
