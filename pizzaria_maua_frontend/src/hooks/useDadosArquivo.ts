import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { consultarArquivo, consultarFaturamento } from '../services/consultasOperacionais';
import { chaveFaturamento } from '../services/dataFinanceira';

// Hook para buscar os pedidos finalizados de uma data específica
export function usePedidosPorData(dataStr: string) {
    return useQuery({
        queryKey: ["pedidos", "finalizados", dataStr],
        queryFn: ({ signal }) => consultarArquivo(api, dataStr, signal),
        enabled: !!dataStr,
        refetchInterval: 5000,
    });
}

// Hook leve focado apenas em trazer o faturamento total somado de uma data específica
export function useFaturamentoDiario(dataStr: string) {
    return useQuery({
        queryKey: chaveFaturamento(dataStr),
        queryFn: ({ signal }) => consultarFaturamento(api, dataStr, signal),
        enabled: !!dataStr,
        refetchInterval: 5000,
    });
}
