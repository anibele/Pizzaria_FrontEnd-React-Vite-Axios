import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useDashboardDados } from '../hooks/useDashboardDados';
import "../styles/painelAnalitico.css";

export default function PainelAnalitico() {
    // Toda a lógica de estado e fetch sumiu daqui de dentro!
    const { loading, resumo, chartVendasHora, chartPagamentos, rankings } = useDashboardDados();

    const formatarMoeda = (valor: number | undefined) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    const formatarPorcentagem = (valor: number | undefined) => {
        return `${(valor || 0).toFixed(0)}%`;
    };

    const lineOptions = {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    };

    const doughnutOptions = { plugins: { legend: { position: 'bottom' } } };

    if (loading) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ height: '50vh' }}>
                <ProgressSpinner strokeWidth="4" aria-label="Carregando indicadores..." />
            </div>
        );
    }

    return (
        <div className="painel-analitico-container mt-4 animate-fade-in">
            <div className="grid-resumo-topo">
                <Card title="Faturamento Hoje" className="card-estatistica">
                    <p className="valor-destaque">{formatarMoeda(resumo?.faturamento)}</p>
                </Card>
                <Card title="Ticket Médio" className="card-estatistica">
                    <p className="valor-destaque">{formatarMoeda(resumo?.ticketMedio)}</p>
                </Card>
                <Card title="Tempo Médio Cozinha" className="card-estatistica">
                    <p className="valor-destaque">{resumo?.tempoMedioCozinhaMinutos} <span style={{fontSize: '1.2rem'}}>min</span></p>
                </Card>
                <Card title="Taxa de Bebidas" className="card-estatistica">
                    <p className="valor-destaque">{formatarPorcentagem(resumo?.taxaBebidas)}</p>
                </Card>
            </div>

            <div className="grid-graficos-meio mt-4">
                <Card title="Picos de Demanda (Vendas x Hora)" className="card-grafico">
                    {chartVendasHora && <Chart type="line" data={chartVendasHora} options={lineOptions} />}
                </Card>
                <Card title="Formas de Pagamento Mais Usadas" className="card-grafico">
                    {chartPagamentos && <Chart type="doughnut" data={chartPagamentos} options={doughnutOptions} style={{ maxWidth: '320px', margin: '0 auto' }} />}
                </Card>
            </div>

            <div className="grid-tabelas-baixo mt-4">
                <Card title="Top 5 Produtos Mais Vendidos (Mês)">
                    <DataTable value={rankings.topPizzas} rows={5} className="p-datatable-sm">
                        <Column header="#" body={(_, options) => options.rowIndex + 1} style={{ width: '10%' }} />
                        <Column field="nome" header="Produto" />
                        <Column field="quantidadeVendida" header="Qtd Vendida" style={{ width: '25%', textAlign: 'center' }} />
                    </DataTable>
                </Card>

                <Card title="Maiores Gargalos da Cozinha">
                    <DataTable value={rankings.gargalos} className="p-datatable-sm">
                        <Column field="produto" header="Produto" />
                        <Column field="vezesAtrasado" header="Atrasos" style={{ width: '20%', textAlign: 'center' }} />
                        <Column field="tempoMedioReal" header="Tempo Médio" body={(row) => `${row.tempoMedioReal} min`} style={{ width: '30%' }} />
                    </DataTable>
                </Card>
            </div>
        </div>
    );
}