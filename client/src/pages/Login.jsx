import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, MessageSquare, AlertCircle, UserPlus } from 'lucide-react';

// Partículas flutuantes do background
function Particles() {
    const particles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * 8,
        opacity: 0.1 + Math.random() * 0.3,
    }));

    return (
        <div className="login-particles">
            {particles.map((p) => (
                <span
                    key={p.id}
                    className="particle"
                    style={{
                        left: `${p.left}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                        opacity: p.opacity,
                    }}
                />
            ))}
        </div>
    );
}

export default function Login() {
    const { login, signup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(username, password);
            } else {
                await signup(username, displayName, password);
            }
        } catch (err) {
            setError(err.message || (isLogin ? 'Erro ao fazer login' : 'Erro ao criar conta'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg" />
            <Particles />

            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <MessageSquare />
                    </div>
                    <span className="login-logo-text">Talking</span>
                </div>

                <p className="login-subtitle">
                    {isLogin ? 'Bem-vindo de volta! Entre para continuar.' : 'Crie sua conta e conecte-se com seus amigos.'}
                </p>

                {error && (
                    <div className="login-error" id="login-error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button 
                        onClick={() => setIsLogin(true)}
                        style={{ flex: 1, padding: '8px', background: isLogin ? 'var(--bg-modifier-selected)' : 'transparent', color: isLogin ? 'var(--text-normal)' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Entrar
                    </button>
                    <button 
                        onClick={() => setIsLogin(false)}
                        style={{ flex: 1, padding: '8px', background: !isLogin ? 'var(--bg-modifier-selected)' : 'transparent', color: !isLogin ? 'var(--text-normal)' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Criar Conta
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="displayName">
                                Nome de Exibição
                            </label>
                            <div className="form-input-wrapper">
                                <UserPlus className="form-input-icon" />
                                <input
                                    id="displayName"
                                    type="text"
                                    className="form-input"
                                    placeholder="Como quer ser chamado?"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="username">
                            Usuário
                        </label>
                        <div className="form-input-wrapper">
                            <User className="form-input-icon" />
                            <input
                                id="username"
                                type="text"
                                className="form-input"
                                placeholder="Seu nome de usuário"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">
                            Senha
                        </label>
                        <div className="form-input-wrapper">
                            <Lock className="form-input-icon" />
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="Sua senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        id="login-btn"
                        type="submit"
                        className="login-btn"
                        disabled={loading || !username || !password || (!isLogin && !displayName)}
                    >
                        {loading ? (
                            <span className="btn-spinner" />
                        ) : (
                            isLogin ? 'Entrar' : 'Registrar'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
