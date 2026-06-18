import { useState } from "react";
import { usePedidosCozinha } from "../hooks/usePedidosCozinha";
import { usePedidoItemStatus } from "../hooks/usePedidoItemStatus";

interface ItemPedidoCozinha {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
}

interface PedidoCozinhaDados {
    id: number;
    numeroMesa: number;
    dataHora: string;
    formaPagamento: string;
    itens: ItemPedidoCozinha[];
}

export default function PedidosCozinha() {
    const { data, isLoading, isError } = usePedidosCozinha();
    const { mutate: atualizarStatus } = usePedidoItemStatus();

    // Estado local para controlar a animação/sumiço imediato do item
    const [itensDespachados, setItensDespachados] = useState<number[]>([]);

    const pedidos = (data as unknown as PedidoCozinhaDados[]) || [];

    const handleMarcarComoEntregue = (itemId: number) => {
        // 1. Adiciona o ID ao estado local para acionar o efeito "verdinho" instantâneo
        setItensDespachados((prev) => [...prev, itemId]);

        // 2. Dispara a requisição para o back-end Java em segundo plano
        atualizarStatus({ itemId, status: "PRONTO" });
    };

    const formatarHora = (dataString: string) => {
        try {
            const dataObjeto = new Date(dataString);
            return dataObjeto.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return "--:--";
        }
    };

    if (isLoading) return <p>⏳ Carregando monitor da cozinha...</p>;
    if (isError) return <p>❌ Erro ao conectar com o monitor de pedidos da cozinha.</p>;

    return (
        <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
            <h2>👨‍🍳 Monitor de Pedidos Ativos (Cozinha)</h2>
            <p>Clique em <strong>✓ Entregue</strong> assim que o prato sair para a mesa. O item sumirá automaticamente.</p>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "20px" }}>
                {pedidos.length > 0 ? (
                    pedidos.map((pedido) => {
                        // Filtra os itens: remove o que o back-end já consolidou como PRONTO
                        // E remove também o que acabou de ser clicado localmente (após o delay)
                        const itensAtivos = (pedido.itens || []).filter(
                            (item) => item.status !== "PRONTO" && !itensDespachados.includes(item.id)
                        );

                        // Se todos os itens do card sumiram, não precisamos mostrar o card vazio da mesa
                        if (itensAtivos.length === 0) return null;

                        return (
                            <div
                                key={pedido.id}
                                style={{
                                    border: "2px solid #333",
                                    borderRadius: "8px",
                                    width: "320px",
                                    padding: "15px",
                                    backgroundColor: "#fffde6",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    transition: "all 0.3s ease"
                                }}
                            >
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #333", paddingBottom: "10px" }}>
                                        <h3 style={{ margin: 0 }}>MESA {pedido.numeroMesa}</h3>
                                        <span style={{ fontSize: "0.9em", color: "#555" }}>⏱️ {formatarHora(pedido.dataHora)}</span>
                                    </div>

                                    <ul style={{ paddingLeft: "0", listStyle: "none", marginTop: "15px" }}>
                                        {itensAtivos.map((item) => {
                                            const foiClicado = itensDespachados.includes(item.id);

                                            return (
                                                <li
                                                    key={item.id}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        marginBottom: "12px",
                                                        fontSize: "1.05em",
                                                        borderBottom: "1px solid rgba(0,0,0,0.05)",
                                                        paddingBottom: "6px",
                                                        paddingLeft: foiClicado ? "8px" : "0",
                                                        paddingRight: foiClicado ? "8px" : "0",
                                                        borderRadius: "4px",
                                                        // EFEITO VISUAL: Se foi clicado, fica verde instantaneamente
                                                        backgroundColor: foiClicado ? "#c8e6c9" : "transparent",
                                                        color: foiClicado ? "#1b5e20" : "#000",
                                                        transition: "all 0.2s ease"
                                                    }}
                                                >
                                                    <div style={{ flex: 1, paddingRight: "10px" }}>
                                                        <strong>{item.quantidade}x</strong> {item.produtoNome}
                                                    </div>

                                                    <button
                                                        onClick={() => handleMarcarComoEntregue(item.id)}
                                                        disabled={foiClicado}
                                                        style={{
                                                            padding: "6px 10px",
                                                            backgroundColor: foiClicado ? "#81c784" : "#2e7d32",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "4px",
                                                            fontSize: "0.85em",
                                                            fontWeight: "bold",
                                                            cursor: "pointer",
                                                            transition: "background-color 0.2s"
                                                        }}
                                                    >
                                                        {foiClicado ? "✓" : "✓ Entregue"}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                <div style={{ borderTop: "1px dashed #333", paddingTop: "8px", marginTop: "10px", fontSize: "0.8em", color: "#666", textAlign: "center" }}>
                                    Comanda ID: #{pedido.id}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p style={{ color: "#666" }}>Pouco movimento por aqui. Nenhum pedido em preparo no momento! 🍕</p>
                )}
            </div>
        </div>
    );
}