import { createContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Tipagem do usuário do sistema
export interface User {
    username: string;
    role: 'MESA' | 'COZINHA' | 'GERENTE' | 'CAIXA';
}

// Resposta esperada do endpoint do Spring Boot
interface LoginResponse {
    token: string;
    role: 'MESA' | 'COZINHA' | 'GERENTE' | 'CAIXA';
}

interface AuthContextType {
    authenticated: boolean;
    user: User | null;
    login: (username: string, senha: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Erro ao ler usuário do localStorage, limpando...", e);
                localStorage.clear();
            }
        }
        setLoading(false);
    }, []);

    const login = async (username: string, senha: string): Promise<void> => {
        try {
            const response = await api.post<LoginResponse>('/auth/login', { username, senha });
            const { token, role } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify({ username, role }));

            setUser({ username, role });

            // --- CORREÇÃO DOS REDIRECIONAMENTOS ---
            if (role === 'MESA') {
                navigate('/cardapio');
            } else if (role === 'COZINHA') {
                navigate('/pedidos'); // Vai direto para a tela de pedidos
            } else if (role === 'GERENTE') {
                navigate('/');        // Vai direto para a tela de produtos
            } else if (role === 'CAIXA') {
                navigate('/caixa');   // Vai direto para a tela do caixa
            }

        } catch (error) {
            console.error("Erro ao fazer login:", error);
            // Propaga o erro para o Login.tsx exibir a mensagem vermelha na interface!
            throw error;
        }
    };

    const logout = (): void => {
        localStorage.clear();
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ authenticated: !!user, user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}