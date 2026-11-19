import type { AxiosInstance } from 'axios';

export interface UsuarioAutenticado {
    username: string;
    role: 'MESA' | 'GERENTE' | 'COZINHA' | 'CAIXA';
    numeroMesa: number | null;
}

export function validarIdentidade(dados: unknown): UsuarioAutenticado {
    const u = dados as UsuarioAutenticado | null;
    if (!u || typeof u.username !== 'string' || !u.username.trim()
        || !['MESA', 'GERENTE', 'COZINHA', 'CAIXA'].includes(u.role)
        || (u.role === 'MESA' ? !Number.isSafeInteger(u.numeroMesa) || u.numeroMesa! <= 0 : u.numeroMesa !== null)) {
        throw new Error('O servidor retornou uma identidade inválida. Solicite atendimento.');
    }
    return Object.freeze({ username: u.username, role: u.role, numeroMesa: u.numeroMesa });
}

export async function consultarIdentidade(http: Pick<AxiosInstance, 'get'>, token: string, signal: AbortSignal) {
    const resposta = await http.get<unknown>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }, timeout: 15000, signal,
    });
    if (resposta.status !== 200) throw new Error('Resposta de identidade inesperada.');
    return validarIdentidade(resposta.data);
}
