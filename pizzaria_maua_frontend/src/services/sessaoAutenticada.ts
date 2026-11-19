import type { AxiosInstance } from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { consultarIdentidade, type UsuarioAutenticado } from './identidadeAutenticada.ts';
import { ControleHttpSessao } from './httpSessao.ts';
import { definirVinculoAutenticado, encerrarSessaoAdicao, garantirSessaoAdicao } from './sessaoAdicao.ts';

type StorageSessao = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface EstadoSessao {
    user: UsuarioAutenticado | null;
    loading: boolean;
    erro: string | null;
    podeRecuperar: boolean;
}
const status = (erro: unknown) => (erro as { response?: { status?: number } })?.response?.status;

// Coordena apenas a identidade; os gestores de POST/PUT continuam responsáveis pelas pendências.
export class SessaoAutenticada {
    private estado: EstadoSessao = { user: null, loading: true, erro: null, podeRecuperar: false };
    private ouvintes = new Set<() => void>();
    private consulta: AbortController | null = null;
    private candidato: string | null = null;
    private novoLogin = false;
    private vinculoRevalidado: string | null = null;
    private http: Pick<AxiosInstance, 'post' | 'get'>;
    private storage: StorageSessao;
    private cache: Pick<QueryClient, 'clear'>;
    private controle: ControleHttpSessao;
    private navegar: (user: UsuarioAutenticado | null) => void;

    constructor(http: Pick<AxiosInstance, 'post' | 'get'>, storage: StorageSessao,
        cache: Pick<QueryClient, 'clear'>, controle: ControleHttpSessao, navegar: (user: UsuarioAutenticado | null) => void) {
        this.http = http; this.storage = storage; this.cache = cache; this.controle = controle; this.navegar = navegar;
    }
    obterEstado = () => this.estado;
    definirNavegacao(navegar: (user: UsuarioAutenticado | null) => void) { this.navegar = navegar; }
    assinar = (ouvinte: () => void) => { this.ouvintes.add(ouvinte); return () => { this.ouvintes.delete(ouvinte); }; };
    private publicar(patch: Partial<EstadoSessao>) {
        this.estado = { ...this.estado, ...patch }; this.ouvintes.forEach(o => o());
    }
    private iniciar() {
        this.controle.avancar(); this.consulta?.abort(); this.consulta = new AbortController();
        definirVinculoAutenticado(null);
        this.cache.clear();
        this.publicar({ user: null, loading: true, erro: null, podeRecuperar: false });
        return { geracao: this.controle.geracao, signal: this.consulta.signal };
    }
    private atual(geracao: number) { return geracao === this.controle.geracao; }
    private limparCredenciais() {
        this.candidato = null;
        // Nunca apagar carrinhos, guardas de abertura ou adições de resultado incerto.
        encerrarSessaoAdicao();
        for (const key of ['token', 'user']) { try { this.storage.removeItem(key); } catch { /* O vínculo em memória já foi invalidado. */ } }
    }
    private async identificar(token: string, geracao: number, signal: AbortSignal, redirecionar: boolean) {
        try {
            const user = await consultarIdentidade(this.http, token, signal);
            if (!this.atual(geracao)) return;
            this.storage.setItem('token', token);
            this.storage.setItem('user', JSON.stringify(user));
            garantirSessaoAdicao(user, this.novoLogin);
            definirVinculoAutenticado({ ...user, token });
            this.candidato = null; this.novoLogin = false;
            this.publicar({ user, loading: false, erro: null, podeRecuperar: false });
            if (redirecionar) this.navegar(user);
        } catch (erro) {
            if (!this.atual(geracao)) return;
            const codigo = status(erro);
            if (codigo === 401) this.limparCredenciais();
            const mensagem = codigo === 401 ? 'Sua sessão expirou. Entre novamente.'
                : codigo === 403 ? 'Não foi possível validar o vínculo da sua mesa. Solicite atendimento ou tente recuperar a sessão.'
                : erro instanceof Error && erro.message.includes('identidade inválida') ? erro.message
                : 'Não foi possível recuperar sua identidade. Verifique a conexão e tente recuperar a sessão.';
            this.publicar({ user: null, loading: false, erro: mensagem, podeRecuperar: codigo !== 401 });
            throw new Error(mensagem, { cause: erro });
        }
    }
    restaurar = async () => {
        const { geracao, signal } = this.iniciar();
        try {
            this.candidato = this.storage.getItem('token');
            if (!this.candidato) { this.publicar({ loading: false }); return; }
            await this.identificar(this.candidato, geracao, signal, false);
        } catch { if (this.atual(geracao) && this.estado.loading) this.publicar({ loading: false, erro: 'Não foi possível ler a sessão. Entre novamente.' }); }
    };
    login = async (username: string, senha: string) => {
        const { geracao, signal } = this.iniciar();
        this.limparCredenciais(); this.novoLogin = true; this.vinculoRevalidado = null;
        let token: string;
        try {
            const resposta = await this.http.post<{ token: string }>('/auth/login', { username, senha }, { signal, timeout: 15000 });
            if (!this.atual(geracao)) return;
            token = resposta.data?.token;
            if (typeof token !== 'string' || !token.trim()) throw new Error('Token inválido.');
        } catch (erro) {
            if (!this.atual(geracao)) return;
            const mensagem = [401, 403].includes(status(erro) || 0) ? 'Usuário ou senha incorretos.' : 'Não foi possível entrar. Verifique a conexão e tente novamente.';
            this.publicar({ loading: false, erro: mensagem }); throw new Error(mensagem, { cause: erro });
        }
        this.candidato = token;
        await this.identificar(token, geracao, signal, true);
    };
    revalidar = async () => {
        const { geracao, signal } = this.iniciar();
        try {
            const token = this.candidato || this.storage.getItem('token');
            if (!token) { this.logout(); return; }
            this.candidato = token;
            await this.identificar(token, geracao, signal, true);
        } catch { if (this.atual(geracao) && this.estado.loading) this.publicar({ loading: false, erro: 'Não foi possível recuperar a sessão.' }); }
    };
    revalidarVinculo = () => {
        const user = this.estado.user;
        if (user?.role !== 'MESA') return;
        const chave = JSON.stringify(user);
        if (chave === this.vinculoRevalidado) return;
        this.vinculoRevalidado = chave;
        void this.revalidar();
    };
    logout = () => {
        this.iniciar(); this.limparCredenciais(); this.novoLogin = false;
        this.publicar({ user: null, loading: false, erro: null, podeRecuperar: false }); this.navegar(null);
    };
    parar = () => {
        this.controle.avancar(); this.consulta?.abort(); definirVinculoAutenticado(null);
        this.controle.expirar = () => {}; this.controle.revalidar = () => {};
    };
    ativar = () => {
        this.controle.expirar = this.logout; this.controle.revalidar = this.revalidarVinculo;
        void this.restaurar();
    };
}
