import { useState, useRef, useCallback } from 'react';
import { SendHorizontal } from 'lucide-react';

export default function MessageInput({ channelId, onSend, onTyping, onStopTyping }) {
    const [content, setContent] = useState('');
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const textareaRef = useRef(null);

    const handleSend = useCallback(() => {
        const trimmed = content.trim();
        if (!trimmed || !channelId) return;

        onSend(channelId, trimmed);
        setContent('');

        // Reset typing
        if (isTypingRef.current) {
            isTypingRef.current = false;
            onStopTyping?.(channelId);
        }
        clearTimeout(typingTimeoutRef.current);

        // Foca no textarea
        textareaRef.current?.focus();
    }, [content, channelId, onSend, onStopTyping]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e) => {
        setContent(e.target.value);

        // Gerencia o indicador de digitação
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            onTyping?.(channelId);
        }

        // Reseta o timeout
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            onStopTyping?.(channelId);
        }, 2000);
    };

    return (
        <div className="message-input-container">
            <div className="message-input-wrapper">
                <textarea
                    ref={textareaRef}
                    id="message-input"
                    className="message-input"
                    placeholder={channelId ? `Conversar em #canal` : 'Selecione um canal...'}
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={!channelId}
                />
                <button
                    id="send-message-btn"
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!content.trim() || !channelId}
                    title="Enviar mensagem"
                >
                    <SendHorizontal size={18} />
                </button>
            </div>
        </div>
    );
}
