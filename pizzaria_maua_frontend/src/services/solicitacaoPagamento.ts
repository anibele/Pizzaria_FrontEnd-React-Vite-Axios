export type FormaPagamento = 'PIX' | 'CARTAO' | 'DINHEIRO';

export interface PedidoPagamento {
    id: number;
    status: 'ABERTO' | 'AGUARDANDO_PAGAMENTO' | 'FINALIZADO';
    formaPagamento: string | null;
}

export interface EstadoPagamento {
    fase: 'selecao' | 'processando' | 'sucesso' | 'erro' | 'verificar' | 'encerrado';
    mensagem: string | null;
}

interface OperacoesPagamento {
    consultar: (signal: AbortSignal) => Promise<PedidoPagamento | null>;
    solicitar: (pedidoId: number, forma: FormaPagamento, signal: AbortSignal) => Promise<PedidoPagamento>;
    atualizar: (pedido: PedidoPagamento | null) => void;
}

const inicial: EstadoPagamento = { fase: 'selecao', mensagem: null };

function mensagemFalha(status: number | undefined): string {
    switch (status) {
        case 400: return 'Não foi possível solicitar o pagamento. Verifique a forma escolhida e tente novamente.';
        case 401: return 'Sua sessão expirou. Entre novamente para continuar.';
        case 403: return 'Seu usuário não tem permissão para solicitar este pagamento. Solicite atendimento.';
        case 404: return 'O pedido não foi encontrado. Feche esta janela e atualize a comanda.';
        case 409: return 'O pedido mudou de estado ou há uma operação concorrente.';
        default: return status && status >= 500
            ? 'O servidor não confirmou a solicitação de pagamento.'
            : 'A conexão foi interrompida ou o tempo de espera terminou.';
    }
}

// Mantém a trava antes do primeiro await e separa consulta de reenvio.
// Não persiste uma confirmação local: reabrir/recarregar exige consultar o servidor.
export class SolicitacaoPagamento {
    private operacoes: OperacoesPagamento;
    private pedidoId: number | null = null;
    private controle: AbortController | null = null;
    private estado: EstadoPagamento = inicial;
    private listeners = new Set<() => void>();

    constructor(operacoes: OperacoesPagamento) { this.operacoes = operacoes; }

    obterEstado = () => this.estado;
    assinar = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    private atualizar(estado: EstadoPagamento) {
        this.estado = estado;
        this.listeners.forEach(listener => listener());
    }

    reiniciar = () => {
        this.controle?.abort();
        this.controle = null;
        this.pedidoId = null;
        this.atualizar(inicial);
    };

    solicitar = async (pedidoId: number | undefined, forma: FormaPagamento): Promise<void> => {
        if (this.controle || this.estado.fase === 'sucesso' || this.estado.fase === 'encerrado') return;
        if (!Number.isSafeInteger(pedidoId) || !pedidoId || pedidoId <= 0) {
            this.atualizar({ fase: 'encerrado', mensagem: 'Não há pedido ativo para solicitar pagamento. Atualize a comanda.' });
            return;
        }
        if (this.pedidoId !== null && this.pedidoId !== pedidoId) {
            this.atualizar({ fase: 'encerrado', mensagem: 'A conta desta mesa mudou. Feche esta janela e confira a comanda.' });
            return;
        }
        this.pedidoId = pedidoId;
        // Enquanto o resultado for desconhecido, até uma chamada repetida só consulta.
        await this.executar(this.estado.fase === 'verificar' ? undefined : forma);
    };

    verificar = async (): Promise<void> => {
        if (this.pedidoId !== null) await this.executar();
    };

    private aplicar(pedido: PedidoPagamento | null): boolean {
        if (pedido && (!Number.isSafeInteger(pedido.id)
            || !['ABERTO', 'AGUARDANDO_PAGAMENTO', 'FINALIZADO'].includes(pedido.status))) {
            throw new Error('Resposta de pedido inválida.');
        }
        this.operacoes.atualizar(pedido);
        if (!pedido || pedido.id !== this.pedidoId || pedido.status === 'FINALIZADO') {
            this.atualizar({ fase: 'encerrado', mensagem: 'Esta conta não está mais aberta. Feche esta janela e confira a comanda.' });
            return false;
        }
        if (pedido.status === 'AGUARDANDO_PAGAMENTO') {
            this.atualizar({ fase: 'sucesso', mensagem: null });
            return false;
        }
        return true;
    }

    private async executar(forma?: FormaPagamento): Promise<void> {
        if (this.controle || this.pedidoId === null) return;
        const controle = new AbortController();
        this.controle = controle;
        const { signal } = controle;
        let enviou = false;
        this.atualizar({ fase: 'processando', mensagem: 'Verificando o pedido...' });
        try {
            const atual = await this.operacoes.consultar(signal);
            if (signal.aborted || !this.aplicar(atual)) return;
            if (!forma) {
                this.atualizar({ fase: 'erro', mensagem: 'O pedido continua aberto. Você pode escolher a forma de pagamento e tentar novamente.' });
                return;
            }
            this.atualizar({ fase: 'processando', mensagem: 'Enviando a solicitação de pagamento...' });
            enviou = true;
            const confirmado = await this.operacoes.solicitar(this.pedidoId, forma, signal);
            if (signal.aborted) return;
            if (!confirmado || confirmado.id !== this.pedidoId || confirmado.status !== 'AGUARDANDO_PAGAMENTO') {
                throw new Error('Confirmação de pagamento inválida.');
            }
            this.aplicar(confirmado);
        } catch (erro: unknown) {
            if (signal.aborted) return;
            const status = (erro as { response?: { status?: number } })?.response?.status;
            const mensagem = mensagemFalha(status);
            if (!enviou) {
                this.atualizar({ fase: 'verificar', mensagem: `${mensagem} Não foi possível verificar o estado atual do pedido.` });
            } else if (status === 400 || status === 401 || status === 403 || status === 404) {
                this.atualizar({ fase: status === 400 ? 'erro' : status === 404 ? 'encerrado' : 'verificar', mensagem });
            } else {
                // 409, falha de rede, timeout e 5xx: nunca repetir o PATCH automaticamente.
                this.atualizar({ fase: 'processando', mensagem: 'Conferindo se o pedido já aguarda pagamento...' });
                try {
                    const atual = await this.operacoes.consultar(signal);
                    if (signal.aborted || !this.aplicar(atual)) return;
                    this.atualizar({ fase: 'erro', mensagem: `${mensagem} O pedido continua aberto. Você pode tentar novamente.` });
                } catch {
                    if (!signal.aborted) this.atualizar({ fase: 'verificar', mensagem: `${mensagem} O resultado ainda não foi confirmado. Verifique o pedido antes de tentar novamente.` });
                }
            }
        } finally {
            if (this.controle === controle) this.controle = null;
        }
    }
}
