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
    dataHora: string; // Vem como ISO string do LocalDateTime do Java
    status: 'ABERTO' | 'FINALIZADO';
    itens: ItemPedidoDados[];
    formaPagamento: string;
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