import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdicionarItensInput } from "../interfaces/PedidoDados";

interface AdicionarItensProps {
    pedidoId: number;
    numeroMesa: number;
    itens: AdicionarItensInput[];
}

async function adicionarItens({ pedidoId, itens }: AdicionarItensProps) {
    const response = await api.put(`/pedidos/${pedidoId}/itens`, itens);
    return response.data;
}

export function usePedidoAdicionarItens() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: adicionarItens,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["pedido-mesa-aberto", variables.numeroMesa] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
            queryClient.invalidateQueries({ queryKey: ["produto-dados"] });
        }
    });
}