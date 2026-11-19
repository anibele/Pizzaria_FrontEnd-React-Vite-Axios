import { CanceledError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// A geração é alterada antes de limpar o cache ou trocar a identidade.
export class ControleHttpSessao {
    geracao = 0;
    expirar: () => void = () => {};
    revalidar: () => void = () => {};
    avancar() { this.geracao++; }
}
export const controleHttpSessao = new ControleHttpSessao();

export function instalarInterceptoresSessao(http: AxiosInstance, storage: Pick<Storage, 'getItem'>, controle: ControleHttpSessao) {
    const enviados = new WeakMap<InternalAxiosRequestConfig, { geracao: number; token: string | null }>();
    const identidade = (url = '') => url === '/auth/login' || url === '/auth/me';
    http.interceptors.request.use(config => {
        const token = storage.getItem('token');
        if (!config.headers.Authorization && token) config.headers.Authorization = `Bearer ${token}`;
        enviados.set(config, { geracao: controle.geracao, token: String(config.headers.Authorization || '') });
        return config;
    }, undefined, { synchronous: true });
    const obsoleta = (config?: InternalAxiosRequestConfig) => {
        if (!config) return false;
        const envio = enviados.get(config);
        return !envio || envio.geracao !== controle.geracao
            || (!identidade(config.url) && envio.token !== `Bearer ${storage.getItem('token') || ''}`);
    };
    http.interceptors.response.use(resposta => {
        if (obsoleta(resposta.config)) throw new CanceledError('Resposta de uma sessão anterior.');
        return resposta;
    }, erro => {
        if (obsoleta(erro.config)) return Promise.reject(new CanceledError('Resposta de uma sessão anterior.'));
        if (!identidade(erro.config?.url)) {
            if (erro.response?.status === 401) controle.expirar();
            // Revalidar é uma consulta, nunca um retry da operação recusada.
            if (erro.response?.status === 403 && /^\/(mesas\/\d+|pedidos(?:\/|$))/.test(erro.config?.url || '')) controle.revalidar();
        }
        return Promise.reject(erro);
    });
}
