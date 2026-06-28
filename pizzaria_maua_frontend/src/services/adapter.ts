import type {PedidoCaixaDados} from "../interfaces/PedidoDadosCaixa";

export const adaptarParaCaixa = (pedido: any): PedidoCaixaDados => {
    return {
        id: pedido.id,

        // Tenta pegar o numeroMesa novo; se não existir, tenta o mesa.numero antigo
        numeroMesa: pedido.numeroMesa ?? (pedido.mesa?.numero ?? 0),

        dataHora: pedido.dataHora,

        // Garante que o status seja uma das opções válidas
        status: pedido.status as 'ABERTO' | 'FINALIZADO' | 'AGUARDANDO_PAGAMENTO',

        formaPagamento: pedido.formaPagamento ?? null,

        faturamento: pedido.faturamento ?? 0,

        itens: (pedido.itens || []).map((item: any) => ({
            id: item.id,
            produtoId: item.produtoId ?? item.produto?.id ?? 0,

            // Prioriza o campo 'produtoNome' (novo), mas aceita 'produto.nome' (antigo)
            produtoNome: item.produtoNome ?? item.produto?.nome ?? "Item sem nome",

            quantidade: item.quantidade ?? 0,

            // Prioriza o campo 'precoUnitario' (novo), mas aceita 'produto.precoBase' (antigo)
            precoUnitario: item.precoUnitario ?? item.produto?.precoBase ?? 0
        }))
    };
};