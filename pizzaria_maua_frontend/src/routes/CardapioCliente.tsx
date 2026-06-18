import { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useProdutosAtivos } from "../hooks/useProdutosAtivos";
import { usePedidoMesaAberto } from "../hooks/usePedidoMesaAberto";
import { usePedidoCriar } from "../hooks/usePedidoCriar";
import { usePedidoAdicionarItens } from "../hooks/usePedidoAdicionarItens";
import { usePedidoFinalizar } from "../hooks/usePedidoFinalizar";
import ModalPagamento from "../componentes/ModalPagamento";
import ModalDetalhesProduto from "../componentes/ModalDetalhesProduto";
import ListaCardapio from "../componentes/ListaCardapio";
import PedidoMesa from "../componentes/PedidoMesa";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

import {
    UtensilsCrossed,
    AlertCircle,
    Loader2
} from "lucide-react";

import "../styles/cardapio.css";

interface ItemCarrinho {
    produto: ProdutoDados;
    quantidade: number;
}

interface ItemPedidoResponse {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
}

export default function CardapioCliente() {
    const { user } = useContext(AuthContext);

    const numeroMesa = user && user.username
        ? Number(user.username.replace(/\D/g, ""))
        : 0;

    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
    const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDados | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const { data: produtos, isLoading: loadingProdutos, isError: erroProdutos } = useProdutosAtivos();
    const { data: pedidoAtivo, isLoading: loadingPedido } = usePedidoMesaAberto(numeroMesa);

    const { mutate: criarNovoPedido, isPending: criando } = usePedidoCriar();
    const { mutate: adicionarItensAoPedido, isPending: adicionando } = usePedidoAdicionarItens();
    const { mutate: finalizarPedido } = usePedidoFinalizar();

    const handleAdicionarAoCarrinho = (produto: ProdutoDados) => {
        setCarrinho((carrinhoAtual) => {
            const itemExistente = carrinhoAtual.find(item => item.produto.id === produto.id);
            if (itemExistente) {
                return carrinhoAtual.map(item =>
                    item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
                );
            }
            return [...carrinhoAtual, { produto, quantidade: 1 }];
        });
    };

    const handleRemoverOuDiminuir = (produtoId: number) => {
        setCarrinho((carrinhoAtual) => {
            const item = carrinhoAtual.find(i => i.produto.id === produtoId);
            if (!item) return carrinhoAtual;

            if (item.quantidade === 1) {
                return carrinhoAtual.filter(i => i.produto.id !== produtoId);
            }

            return carrinhoAtual.map(i =>
                i.produto.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i
            );
        });
    };

    const limparCarrinho = () => setCarrinho([]);

    const handleEnviarParaCozinha = () => {
        if (carrinho.length === 0 || numeroMesa === 0) return;

        if (pedidoAtivo) {
            const itensPayload = carrinho.map(item => ({
                produtoId: item.produto.id!,
                quantidade: item.quantidade
            }));

            adicionarItensAoPedido({
                pedidoId: pedidoAtivo.id,
                numeroMesa: numeroMesa,
                itens: itensPayload
            }, {
                onSuccess: () => {
                    alert("Novos itens adicionados e enviados para a cozinha! 🍕");
                    limparCarrinho();
                }
            });
        } else {
            const novoPedidoPayload = {
                numeroMesa: numeroMesa,
                formaPagamento: "PENDENTE",
                itens: carrinho.map(item => ({
                    produtoId: item.produto.id!,
                    quantidade: item.quantidade
                }))
            };

            criarNovoPedido(novoPedidoPayload, {
                onSuccess: () => {
                    alert("Pedido inicial aberto e enviado para a cozinha! 🎉");
                    limparCarrinho();
                }
            });
        }
    };

    const itensConsumidos = (pedidoAtivo?.itens as unknown as ItemPedidoResponse[]) || [];
    const possuiItensConsumidos = itensConsumidos.length > 0;
    const todosItensProntos = possuiItensConsumidos && itensConsumidos.every(item => item.status === "PRONTO");

    const handleFechamentoModal = (formaPagamentoSelecionada?: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        setIsModalOpen(false);
        if (formaPagamentoSelecionada && pedidoAtivo) {
            finalizarPedido({
                pedidoId: pedidoAtivo.id,
                numeroMesa: numeroMesa,
                formaPagamento: formaPagamentoSelecionada
            });
        }
    };

    const produtosCardapio = produtos?.filter(p => p.ativo) || [];

    if (numeroMesa === 0 || loadingProdutos || loadingPedido) {
        return (
            <div className="center-message">
                <Loader2 className="animate-spin" size={40} color="#e53935" />
                <p>Inicializando Tablet da Mesa. Por favor, aguarde...</p>
            </div>
        );
    }

    if (erroProdutos) {
        return (
            <div className="error-card">
                <AlertCircle size={48} color="#d32f2f" style={{ marginBottom: '16px' }} />
                <h2>Não foi possível carregar o cardápio</h2>
                <p>O tablet falhou ao tentar buscar os produtos ativos. Verifique as regras do Back-end.</p>
            </div>
        );
    }

    return (
        <div className="cardapio-container">

            {/* SEÇÃO ESQUERDA: LISTA DE PRODUTOS */}
            <div className="coluna-cardapio">
                <div className="cardapio-header">
                    <h2 className="cardapio-title">
                        <UtensilsCrossed color="#e53935" /> Cardápio Digital - Pizzaria Mauá
                    </h2>
                </div>

                {/* O bloco da "Comanda Ativa" foi inteiramente removido daqui */}

                <ListaCardapio
                    produtos={produtosCardapio}
                    onVerDetalhes={setProdutoSelecionado}
                    onAdicionar={handleAdicionarAoCarrinho}
                />
            </div>

            {/* SEÇÃO DIREITA: BARRA LATERAL TOTALMENTE MODULARIZADA */}
            <div className="coluna-pedido">
                <PedidoMesa
                    carrinho={carrinho}
                    onRemoverOuDiminuir={handleRemoverOuDiminuir}
                    onAdicionarAoCarrinho={handleAdicionarAoCarrinho}
                    onEnviarParaCozinha={handleEnviarParaCozinha}
                    criando={criando}
                    adicionando={adicionando}
                    pedidoAtivo={pedidoAtivo}
                    itensConsumidos={itensConsumidos}
                    possuiItensConsumidos={possuiItensConsumidos}
                    todosItensProntos={todosItensProntos}
                    onAbrirPagamento={() => setIsModalOpen(true)}
                />
            </div>

            <ModalPagamento
                isOpen={isModalOpen}
                onClose={handleFechamentoModal}
            />

            <ModalDetalhesProduto
                produto={produtoSelecionado}
                onClose={() => setProdutoSelecionado(null)}
            />
        </div>
    );
}