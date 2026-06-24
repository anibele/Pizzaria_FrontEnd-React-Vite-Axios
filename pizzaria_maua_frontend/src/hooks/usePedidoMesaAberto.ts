import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { PedidoDados } from "../interfaces/PedidoDados";

const buscarPedidoMesa = async (numeroMesa: number): Promise<PedidoDados | null> => {
    try {
        const response = await api.get<PedidoDados>(`/pedidos/mesa/${numeroMesa}/aberto`);
        return response.data;
    } catch {
        return null;
    }
};

export function usePedidoMesaAberto(numeroMesa: number) {
    return useQuery({
        queryKey: ["pedido-mesa-aberto", numeroMesa],
        queryFn: () => buscarPedidoMesa(numeroMesa),
        enabled: numeroMesa > 0,
        refetchInterval: 1000
    });
}