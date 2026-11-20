import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import type { MesaDados } from '../interfaces/MesaDados';

async function buscarStatusAtual(numeroMesa: number) {
    const response = await api.get<MesaDados>(`/mesas/${numeroMesa}`);
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
