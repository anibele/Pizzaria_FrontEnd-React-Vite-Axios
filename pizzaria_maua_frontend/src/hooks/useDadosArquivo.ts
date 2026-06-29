import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import type { MesaDados } from "../interfaces/MesaDados.ts";

// Hook para buscar os pedidos finalizados de uma data específica
export function usePedidosPorData(dataStr: string) {
    return useQuery({
        queryKey: ["pedidos", "finalizados", dataStr],
        queryFn: async () => {
            // Rota corrigida com o prefixo e passando a data informada
            const response = await api.get<MesaDados[]>(`/pedidos/finalizados?data=${dataStr}`);
            return response.data;
        },
        enabled: !!dataStr,
        refetchInterval: 5000,
    });
}

// Hook leve focado apenas em trazer o faturamento total somado de uma data específica
export function useFaturamentoDiario(dataStr: string) {
    return useQuery({
        queryKey: ["faturamento", dataStr],
        queryFn: async () => {
            // Rota corrigida com o prefixo e passando a data informada
            const response = await api.get<number>(`/pedidos/faturamento?data=${dataStr}`);
            return response.data;
        },
        enabled: !!dataStr,
        refetchInterval: 5000,
    });
}