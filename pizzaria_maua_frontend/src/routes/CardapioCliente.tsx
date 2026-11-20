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
import { CarrinhoDaIdentidade, type ItemCarrinho } from '../services/carrinhoPersistido';
import { contextoAtualAdicao } from '../services/sessaoAdicao';
import { controleHttpSessao } from '../services/httpSessao';
import { adicionarUnidade, motivoNovosItens, motivoSelecao, podeSolicitarPagamento, produtoDisponivel } from '../services/regrasCardapio';
import { OnboardingProvider } from "../contexts/OnboardingContext";
import { useOnboarding } from "../hooks/useOnboarding";
import { WelcomeModal } from "../componentes/onboarding/WelcomeModal";
import { TutorialOverlay } from "../componentes/onboarding/TutorialOverlay";
import TelaInicio from "../pages/TelaInicio";
import {
    AlertCircle,
    Loader2,
    RefreshCw
} from "lucide-react";
import "../styles/cardapio.css";

export default function CardapioCliente() {
    const { user, loading, versaoSessao } = useContext(AuthContext);
    if (loading || user?.role !== 'MESA' || !Number.isSafeInteger(user.numeroMesa) || user.numeroMesa! <= 0) return <div>Carregando...</div>;
    return <CardapioAutenticado key={`${versaoSessao}:${user.username}:${user.numeroMesa}`} numeroMesa={user.numeroMesa!} />;
}

function CardapioAutenticado({ numeroMesa }: { numeroMesa: number }) {
    const [isStandBy, setIsStandBy] = useState<boolean>(false);
    const [clienteIniciouSessao, setClienteIniciouSessao] = useState<boolean>(false);

    const { user } = useContext(AuthContext);

    const { data: mesaStatusData, isError: erroMesa, isLoading: carregandoMesa, refetch: atualizarMesa } = useMonitorarStatusMesa(numeroMesa > 0 ? numeroMesa : undefined);

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

    if (erroMesa) return <div className="error-card" role="alert">
        <p>Não foi possível atualizar a situação da mesa. Nenhuma operação será enviada até uma nova consulta.</p>
        <button onClick={() => void atualizarMesa()}>Tentar novamente</button>
    </div>;
    if (carregandoMesa) return <div className="center-message">Carregando mesa...</div>;

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

    const { user, versaoSessao } = useContext(AuthContext);
    const [persistencia] = useState(() => {
        const contexto = contextoAtualAdicao(numeroMesa);
        return new CarrinhoDaIdentidade({ getItem: chave => localStorage.getItem(chave),
            setItem: (chave, valor) => localStorage.setItem(chave, valor) }, { username: user!.username, numeroMesa },
            () => controleHttpSessao.geracao === versaoSessao && contexto !== null
                && JSON.stringify(contextoAtualAdicao(numeroMesa)) === JSON.stringify(contexto));
    });
    const recuperado = persistencia.inicial;
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(recuperado.itens);
    const [erroCarrinho, setErroCarrinho] = useState(recuperado.erro);

    const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDados | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isModalAvisoOpen, setIsModalAvisoOpen] = useState<boolean>(false);

    const { data: produtos, isLoading: loadingProdutos, isFetching: atualizandoProdutos, isError: erroProdutos, refetch: atualizarProdutos } = useProdutosAtivos();
    const { data: pedidoAtivo, isLoading: loadingPedido, isFetching: atualizandoPedido, isError: erroPedido, refetch: refetchPedido } = usePedidoMesaAberto(numeroMesa);
    const leituraEmCurso = useRef(false);
    const abertura = usePedidoCriar(numeroMesa);
    const criando = abertura.processando;
    const { bloqueiaCarrinho: bloqueiaAbertura, protegida: aberturaProtegida } = abertura;
    const adicao = usePedidoAdicionarItens(numeroMesa);
    const adicionando = adicao.enviando;
    const existePendencia = !!adicao.pendente || adicao.bloqueada || abertura.protegida;
    const envioEmCurso = useRef(false);
    const pagamento = usePedidoFinalizar(numeroMesa);
    const reiniciarPagamento = pagamento.reiniciar;
    const bloqueioEstado = motivoNovosItens(mesaStatusData, pedidoAtivo);
    const bloqueioEstoque = carrinho.length && !existePendencia ? motivoSelecao(carrinho, produtos ?? []) : null;
    const recuperandoLeituras = atualizandoPedido || atualizandoProdutos;
    const conferirAdicaoIncerta = !!adicao.pendente && !adicionando && !adicao.podeRevisar;
    const acaoAtualizacao = (erroPedido || erroProdutos || conferirAdicaoIncerta) && (
        <button type="button" className="btn btn-secondary pedido-atualizar"
            aria-busy={recuperandoLeituras} aria-disabled={recuperandoLeituras}
            onClick={() => {
                if (leituraEmCurso.current || recuperandoLeituras) return;
                leituraEmCurso.current = true;
                void Promise.allSettled([
                    refetchPedido({ cancelRefetch: false }), atualizarProdutos({ cancelRefetch: false }),
                ]).finally(() => { leituraEmCurso.current = false; });
            }}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>Atualizar comanda e cardápio</span>
        </button>
    );
    const podeAdicionar = (produto: ProdutoDados) => !bloqueioEstado && !existePendencia
        && produtoDisponivel(produtos?.find(p => p.id === produto.id), (carrinho.find(i => i.produto.id === produto.id)?.quantidade ?? 0) + 1);

    useEffect(() => {
        if (!erroCarrinho) {
            const carrinhoFiltrado = carrinho.filter(item => item.produto.id !== 9999);
            const erro = persistencia.salvar(carrinhoFiltrado);
            // A falha de uma escrita externa deve bloquear novos envios.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (erro) setErroCarrinho(erro);
        }
    }, [carrinho, persistencia, erroCarrinho]);

    useEffect(() => {
        const conferir = () => { const erro = persistencia.conferir(); if (erro) setErroCarrinho(erro); };
        window.addEventListener('storage', conferir);
        return () => window.removeEventListener('storage', conferir);
    }, [persistencia]);

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

        const eventosInteracao = ["mousemove", "mousedown", "touchstart", "click", "scroll", "keydown"];
        resetarCronometro();
        // Captura teclado antes que diálogos interrompam Escape; os demais eventos mantêm a fase original.
        eventosInteracao.forEach(evento => window.addEventListener(evento, resetarCronometro, evento === 'keydown'));

        return () => {
            clearTimeout(inactivityTimer);
            eventosInteracao.forEach(evento => window.removeEventListener(evento, resetarCronometro, evento === 'keydown'));
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
        }
    }, [mesaStatusData?.status, clienteIniciouSessao, setClienteIniciouSessao, setIsStandBy, existePendencia, reiniciarPagamento, bloqueiaAbertura]);

    const handleAdicionarAoCarrinho = (produto: ProdutoDados) => {
        if (erroCarrinho || bloqueioEstado || bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        const atual = produtos?.find(p => p.id === produto.id);
        setCarrinho(carrinhoAtual => adicionarUnidade(carrinhoAtual, atual));
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

    const limparCarrinho = () => {
        const erro = persistencia.salvar([]);
        if (erro) { setErroCarrinho(erro); return false; }
        setCarrinho([]);
        return true;
    };

    const handleEnviarParaCozinha = async () => {
        if (erroCarrinho || erroPedido || loadingPedido || bloqueiaAbertura() || envioEmCurso.current || adicao.bloqueada || numeroMesa === 0) return;
        // Retry incerto usa exclusivamente a intenção persistida; estoque/status atuais não provam se ela foi aplicada.
        if (!adicao.pendente && (motivoNovosItens(mesaStatusData, pedidoAtivo) || motivoSelecao(carrinho, produtos ?? []))) return;
        if (!adicao.pendente && carrinho.length === 0) return;
        const erroPersistencia = persistencia.salvar(carrinho.filter(item => item.produto.id !== 9999));
        if (erroPersistencia) { setErroCarrinho(erroPersistencia); return; }
        envioEmCurso.current = true;
        try {
            if (adicao.pendente || pedidoAtivo) {
                const itensPayload = carrinho.map(item => ({ produtoId: item.produto.id!, quantidade: item.quantidade }));
                // O gestor ignora estes dados em retries e usa exclusivamente o snapshot salvo.
                await adicao.enviar(adicao.pendente?.pedidoId ?? pedidoAtivo!.id, itensPayload, () => {
                    if (!limparCarrinho()) throw new Error('A seleção não pôde ser limpa com segurança.');
                });
            } else {
                await abertura.enviar(carrinho.map(item => ({ produtoId: item.produto.id!, quantidade: item.quantidade })), () => {
                    if (!limparCarrinho()) throw new Error('A seleção não pôde ser limpa com segurança.');
                });
            }
        } finally { envioEmCurso.current = false; }
    };

    const itensConsumidos = pedidoAtivo?.itens ?? [];
    const possuiItensConsumidos = itensConsumidos.length > 0;
    const todosItensProntos = possuiItensConsumidos && itensConsumidos.every(item => item.status === "PRONTO");

    const handleSolicitarPagamento = () => {
        if (!todosItensProntos || !podeSolicitarPagamento(mesaStatusData, pedidoAtivo)) return;
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        if (carrinho.length > 0) {
            setIsModalAvisoOpen(true);
        } else {
            reiniciarPagamento();
            setIsModalOpen(true);
        }
    };

    const handleDescartarEPagar = () => {
        if (!todosItensProntos || !podeSolicitarPagamento(mesaStatusData, pedidoAtivo)) return;
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        if (!limparCarrinho()) return;
        setIsModalAvisoOpen(false);
        reiniciarPagamento();
        setIsModalOpen(true);
    };

    const handleEnviarSolicitacaoPagamento = async (formaPagamentoSelecionada: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        if (!todosItensProntos || !podeSolicitarPagamento(mesaStatusData, pedidoAtivo)) return;
        if (bloqueiaAbertura() || adicao.bloqueiaCarrinho() || envioEmCurso.current) return;
        await pagamento.solicitar(pedidoAtivo?.id, formaPagamentoSelecionada);
    };

    const handleFechamentoModal = () => {
        setIsModalOpen(false);
        reiniciarPagamento();
    };

    const produtosCardapio = produtos?.filter(p => p.ativo) || [];
    if (erroCarrinho) return <div className="error-card" role="alert">
        <p>{erroCarrinho}</p>
        <p>Se houver uma operação pendente, solicite atendimento para conferir a comanda.</p>
        {!existePendencia && <button onClick={() => {
            const erro = persistencia.iniciarNovo();
            if (erro) { setErroCarrinho(erro); return; }
            setCarrinho([]); setErroCarrinho(null);
        }}>Iniciar nova seleção vazia</button>}
    </div>;
    if (erroPedido) return <div className="error-card" role="alert">
        <p>Não foi possível consultar a comanda. A ausência de pedido não foi confirmada e a seleção foi preservada.</p>
        {acaoAtualizacao}
    </div>;

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
            <div className="error-card" role="alert">
                <AlertCircle size={48} color="#d32f2f" style={{ marginBottom: '16px' }} />
                <h2>Não foi possível carregar o cardápio</h2>
                <p>O tablet falhou ao tentar buscar os produtos ativos.</p>
                {acaoAtualizacao}
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
                        bloqueado={!!bloqueioEstado || existePendencia || criando || adicionando}
                        podeAdicionar={podeAdicionar}
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
                        motivoBloqueio={bloqueioEstado}
                        motivoEstoque={bloqueioEstoque || null}
                        produtosAtuais={produtos}
                        pagamentoPermitido={podeSolicitarPagamento(mesaStatusData, pedidoAtivo)}
                        acaoAtualizacao={acaoAtualizacao}
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
