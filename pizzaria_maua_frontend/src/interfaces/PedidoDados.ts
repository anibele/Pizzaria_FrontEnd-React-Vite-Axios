import type { ProdutoDados } from "./ProdutoDados";
import type { MesaDados } from "./MesaDados";

export interface ItemPedidoDados {
    id?: number;
    produto: ProdutoDados;
    quantidade: number;
}

export interface PedidoDados {
    id: number;
    mesa: MesaDados;
    dataHora: string;
    status: 'ABERTO' | 'FINALIZADO' | 'AGUARDANDO_PAGAMENTO';
    itens: ItemPedidoDados[];
    formaPagamento: string;
    faturamento?: number;
}

export interface CriarPedidoInput {
    numeroMesa: number;
    itens: {
        produtoId: number;
        quantidade: number;
    }[];
    formaPagamento: string; // Ex: "Pendente"
}

export interface AdicionarItensInput {
    produtoId: number;
    quantidade: number;
}