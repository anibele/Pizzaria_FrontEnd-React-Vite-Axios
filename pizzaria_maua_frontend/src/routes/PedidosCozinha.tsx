import { useState, useEffect, useRef } from "react";
import { usePedidosCozinha } from "../hooks/usePedidosCozinha";
import { usePedidoItemStatus } from "../hooks/usePedidoItemStatus";
import { useNotification } from "../contexts/NotificationContext";
import NavbarCozinha from "../componentes/NavbarCozinha";
import CardPedidoCozinha from "../componentes/CardPedidoCozinha";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import "../styles/pedidosCozinha.css";

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
    status: "ABERTO" | "AGUARDANDO_PAGAMENTO" | "FINALIZADO"; // 👈 Alinhado com o Back-end
    formaPagamento: string;
    itens: ItemPedidoCozinha[];
}

export default function PedidosCozinha() {
    const { data, isLoading, isError } = usePedidosCozinha();
    const { mutate: atualizarStatus } = usePedidoItemStatus();
    const { adicionarNotificacao } = useNotification(); // 👈 Destruturado aqui

    const [itensDespachados, setItensDespachados] = useState<number[]>([]);

    // Guardas de estado para o algoritmo de comparação (Diffing)
    const prevPedidosRef = useRef<PedidoCozinhaDados[]>([]);
    const isFirstLoadRef = useRef(true);

    const pedidos = (data as unknown as PedidoCozinhaDados[]) || [];

    // 🔥 Algoritmo de Diffing: Compara a lista antiga com a nova a cada Polling
    useEffect(() => {
        if (isLoading || isError || !data) return;

        const novosPedidos = data as unknown as PedidoCozinhaDados[];

        // Se for a primeiríssima carga, apenas salvamos o estado atual e pulamos os alertas
        if (isFirstLoadRef.current) {
            prevPedidosRef.current = novosPedidos;
            isFirstLoadRef.current = false;
            return;
        }

        // Varre a nova lista comparando com o histórico em memória
        novosPedidos.forEach((newPedido) => {
            const oldPedido = prevPedidosRef.current.find((p) => p.id === newPedido.id);

            if (!oldPedido) {
                // GATILHO 1: O ID do pedido não existia na lista anterior -> Novo Pedido!
                adicionarNotificacao("NOVO_PEDIDO", newPedido.numeroMesa);
            } else {
                // GATILHO 2: Verificando se novos itens foram adicionados à mesma mesa
                if (newPedido.itens.length > oldPedido.itens.length) {
                    adicionarNotificacao("ITENS_ADICIONADOS", newPedido.numeroMesa);
                }

                // GATILHO 3: Verificando se o cliente solicitou a conta pelo tablet
                if (
                    newPedido.status === "AGUARDANDO_PAGAMENTO" &&
                    oldPedido.status !== "AGUARDANDO_PAGAMENTO"
                ) {
                    adicionarNotificacao("PAGAMENTO", newPedido.numeroMesa, newPedido.formaPagamento);
                }
            }
        });

        // Atualiza a referência em memória para a próxima verificação daqui a 5 segundos
        prevPedidosRef.current = novosPedidos;
    }, [data, isLoading, isError, adicionarNotificacao]);

    const handleMarcarComoEntregue = (itemId: number) => {
        setItensDespachados((prev) => [...prev, itemId]);
        atualizarStatus({ itemId, status: "PRONTO" });
    };

    if (isLoading) {
        return (
            <div className="cozinha-tela-mensagem">
                <Loader2 className="animate-spin" size={64} color="#e53935" />
                <h2>Carregando sistema da cozinha...</h2>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="cozinha-tela-mensagem erro">
                <AlertCircle size={64} color="#d32f2f" />
                <h2>Erro de conexão</h2>
                <p>Não foi possível conectar com o servidor. Verifique a rede.</p>
            </div>
        );
    }

    // Filtra se sobrou algum pedido pendente/em preparo para exibir na tela
    const existemPedidosAtivos = pedidos.some(pedido =>
        pedido.itens.some(item => item.status !== "PRONTO" && !itensDespachados.includes(item.id))
    );

    return (
        <div className="cozinha-dashboard-bg">
            <NavbarCozinha />

            <main className="cozinha-main-content">
                {!existemPedidosAtivos ? (
                    <div className="cozinha-vazia">
                        <CheckCircle2 size={80} color="#2e7d32" />
                        <h2>Tudo limpo por aqui!</h2>
                        <p>Nenhum pedido aguardando preparo no momento. Bom trabalho!</p>
                    </div>
                ) : (
                    <div className="cozinha-grid-pedidos">
                        {pedidos.map((pedido) => (
                            <CardPedidoCozinha
                                key={pedido.id}
                                pedido={pedido}
                                itensDespachados={itensDespachados}
                                onMarcarComoEntregue={handleMarcarComoEntregue}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}