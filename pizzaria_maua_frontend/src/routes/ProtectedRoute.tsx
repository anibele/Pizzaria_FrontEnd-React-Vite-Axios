import { useContext, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles?: ('MESA' | 'COZINHA' | 'GERENTE' | 'CAIXA')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { authenticated, user, loading, erroSessao, podeRecuperarSessao, revalidarSessao, logout } = useContext(AuthContext);

    if (loading) return <div>Carregando...</div>;
    if (!authenticated && podeRecuperarSessao) return <div role="alert">
        <p>{erroSessao}</p>
        <button onClick={() => void revalidarSessao()}>Recuperar sessão</button>
        <button onClick={logout}>Sair</button>
    </div>;

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <>{children}</>;
}
