import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Armchair, Plus, Trash2, CheckCircle, XCircle, Wrench, RefreshCw, Clock } from "lucide-react";
import { useMesaDados } from "../hooks/useMesaDados";
import { useMesaMutateStatus } from "../hooks/useMesaMutateStatus";
import { useMesaDeletar } from "../hooks/useMesaDelete";
import { useMesaAlterarAtivacao } from "../hooks/useMesaAlterarAtivacao";
import { AcoesMesa, consultarMesa } from "../services/acoesMesa";
import api from "../services/api";
import type { MesaDados } from "../interfaces/MesaDados";
import { FormularioMesa } from "../componentes/FormularioMesa";
import { ModalAcoesMesa } from "../componentes/ModalAcoesMesa";
import "../styles/mesasGerente.css";

export default function MesasGerente() {
    const { data: mesas, isLoading, isError } = useMesaDados();
    const { mutate: atualizarStatus } = useMesaMutateStatus();
    const { mutateAsync: deletarMesa } = useMesaDeletar();
    const { mutateAsync: alterarAtivacao } = useMesaAlterarAtivacao();
    const queryClient = useQueryClient();
    const gestor = useMemo(() => new AcoesMesa(queryClient, {
        excluir: deletarMesa,
        ativacao: alterarAtivacao,
        consultar: (numero, signal) => consultarMesa(api, numero, signal),
    }), [queryClient, deletarMesa, alterarAtivacao]);
    const estado = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    useEffect(() => () => gestor.limpar(), [gestor]);

    const [modalMesaAberto, setModalMesaAberto] = useState(false);
    const [mesaSelecionadaAcoes, setMesaSelecionadaAcoes] = useState<MesaDados | null>(null);

    const abrirAcoes = (mesa: MesaDados) => {
        if (gestor.obterEstado().processando) return;
        gestor.limpar();
        setMesaSelecionadaAcoes(mesa);
    };
    const fecharAcoes = () => {
        if (!gestor.obterEstado().processando) setMesaSelecionadaAcoes(null);
    };

    // Ciclo inteligente de alteração manual de status (apenas para mesas ativas)
    const handleAlternarStatus = (numero: number, statusAtual: 'LIVRE' | 'OCUPADA' | 'MANUTENCAO' | 'RESERVADA') => {
        if (gestor.obterEstado().processando) return;
        let novoStatus: 'LIVRE' | 'OCUPADA' | 'MANUTENCAO' | 'RESERVADA';

        if (statusAtual === 'LIVRE') novoStatus = 'RESERVADA';
        else if (statusAtual === 'RESERVADA') novoStatus = 'OCUPADA';
        else if (statusAtual === 'OCUPADA') novoStatus = 'MANUTENCAO';
        else novoStatus = 'LIVRE';

        atualizarStatus({ numero, status: novoStatus });
    };

    const handleDesativarMesa = () => {
        if (mesaSelecionadaAcoes) void gestor.executar(mesaSelecionadaAcoes, 'desativar');
    };

    // Reativação rápida pelo card cinza
    const handleAtivarMesa = (mesa: MesaDados) => {
        void gestor.executar(mesa, 'ativar');
    };

    const handleExcluirDefinitivo = () => {
        if (mesaSelecionadaAcoes) void gestor.executar(mesaSelecionadaAcoes, 'excluir');
    };

    if (isLoading) return <div className="status-tela"><p>⏳ Carregando mapa de mesas...</p></div>;
    if (isError && !mesas) return <div className="status-tela error"><p>❌ Erro ao conectar com o servidor de mesas.</p></div>;

    const mapeamentoNumeros = mesas ? mesas.map(m => m.numero) : [];
    const mesaParaVerificar = mesas?.find(m => m.numero === estado.numero);

    return (
        <div className="gerente-mesas-container animate-fade-in">
            {mesaSelecionadaAcoes === null && estado.mensagem && <p role={estado.processando || estado.sucesso ? 'status' : 'alert'}>{estado.mensagem}</p>}
            {mesaSelecionadaAcoes === null && estado.verificar && mesaParaVerificar && <button className="btn-alternar-status" onClick={() => { void gestor.verificar(mesaParaVerificar); }}>Verificar mesa</button>}
            {isError && !estado.mensagem && <p role="alert">Não foi possível atualizar as mesas. Exibindo os últimos dados confirmados.</p>}
            <div className="topo-painel">
                <div>
                    <h2>
                        <Armchair size={28} style={{ display: 'inline', verticalAlign: 'bottom', marginRight: '8px' }} />
                        Gerenciamento de Mesas
                    </h2>
                    <p>Monitore o status do salão, gerencie reservas ou desative a infraestrutura física.</p>
                </div>

                <button className="btn-novo-produto" onClick={() => setModalMesaAberto(true)}>
                    <Plus size={20} /> Nova Mesa
                </button>
            </div>

            <div className="grid-mesas">
                {mesas && mesas.length > 0 ? (
                    [...mesas].sort((a, b) => a.numero - b.numero).map((mesa) => {
                        let classeCard = "mesa-livre";
                        let componenteBadge = <span className="status-badge livre"><CheckCircle size={14} /> Disponível</span>;

                        // 1️⃣ Se a mesa estiver desativada logicamente, ela ganha prioridade estética total
                        if (!mesa.ativo) {
                            classeCard = "mesa-desativada";
                            componenteBadge = <span className="status-badge desativada"><XCircle size={14} /> Desativada</span>;
                        } else {
                            // 2️⃣ Se ativa, renderiza seu respectivo estado operacional
                            if (mesa.status === 'OCUPADA') {
                                classeCard = "mesa-ocupada";
                                componenteBadge = <span className="status-badge ocupada"><XCircle size={14} /> Ocupada</span>;
                            } else if (mesa.status === 'RESERVADA') {
                                classeCard = "mesa-reservada"; // 🌟 Nova classe
                                componenteBadge = <span className="status-badge reservada"><Clock size={14} /> Reservada</span>; // 🌟 Novo badge
                            } else if (mesa.status === 'MANUTENCAO') {
                                classeCard = "mesa-manutencao";
                                componenteBadge = <span className="status-badge manutencao"><Wrench size={14} /> Manutenção</span>;
                            }
                        }

                        return (
                            <div key={mesa.numero} className={`card-mesa ${classeCard}`}>
                                <div className="card-mesa-header">
                                    <h3>Mesa {mesa.numero}</h3>
                                    <button onClick={() => abrirAcoes(mesa)} disabled={estado.processando} className="btn-deletar-mesa" title="Remover ou Desativar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="card-mesa-status-info">
                                    {componenteBadge}
                                </div>

                                <div className="card-mesa-acoes">
                                    {/* 🔄 Se a mesa não estiver ativa, exibe o botão de ativação rápida */}
                                    {!mesa.ativo ? (
                                        <button onClick={() => handleAtivarMesa(mesa)} disabled={estado.processando} className="btn-ativar-mesa">
                                            <CheckCircle size={14} /> Ativar Mesa
                                        </button>
                                    ) : (
                                        <button onClick={() => handleAlternarStatus(mesa.numero, mesa.status)} disabled={estado.processando} className="btn-alternar-status">
                                            <RefreshCw size={14} /> Mudar Status
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="sem-mesas"><p>Nenhuma mesa cadastrada no sistema da Pizzaria Mauá.</p></div>
                )}
            </div>

            {/* Modal de Cadastro */}
            {modalMesaAberto && (
                <div className="overlay-modal">
                    <div className="modal-conteudo modal-pequeno" style={{ maxWidth: '500px', textAlign: 'left', padding: '0' }}>
                        <FormularioMesa
                            fecharModal={() => setModalMesaAberto(false)}
                            mesasExistentes={mapeamentoNumeros}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Ações Inteligentes */}
            <ModalAcoesMesa
                isOpen={mesaSelecionadaAcoes !== null}
                onClose={fecharAcoes}
                numeroMesa={mesaSelecionadaAcoes?.numero || 0}
                estado={estado}
                onDesativar={handleDesativarMesa}
                onExcluir={handleExcluirDefinitivo}
                onVerificar={() => { if (mesaSelecionadaAcoes) void gestor.verificar(mesaSelecionadaAcoes); }}
            />
        </div>
    );
}
