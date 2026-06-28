import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function confirmarPagamento(pedidoId: number) {
    await api.patch(`/pedidos/${pedidoId}/confirmar`);
}

export function usePedidoConfirmarPagamento() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: confirmarPagamento,
        onSuccess: () => {
            // Atualiza a lista de pedidos após confirmar
            queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        }
    });
}