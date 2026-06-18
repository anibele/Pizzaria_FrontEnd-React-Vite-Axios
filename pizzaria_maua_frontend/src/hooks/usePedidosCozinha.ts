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
        refetchInterval: 5000, // Mantém o Pooling ativo a cada 5 segundos para a cozinha
    });
}