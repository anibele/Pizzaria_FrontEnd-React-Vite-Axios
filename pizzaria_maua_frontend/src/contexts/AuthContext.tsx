import { createContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { controleHttpSessao } from '../services/httpSessao';
import { SessaoAutenticada } from '../services/sessaoAutenticada';
import type { UsuarioAutenticado } from '../services/identidadeAutenticada';

export type User = UsuarioAutenticado;
interface AuthContextType {
    authenticated: boolean;
    user: User | null;
    login: (username: string, senha: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
    erroSessao: string | null;
    podeRecuperarSessao: boolean;
    revalidarSessao: () => Promise<void>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const cache = useQueryClient();
    const gestor = useMemo(() => new SessaoAutenticada(api, {
        getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: key => localStorage.removeItem(key),
    }, cache, controleHttpSessao, () => {}), [cache]);
    useEffect(() => { gestor.definirNavegacao(user => {
        const destinos = { MESA: '/cardapio', COZINHA: '/pedidos', GERENTE: '/', CAIXA: '/caixa' };
        navigate(user ? destinos[user.role] : '/login', { replace: true });
    }); }, [gestor, navigate]);
    const estado = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    useEffect(() => { gestor.ativar(); return gestor.parar; }, [gestor]);
    return <AuthContext.Provider value={{ authenticated: !!estado.user, user: estado.user, loading: estado.loading,
        login: gestor.login, logout: gestor.logout, erroSessao: estado.erro,
        podeRecuperarSessao: estado.podeRecuperar, revalidarSessao: gestor.revalidar }}>
        {children}
    </AuthContext.Provider>;
}
