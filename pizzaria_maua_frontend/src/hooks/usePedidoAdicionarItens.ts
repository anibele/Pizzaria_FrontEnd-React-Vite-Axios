import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useMemo, useSyncExternalStore } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { contextoAtualAdicao } from "../services/sessaoAdicao";
import { enviarAdicao, GestorAdicao } from "../services/adicaoPendente";
import type { AdicaoPendente } from "../services/adicaoPendente";
import type { AdicionarItensInput } from "../interfaces/PedidoDados";

export function usePedidoAdicionarItens(numeroMesa: number) {
    const queryClient = useQueryClient();
    const { user } = useContext(AuthContext);
    const username = user?.username;
    const role = user?.role;
    const gestor = useMemo(() => {
        // Identidade atual e conferida novamente antes e depois de cada tentativa.
        const atual = contextoAtualAdicao(numeroMesa);
        const contexto = atual?.username === username && atual?.role === role ? atual : null;
        return new GestorAdicao({ getItem: key => sessionStorage.getItem(key),
            setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key)
        }, contexto, () => contextoAtualAdicao(numeroMesa));
    }, [numeroMesa, username, role]);
    const estado = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    const mutation = useMutation({ mutationFn: (op: AdicaoPendente) => enviarAdicao(api, op), retry: false });

    const enviar = async (pedidoId: number, itens: AdicionarItensInput[], confirmar: (op: AdicaoPendente) => void) => {
        await gestor.enviar(pedidoId, itens, op => mutation.mutateAsync(op), op => {
            confirmar(op);
            // Nunca mescla o snapshot antigo de um replay no cache atual.
            void queryClient.invalidateQueries({ queryKey: ["pedido-mesa-aberto", op.contexto.numeroMesa] });
            void queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
            void queryClient.invalidateQueries({ queryKey: ["produto-dados"] });
            void queryClient.invalidateQueries({ queryKey: ["produtos-ativos"] });
        });
    };
    return { ...estado, enviar, revisarRejeitada: () => gestor.revisarRejeitada(),
        bloqueiaCarrinho: () => !!gestor.obterEstado().pendente || gestor.obterEstado().enviando || gestor.obterEstado().bloqueada };
}
