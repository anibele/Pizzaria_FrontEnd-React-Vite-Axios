import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export default function Login() {
    const [username, setUsername] = useState<string>('');
    const [senha, setSenha] = useState<string>('');
    const { login } = useContext(AuthContext);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username && senha) {
            login(username, senha);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '10px' }}>
                <h2>Pizzaria Mauá - Login</h2>
                <input
                    type="text"
                    placeholder="Usuário (ex: mesa01)"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Senha"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                />
                <button type="submit">Entrar</button>
            </form>
        </div>
    );
}