import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Home from './pages/Home';
import { api } from './services/api';

function compareVersions(v1, v2) {
    const parts1 = (v1 || '0.0.0').split('.').map(Number);
    const parts2 = (v2 || '0.0.0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

function VersionCheck({ children }) {
    const [isChecking, setIsChecking] = useState(true);
    const [outdatedInfo, setOutdatedInfo] = useState(null);

    useEffect(() => {
        // Se estiver rodando no navegador normal, não trava a versão
        // A trava de versão é mais importante para o executável (Electron)
        const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
        
        api.getVersion()
            .then((data) => {
                const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
                const requiredVersion = data.version;
                
                if (isElectron && compareVersions(currentVersion, requiredVersion) < 0) {
                    setOutdatedInfo({
                        currentVersion,
                        requiredVersion,
                        downloadUrl: data.downloadUrl
                    });
                }
            })
            .catch((err) => console.error("Erro ao verificar versão:", err))
            .finally(() => setIsChecking(false));
    }, []);

    if (isChecking) {
        return (
            <div className="login-page">
                <div className="login-bg" />
                <div className="login-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <span className="btn-spinner" style={{ width: 32, height: 32 }} />
                    <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Verificando atualizações...</p>
                </div>
            </div>
        );
    }

    if (outdatedInfo) {
        return (
            <div className="login-page">
                <div className="login-bg" />
                <div className="login-card" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 500 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-dim)', 
                        color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', fontSize: 32
                    }}>
                        ⚠️
                    </div>
                    <h2 style={{ marginBottom: 12 }}>Atualização Obrigatória</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: '1.5' }}>
                        Uma nova versão do aplicativo está disponível e é necessária para continuar conectando ao servidor.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 32, fontSize: '0.9rem' }}>
                        <div>Sua versão:<br/><strong style={{color: 'var(--danger)'}}>{outdatedInfo.currentVersion}</strong></div>
                        <div>Versão nova:<br/><strong style={{color: 'var(--success)'}}>{outdatedInfo.requiredVersion}</strong></div>
                    </div>
                    
                    {outdatedInfo.downloadUrl ? (
                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
                            onClick={() => window.location.href = outdatedInfo.downloadUrl}
                        >
                            Baixar Nova Versão
                        </button>
                    ) : (
                        <p style={{ color: 'var(--danger)' }}>Link de download não configurado no servidor.</p>
                    )}
                </div>
            </div>
        );
    }

    return children;
}

function AppContent() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="login-page">
                <div className="login-bg" />
                <div className="login-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <span className="btn-spinner" style={{ width: 32, height: 32 }} />
                    <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Carregando...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <SocketProvider>
            <Home />
        </SocketProvider>
    );
}

export default function App() {
    return (
        <VersionCheck>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </VersionCheck>
    );
}
