import { useState } from 'react';
import { X, Hash, Link } from 'lucide-react';

export default function ServerModals({ isOpen, onClose, onCreateServer, onJoinServer }) {
    const [tab, setTab] = useState('create'); // 'create' | 'join'
    const [name, setName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await onCreateServer(name);
            setName('');
            onClose();
        } catch (err) {
            setError(err.message || 'Erro ao criar servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await onJoinServer(inviteCode);
            setInviteCode('');
            onClose();
        } catch (err) {
            setError(err.message || 'Erro ao entrar no servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <button className="modal-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className="modal-header">
                    <h2>{tab === 'create' ? 'Crie seu servidor' : 'Entrar em um servidor'}</h2>
                    <p>
                        {tab === 'create' 
                            ? 'Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a conversar.' 
                            : 'Insira um código de convite abaixo para entrar em um servidor existente.'}
                    </p>
                </div>

                <div className="modal-tabs">
                    <button 
                        className={`modal-tab ${tab === 'create' ? 'active' : ''}`}
                        onClick={() => setTab('create')}
                    >
                        Criar
                    </button>
                    <button 
                        className={`modal-tab ${tab === 'join' ? 'active' : ''}`}
                        onClick={() => setTab('join')}
                    >
                        Entrar
                    </button>
                </div>

                {error && <div className="modal-error">{error}</div>}

                <div className="modal-body">
                    {tab === 'create' ? (
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">NOME DO SERVIDOR</label>
                                <div className="form-input-wrapper">
                                    <Hash className="form-input-icon" />
                                    <input 
                                        type="text"
                                        className="form-input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Meu Servidor"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={onClose}>Voltar</button>
                                <button type="submit" className="btn-primary" disabled={loading || !name}>Criar</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleJoin}>
                            <div className="form-group">
                                <label className="form-label">CÓDIGO DE CONVITE</label>
                                <div className="form-input-wrapper">
                                    <Link className="form-input-icon" />
                                    <input 
                                        type="text"
                                        className="form-input"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value)}
                                        placeholder="Ex: a1b2c3d4"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={onClose}>Voltar</button>
                                <button type="submit" className="btn-primary" disabled={loading || !inviteCode}>Entrar no Servidor</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
