import { useState } from "react";
import { Armchair, Plus, Trash2, CheckCircle, XCircle, Wrench, RefreshCw, Clock } from "lucide-react";
import { useMesaDados } from "../hooks/useMesaDados";
import { useMesaMutateStatus } from "../hooks/useMesaMutateStatus";
import { useMesaDeletar } from "../hooks/useMesaDelete";
import { useMesaAlterarAtivacao } from "../hooks/useMesaAlterarAtivacao"; // 🌟 Importando o hook de ativação real
import { FormularioMesa } from "../componentes/FormularioMesa";
import { ModalAcoesMesa } from "../componentes/ModalAcoesMesa";
import "../styles/mesasGerente.css";

export default function MesasGerente() {
    const { data: mesas, isLoading, isError } = useMesaDados();
    const { mutate: atualizarStatus } = useMesaMutateStatus();
    const { mutate: deletarMesa } = useMesaDeletar();
    const { mutate: alterarAtivacao } = useMesaAlterarAtivacao(); // 🌟 Instanciando a mutação

    const [modalMesaAberto, setModalMesaAberto] = useState(false);
    const [mesaSelecionadaAcoes, setMesaSelecionadaAcoes] = useState<number | null>(null);

    // Ciclo inteligente de alteração manual de status (apenas para mesas ativas)
    const handleAlternarStatus = (numero: number, statusAtual: 'LIVRE' | 'OCUPADA' | 'MANUTENCAO' | 'RESERVADA') => {
        let novoStatus: 'LIVRE' | 'OCUPADA' | 'MANUTENCAO' | 'RESERVADA';

        if (statusAtual === 'LIVRE') novoStatus = 'RESERVADA';
        else if (statusAtual === 'RESERVADA') novoStatus = 'OCUPADA';
        else if (statusAtual === 'OCUPADA') novoStatus = 'MANUTENCAO';
        else novoStatus = 'LIVRE';

        atualizarStatus({ numero, status: novoStatus });
    };

    // OPÇÃO 1 DO MODAL: Desativação Lógica Real (chama o endpoint PATCH /ativacao)
    const handleDesativarMesa = (numero: number) => {
        alterarAtivacao({ numero, ativo: false });
        setMesaSelecionadaAcoes(null);
    };

    // Reativação rápida pelo card cinza
    const handleAtivarMesa = (numero: number) => {
        alterarAtivacao({ numero, ativo: true });
    };

    // OPÇÃO 2 DO MODAL: Tenta deletar fisicamente. Se houver FK, o catch faz o fallback automático
    const handleExcluirDefinitivo = (numero: number) => {
        setMesaSelecionadaAcoes(null);

        deletarMesa(numero, {
            onError: (error: any) => {
                const mensagemErro = error.response?.data?.message || "";

                if (mensagemErro.includes("históricos de pedidos") || error.response?.status === 409 || error.response?.status === 500) {
                    alert(`⚠️ A Mesa ${numero} possui históricos de pedidos vinculados.\n\nPor segurança, o sistema converteu a ação e a mesa foi apenas DESATIVADA temporariamente.`);
                    alterarAtivacao({ numero, ativo: false }); // Fallback seguro
                } else {
                    alert("❌ Erro inesperado ao tentar excluir a mesa.");
                }
            }
        });
    };

    if (isLoading) return <div className="status-tela"><p>⏳ Carregando mapa de mesas...</p></div>;
    if (isError) return <div className="status-tela error"><p>❌ Erro ao conectar com o servidor de mesas.</p></div>;

    const mapeamentoNumeros = mesas ? mesas.map(m => m.numero) : [];

    return (
        <div className="gerente-mesas-container animate-fade-in">
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
                                    <button onClick={() => setMesaSelecionadaAcoes(mesa.numero)} className="btn-deletar-mesa" title="Remover ou Desativar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="card-mesa-status-info">
                                    {componenteBadge}
                                </div>

                                <div className="card-mesa-acoes">
                                    {/* 🔄 Se a mesa não estiver ativa, exibe o botão de ativação rápida */}
                                    {!mesa.ativo ? (
                                        <button onClick={() => handleAtivarMesa(mesa.numero)} className="btn-ativar-mesa">
                                            <CheckCircle size={14} /> Ativar Mesa
                                        </button>
                                    ) : (
                                        <button onClick={() => handleAlternarStatus(mesa.numero, mesa.status)} className="btn-alternar-status">
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
                onClose={() => setMesaSelecionadaAcoes(null)}
                numeroMesa={mesaSelecionadaAcoes || 0}
                onDesativar={() => handleDesativarMesa(mesaSelecionadaAcoes!)}
                onExcluir={() => handleExcluirDefinitivo(mesaSelecionadaAcoes!)}
            />
        </div>
    );
}