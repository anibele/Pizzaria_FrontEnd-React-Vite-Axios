import type { AxiosInstance } from 'axios';
import type { PedidoDados } from '../interfaces/PedidoDados';
import { adaptarParaCaixa } from './adapter';

interface ResumoDTO { faturamento: number; ticketMedio: number; tempoMedioCozinhaMinutos: number; taxaBebidas: number }
interface VendasHoraDTO { hora: number; quantidadePedidos: number }
interface PagamentoDTO { formaPagamento: string; quantidade: number }
interface RankingsDTO {
    topPizzas: { nome: string; quantidadeVendida: number }[];
    gargalos: { produto: string; vezesAtrasado: number; tempoMedioReal: number }[];
}

// Erros HTTP permanecem rejeições. Lista vazia e zero só vêm de respostas válidas.
export async function consultarArquivo(http: Pick<AxiosInstance, 'get'>, data: string, signal: AbortSignal) {
    const resposta = await http.get<PedidoDados[]>('/pedidos/finalizados', { params: { data }, signal });
    if (!Array.isArray(resposta.data)) throw new Error('Resposta de arquivo inválida.');
    resposta.data.forEach(adaptarParaCaixa);
    return resposta.data;
}
export async function consultarFaturamento(http: Pick<AxiosInstance, 'get'>, data: string, signal: AbortSignal) {
    const resposta = await http.get<number>('/pedidos/faturamento', { params: { data }, signal });
    if (typeof resposta.data !== 'number' || !Number.isFinite(resposta.data)) throw new Error('Resposta de faturamento inválida.');
    return resposta.data;
}
export async function consultarDashboard(http: Pick<AxiosInstance, 'get'>, signal: AbortSignal) {
    const [resumo, vendas, pagamentos, rankings] = await Promise.all([
        http.get<ResumoDTO>('/api/dashboard/resumo', { signal }),
        http.get<VendasHoraDTO[]>('/api/dashboard/vendas-hora', { signal }),
        http.get<PagamentoDTO[]>('/api/dashboard/pagamentos', { signal }),
        http.get<RankingsDTO>('/api/dashboard/rankings', { signal }),
    ]);
    if (!resumo.data || !['faturamento', 'ticketMedio', 'tempoMedioCozinhaMinutos', 'taxaBebidas']
        .every(key => typeof resumo.data[key as keyof ResumoDTO] === 'number' && Number.isFinite(resumo.data[key as keyof ResumoDTO]))
        || !Array.isArray(vendas.data) || !Array.isArray(pagamentos.data)
        || !Array.isArray(rankings.data?.topPizzas) || !Array.isArray(rankings.data?.gargalos)) throw new Error('Resposta de indicadores inválida.');
    return { resumo: resumo.data, vendas: vendas.data, pagamentos: pagamentos.data, rankings: rankings.data };
}
