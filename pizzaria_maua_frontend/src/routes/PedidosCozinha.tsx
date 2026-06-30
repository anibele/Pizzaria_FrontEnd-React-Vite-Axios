import { useState, useEffect, useRef } from "react";
import { usePedidosCozinha } from "../hooks/usePedidosCozinha";
import { usePedidoItemStatus } from "../hooks/usePedidoItemStatus";
import { useNotification } from "../contexts/NotificationContext";
import NavbarCozinha from "../componentes/NavbarCozinha";
import CardPedidoCozinha from "../componentes/CardPedidoCozinha";
import { Loader2, AlertCircle, CheckCircle2, BrickWallFire, Zap } from "lucide-react";
import { calcularPrioridadeKds } from "../services/kdsCalculadora";
import "../styles/pedidosCozinha.css";

interface ItemPedidoCozinha {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
    dataHoraInclusao: string;
    tempoPreparoMinutos: number;
}

interface PedidoCozinhaDados {
    id: number;
    numeroMesa: number;
    dataHora: string;
    status: "ABERTO" | "AGUARDANDO_PAGAMENTO" | "FINALIZADO";
    formaPagamento: string;
    itens: ItemPedidoCozinha[];
}

const LIMITE_MINUTOS_RAPIDO = 15;

export default function PedidosCozinha() {
    const { data, isLoading, isError } = usePedidosCozinha();
    const { mutate: atualizarStatus } = usePedidoItemStatus();
    const { adicionarNotificacao } = useNotification();

    const [itensDespachados, setItensDespachados] = useState<number[]>([]);
    const [, setTickTempo] = useState(0);

    const prevPedidosRef = useRef<PedidoCozinhaDados[]>([]);
    const isFirstLoadRef = useRef(true);

    const pedidosOriginais = (data as unknown as PedidoCozinhaDados[]) || [];

    useEffect(() => {
        const interval = setInterval(() => {
            setTickTempo((t) => t + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isLoading || isError || !data) return;
        const novosPedidos = data as unknown as PedidoCozinhaDados[];

        if (isFirstLoadRef.current) {
            prevPedidosRef.current = novosPedidos;
            isFirstLoadRef.current = false;
            return;
        }

        novosPedidos.forEach((newPedido) => {
            const oldPedido = prevPedidosRef.current.find((p) => p.id === newPedido.id);

            if (!oldPedido) {
                adicionarNotificacao("NOVO_PEDIDO", newPedido.numeroMesa);
            } else {
                if (newPedido.itens.length > oldPedido.itens.length) {
                    adicionarNotificacao("ITENS_ADICIONADOS", newPedido.numeroMesa);
                }
                if (newPedido.status === "AGUARDANDO_PAGAMENTO" && oldPedido.status !== "AGUARDANDO_PAGAMENTO") {
                    adicionarNotificacao("PAGAMENTO", newPedido.numeroMesa, newPedido.formaPagamento);
                }
            }
        });

        prevPedidosRef.current = novosPedidos;
    }, [data, isLoading, isError, adicionarNotificacao]);

    const handleMarcarComoEntregue = (itemId: number) => {
        setItensDespachados((prev) => [...prev, itemId]);
        atualizarStatus({ itemId, status: "PRONTO" });
    };

    // MOTOR DE ROTEAMENTO E ORDENAÇÃO
    const processarPedidos = (tipoDaColuna: 'RAPIDO' | 'LENTO') => {
        return pedidosOriginais
            .map(pedido => {
                // 1. Filtra apenas os itens que pertencem a esta coluna e não estão prontos
                const itensFiltrados = pedido.itens.filter(item => {
                    const isAtivo = item.status !== "PRONTO" && !itensDespachados.includes(item.id);
                    const isRapido = item.tempoPreparoMinutos <= LIMITE_MINUTOS_RAPIDO;
                    return isAtivo && (tipoDaColuna === 'RAPIDO' ? isRapido : !isRapido);
                });
                return { ...pedido, itens: itensFiltrados };
            })
            // 2. Remove da lista as comandas que ficaram sem itens para esta coluna
            .filter(pedido => pedido.itens.length > 0)
            // 3. Ordena a fila da coluna
            .sort((a, b) => {
                let temAtrasadoA = false;
                let menorTempoA = Infinity;
                a.itens.forEach(i => {
                    const calc = calcularPrioridadeKds(i.dataHoraInclusao, i.tempoPreparoMinutos);
                    if (calc.status === 'ATRASADO') temAtrasadoA = true;
                    if (calc.minutosRestantes < menorTempoA) menorTempoA = calc.minutosRestantes;
                });

                let temAtrasadoB = false;
                let menorTempoB = Infinity;
                b.itens.forEach(i => {
                    const calc = calcularPrioridadeKds(i.dataHoraInclusao, i.tempoPreparoMinutos);
                    if (calc.status === 'ATRASADO') temAtrasadoB = true;
                    if (calc.minutosRestantes < menorTempoB) menorTempoB = calc.minutosRestantes;
                });

                // Regra 1: Pedidos com itens atrasados sobem para o topo
                if (temAtrasadoA && !temAtrasadoB) return -1;
                if (!temAtrasadoA && temAtrasadoB) return 1;

                // Regra 2: Ordena pelo menor tempo restante dentro do card
                if (menorTempoA !== menorTempoB) return menorTempoA - menorTempoB;

                // Regra 3 (Desempate): Ordem de chegada do pedido
                return new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
            });
    };

    const pedidosRapidos = processarPedidos('RAPIDO');
    const pedidosLentos = processarPedidos('LENTO');

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
                <p>Não foi possível conectar com o servidor.</p>
            </div>
        );
    }

    return (
        <div className="cozinha-dashboard-bg">
            <NavbarCozinha />

            <main className="cozinha-main-content split-layout">
                {/* COLUNA ESQUERDA: ITENS RÁPIDOS */}
                <section className="kds-coluna kds-rapidos">
                    <div className="kds-coluna-header">
                        <h3>
                            <Zap size={25} color="#FFFF00" />
                            Preparo Rápido (Até {LIMITE_MINUTOS_RAPIDO}m)</h3>
                    </div>
                    {pedidosRapidos.length === 0 ? (
                        <div className="cozinha-vazia-coluna">
                            <CheckCircle2 size={40} color="#2e7d32" />
                            <p>Sem pedidos no momento.</p>
                        </div>
                    ) : (
                        <div className="cozinha-grid-pedidos-coluna">
                            {pedidosRapidos.map((pedido) => (
                                <CardPedidoCozinha
                                    key={`rapido-${pedido.id}`}
                                    pedido={pedido}
                                    itensDespachados={itensDespachados}
                                    onMarcarComoEntregue={handleMarcarComoEntregue}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* DIVISÓRIA CENTRAL */}
                <div className="kds-divisor"></div>

                {/* COLUNA DIREITA: ITENS LENTOS */}
                <section className="kds-coluna kds-lentos">
                    <div className="kds-coluna-header">
                        <h3 className="kds-header-titulo">
                            <BrickWallFire size={25} color="#f4a84d" />
                            <span>Forno / Preparo Lento (+{LIMITE_MINUTOS_RAPIDO}m)</span>
                        </h3>
                    </div>
                    {pedidosLentos.length === 0 ? (
                        <div className="cozinha-vazia-coluna">
                            <CheckCircle2 size={40} color="#2e7d32" />
                            <p>Sem pedidos no momento.</p>
                        </div>
                    ) : (
                        <div className="cozinha-grid-pedidos-coluna">
                            {pedidosLentos.map((pedido) => (
                                <CardPedidoCozinha
                                    key={`lento-${pedido.id}`}
                                    pedido={pedido}
                                    itensDespachados={itensDespachados}
                                    onMarcarComoEntregue={handleMarcarComoEntregue}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}