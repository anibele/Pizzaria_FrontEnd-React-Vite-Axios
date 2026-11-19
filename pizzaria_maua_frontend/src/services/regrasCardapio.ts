import type { MesaDados } from '../interfaces/MesaDados';
import type { PedidoDados } from '../interfaces/PedidoDados';
import type { ProdutoDados } from '../interfaces/ProdutoDados';
import type { ItemCarrinho } from './carrinhoPersistido';

// Orientação com dados conhecidos; o backend revalida estado, estoque, preço e autorização.
export function motivoNovosItens(mesa: MesaDados | undefined, pedido: PedidoDados | null | undefined): string | null {
    if (!mesa || pedido === undefined) return 'Aguarde a consulta da mesa e da comanda.';
    if (!mesa.ativo) return 'Esta mesa está inativa. Solicite atendimento.';
    if (pedido) {
        if (pedido.numeroMesa !== mesa.numero) return 'A comanda recebida não corresponde a esta mesa. Atualize as informações.';
        if (mesa.status !== 'OCUPADA') return 'A situação da mesa e da comanda precisa ser atualizada.';
        if (pedido.status === 'AGUARDANDO_PAGAMENTO') return 'Pagamento já solicitado. Novos itens não podem ser enviados nesta comanda.';
        if (pedido.status !== 'ABERTO') return 'Esta comanda foi encerrada. Atualize as informações antes de continuar.';
        return null;
    }
    return mesa.status === 'LIVRE' ? null : 'A abertura exige uma mesa ativa e livre. Atualize as informações ou solicite atendimento.';
}

export function podeSolicitarPagamento(mesa: MesaDados | undefined, pedido: PedidoDados | null | undefined): boolean {
    return !!pedido && pedido.status === 'ABERTO' && !!mesa?.ativo && mesa.status === 'OCUPADA' && pedido.numeroMesa === mesa.numero;
}

export function produtoDisponivel(produto: ProdutoDados | undefined, quantidade = 1): boolean {
    return !!produto && typeof produto.id === 'number' && Number.isSafeInteger(produto.id) && produto.id > 0 && produto.ativo
        && Number.isSafeInteger(quantidade) && quantidade > 0 && quantidade <= 2147483647
        && Number.isSafeInteger(produto.qtdEstoque) && produto.qtdEstoque >= quantidade;
}

export function adicionarUnidade(itens: ItemCarrinho[], produto: ProdutoDados | undefined): ItemCarrinho[] {
    if (!produto) return itens;
    const existente = itens.find(i => i.produto.id === produto.id);
    if (!produtoDisponivel(produto, (existente?.quantidade ?? 0) + 1)) return itens;
    return existente ? itens.map(i => i.produto.id === produto.id ? { produto, quantidade: i.quantidade + 1 } : i)
        : [...itens, { produto, quantidade: 1 }];
}

export function motivoSelecao(itens: readonly ItemCarrinho[], produtos: readonly ProdutoDados[]): string | null {
    if (!itens.length) return 'Selecione ao menos um item.';
    const quantidades = new Map<number, number>();
    for (const item of itens) {
        const id = item.produto.id;
        if (typeof id !== 'number' || !Number.isSafeInteger(id) || !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0) return 'Revise os itens e quantidades da seleção.';
        const quantidade = (quantidades.get(id) || 0) + item.quantidade;
        quantidades.set(id, quantidade);
        const produto = produtos.find(p => p.id === id);
        if (!produto?.ativo) return 'Há um produto indisponível na seleção. Revise os itens.';
        if (!produtoDisponivel(produto, quantidade)) return `Estoque insuficiente para ${produto.nome}. Diminua a quantidade ou atualize o cardápio.`;
    }
    return null;
}
