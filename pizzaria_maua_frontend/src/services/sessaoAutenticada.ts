import type { AxiosInstance } from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { consultarIdentidade, type UsuarioAutenticado } from './identidadeAutenticada.ts';
import { ControleHttpSessao } from './httpSessao.ts';
import { CHAVE_SESSAO_ADICAO, definirVinculoAutenticado, encerrarSessaoAdicao, garantirSessaoAdicao } from './sessaoAdicao.ts';

type StorageSessao = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface EstadoSessao {
    user: UsuarioAutenticado | null;
    loading: boolean;
    erro: string | null;
    podeRecuperar: boolean;
    versao: number;
}
const status = (erro: unknown) => (erro as { response?: { status?: number } })?.response?.status;

// Coordena apenas a identidade; os gestores de POST/PUT continuam responsáveis pelas pendências.
export class SessaoAutenticada {
    private estado: EstadoSessao = { user: null, loading: true, erro: null, podeRecuperar: false, versao: 0 };
    private ouvintes = new Set<() => void>();
    private consulta: AbortController | null = null;
    private candidato: string | null = null;
    private novoLogin = false;
    private vinculoRevalidado: string | null = null;
    private persistido: string | null = null;
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
        this.publicar({ user: null, loading: true, erro: null, podeRecuperar: false, versao: this.controle.geracao });
        return { geracao: this.controle.geracao, signal: this.consulta.signal };
    }
    private atual(geracao: number) { return geracao === this.controle.geracao; }
    private lerPersistencia() {
        return JSON.stringify(['token', 'user', CHAVE_SESSAO_ADICAO].map(key => this.storage.getItem(key)));
    }
    private conferirPersistencia(esperado: string) {
        if (this.lerPersistencia() === esperado) return true;
        // O evento storage pode ainda estar na fila: a resposta antiga não pode gravar sobre a nova sessão.
        void this.recuperar(true);
        return false;
    }
    sincronizarArmazenamento = (evento: { key: string | null; newValue: string | null }) => {
        if (evento.key !== null && !['token', 'user', CHAVE_SESSAO_ADICAO].includes(evento.key)) return;
        try {
            if (evento.key !== null && this.storage.getItem(evento.key) !== evento.newValue) return;
            if (this.lerPersistencia() === this.persistido) return;
        } catch { /* A recuperação invalida o estado local e falha fechada se a leitura continuar indisponível. */ }
        void this.recuperar(true);
    };
    observarArmazenamento(alvo: Pick<Window, 'addEventListener' | 'removeEventListener'>, area: Storage) {
        const sincronizar = (evento: StorageEvent) => {
            if (evento.storageArea === area) this.sincronizarArmazenamento(evento);
        };
        alvo.addEventListener('storage', sincronizar);
        return () => alvo.removeEventListener('storage', sincronizar);
    }
    private limparCredenciais() {
        this.candidato = null;
        // Nunca apagar carrinhos, guardas de abertura ou adições de resultado incerto.
        encerrarSessaoAdicao();
        for (const key of ['token', 'user']) { try { this.storage.removeItem(key); } catch { /* O vínculo em memória já foi invalidado. */ } }
    }
    private async identificar(token: string, geracao: number, signal: AbortSignal, redirecionar: boolean, esperado: string) {
        try {
            const user = await consultarIdentidade(this.http, token, signal);
            if (!this.atual(geracao)) return;
            if (!this.conferirPersistencia(esperado)) return;
            let contextoValido = false;
            try {
                this.storage.setItem('token', token);
                this.storage.setItem('user', JSON.stringify(user));
                contextoValido = garantirSessaoAdicao(user, this.novoLogin);
            } finally { esperado = this.persistido = this.lerPersistencia(); }
            if (!contextoValido) throw new Error('Não foi possível proteger o contexto da sessão.');
            definirVinculoAutenticado({ ...user, token });
            this.candidato = null; this.novoLogin = false;
            this.publicar({ user, loading: false, erro: null, podeRecuperar: false });
            if (redirecionar) this.navegar(user);
        } catch (erro) {
            if (!this.atual(geracao)) return;
            // Inclusive um 401 antigo de /me não pode remover credenciais escritas por outra aba.
            let podeLimpar = false;
            try { if (!this.conferirPersistencia(esperado)) return; podeLimpar = true; }
            catch { /* Armazenamento indisponível nunca autoriza limpar credenciais compartilhadas. */ }
            const codigo = status(erro);
            if (codigo === 401 && podeLimpar) { this.limparCredenciais(); try { this.persistido = this.lerPersistencia(); } catch { /* Sessão já invalidada. */ } }
            const mensagem = codigo === 401 ? 'Sua sessão expirou. Entre novamente.'
                : codigo === 403 ? 'Não foi possível validar o vínculo da sua mesa. Solicite atendimento ou tente recuperar a sessão.'
                : codigo && codigo >= 500 ? 'O servidor está indisponível para recuperar sua identidade. Tente novamente mais tarde.'
                : erro instanceof Error && erro.message.includes('identidade inválida') ? erro.message
                : 'Não foi possível recuperar sua identidade. Verifique a conexão e tente recuperar a sessão.';
            this.publicar({ user: null, loading: false, erro: mensagem, podeRecuperar: codigo !== 401 });
            throw new Error(mensagem, { cause: erro });
        }
    }
    private recuperar = async (redirecionar: boolean) => {
        const { geracao, signal } = this.iniciar();
        this.candidato = null; this.novoLogin = false; this.vinculoRevalidado = null;
        try {
            const esperado = this.persistido = this.lerPersistencia();
            this.candidato = this.storage.getItem('token');
            if (!this.candidato) { this.publicar({ loading: false }); if (redirecionar) this.navegar(null); return; }
            await this.identificar(this.candidato, geracao, signal, redirecionar, esperado);
        } catch { if (this.atual(geracao) && this.estado.loading) this.publicar({ loading: false, erro: 'Não foi possível ler a sessão. Tente recuperar a sessão.', podeRecuperar: true }); }
    };
    restaurar = () => this.recuperar(false);
    login = async (username: string, senha: string) => {
        const { geracao, signal } = this.iniciar();
        this.limparCredenciais(); this.novoLogin = true; this.vinculoRevalidado = null;
        let token: string, esperado: string;
        try {
            esperado = this.persistido = this.lerPersistencia();
            const resposta = await this.http.post<{ token: string }>('/auth/login', { username, senha }, { signal, timeout: 15000 });
            if (!this.atual(geracao)) return;
            if (!this.conferirPersistencia(esperado)) return;
            token = resposta.data?.token;
        } catch (erro) {
            if (!this.atual(geracao)) return;
            if (this.persistido !== null) {
                try { if (!this.conferirPersistencia(this.persistido)) return; } catch { /* Falha fechada. */ }
            }
            const mensagem = status(erro) === 401 ? 'Usuário ou senha incorretos.'
                : status(erro) === 403 ? 'Não foi possível autorizar o acesso. Solicite atendimento.'
                : status(erro) && status(erro)! >= 500 ? 'O servidor está indisponível. Tente novamente mais tarde.'
                : 'Não foi possível entrar. Verifique a conexão e tente novamente.';
            this.publicar({ loading: false, erro: mensagem }); throw new Error(mensagem, { cause: erro });
        }
        if (typeof token !== 'string' || !token.trim()) {
            const mensagem = 'O servidor retornou uma resposta de login inválida. Tente novamente ou solicite atendimento.';
            this.publicar({ loading: false, erro: mensagem }); throw new Error(mensagem);
        }
        this.candidato = token;
        await this.identificar(token, geracao, signal, true, esperado);
    };
    revalidar = async () => {
        const { geracao, signal } = this.iniciar();
        try {
            const esperado = this.lerPersistencia();
            if (this.persistido !== null && !this.conferirPersistencia(this.persistido)) return;
            this.persistido = esperado;
            const token = this.candidato || this.storage.getItem('token');
            if (!token) { this.logout(); return; }
            this.candidato = token;
            await this.identificar(token, geracao, signal, true, esperado);
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
        this.iniciar();
        try {
            if (this.lerPersistencia() === this.persistido) this.limparCredenciais();
            this.persistido = this.lerPersistencia();
        } catch { /* Não remover dados de outra sessão quando não é possível confirmar sua identidade. */ }
        this.candidato = null; this.novoLogin = false;
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
