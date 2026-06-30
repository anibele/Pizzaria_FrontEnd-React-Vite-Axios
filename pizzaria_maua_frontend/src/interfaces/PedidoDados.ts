import type { ProdutoDados } from "./ProdutoDados";
import type { MesaDados } from "./MesaDados";

export interface ItemPedidoDados {
    id?: number;
    produto: ProdutoDados;
    quantidade: number;

    // NOVOS CAMPOS ADICIONADOS PARA A FILA INTELIGENTE DA COZINHA:
    status: 'PENDENTE' | 'EM_PREPARO' | 'PRONTO';
    dataHoraInclusao: string;     // O LocalDateTime do Java chega aqui como String ISO
    tempoPreparoMinutos: number;  // Inteiro pronto para fazermos as contas de peso e prioridade
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
    formaPagamento: string;
}

export interface AdicionarItensInput {
    produtoId: number;
    quantidade: number;
}