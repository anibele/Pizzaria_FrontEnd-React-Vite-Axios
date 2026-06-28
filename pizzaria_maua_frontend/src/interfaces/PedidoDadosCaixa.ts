export interface ItemPedidoCaixa {
    id?: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
}

export interface PedidoCaixaDados {
    id: number;
    numeroMesa: number;
    dataHora: string;
    status: 'ABERTO' | 'FINALIZADO' | 'AGUARDANDO_PAGAMENTO';
    itens: ItemPedidoCaixa[];
    formaPagamento: string | null;
    faturamento: number;
}