import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, MessageSquare, AlertCircle } from 'lucide-react';

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
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
        } catch (err) {
            setError(err.message || 'Erro ao fazer login');
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
                    Bem-vindo de volta! Entre para continuar.
                </p>

                {error && (
                    <div className="login-error" id="login-error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
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
                        disabled={loading || !username || !password}
                    >
                        {loading ? (
                            <span className="btn-spinner" />
                        ) : (
                            'Entrar'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
