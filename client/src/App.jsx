import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Home from './pages/Home';

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
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
