import { useState, useEffect } from 'react';
import api from '../services/api'; // 👈 Ajuste o caminho de importação para onde está o seu api.ts

interface ResumoDTO {
    faturamento: number;
    ticketMedio: number;
    tempoMedioCozinhaMinutos: number;
    taxaBebidas: number;
}

interface VendasHoraDTO {
    hora: number;
    quantidadePedidos: number;
}

interface PagamentoDTO {
    formaPagamento: string;
    quantidade: number;
}

interface RankingsDTO {
    topPizzas: Array<{ nome: string; quantidadeVendida: number }>;
    gargalos: Array<{ produto: string; vezesAtrasado: number; tempoMedioReal: number }>;
}

export function useDashboardDados() {
    const [loading, setLoading] = useState(true);
    const [resumo, setResumo] = useState<ResumoDTO | null>(null);
    const [chartVendasHora, setChartVendasHora] = useState<any>(null);
    const [chartPagamentos, setChartPagamentos] = useState<any>(null);
    const [rankings, setRankings] = useState<RankingsDTO>({ topPizzas: [], gargalos: [] });

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);

        // No Axios, não precisamos do .then(res => res.json()), ele faz isso sozinho.
        Promise.all([
            api.get('/api/dashboard/resumo'),
            api.get('/api/dashboard/vendas-hora'),
            api.get('/api/dashboard/pagamentos'),
            api.get('/api/dashboard/rankings')
        ])
            .then(([resResumo, resVendasHora, resPagamentos, resRankings]) => {
                // O Axios armazena o corpo da resposta HTTP dentro do atributo .data
                const dadosResumo = resResumo.data;
                const dadosVendasHora = resVendasHora.data;
                const dadosPagamentos = resPagamentos.data;
                const dadosRankings = resRankings.data;

                setResumo(dadosResumo);
                setRankings(dadosRankings);

                // 1. Configuração do Gráfico de Linha
                setChartVendasHora({
                    labels: dadosVendasHora.map((item: VendasHoraDTO) => `${item.hora}h`),
                    datasets: [{
                        label: 'Quantidade de Pedidos',
                        data: dadosVendasHora.map((item: VendasHoraDTO) => item.quantidadePedidos),
                        fill: true,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                });

                // 2. Configuração do Gráfico de Rosca
                setChartPagamentos({
                    labels: dadosPagamentos.map((item: PagamentoDTO) => item.formaPagamento),
                    datasets: [{
                        data: dadosPagamentos.map((item: PagamentoDTO) => item.quantidade),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'],
                        hoverBackgroundColor: ['#2563eb', '#059669', '#d97706', '#4f46e5']
                    }]
                });
            })
            .catch(err => {
                console.error("Erro ao carregar dados do dashboard:", err);
                // Se o erro for 401, o seu interceptor do api.ts já vai chutar o usuário para o /login automaticamente!
            })
            .finally(() => setLoading(false));
    }, []);

    return { loading, resumo, chartVendasHora, chartPagamentos, rankings };
}