import { useContext, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles?: ('MESA' | 'COZINHA' | 'GERENTE' | 'CAIXA')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { authenticated, user, loading } = useContext(AuthContext);

    if (loading) return <div>Carregando...</div>;

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <>{children}</>;
}