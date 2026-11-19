import type { ItemPedidoDados, PedidoDados } from './PedidoDados';

export type ItemPedidoCaixa = Pick<ItemPedidoDados, 'id' | 'produtoId' | 'produtoNome' | 'quantidade' | 'precoUnitario'>;
// Modelo de exibição: total calculado dos preços históricos quando o DTO prevê total nulo.
export interface PedidoCaixaDados extends Omit<PedidoDados, 'itens' | 'faturamento'> {
    itens: ItemPedidoCaixa[];
    faturamento: number;
}
