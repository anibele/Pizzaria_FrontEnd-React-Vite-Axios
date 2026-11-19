import { Component, Suspense, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

class FalhaCarregamento extends Component<{ children: ReactNode }, { falhou: boolean }> {
    state = { falhou: false };

    static getDerivedStateFromError() { return { falhou: true }; }

    render() {
        if (this.state.falhou) return <div role="alert">
            <p>Não foi possível carregar esta tela. Verifique sua conexão e tente novamente.</p>
            <button type="button" onClick={() => window.location.reload()}>Recarregar tela</button>
        </div>;
        return this.props.children;
    }
}

// A guarda de perfil envolve este componente. Trocas de rota ou sessão descartam seu estado.
export default function RotaSobDemanda({ children }: { children: ReactNode }) {
    const { versaoSessao } = useContext(AuthContext);
    const { pathname } = useLocation();
    return <FalhaCarregamento key={`${versaoSessao}:${pathname}`}>
        <Suspense fallback={<div role="status">Carregando tela...</div>}>{children}</Suspense>
    </FalhaCarregamento>;
}
