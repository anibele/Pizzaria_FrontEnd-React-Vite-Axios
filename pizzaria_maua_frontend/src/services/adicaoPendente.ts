import type { AxiosInstance } from "axios";
import type { AdicionarItensInput, PedidoDados } from "../interfaces/PedidoDados.ts";
import { CHAVE_ADICAO_PENDENTE, novoUUID } from "./sessaoAdicao.ts";
import type { ContextoAdicao } from "./sessaoAdicao.ts";

export const MENSAGEM_INCERTA = "Não foi possível confirmar se os itens foram adicionados. Você pode tentar novamente sem duplicar o pedido.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface AdicaoPendente {
    readonly chave: string;
    readonly pedidoId: number;
    readonly itens: readonly Readonly<AdicionarItensInput>[];
    readonly contexto: Readonly<ContextoAdicao>;
}
interface EstadoAdicao {
    pendente: AdicaoPendente | null;
    enviando: boolean;
    mensagem: string | null;
    podeRevisar: boolean;
    bloqueada: boolean;
}
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const mesmoContexto = (a: ContextoAdicao | null, b: ContextoAdicao | null) => !!a && !!b
    && a.username === b.username && a.role === b.role && a.sessao === b.sessao && a.numeroMesa === b.numeroMesa;

export async function enviarAdicao(http: Pick<AxiosInstance, "put">, operacao: AdicaoPendente): Promise<PedidoDados> {
    const response = await http.put<PedidoDados>(`/pedidos/${operacao.pedidoId}/itens`, operacao.itens, {
        headers: { "Idempotency-Key": operacao.chave }, timeout: 15000
    });
    return response.data;
}

function snapshot(chave: string, pedidoId: number, itens: readonly AdicionarItensInput[], contexto: ContextoAdicao): AdicaoPendente {
    if (!uuid.test(chave) || !Number.isSafeInteger(pedidoId) || pedidoId <= 0 || !Array.isArray(itens) || !itens.length
        || itens.some(i => !i || !Number.isSafeInteger(i.produtoId) || i.produtoId <= 0
            || !Number.isSafeInteger(i.quantidade) || i.quantidade <= 0 || i.quantidade > 2147483647)) throw new Error("Operação inválida.");
    return Object.freeze({ chave, pedidoId, contexto: Object.freeze({ sessao: contexto.sessao, username: contexto.username, role: contexto.role, numeroMesa: contexto.numeroMesa }),
        itens: Object.freeze(itens.map(i => Object.freeze({ produtoId: i.produtoId, quantidade: i.quantidade }))) });
}

// Um gestor por tela/contexto. A persistencia e a chave protegem tambem remontagens/reload.
export class GestorAdicao {
    private storage: Armazenamento;
    private contexto: ContextoAdicao | null;
    private contextoAtual: () => ContextoAdicao | null;
    private gerarUUID: () => string;
    private incerta = false;
    private listeners = new Set<() => void>();
    private estado: EstadoAdicao = { pendente: null, enviando: false, mensagem: null, podeRevisar: false, bloqueada: false };

    constructor(storage: Armazenamento, contexto: ContextoAdicao | null, contextoAtual: () => ContextoAdicao | null, gerarUUID = novoUUID) {
        this.storage = storage; this.contexto = contexto; this.contextoAtual = contextoAtual; this.gerarUUID = gerarUUID;
        try {
            const raw = storage.getItem(CHAVE_ADICAO_PENDENTE);
            if (raw) {
                const op = JSON.parse(raw);
                if (!mesmoContexto(op.contexto, contexto)) {
                    this.estado = { ...this.estado, bloqueada: true, mensagem: "Existe uma adição pendente de outra sessão ou mesa. Confira a comanda e solicite atendimento antes de continuar." };
                } else {
                    this.estado = { ...this.estado, pendente: snapshot(op.chave, op.pedidoId, op.itens, op.contexto), mensagem: MENSAGEM_INCERTA };
                    this.incerta = true;
                }
            }
        } catch {
            this.estado = { ...this.estado, bloqueada: true, mensagem: "Não foi possível recuperar o envio com segurança. Confira a comanda e solicite atendimento." };
        }
    }
    obterEstado = () => this.estado;
    assinar = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private atualizar(patch: Partial<EstadoAdicao>) {
        this.estado = { ...this.estado, ...patch }; this.listeners.forEach(listener => listener());
    }
    private autorizado() { return mesmoContexto(this.contexto, this.contextoAtual()); }

    async enviar(pedidoId: number, itens: readonly AdicionarItensInput[], executar: (op: AdicaoPendente) => Promise<unknown>, confirmar: (op: AdicaoPendente) => void): Promise<void> {
        if (this.estado.enviando || this.estado.bloqueada) return;
        if (!this.autorizado() || !this.contexto) {
            this.atualizar({ bloqueada: true, mensagem: "A sessão ou a mesa mudou. Não foi realizado um novo envio." }); return;
        }
        // Antes do primeiro await: dois toques nao geram duas operacoes/chaves.
        this.atualizar({ enviando: true, podeRevisar: false });
        let preparada = false;
        try {
            const op = this.estado.pendente ?? snapshot(this.gerarUUID(), pedidoId, itens, this.contexto);
            this.atualizar({ pendente: op, mensagem: null });
            this.storage.setItem(CHAVE_ADICAO_PENDENTE, JSON.stringify(op));
            preparada = true;
            await executar(op);
            if (!this.autorizado()) {
                this.atualizar({ bloqueada: true, mensagem: "A sessão mudou durante o envio. Confira a comanda antes de continuar." }); return;
            }
            // Outra montagem pode ter confirmado enquanto esta resposta estava atrasada.
            const salvo = JSON.parse(this.storage.getItem(CHAVE_ADICAO_PENDENTE) || "null");
            if (salvo?.chave !== op.chave || !mesmoContexto(salvo.contexto, op.contexto)) return;
            // Atualiza o carrinho persistido antes de remover a chave: reload neste intervalo faz replay seguro.
            confirmar(op);
            if (salvo?.chave === op.chave && mesmoContexto(salvo.contexto, op.contexto)) this.storage.removeItem(CHAVE_ADICAO_PENDENTE);
            this.incerta = false;
            this.atualizar({ pendente: null, mensagem: null });
        } catch (error: unknown) {
            if (!this.autorizado()) { this.atualizar({ bloqueada: true, mensagem: "Sessão encerrada. Confira a comanda após entrar novamente." }); return; }
            const resposta = (error as { response?: { status?: number; data?: { mensagem?: string } } })?.response;
            const status = resposta?.status;
            const mensagem = typeof resposta?.data?.mensagem === "string" ? resposta.data.mensagem : "Não foi possível adicionar os itens. Confira a comanda ou solicite atendimento.";
            const desconhecido = !status || status >= 500 || status === 408 || status === 429;
            this.incerta ||= preparada && desconhecido;
            const podeRevisar = !this.incerta && (status === 400 || status === 404
                || (status === 409 && /^(Estoque insuficiente|Apenas pedidos ABERTOS)/.test(mensagem)));
            this.atualizar({ mensagem: !preparada ? "Não foi possível preparar o envio com segurança. Tente novamente." : desconhecido ? MENSAGEM_INCERTA : mensagem,
                podeRevisar, bloqueada: status === 401 || status === 403 });
        } finally { this.atualizar({ enviando: false }); }
    }

    revisarRejeitada() {
        if (!this.estado.podeRevisar || this.estado.enviando || !this.autorizado()) return;
        try {
            this.storage.removeItem(CHAVE_ADICAO_PENDENTE);
            this.atualizar({ pendente: null, podeRevisar: false, mensagem: null });
        } catch { this.atualizar({ mensagem: "Não foi possível liberar a seleção com segurança. Tente novamente." }); }
    }
}
