import { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useProdutosAtivos } from "../hooks/useProdutosAtivos"; // 🟢 Hook correto de ativos
import { usePedidoMesaAberto } from "../hooks/usePedidoMesaAberto";
import { usePedidoCriar } from "../hooks/usePedidoCriar";
import { usePedidoAdicionarItens } from "../hooks/usePedidoAdicionarItens";
import { usePedidoFinalizar } from "../hooks/usePedidoFinalizar";
import ModalPagamento from "../componentes/ModalPagamento";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

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

    {/* 🚨 Extrai o número da mesa direto do user logado em tempo de execução */}
    const numeroMesa = user && user.username
        ? Number(user.username.replace(/\D/g, ""))
        : 0;

    // Estados do Carrinho Local e Modais
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
    const [produtoDetalheId, setProdutoDetalheId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // Hooks de dados com monitoramento de erro para o cardápio
    const { data: produtos, isLoading: loadingProdutos, isError: erroProdutos } = useProdutosAtivos();
    const { data: pedidoAtivo, isLoading: loadingPedido } = usePedidoMesaAberto(numeroMesa);

    // Hooks de mutação
    const { mutate: criarNovoPedido, isPending: criando } = usePedidoCriar();
    const { mutate: adicionarItensAoPedido, isPending: adicionando } = usePedidoAdicionarItens();
    const { mutate: finalizarPedido } = usePedidoFinalizar();

    // --- FUNÇÕES DE MANIPULAÇÃO DO CARRINHO LOCAL ---
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

            if (!item) {
                return carrinhoAtual;
            }

            if (item.quantidade === 1) {
                return carrinhoAtual.filter(i => i.produto.id !== produtoId);
            }

            return carrinhoAtual.map(i =>
                i.produto.id === produtoId
                    ? { ...i, quantidade: i.quantidade - 1 }
                    : i
            );
        });
    };

    const limparCarrinho = () => setCarrinho([]);

    // --- ENVIO DO PEDIDO ---
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

    // Filtro redundante de segurança, embora a rota /ativos já entregue filtrado
    const produtosCardapio = produtos?.filter(p => p.ativo) || [];

    const totalCarrinho = carrinho.reduce((acc, item) => {
        return acc + (item.produto.precoBase * item.quantidade);
    }, 0);

    // 1. Renderização condicional de carregamento
    if (numeroMesa === 0 || loadingProdutos || loadingPedido) {
        return <p style={{ padding: "20px", fontFamily: "sans-serif" }}>⏳ Inicializando Tablet da Mesa...</p>;
    }

    // 2. Renderização preventiva caso ocorra falha de segurança (Erro 403)
    if (erroProdutos) {
        return (
            <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center" }}>
                <h2 style={{ color: "#d32f2f" }}>❌ Não foi possível carregar o cardápio</h2>
                <p style={{ color: "#555", maxWidth: "600px", margin: "20px auto" }}>
                    O tablet não conseguiu buscar a lista de pizzas. Verifique se o endpoint <code>/produtos/ativos</code> está liberado para o perfil MESA no Back-end.
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: "20px", display: "flex", gap: "20px", fontFamily: "sans-serif" }}>

            {/* COLUNA DA ESQUERDA: CARDÁPIO */}
            <div style={{ flex: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2>🍕 Cardápio Digital - Pizzaria Mauá</h2>
                    <div>
                        <span style={{ backgroundColor: "#222", color: "#fff", padding: "8px 12px", borderRadius: "20px", fontWeight: "bold" }}>
                            📍 ATENDIMENTO: MESA {numeroMesa}
                        </span>
                    </div>
                </div>

                <div style={{ padding: "10px", backgroundColor: pedidoAtivo ? "#e8f5e9" : "#fff3e0", borderRadius: "5px", marginBottom: "20px" }}>
                    {pedidoAtivo ? (
                        <p style={{ margin: 0, color: "#2e7d32" }}>
                            🟢 <strong>Comanda Ativa Nº {pedidoAtivo.id} detectada para a Mesa {numeroMesa}.</strong> Tudo o que você pedir agora entrará como acréscimo na conta atual!
                        </p>
                    ) : (
                        <p style={{ margin: 0, color: "#e65100" }}>
                            ⚪ <strong>Nenhum pedido em andamento para a Mesa {numeroMesa}.</strong> Seu próximo envio abrirá uma nova comanda.
                        </p>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
                    {produtosCardapio.map((produto) => (
                        <div key={produto.id} style={{ border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden", padding: "10px", backgroundColor: "#fff" }}>
                            <img src={produto.imagemUrl} alt={produto.nome} style={{ width: "100%", height: "130px", objectFit: "cover", borderRadius: "4px" }} />
                            <h3 style={{ margin: "10px 0 5px 0", fontSize: "1.1em" }}>{produto.nome}</h3>
                            <p style={{ color: "#e53935", fontWeight: "bold", margin: "0 0 10px 0" }}>R$ {produto.precoBase.toFixed(2)}</p>

                            {produtoDetalheId === produto.id && (
                                <p style={{ fontSize: "0.85em", color: "#666", backgroundColor: "#f9f9f9", padding: "5px", borderRadius: "4px" }}>
                                    {produto.descricao}
                                </p>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
                                <button
                                    onClick={() => setProdutoDetalheId(produtoDetalheId === produto.id ? null : produto.id!)}
                                    style={{ padding: "6px", fontSize: "0.85em", cursor: "pointer" }}
                                >
                                    {produtoDetalheId === produto.id ? "Esconder Detalhes" : "👀 Ver Detalhes"}
                                </button>
                                <button
                                    onClick={() => handleAdicionarAoCarrinho(produto)}
                                    style={{ padding: "8px", backgroundColor: "#ff9800", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                                >
                                    ➕ Adicionar ao Pedido
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUNA DA DIREITA: ITENS DO PEDIDO */}
            <div style={{ flex: 1, borderLeft: "2px dashed #ccc", paddingLeft: "20px", minWidth: "260px" }}>
                <h3>🍽️ Itens do Pedido</h3>
                <p style={{ fontSize: "0.85em", color: "#666" }}>Estes itens ainda não foram para a cozinha.</p>

                {carrinho.length === 0 ? (
                    <p style={{ color: "#999", fontStyle: "italic" }}>Nenhum item selecionado. Escolha pratos do cardápio!</p>
                ) : (
                    <div>
                        <ul style={{ paddingLeft: "0", listStyle: "none" }}>
                            {carrinho.map((item) => (
                                <li key={item.produto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "5px", borderBottom: "1px solid #eee" }}>
                                    <div>
                                        <span style={{ fontWeight: "bold" }}>{item.quantidade}x</span> {item.produto.nome}
                                        <div style={{ fontSize: "0.85em", color: "#888" }}>R$ {(item.produto.precoBase * item.quantidade).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <button onClick={() => handleRemoverOuDiminuir(item.produto.id!)} style={{ padding: "2px 6px", cursor: "pointer" }}>-</button>
                                        <button onClick={() => handleAdicionarAoCarrinho(item.produto)} style={{ padding: "2px 6px", marginLeft: "2px", cursor: "pointer" }}>+</button>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", padding: "10px 0", borderTop: "2px solid #ddd", marginTop: "15px", color: "#333" }}>
                            <span>Total Atual do Pedido:</span>
                            <span>R$ {totalCarrinho.toFixed(2)}</span>
                        </div>

                        <button
                            onClick={handleEnviarParaCozinha}
                            disabled={criando || adicionando}
                            style={{
                                width: "100%",
                                padding: "12px",
                                backgroundColor: "#e53935",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                marginTop: "10px"
                            }}
                        >
                            {criando || adicionando ? "Enviando..." : "🔥 Enviar Pedido à Cozinha"}
                        </button>
                    </div>
                )}

                {/* Histórico Consumido */}
                {pedidoAtivo && possuiItensConsumidos && (
                    <div style={{ marginTop: "40px", padding: "10px", border: "1px solid #a5d6a7", borderRadius: "5px", backgroundColor: "#f1f8e9" }}>
                        <h4>🧾 Já Consumido nesta Mesa:</h4>
                        <ul style={{ paddingLeft: "15px", fontSize: "0.9em" }}>
                            {itensConsumidos.map((item) => (
                                <li key={item.id} style={{ marginBottom: "5px" }}>
                                    {item.quantidade}x {item.produtoNome}
                                    <span style={{
                                        marginLeft: "8px",
                                        fontSize: "0.8em",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                        fontWeight: "bold",
                                        backgroundColor: item.status === "PRONTO" ? "#c8e6c9" : "#ffe0b2",
                                        color: item.status === "PRONTO" ? "#2e7d32" : "#e65100"
                                    }}>
                                        {item.status === "PRONTO" ? "Entregue para você!" : "Em preparação..."}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div style={{ borderTop: "1px solid #a5d6a7", paddingTop: "5px", fontWeight: "bold", textAlign: "right", marginBottom: "15px" }}>
                            Total Consumido: R$ {itensConsumidos.reduce((acc, i) => acc + (i.precoUnitario * i.quantidade), 0).toFixed(2)}
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            disabled={!todosItensProntos}
                            style={{
                                width: "100%",
                                padding: "12px",
                                fontSize: "1em",
                                fontWeight: "bold",
                                border: "none",
                                borderRadius: "4px",
                                cursor: todosItensProntos ? "pointer" : "not-allowed",
                                backgroundColor: todosItensProntos ? "#2e7d32" : "#b0bec5",
                                color: "#fff",
                                transition: "background-color 0.3s"
                            }}
                        >
                            {todosItensProntos ? "💳 Pagar Conta" : "⏳ Itens em preparo na cozinha..."}
                        </button>
                    </div>
                )}
            </div>

            <ModalPagamento isOpen={isModalOpen} onClose={handleFechamentoModal} />
        </div>
    );
}