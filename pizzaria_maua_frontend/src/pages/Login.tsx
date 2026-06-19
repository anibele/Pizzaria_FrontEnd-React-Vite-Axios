import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { User, Lock, Pizza, AlertCircle, Loader2 } from 'lucide-react';
import '../styles/login.css';

export default function Login() {
    const [username, setUsername] = useState<string>('');
    const [senha, setSenha] = useState<string>('');
    const [erro, setErro] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { login } = useContext(AuthContext);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro(null);

        if (!username || !senha) {
            setErro("Por favor, preencha todos os campos.");
            return;
        }

        try {
            setLoading(true);
            // Executa a função de login da sua Context API
            await login(username, senha);
        } catch (err: any) {
            // Captura o erro do backend se houver rejeição de Promise
            setErro("Usuário ou senha incorretos. Verifique os dados do tablet.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen-container">
            <div className="login-card">

                {/* Header do Card */}
                <div className="login-header">
                    <div className="login-logo-wrapper">
                        <Pizza size={32} strokeWidth={2.5} />
                    </div>
                    <h2 className="login-titulo">Pizzaria Mauá</h2>
                    <p className="login-subtitulo">Painel de Acesso do Terminal</p>
                </div>

                {/* Formulário de Login */}
                <form onSubmit={handleSubmit} className="login-form">

                    {/* Feedback de Erro */}
                    {erro && (
                        <div className="error-banner">
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <span>{erro}</span>
                        </div>
                    )}

                    {/* Campo de Usuário */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="username">Identificação</label>
                        <div className="input-wrapper">
                            <input
                                id="username"
                                type="text"
                                placeholder="Ex: mesa01"
                                className="login-input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                disabled={loading}
                                autoComplete="off"
                            />
                            <User className="input-icon" size={18} />
                        </div>
                    </div>

                    {/* Campo de Senha */}
                    <div className="input-group">
                        <label className="input-label" htmlFor="password">Senha de Acesso</label>
                        <div className="input-wrapper">
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                className="login-input"
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                disabled={loading}
                            />
                            <Lock className="input-icon" size={18} />
                        </div>
                    </div>

                    {/* Botão de Enviar */}
                    <button type="submit" className="btn-login-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Autenticando...
                            </>
                        ) : (
                            "Entrar no Sistema"
                        )}
                    </button>
                </form>

            </div>
        </div>
    );
}