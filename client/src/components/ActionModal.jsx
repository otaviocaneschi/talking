import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ActionModal({ 
    isOpen, 
    onClose, 
    title, 
    description, 
    inputType = null, // 'text' ou null
    placeholder = '',
    initialValue = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = false,
    onSubmit 
}) {
    const [inputValue, setInputValue] = useState(initialValue);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInputValue(initialValue);
            setLoading(false);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(inputType ? inputValue : null);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '400px' }}>
                <button className="modal-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className="modal-header" style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', color: isDanger ? '#ef4444' : 'var(--text-primary)' }}>{title}</h2>
                    <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {description}
                    </p>
                </div>

                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        {inputType && (
                            <div className="form-group" style={{ marginBottom: '24px' }}>
                                <input 
                                    type={inputType}
                                    className="form-input"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={placeholder}
                                    disabled={loading}
                                    autoFocus
                                    style={{ width: '100%', padding: '10px' }}
                                />
                            </div>
                        )}
                        <div className="modal-footer" style={{ marginTop: 0 }}>
                            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                                {cancelText}
                            </button>
                            <button 
                                type="submit" 
                                className="btn-primary" 
                                disabled={loading || (inputType && !inputValue.trim())}
                                style={isDanger ? { backgroundColor: '#ef4444' } : {}}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
