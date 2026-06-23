import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useProdutosAtivos } from "../hooks/useProdutosAtivos";
import { usePedidoMesaAberto } from "../hooks/usePedidoMesaAberto";
import { usePedidoCriar } from "../hooks/usePedidoCriar";
import { usePedidoAdicionarItens } from "../hooks/usePedidoAdicionarItens";
import { usePedidoFinalizar } from "../hooks/usePedidoFinalizar";
import { useMonitorarStatusMesa } from "../hooks/useMonitorarStatusMesa";
import ModalPagamento from "../componentes/ModalPagamento";
import ModalAvisoCarrinho from "../componentes/ModalAvisoCarrinho";
import ModalDetalhesProduto from "../componentes/ModalDetalhesProduto";
import ListaCardapio from "../componentes/ListaCardapio";
import PedidoMesa from "../componentes/PedidoMesa";
import StandByPizzaria from "../pages/StandByPizzaria.tsx";
import ManutencaoMesa from "../pages/ManutencaoMesa";
import MesaReservada from "../pages/MesaReservada";
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
    const [isModalAvisoOpen, setIsModalAvisoOpen] = useState<boolean>(false);
    const [isStandBy, setIsStandBy] = useState<boolean>(false);

    const [pagamentoSolicitado, setPagamentoSolicitado] = useState<boolean>(false);

    const { data: produtos, isLoading: loadingProdutos, isError: erroProdutos } = useProdutosAtivos();
    const { data: pedidoAtivo, isLoading: loadingPedido } = usePedidoMesaAberto(numeroMesa);
    const { data: mesaStatusData } = useMonitorarStatusMesa(numeroMesa > 0 ? numeroMesa : undefined);

    const { mutate: criarNovoPedido, isPending: criando } = usePedidoCriar();
    const { mutate: adicionarItensAoPedido, isPending: adicionando } = usePedidoAdicionarItens();
    const { mutate: finalizarPedido } = usePedidoFinalizar();

    useEffect(() => {
        if (isStandBy) return;

        let inactivityTimer: ReturnType<typeof setTimeout>;

        const resetarCronometro = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                setIsStandBy(true);
            }, 60 * 1000);
        };

        const eventosInteracao = ["mousemove", "mousedown", "touchstart", "click", "scroll"];

        resetarCronometro();

        eventosInteracao.forEach(evento => window.addEventListener(evento, resetarCronometro));

        return () => {
            clearTimeout(inactivityTimer);
            eventosInteracao.forEach(evento => window.removeEventListener(evento, resetarCronometro));
        };
    }, [isStandBy]);

    const handleAdicionarAoCarrinho = (produto: ProdutoDados) => {
        setCarrinho((carrinhoAtual) => {
            const itemExistente = carrinhoAtual.find(item => item.produto.id === produto.id);
            if (itemExistente) {
                return carrinhoAtual.map(item =>
                    item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
                );
            }
            return [...carrinhoAtual, { produto, grandmother: 1, quantidade: 1 }];
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
                    limparCarrinho();
                }
            });
        }
    };

    const itensConsumidos = (pedidoAtivo?.itens as unknown as ItemPedidoResponse[]) || [];
    const possuiItensConsumidos = itensConsumidos.length > 0;
    const todosItensProntos = possuiItensConsumidos && itensConsumidos.every(item => item.status === "PRONTO");

    const handleSolicitarPagamento = () => {
        if (carrinho.length > 0) {
            setIsModalAvisoOpen(true);
        } else {
            setPagamentoSolicitado(false);
            setIsModalOpen(true);
        }
    };

    const handleDescartarEPagar = () => {
        limparCarrinho();
        setIsModalAvisoOpen(false);
        setPagamentoSolicitado(false);
        setIsModalOpen(true);
    };

    const handleEnviarSolicitacaoPagamento = (formaPagamentoSelecionada: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        if (pedidoAtivo) {
            setPagamentoSolicitado(true);

            finalizarPedido({
                pedidoId: pedidoAtivo.id,
                numeroMesa: numeroMesa,
                formaPagamento: formaPagamentoSelecionada
            });
        }
    };

    const handleFechamentoModal = () => {
        setIsModalOpen(false);

        if (pagamentoSolicitado) {
            setIsStandBy(true);
            setPagamentoSolicitado(false);
        }
    };

    const produtosCardapio = produtos?.filter(p => p.ativo) || [];

    // CORREÇÃO: Se a mesa estiver explicitamente desativada no banco (ativo == false) OU com status MANUTENCAO, bloqueia o fluxo imediatamente
    if (mesaStatusData?.status === "MANUTENCAO" || mesaStatusData?.ativo === false) {
        return <ManutencaoMesa />;
    }

    if (mesaStatusData?.status === "RESERVADA") {
        return <MesaReservada />;
    }

    if (isStandBy) {
        return <StandByPizzaria onToque={() => setIsStandBy(false)} />;
    }

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
            <div className="coluna-cardapio">
                <div className="cardapio-header">
                    <h2 className="cardapio-title">
                        <UtensilsCrossed color="#e53935" /> Cardápio Digital - Faça seus pedidos aqui!
                    </h2>
                </div>

                <ListaCardapio
                    produtos={produtosCardapio}
                    onVerDetalhes={setProdutoSelecionado}
                    onAdicionar={handleAdicionarAoCarrinho}
                />
            </div>

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
                    onAbrirPagamento={handleSolicitarPagamento}
                />
            </div>

            <ModalPagamento
                isOpen={isModalOpen}
                onClose={handleFechamentoModal}
                onSolicitarPagamento={handleEnviarSolicitacaoPagamento}
            />

            <ModalAvisoCarrinho
                isOpen={isModalAvisoOpen}
                onClose={() => setIsModalAvisoOpen(false)}
                onConfirmarPagamento={handleDescartarEPagar}
            />

            <ModalDetalhesProduto
                produto={produtoSelecionado}
                onClose={() => setProdutoSelecionado(null)}
            />
        </div>
    );
}