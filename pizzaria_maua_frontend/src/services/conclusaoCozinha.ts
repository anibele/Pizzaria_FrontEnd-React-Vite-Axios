import { replaceEqualDeep } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import type { PedidoDados } from '../interfaces/PedidoDados';

export const CHAVE_COZINHA = ['pedidos-cozinha'] as const;

export async function buscarPedidosCozinha(http: Pick<AxiosInstance, 'get'>, signal: AbortSignal): Promise<PedidoDados[]> {
    const response = await http.get<PedidoDados[]>('/pedidos/cozinha', { signal, timeout: 15000 });
    return response.data;
}

export async function concluirItemCozinha(http: Pick<AxiosInstance, 'patch'>, itemId: number): Promise<void> {
    await http.patch(`/pedidos/itens/${itemId}/status`, null, { params: { status: 'PRONTO' }, timeout: 15000 });
}

// PRONTO é terminal no contrato do backend. Conserva apenas confirmações já no cache,
// sem manter outra coleção de IDs que possa esconder itens após uma falha.
export function preservarItensProntos(anterior: unknown, recebido: unknown): PedidoDados[] {
    const novos = recebido as PedidoDados[];
    if (!Array.isArray(anterior) || !Array.isArray(novos)) return novos;
    const prontos = new Map((anterior as PedidoDados[]).map(p => [p.id,
        new Set(p.itens.filter(i => i.status === 'PRONTO').map(i => i.id))]));
    const mesclados = novos.map(p => ({ ...p, itens: p.itens.map(i =>
        i.id !== undefined && prontos.get(p.id)?.has(i.id) ? { ...i, status: 'PRONTO' as const } : i) }));
    return replaceEqualDeep(anterior, mesclados) as PedidoDados[];
}

export interface EstadoConclusaoItem {
    processando: boolean;
    verificar: boolean;
    mensagem: string | null;
}

interface OperacoesCozinha {
    concluir: (itemId: number) => Promise<void>;
    consultar: (signal: AbortSignal) => Promise<PedidoDados[]>;
}

class FilaAtualizada extends Error {}

function mensagemErro(erro: unknown): string {
    if (erro instanceof FilaAtualizada) return 'A fila mudou durante a consulta. Verifique novamente antes de concluir o item.';
    const resposta = (erro as { response?: { status?: number; data?: { mensagem?: string } } })?.response;
    const detalhe = typeof resposta?.data?.mensagem === 'string' ? resposta.data.mensagem : undefined;
    switch (resposta?.status) {
        case 400: return detalhe || 'A solicitação do item é inválida. Confira os dados e tente novamente.';
        case 401: return 'Sua sessão expirou. Entre novamente para continuar.';
        case 403: return 'Seu usuário não tem permissão para concluir este item. Solicite atendimento.';
        case 404: return 'O item não foi encontrado. Atualize a fila e confira o pedido.';
        case 409: return detalhe || 'O estado do pedido ou do item mudou. Confira a fila atualizada.';
        default: return resposta?.status && resposta.status >= 500
            ? 'O servidor não confirmou a conclusão do item.'
            : 'A conclusão não foi confirmada: falha de conexão ou tempo de espera esgotado.';
    }
}

export class ConclusaoCozinha {
    private client: QueryClient;
    private operacoes: OperacoesCozinha;
    private estado: Record<number, EstadoConclusaoItem> = {};
    private emCurso = new Map<number, AbortController>();
    private listeners = new Set<() => void>();

    constructor(client: QueryClient, operacoes: OperacoesCozinha) {
        this.client = client;
        this.operacoes = operacoes;
    }

    obterEstado = () => this.estado;
    assinar = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    private atualizar(itemId: number, estado?: EstadoConclusaoItem) {
        const proximo = { ...this.estado };
        if (estado) proximo[itemId] = estado;
        else delete proximo[itemId];
        this.estado = proximo;
        this.listeners.forEach(listener => listener());
    }

    // A requisição pode terminar no servidor; só o novo monitor deve refletir seu
    // resultado, pelo polling. Callbacks da montagem anterior deixam de atuar.
    limpar = () => {
        this.emCurso.forEach(controle => controle.abort());
        this.emCurso.clear();
        this.estado = {};
        this.listeners.forEach(listener => listener());
    };

    private itemAtual(itemId: number) {
        return this.client.getQueryData<PedidoDados[]>(CHAVE_COZINHA)?.flatMap(p => p.itens).find(i => i.id === itemId);
    }

    private async consultar(controle: AbortController) {
        // GET próprio e posterior à falha, sem reaproveitar polling anterior.
        const anterior = this.client.getQueryData(CHAVE_COZINHA);
        const pedidos = await this.operacoes.consultar(controle.signal);
        if (controle.signal.aborted) return;
        // Outro item/polling pode ter confirmado ou retirado uma conta neste intervalo.
        // Não republicar um snapshot antigo sobre essa atualização mais recente.
        if (this.client.getQueryData(CHAVE_COZINHA) !== anterior) throw new FilaAtualizada();
        await this.client.cancelQueries({ queryKey: CHAVE_COZINHA, exact: true });
        if (controle.signal.aborted) return;
        if (this.client.getQueryData(CHAVE_COZINHA) !== anterior) throw new FilaAtualizada();
        this.client.setQueryData<PedidoDados[]>(CHAVE_COZINHA, anterior => preservarItensProntos(anterior, pedidos));
    }

    concluir = (itemId: number) => this.executar(itemId, false);
    verificar = (itemId: number) => this.executar(itemId, true);

    private async executar(itemId: number, somenteConsultar: boolean): Promise<void> {
        if (this.emCurso.has(itemId)) return;
        if (this.itemAtual(itemId)?.status === 'PRONTO') { this.atualizar(itemId); return; }
        const anterior = this.estado[itemId];
        somenteConsultar ||= !!anterior?.verificar;
        const controle = new AbortController();
        this.emCurso.set(itemId, controle);
        const vigente = () => this.emCurso.get(itemId) === controle;
        let tentouConcluir = false;
        this.atualizar(itemId, { processando: true, verificar: false, mensagem: 'Confirmando o item...' });
        try {
            // Uma tentativa após falha começa verificando o estado persistido.
            if (anterior || somenteConsultar || !this.itemAtual(itemId)) {
                await this.consultar(controle);
                if (!vigente()) return;
                const item = this.itemAtual(itemId);
                if (!item || item.status === 'PRONTO') { this.atualizar(itemId); return; }
                if (somenteConsultar) {
                    this.atualizar(itemId, { processando: false, verificar: false, mensagem: 'O item ainda não está PRONTO. Você pode tentar concluir novamente.' });
                    return;
                }
            }
            tentouConcluir = true;
            await this.operacoes.concluir(itemId);
            if (!vigente()) return;
            // Descarta polling anterior antes de publicar a confirmação 204.
            await this.client.cancelQueries({ queryKey: CHAVE_COZINHA, exact: true });
            if (!vigente()) return;
            this.client.setQueryData<PedidoDados[]>(CHAVE_COZINHA, pedidos => pedidos?.map(p => ({ ...p,
                itens: p.itens.map(i => i.id === itemId ? { ...i, status: 'PRONTO' as const } : i) })));
            this.atualizar(itemId);
            void this.client.invalidateQueries({ queryKey: CHAVE_COZINHA, exact: true });
        } catch (erro: unknown) {
            if (!vigente()) return;
            if (this.itemAtual(itemId)?.status === 'PRONTO') { this.atualizar(itemId); return; }
            const status = (erro as { response?: { status?: number } })?.response?.status;
            const mensagem = mensagemErro(erro);
            if (!tentouConcluir || status === 401 || status === 403) {
                this.atualizar(itemId, { processando: false, verificar: true, mensagem });
                return;
            }
            this.atualizar(itemId, { processando: true, verificar: true, mensagem: 'Verificando a fila no servidor...' });
            try {
                await this.consultar(controle);
                if (!vigente()) return;
                const item = this.itemAtual(itemId);
                if (!item || item.status === 'PRONTO') { this.atualizar(itemId); return; }
                this.atualizar(itemId, { processando: false, verificar: false, mensagem: `${mensagem} O item continua na fila; a conclusão não foi confirmada.` });
            } catch (erroConsulta: unknown) {
                if (vigente()) this.atualizar(itemId, { processando: false, verificar: true,
                    mensagem: `${mensagem} ${mensagemErro(erroConsulta)} Toque para verificar a fila antes de tentar novamente.` });
            }
        } finally {
            if (vigente()) this.emCurso.delete(itemId);
        }
    }
}
