export type StatusPedido = 'ABERTO' | 'AGUARDANDO_PAGAMENTO' | 'FINALIZADO';
export type StatusItemPedido = 'PENDENTE' | 'EM_PREPARO' | 'PRONTO';

// PedidoResponseDTO e ItemPedidoResponseDTO: números JSON e LocalDateTime sem offset.
export interface ItemPedidoDados {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: StatusItemPedido;
    dataHoraInclusao: string;
    tempoPreparoMinutos: number;
    dataHoraConclusao: string | null;
}
export interface PedidoDados {
    id: number;
    numeroMesa: number;
    dataHora: string;
    status: StatusPedido;
    itens: ItemPedidoDados[];
    formaPagamento: string | null;
    faturamento: number | null;
}
export interface CriarPedidoInput {
    numeroMesa: number;
    itens: AdicionarItensInput[];
    formaPagamento: string;
}
export interface AdicionarItensInput { produtoId: number; quantidade: number }
