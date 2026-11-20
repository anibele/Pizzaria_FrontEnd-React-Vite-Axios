import type { AxiosInstance } from "axios";
import type { AdicionarItensInput } from "../interfaces/PedidoDados.ts";
import { novoUUID } from "./sessaoAdicao.ts";
import type { ContextoAdicao } from "./sessaoAdicao.ts";

export const CHAVE_ABERTURA_PENDENTE = "pizzaria-abertura-pendente";
export const ABERTURA_INCERTA = "Não foi possível confirmar a abertura. A seleção está protegida para evitar itens duplicados. Verifique a comanda e solicite atendimento antes de um novo envio.";
interface PedidoObservado { id: number; numeroMesa: number; status: "ABERTO" | "AGUARDANDO_PAGAMENTO" }
export interface DadosAbertura {
    readonly numeroMesa: number;
    readonly formaPagamento: string;
    readonly itens: readonly Readonly<AdicionarItensInput>[];
}
interface AberturaPendente {
    readonly idLocal: string; // Somente guarda local; o POST não aceita identificador de intenção.
    readonly contexto: Readonly<ContextoAdicao>;
    readonly dados: DadosAbertura;
}
interface EstadoAbertura {
    pendente: AberturaPendente | null;
    protegida: boolean;
    processando: boolean;
    podeRevisar: boolean;
    mensagem: string | null;
}
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const mesmoContexto = (a: ContextoAdicao | null, b: ContextoAdicao | null) => !!a && !!b
    && a.sessao === b.sessao && a.username === b.username && a.role === b.role && a.numeroMesa === b.numeroMesa;
const statusHttp = (erro: unknown) => (erro as { response?: { status?: number } })?.response?.status;
const rejeicaoDefinitiva = (status: unknown, mensagem: unknown) => typeof mensagem === "string" && mensagem.length > 0
    && (status === 400 || status === 404 || (status === 409 && (
        mensagem === "A mesa já possui um pedido ativo."
        || mensagem === "A abertura exige uma mesa ativa e LIVRE. Revise a disponibilidade da mesa."
        || mensagem.startsWith("Estoque insuficiente para o produto: "))));

function recuperar(raw: string): AberturaPendente {
    const op = JSON.parse(raw);
    const c = op?.contexto, d = op?.dados;
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(op?.idLocal)
        || !c || ![c.sessao, c.username, c.role].every(v => typeof v === "string" && v.length > 0)
        || !Number.isSafeInteger(c.numeroMesa) || c.numeroMesa <= 0 || d?.numeroMesa !== c.numeroMesa
        || d.formaPagamento !== "PENDENTE" || !Array.isArray(d.itens) || !d.itens.length
        || d.itens.some((i: AdicionarItensInput) => !i || !Number.isSafeInteger(i.produtoId) || i.produtoId <= 0
            || !Number.isSafeInteger(i.quantidade) || i.quantidade <= 0 || i.quantidade > 2147483647)) throw new Error("Abertura inválida.");
    return Object.freeze({ idLocal: op.idLocal, contexto: Object.freeze({ ...c }),
        dados: Object.freeze({ numeroMesa: d.numeroMesa, formaPagamento: "PENDENTE",
            itens: Object.freeze(d.itens.map((i: AdicionarItensInput) => Object.freeze({ produtoId: i.produtoId, quantidade: i.quantidade }))) }) });
}

function pedidoValido(dados: unknown, numeroMesa: number): dados is PedidoObservado {
    const p = dados as PedidoObservado | null;
    return !!p && Number.isSafeInteger(p.id) && p.id > 0 && p.numeroMesa === numeroMesa
        && (p.status === "ABERTO" || p.status === "AGUARDANDO_PAGAMENTO");
}

export async function enviarAbertura(http: Pick<AxiosInstance, "post">, dados: DadosAbertura): Promise<PedidoObservado> {
    const resposta = await http.post<PedidoObservado>("/pedidos", dados, { timeout: 15000 });
    if (resposta.status !== 201 || !pedidoValido(resposta.data, dados.numeroMesa)) throw new Error("Confirmação de abertura inesperada.");
    return resposta.data;
}

export async function consultarAbertura(http: Pick<AxiosInstance, "get">, numeroMesa: number, signal: AbortSignal): Promise<PedidoObservado | null> {
    try {
        const resposta = await http.get<PedidoObservado>(`/pedidos/mesa/${numeroMesa}/aberto`, { timeout: 15000, signal });
        if (!pedidoValido(resposta.data, numeroMesa)) throw new Error("Consulta de abertura inesperada.");
        return resposta.data;
    } catch (erro: unknown) {
        if (statusHttp(erro) === 404) return null;
        throw erro;
    }
}

// Guarda específica do POST: observar um pedido ativo nunca confirma sua origem.
export class GestorAbertura {
    private estado: EstadoAbertura = { pendente: null, protegida: false, processando: false, podeRevisar: false, mensagem: null };
    private listeners = new Set<() => void>();
    private evidencia: string | null = null;
    private geracao = 0;
    private consulta: AbortController | null = null;
    private storage: Armazenamento;
    private contexto: ContextoAdicao | null;
    private contextoAtual: () => ContextoAdicao | null;
    constructor(storage: Armazenamento, contexto: ContextoAdicao | null, contextoAtual: () => ContextoAdicao | null) {
        this.storage = storage; this.contexto = contexto; this.contextoAtual = contextoAtual;
        try {
            const raw = storage.getItem(CHAVE_ABERTURA_PENDENTE);
            if (raw) {
                const pendente = recuperar(raw);
                if (!mesmoContexto(pendente.contexto, contexto)) throw new Error("Outro contexto.");
                const rejeicao = JSON.parse(raw).rejeicao;
                const podeRevisar = rejeicaoDefinitiva(rejeicao?.status, rejeicao?.mensagem);
                this.estado = { ...this.estado, pendente, protegida: true, podeRevisar,
                    mensagem: podeRevisar ? `A abertura foi rejeitada: ${rejeicao.mensagem} Confira a comanda antes de revisar a seleção.` : ABERTURA_INCERTA };
                if (podeRevisar) this.evidencia = raw;
            }
        } catch { this.atualizar({ protegida: true, mensagem: "Não foi possível recuperar a abertura com segurança. A seleção está protegida. Solicite atendimento para conferir a comanda." }); }
    }
    obterEstado = () => this.estado;
    assinar = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private atualizar(patch: Partial<EstadoAbertura>) { this.estado = { ...this.estado, ...patch }; this.listeners.forEach(l => l()); }
    private autorizado() { return mesmoContexto(this.contexto, this.contextoAtual()); }
    bloqueiaCarrinho = () => {
        if (this.estado.protegida) return true;
        try {
            if (this.autorizado() && this.storage.getItem(CHAVE_ABERTURA_PENDENTE) === null) return false;
        } catch { /* Sem leitura confiável, não iniciar POST nem liberar PUT. */ }
        this.atualizar({ protegida: true, mensagem: "Há uma abertura ou sessão que precisa ser conferida. A seleção está protegida. Atualize a página ou solicite atendimento." });
        return true;
    };
    desmontar = () => { this.geracao++; this.consulta?.abort(); this.consulta = null; this.atualizar({ processando: false }); };

    enviar = async (itens: AdicionarItensInput[], executar: (dados: DadosAbertura) => Promise<unknown>, confirmar: () => void) => {
        if (this.bloqueiaCarrinho()) return;
        const geracao = this.geracao;
        const vigente = () => geracao === this.geracao && this.autorizado();
        let registro: string | null = null;
        let enviou = false;
        let confirmada = false;
        this.atualizar({ protegida: true, processando: true, podeRevisar: false, mensagem: "Aguardando confirmação da abertura..." });
        try {
            const op = recuperar(JSON.stringify({ idLocal: novoUUID(), contexto: this.contexto,
                dados: { numeroMesa: this.contexto!.numeroMesa, formaPagamento: "PENDENTE", itens } }));
            registro = JSON.stringify(op);
            this.storage.setItem(CHAVE_ABERTURA_PENDENTE, registro);
            this.atualizar({ pendente: op });
            enviou = true;
            await executar(op.dados);
            confirmada = true;
            if (!vigente() || this.storage.getItem(CHAVE_ABERTURA_PENDENTE) !== registro) return;
            // Limpar o carrinho persistido antes de liberar a guarda. Uma falha mantém a proteção.
            confirmar();
            this.storage.removeItem(CHAVE_ABERTURA_PENDENTE);
            this.atualizar({ pendente: null, protegida: false, mensagem: null });
        } catch (erro: unknown) {
            if (!vigente()) return;
            if (confirmada) {
                this.atualizar({ mensagem: "A abertura foi confirmada, mas não foi possível concluir a limpeza da seleção com segurança. Não reenvie os itens; solicite atendimento para conferir a comanda." });
                return;
            }
            const mensagem = (erro as { response?: { data?: { mensagem?: unknown } } })?.response?.data?.mensagem;
            const status = statusHttp(erro);
            if (enviou && rejeicaoDefinitiva(status, mensagem)) {
                try {
                    if (this.storage.getItem(CHAVE_ABERTURA_PENDENTE) !== registro) return;
                    const rejeitada = JSON.stringify({ ...this.estado.pendente, rejeicao: { status, mensagem } });
                    this.storage.setItem(CHAVE_ABERTURA_PENDENTE, rejeitada);
                    this.evidencia = rejeitada;
                    this.atualizar({ podeRevisar: true, mensagem: `A abertura foi rejeitada: ${mensagem} Confira a comanda antes de revisar a seleção.` });
                } catch { this.atualizar({ mensagem: ABERTURA_INCERTA }); }
            } else this.atualizar({ mensagem: !enviou ? "Não foi possível preparar a abertura com segurança. Nenhum envio foi realizado. Atualize a página ou solicite atendimento."
                : status === 401 || status === 403 ? "A abertura não foi confirmada. Verifique sua sessão e solicite atendimento antes de reenviar." : ABERTURA_INCERTA });
        } finally { if (geracao === this.geracao) this.atualizar({ processando: false }); }
    };

    revisarRejeitada = () => {
        if (!this.estado.podeRevisar || this.estado.processando || !this.autorizado()) return;
        try {
            if (!this.evidencia || this.storage.getItem(CHAVE_ABERTURA_PENDENTE) !== this.evidencia) throw new Error("Evidência alterada.");
            this.storage.removeItem(CHAVE_ABERTURA_PENDENTE);
            this.evidencia = null;
            this.atualizar({ pendente: null, protegida: false, podeRevisar: false, mensagem: null });
        } catch { this.atualizar({ podeRevisar: false, protegida: true, mensagem: ABERTURA_INCERTA }); }
    };

    verificar = async (consultar: (numeroMesa: number, signal: AbortSignal) => Promise<PedidoObservado | null>) => {
        if (!this.estado.pendente || !this.estado.protegida || this.estado.processando || !this.autorizado()) return;
        const geracao = this.geracao;
        const controle = new AbortController(); this.consulta = controle;
        this.atualizar({ processando: true });
        try {
            const pedido = await consultar(this.contexto!.numeroMesa, controle.signal);
            if (geracao !== this.geracao || !this.autorizado()) return;
            // Não escreve no cache: esta leitura pode ser anterior ao polling.
            this.atualizar({ mensagem: `${pedido ? `Há um pedido ${pedido.status === "ABERTO" ? "aberto" : "aguardando pagamento"} para esta mesa.` : "Nenhum pedido ativo foi encontrado agora."} Esta consulta não identifica a abertura original. A seleção permanece protegida; solicite atendimento para conferir a comanda.` });
        } catch {
            if (geracao === this.geracao && this.autorizado()) this.atualizar({ mensagem: "Não foi possível consultar a comanda. A abertura continua sem confirmação e a seleção permanece protegida. Solicite atendimento." });
        } finally { if (geracao === this.geracao) { this.consulta = null; this.atualizar({ processando: false }); } }
    };
}
