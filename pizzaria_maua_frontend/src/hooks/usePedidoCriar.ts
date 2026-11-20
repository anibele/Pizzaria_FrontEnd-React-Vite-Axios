import api from "../services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { CriarPedidoInput } from "../interfaces/PedidoDados";
import { AuthContext } from "../contexts/AuthContext";
import { contextoAtualAdicao } from "../services/sessaoAdicao";
import { consultarAbertura, enviarAbertura, GestorAbertura } from "../services/aberturaPendente";
import type { DadosAbertura } from "../services/aberturaPendente";

export function usePedidoCriar(numeroMesa: number) {
    const queryClient = useQueryClient();
    const { user } = useContext(AuthContext);
    const username = user?.username, role = user?.role;
    const gestor = useMemo(() => {
        const atual = contextoAtualAdicao(numeroMesa);
        const contexto = atual?.username === username && atual?.role === role ? atual : null;
        return new GestorAbertura({ getItem: key => sessionStorage.getItem(key),
            setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key)
        }, contexto, () => contextoAtualAdicao(numeroMesa));
    }, [numeroMesa, username, role]);
    const estado = useSyncExternalStore(gestor.assinar, gestor.obterEstado);
    useEffect(() => () => gestor.desmontar(), [gestor]);

    const { mutateAsync } = useMutation({
        mutationFn: (dados: DadosAbertura) => enviarAbertura(api, dados), retry: false, networkMode: "always",
    });
    const enviar = async (itens: CriarPedidoInput["itens"], confirmar: () => void) => {
        await gestor.enviar(itens, dados => mutateAsync(dados), confirmar);
        // Apenas refetch: a resposta antiga do POST não substitui o polling atual.
        void queryClient.invalidateQueries({ queryKey: ["mesa-dados"] });
        void queryClient.invalidateQueries({ queryKey: ["pedido-mesa-aberto", numeroMesa] });
        void queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        void queryClient.invalidateQueries({ queryKey: ["produtos-ativos"] });
    };
    return { ...estado, enviar, bloqueiaCarrinho: gestor.bloqueiaCarrinho,
        revisarRejeitada: gestor.revisarRejeitada,
        verificar: () => gestor.verificar((numero, signal) => consultarAbertura(api, numero, signal)) };
}
