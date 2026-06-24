import api from "../services/api";
import { useQuery } from "@tanstack/react-query";

async function buscarStatusAtual(numeroMesa: number) {
    const response = await api.get(`/mesas/${numeroMesa}`);
    return response.data; // Retorna o MesaResponseDTO { id, numero, status }
}

export function useMonitorarStatusMesa(numeroMesa: number | undefined) {
    return useQuery({
        queryKey: ["status-tablet-mesa", numeroMesa],
        queryFn: () => buscarStatusAtual(numeroMesa!),
        enabled: !!numeroMesa, // Só executa se soubermos o número da mesa
        refetchInterval: 1000,
        refetchIntervalInBackground: true // Continua checando mesmo se a tela escurecer
    });
}