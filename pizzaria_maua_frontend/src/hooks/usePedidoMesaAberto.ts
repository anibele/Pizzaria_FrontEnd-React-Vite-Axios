import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { PedidoDados } from "../interfaces/PedidoDados";

const buscarPedidoMesa = async (numeroMesa: number): Promise<PedidoDados | null> => {
    try {
        const response = await api.get<PedidoDados>(`/pedidos/mesa/${numeroMesa}/aberto`);
        return response.data;
    } catch (error: any) {
        // Se o banco retornar 404, significa apenas que a mesa está sem pedidos.
        // Retornamos null tranquilamente para a UI não quebrar.
        if (error.response?.status === 404) {
            return null;
        }
        // Se for outro erro (ex: servidor caiu), joga o erro para o React Query
        throw error;
    }
};

export function usePedidoMesaAberto(numeroMesa: number) {
    return useQuery({
        queryKey: ["pedido-mesa-aberto", numeroMesa],
        queryFn: () => buscarPedidoMesa(numeroMesa),
        enabled: numeroMesa > 0,
        refetchInterval: 1000,
        retry: (failureCount, error: any) => {
            if (error?.response?.status === 404) {
                return false; // Não faz retry se for 404
            }
            return failureCount < 2;
        }
    });
}