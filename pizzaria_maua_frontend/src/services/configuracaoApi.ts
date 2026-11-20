import axios from 'axios';
import { instalarInterceptoresSessao, type ControleHttpSessao } from './httpSessao.ts';

export interface AmbienteApi {
    VITE_API_BASE_URL?: string;
    VITE_BACKEND_IP?: string;
    DEV: boolean;
}

const erroConfiguracao = () => new Error('Configuração da API inválida. Defina VITE_API_BASE_URL como URL HTTP(S) completa ou caminho iniciado por uma única barra.');

export function resolverBaseURL(ambiente: AmbienteApi, protocoloPagina: string): string {
    let valor = ambiente.VITE_API_BASE_URL;
    if (valor === undefined) {
        if (!ambiente.DEV || !ambiente.VITE_BACKEND_IP) {
            throw new Error('Configuração da API ausente. Defina VITE_API_BASE_URL antes de gerar o build; VITE_BACKEND_IP é aceito somente no desenvolvimento.');
        }
        // Compatibilidade transitória: o legado representa somente um host, sem protocolo ou porta.
        const host = ambiente.VITE_BACKEND_IP;
        if (typeof host !== 'string' || !/^(\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(host)) throw erroConfiguracao();
        valor = `http://${host}:8080`;
    }
    if (typeof valor !== 'string' || !valor || /[\s\p{Control}\\?#]/u.test(valor)) throw erroConfiguracao();
    const relativo = valor.startsWith('/') && !valor.startsWith('//');
    const absoluta = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(valor);
    if (!relativo && !absoluta) throw erroConfiguracao();
    if (protocoloPagina !== 'http:' && protocoloPagina !== 'https:') throw erroConfiguracao();
    let url: URL;
    try {
        url = new URL(valor, 'https://configuracao.invalid');
        // Evita normalizações silenciosas de caminhos ambíguos ou com traversal.
        const caminho = relativo ? valor : absoluta?.[2] || '';
        if (caminho.split('/').some(parte => {
            const texto = decodeURIComponent(parte);
            return texto === '.' || texto === '..' || /[\p{Control}\\/]/u.test(texto);
        })) throw erroConfiguracao();
    } catch { throw erroConfiguracao(); }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw erroConfiguracao();
    if (absoluta?.[1].includes('@')) throw erroConfiguracao();
    if (!relativo && protocoloPagina === 'https:' && url.protocol === 'http:') {
        throw new Error('Configuração incompatível: uma página HTTPS exige API HTTPS ou caminho na mesma origem.');
    }
    const base = relativo ? url.pathname : `${url.origin}${url.pathname}`;
    return base.replace(/\/+$/, '') || '/';
}

// api.ts e os testes utilizam a mesma criação de instância e os interceptors existentes.
export function criarApi(ambiente: AmbienteApi, protocoloPagina: string,
    storage: Pick<Storage, 'getItem'>, controle: ControleHttpSessao) {
    const api = axios.create({ baseURL: resolverBaseURL(ambiente, protocoloPagina) });
    instalarInterceptoresSessao(api, storage, controle);
    return api;
}
