import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";

interface AtualizarStatusParam {
    itemId: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
}

export function usePedidoItemStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, status }: AtualizarStatusParam) => {
            await api.patch(`/pedidos/itens/${itemId}/status`, null, {
                params: { status }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        }
    });
}