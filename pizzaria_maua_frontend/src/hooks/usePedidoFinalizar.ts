import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FinalizarPedidoProps {
    pedidoId: number;
    numeroMesa: number;
    formaPagamento: 'PIX' | 'CARTAO' | 'DINHEIRO';
}

async function finalizarPedido({ pedidoId, formaPagamento }: FinalizarPedidoProps) {
    await api.patch(`/pedidos/${pedidoId}/finalizar?formaPagamento=${formaPagamento}`);
}

export function usePedidoFinalizar() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: finalizarPedido,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
            queryClient.invalidateQueries({ queryKey: ["pedido-mesa-aberto", variables.numeroMesa] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        }
    });
}