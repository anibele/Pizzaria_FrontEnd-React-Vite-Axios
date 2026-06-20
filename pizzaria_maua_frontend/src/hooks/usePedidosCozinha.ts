import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { PedidoDados } from "../interfaces/PedidoDados";

const buscarPedidosCozinha = async (): Promise<PedidoDados[]> => {
    const response = await api.get<PedidoDados[]>('/pedidos/cozinha');
    return response.data;
};

export function usePedidosCozinha() {
    return useQuery({
        queryKey: ["pedidos-cozinha"],
        queryFn: buscarPedidosCozinha,
        refetchInterval: 2000,
        staleTime: 0,
        gcTime: 0,             
    });
}