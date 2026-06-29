import { useState, useMemo } from "react";
import { usePedidosPorData } from "../hooks/useDadosArquivo";
import { adaptarParaCaixa } from "../services/adapter";
import { baixarComandaTxt } from "../services/gerarComandaTxt";
import { ModalDetalhesPedido } from "../componentes/ModalDetalhesPedido";
import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa";

// Lucide Icons
import { LayoutGrid, Table, Calendar, Search, Loader2, FileDown, Eye} from "lucide-react";

// PrimeReact Components
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "../styles/arquivoCaixa.css";

export default function ArquivoCaixa() {
    // Inicializa a data filtro padrão com o dia de HOJE no formato YYYY-MM-DD
    const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [dataFiltro, setDataFiltro] = useState<string>(hojeStr);
    const [visao, setVisao] = useState<"CARDS" | "TABELA">("CARDS");
    const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCaixaDados | null>(null);

    // Requisição reativa usando o Hook
    const { data: pedidosBrutos, isLoading } = usePedidosPorData(dataFiltro);

    // Filtra e adapta somente os finalizados para exibição uniforme
    const pedidosFinalizados = useMemo(() => {
        if (!pedidosBrutos) return [];
        return pedidosBrutos
            .filter((p: any) => p.status === "FINALIZADO")
            .map((p: any) => adaptarParaCaixa(p));
    }, [pedidosBrutos]);

    // Calcula o faturamento retroativo total do dia exibido
    const faturamentoTotalDoDia = useMemo(() => {
        return pedidosFinalizados.reduce((acc, p) => acc + (p.faturamento || 0), 0);
    }, [pedidosFinalizados]);

    const handleBaixarTxt = (e: React.MouseEvent, pedido: PedidoCaixaDados) => {
        e.stopPropagation(); // Evita abrir o modal de detalhes acidentalmente
        baixarComandaTxt(pedido);
    };

    // --- TEMPLATES CUSTOMIZADOS PARA A DATA TABLE DO PRIMEREACT ---
    const idTemplate = (rowData: PedidoCaixaDados) => (
        <span className="font-mono text-gray-600 font-bold">#{rowData.id}</span>
    );

    const mesaTemplate = (rowData: PedidoCaixaDados) => (
        <span className="font-semibold">Mesa {rowData.numeroMesa ?? "Avulsa"}</span>
    );

    const faturamentoTemplate = (rowData: PedidoCaixaDados) => (
        <span className="font-bold text-gray-800">R$ {rowData.faturamento.toFixed(2)}</span>
    );

    const fPagamentoTemplate = (rowData: PedidoCaixaDados) => (
        <span className="badge-f-pagamento">{rowData.formaPagamento || "Não informada"}</span>
    );

    const acoesTemplate = (rowData: PedidoCaixaDados) => (
        <div className="tabela-acoes-container">
            <button
                className="btn-tabela-acao visualizar"
                onClick={() => setPedidoSelecionado(rowData)}
                title="Visualizar Detalhes"
            >
                <Eye size={16} />
            </button>
            <button
                className="btn-tabela-acao baixar"
                onClick={(e) => handleBaixarTxt(e, rowData)}
                title="Baixar Comanda (.txt)"
            >
                <FileDown size={16} />
            </button>
        </div>
    );

    return (
        <div className="arquivo-container">

            {/* CONTROLES DO TOPO: Filtro de Data, Visões e Faturamento */}
            <div className="arquivo-filtros-bar">
                <div className="grupo-busca-data">
                    <div className="input-data-wrapper">
                        <Calendar size={18} className="text-gray-400" />
                        <input
                            type="date"
                            value={dataFiltro}
                            onChange={(e) => setDataFiltro(e.target.value)}
                            className="input-data-campo"
                        />
                    </div>
                </div>

                <div className="faturamento-historico-card">
                    <span className="faturamento-label-hist">Total Concluído no Dia</span>
                    <span className="faturamento-valor-hist">R$ {faturamentoTotalDoDia.toFixed(2)}</span>
                </div>

                <div className="alternador-visao-container">
                    <button
                        className={`btn-alternador ${visao === "CARDS" ? "ativo" : ""}`}
                        onClick={() => setVisao("CARDS")}
                    >
                        <LayoutGrid size={18} />
                        <span>Cards</span>
                    </button>
                    <button
                        className={`btn-alternador ${visao === "TABELA" ? "ativo" : ""}`}
                        onClick={() => setVisao("TABELA")}
                    >
                        <Table size={18} />
                        <span>Tabela</span>
                    </button>
                </div>
            </div>

            {/* AREA DE EXIBIÇÃO CONTEÚDO */}
            {isLoading ? (
                <div className="loader-arquivo-container">
                    <Loader2 className="animate-spin text-red-600" size={48} />
                    <p>Buscando registros históricos...</p>
                </div>
            ) : pedidosFinalizados.length === 0 ? (
                <div className="empty-state">
                    <Search size={56} className="empty-icon" />
                    <h3 className="text-xl font-bold mb-2">Nenhum pedido finalizado</h3>
                    <p>Não encontramos nenhum registro de venda encerrada na data selecionada.</p>
                </div>
            ) : visao === "CARDS" ? (
                /* 1. VISÃO EM GRID DE CARDS (REAPROVEITADO DO CAIXA) */
                <div className="cards-grid">
                    {pedidosFinalizados.map((pedido) => (
                        <div
                            key={pedido.id}
                            className="card-mesa card-arquivo-finalizado"
                            onClick={() => setPedidoSelecionado(pedido)}
                        >
                            <div className="card-header border-b-gray">
                                <h3 className="mesa-title">Mesa {pedido.numeroMesa ?? "?"}</h3>
                                <span className="status-badge status-concluido">Concluído</span>
                            </div>

                            <div className="card-body">
                                <span className="label-total">Total Pago</span>
                                <span className="valor-total">R$ {pedido.faturamento.toFixed(2)}</span>
                                <span className="forma-pagamento text-gray-dark">
                                    Forma: {pedido.formaPagamento || "Outros"}
                                </span>
                            </div>

                            <div className="card-footer-arquivo">
                                <button
                                    className="btn-baixar-txt-card"
                                    onClick={(e) => handleBaixarTxt(e, pedido)}
                                >
                                    <FileDown size={16} />
                                    Baixar TXT
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* 2. VISÃO EM TABELA USANDO PRIMEREACT DATATABLE */
                <div className="tabela-p-container card">
                    <DataTable
                        value={pedidosFinalizados}
                        stripedRows
                        responsiveLayout="scroll"
                        className="p-datatable-custom"
                        dataKey="id"
                    >
                        <Column field="id" header="Cód/Pedido" body={idTemplate} sortable style={{ width: '15%' }}></Column>
                        <Column field="numeroMesa" header="Origem" body={mesaTemplate} sortable style={{ width: '20%' }}></Column>
                        <Column field="formaPagamento" header="Método de Pagamento" body={link => fPagamentoTemplate(link)} style={{ width: '25%' }}></Column>
                        <Column field="faturamento" header="Total Pago" body={faturamentoTemplate} sortable style={{ width: '20%' }}></Column>
                        <Column
                            header="Ações"
                            body={acoesTemplate}
                            style={{ width: '20%' }}
                            alignHeader="center"
                            align="center"
                        />
                    </DataTable>
                </div>
            )}

            {/* MODAL DE DETALHES REUTILIZADO */}
            <ModalDetalhesPedido
                isOpen={!!pedidoSelecionado}
                onClose={() => setPedidoSelecionado(null)}
                pedido={pedidoSelecionado}
            />
        </div>
    );
}