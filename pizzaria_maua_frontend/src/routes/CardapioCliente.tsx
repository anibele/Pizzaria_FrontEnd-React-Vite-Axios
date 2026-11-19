import { useState, useContext, useEffect, useRef } from "react";
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
import type { MesaDados } from "../interfaces/MesaDados";
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { OnboardingProvider } from "../contexts/OnboardingContext";
import { useOnboarding } from "../hooks/useOnboarding";
import { WelcomeModal } from "../componentes/onboarding/WelcomeModal";
import { TutorialOverlay } from "../componentes/onboarding/TutorialOverlay";
import TelaInicio from "../pages/TelaInicio";
import {
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
    const [isStandBy, setIsStandBy] = useState<boolean>(false);
    const [clienteIniciouSessao, setClienteIniciouSessao] = useState<boolean>(false);

    const { user } = useContext(AuthContext);

    const numeroMesa = user && user.username
        ? Number(user.username.replace(/\D/g, ""))
        : 0;

    const { data: mesaStatusData } = useMonitorarStatusMesa(numeroMesa > 0 ? numeroMesa : undefined);

    useEffect(() => {
        if (mesaStatusData?.status === "LIVRE") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsStandBy(false);
            setClienteIniciouSessao(false);
        }
    }, [mesaStatusData?.status]);

    const determinarStatusOnboarding = () => {
        if (isStandBy) return "STANDBY";

        // Se a mesa tá LIVRE no banco, mas o cliente acabou de tocar na tela,
        // fingimos que está "OCUPADA" para o Contexto disparar o Tutorial
        if (mesaStatusData?.status === "LIVRE" && clienteIniciouSessao) {
            return "OCUPADA";
        }

        return mesaStatusData?.status || "OCUPADA";
    };

    return (
        <OnboardingProvider statusMesa={determinarStatusOnboarding()}>
            <CardapioConteudo
                key={`${user?.username}:${numeroMesa}`}
                isStandBy={isStandBy}
                setIsStandBy={setIsStandBy}
                clienteIniciouSessao={clienteIniciouSessao}
                setClienteIniciouSessao={setClienteIniciouSessao}
                mesaStatusData={mesaStatusData}
                numeroMesa={numeroMesa}
            />
        </OnboardingProvider>
    );
}

interface CardapioConteudoProps {
    isStandBy: boolean;
    setIsStandBy: (v: boolean) => void;
    clienteIniciouSessao: boolean;
    setClienteIniciouSessao: (v: boolean) => void;
    mesaStatusData: MesaDados | undefined;
    numeroMesa: number;
}

function CardapioConteudo({
                              isStandBy, setIsStandBy,
                              clienteIniciouSessao, setClienteIniciouSessao,
                              mesaStatusData, numeroMesa
                          }: CardapioConteudoProps) {
    const { status } = useOnboarding();

    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
        try {
            const carrinhoSalvo = localStorage.getItem(`carrinho_mesa_${numeroMesa}`);
            return carrinhoSalvo ? JSON.parse(carrinhoSalvo) : [];
        } catch {
            return [];
        }
    });

    const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDados | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isModalAvisoOpen, setIsModalAvisoOpen] = useState<boolean>(false);

    const { data: produtos, isLoading: loadingProdutos, isError: erroProdutos } = useProdutosAtivos();
    const { data: pedidoAtivo, isLoading: loadingPedido, refetch: refetchPedido } = usePedidoMesaAberto(numeroMesa);
    const abertura = usePedidoCriar(numeroMesa);
    const criando = abertura.processando;
    const { bloqueiaCarrinho: bloqueiaAbertura, protegida: aberturaProtegida } = abertura;
    const adicao = usePedidoAdicionarItens(numeroMesa);
    const adicionando = adicao.enviando;
    const existePendencia = !!adicao.pendente || adicao.bloqueada || abertura.protegida;
    const envioEmCurso = useRef(false);
    const pagamento = usePedidoFinalizar(numeroMesa);
    const reiniciarPagamento = pagamento.reiniciar;

    useEffect(() => {
        if (numeroMesa > 0) {
            const carrinhoFiltrado = carrinho.filter(item => item.produto.id !== 9999);
            localStorage.setItem(`carrinho_mesa_${numeroMesa}`, JSON.stringify(carrinhoFiltrado));
        }
    }, [carrinho, numeroMesa]);

    useEffect(() => {
        if (bloqueiaAbertura()) return;
        if (status === "TUTORIAL" && produtos && produtos.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCarrinho(carrinhoAtual => {
                if (carrinhoAtual.some(item => item.produto.id === 9999)) return carrinhoAtual;
                const produtoBase = produtos.find(p => p.ativo) || produtos[0];
                const produtoDemonstracao: ProdutoDados = { ...produtoBase, id: 9999 };
                return [...carrinhoAtual, { produto: produtoDemonstracao, quantidade: 1 }];
            });
        } else {
            setCarrinho(carrinhoAtual => {
                if (carrinhoAtual.some(item => item.produto.id === 9999)) {
                    return carrinhoAtual.filter(item => item.produto.id !== 9999);
                }
                return carrinhoAtual;
            });
        }
    }, [status, produtos, aberturaProtegida, bloqueiaAbertura]);

    useEffect(() => {
        if (isStandBy || (mesaStatusData?.status === "LIVRE" && !clienteIniciouSessao)) return;
        let inactivityTimer: ReturnType<typeof setTimeout>;

        const resetarCronometro = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                setIsStandBy(true);
            }, 3 * 60 * 1000);
        };

        const eventosInteracao = ["mousemove", "mousedown", "touchstart", "click", "scroll"];
        resetarCronometro();
        eventosInteracao.forEach(evento => window.addEventListener(evento, resetarCronometro));

        return () => {
            clearTimeout(inactivityTimer);
            eventosInteracao.forEach(evento => window.removeEventListener(evento, resetarCronometro));
        };
    }, [isStandBy, setIsStandBy, mesaStatusData?.status, clienteIniciouSessao]);

    useEffect(() => {
        if (mesaStatusData?.status === "LIVRE" && !clienteIniciouSessao && !existePendencia && !bloqueiaAbertura()) {
            setClienteIniciouSessao(false);
            setIsStandBy(false);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsModalOpen(false);
            setIsModalAvisoOpen(false);
            reiniciarPagamento();
            setProdutoSelecionado(null);
            setCarrinho([]);
        }
    }, [mesaStatusData?.status, clienteIniciouSessao, setClienteIniciouSessao, setIsStandBy, existePendencia, reiniciarPagamento, bloqueiaAbertura]);

    const handleAdicionarAoCarrinho = (produto: ProdutoDados) => {
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
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
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
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

    const handleEnviarParaCozinha = async () => {
        if (bloqueiaAbertura() || envioEmCurso.current || adicao.bloqueada || numeroMesa === 0) return;
        if (!adicao.pendente && carrinho.length === 0) return;
        envioEmCurso.current = true;
        try {
            if (adicao.pendente || pedidoAtivo) {
                const itensPayload = carrinho.map(item => ({ produtoId: item.produto.id!, quantidade: item.quantidade }));
                // O gestor ignora estes dados em retries e usa exclusivamente o snapshot salvo.
                await adicao.enviar(adicao.pendente?.pedidoId ?? pedidoAtivo!.id, itensPayload, operacao => {
                    localStorage.removeItem(`carrinho_mesa_${operacao.contexto.numeroMesa}`);
                    limparCarrinho();
                });
            } else {
                await abertura.enviar(carrinho.map(item => ({ produtoId: item.produto.id!, quantidade: item.quantidade })), () => {
                    localStorage.removeItem(`carrinho_mesa_${numeroMesa}`);
                    limparCarrinho();
                });
            }
        } finally { envioEmCurso.current = false; }
    };

    const itensConsumidos = (pedidoAtivo?.itens as unknown as ItemPedidoResponse[]) || [];
    const possuiItensConsumidos = itensConsumidos.length > 0;
    const todosItensProntos = possuiItensConsumidos && itensConsumidos.every(item => item.status === "PRONTO");

    const handleSolicitarPagamento = () => {
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        if (carrinho.length > 0) {
            setIsModalAvisoOpen(true);
        } else {
            reiniciarPagamento();
            setIsModalOpen(true);
        }
    };

    const handleDescartarEPagar = () => {
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        limparCarrinho();
        setIsModalAvisoOpen(false);
        reiniciarPagamento();
        setIsModalOpen(true);
    };

    const handleEnviarSolicitacaoPagamento = async (formaPagamentoSelecionada: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        await pagamento.solicitar(pedidoAtivo?.id, formaPagamentoSelecionada);
    };

    const handleFechamentoModal = () => {
        setIsModalOpen(false);
        reiniciarPagamento();
    };

    const produtosCardapio = produtos?.filter(p => p.ativo) || [];

    if (!existePendencia && (mesaStatusData?.status === "MANUTENCAO" || mesaStatusData?.ativo === false)) {
        return <ManutencaoMesa />;
    }

    if (!existePendencia && mesaStatusData?.status === "RESERVADA") {
        return <MesaReservada />;
    }

    if (!existePendencia && mesaStatusData?.status === "LIVRE" && !clienteIniciouSessao) {
        return (
            <TelaInicio onIniciar={() => {
                setClienteIniciouSessao(true);
                refetchPedido();
            }} />
        );
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
                <p>O tablet falhou ao tentar buscar os produtos ativos.</p>
            </div>
        );
    }

    return (
        <>
            <WelcomeModal />
            <TutorialOverlay />

            <div className="cardapio-container">
                <div className="coluna-cardapio">
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
                        adicaoPendente={existePendencia}
                        mensagemAdicao={abertura.protegida ? abertura.mensagem : adicao.mensagem}
                        reenvioPermitido={!abertura.protegida && !!adicao.pendente && !adicao.bloqueada}
                        podeRevisarAdicao={abertura.protegida ? abertura.podeRevisar : adicao.podeRevisar}
                        onRevisarAdicao={abertura.protegida ? () => {
                            setClienteIniciouSessao(true);
                            abertura.revisarRejeitada();
                        } : adicao.revisarRejeitada}
                        onVerificarAbertura={abertura.protegida && abertura.pendente ? abertura.verificar : undefined}
                        pedidoAtivo={pedidoAtivo}
                        itensConsumidos={itensConsumidos}
                        possuiItensConsumidos={possuiItensConsumidos}
                        todosItensProntos={todosItensProntos}
                        onAbrirPagamento={handleSolicitarPagamento}
                    />
                </div>

                <ModalPagamento
                    isOpen={isModalOpen}
                    estado={pagamento}
                    onClose={handleFechamentoModal}
                    onSolicitarPagamento={handleEnviarSolicitacaoPagamento}
                    onVerificarPedido={pagamento.verificar}
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
        </>
    );
}
