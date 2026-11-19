import { useQuery } from '@tanstack/react-query';
import type { ChartData } from 'chart.js';
import api from '../services/api';
import { consultarDashboard } from '../services/consultasOperacionais';

export function useDashboardDados() {
    const consulta = useQuery({ queryKey: ['dashboard-indicadores'],
        queryFn: ({ signal }) => consultarDashboard(api, signal), retry: false });
    const dados = consulta.data;
    const chartVendasHora: ChartData<'line'> | null = dados ? {
        labels: dados.vendas.map(item => `${item.hora}h`),
        datasets: [{ label: 'Quantidade de Pedidos', data: dados.vendas.map(item => item.quantidadePedidos),
            fill: true, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4 }],
    } : null;
    const chartPagamentos: ChartData<'doughnut'> | null = dados ? {
        labels: dados.pagamentos.map(item => item.formaPagamento),
        datasets: [{ data: dados.pagamentos.map(item => item.quantidade),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'],
            hoverBackgroundColor: ['#2563eb', '#059669', '#d97706', '#4f46e5'] }],
    } : null;
    return { loading: consulta.isPending, erro: consulta.isError, atualizar: consulta.refetch,
        resumo: dados?.resumo, rankings: dados?.rankings, chartVendasHora, chartPagamentos };
}
