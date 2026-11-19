import type { PedidoCaixaDados } from '../interfaces/PedidoDadosCaixa';
import type { PedidoDados } from '../interfaces/PedidoDados';

export const adaptarParaCaixa = (pedido: PedidoDados): PedidoCaixaDados => {
    if (!pedido || !Number.isSafeInteger(pedido.id) || pedido.id <= 0 || !Number.isSafeInteger(pedido.numeroMesa) || pedido.numeroMesa <= 0
        || typeof pedido.dataHora !== 'string' || !pedido.dataHora
        || !['ABERTO', 'AGUARDANDO_PAGAMENTO', 'FINALIZADO'].includes(pedido.status) || !Array.isArray(pedido.itens)
        || !(pedido.formaPagamento === null || typeof pedido.formaPagamento === 'string')
        || !(pedido.faturamento === null || (typeof pedido.faturamento === 'number' && Number.isFinite(pedido.faturamento) && pedido.faturamento >= 0))
        || pedido.itens.some(item => !item || !Number.isSafeInteger(item.id) || item.id <= 0 || !Number.isSafeInteger(item.produtoId) || item.produtoId <= 0
            || typeof item.produtoNome !== 'string' || !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0
            || typeof item.precoUnitario !== 'number' || !Number.isFinite(item.precoUnitario) || item.precoUnitario < 0)) {
        throw new Error('Dados da comanda incompatíveis com a resposta da API.');
    }
    return { ...pedido, faturamento: pedido.faturamento ?? pedido.itens.reduce((total, item) => total + item.quantidade * item.precoUnitario, 0),
        itens: pedido.itens.map(item => ({ id: item.id, produtoId: item.produtoId, produtoNome: item.produtoNome,
            quantidade: item.quantidade, precoUnitario: item.precoUnitario })) };
};
