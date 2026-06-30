export type KdsStatus = 'NORMAL' | 'ALERTA' | 'ATRASADO';

export interface KdsCalculo {
    status: KdsStatus;
    minutosRestantes: number;
}

export function calcularPrioridadeKds(dataHoraInclusao: string, tempoPreparoMinutos: number): KdsCalculo {
    if (!dataHoraInclusao || !tempoPreparoMinutos) {
        return { status: 'NORMAL', minutosRestantes: 0 };
    }

    const agora = new Date().getTime();
    const inclusao = new Date(dataHoraInclusao).getTime();

    // Prazo = Inclusão + (Minutos em Milissegundos)
    const prazo = inclusao + (tempoPreparoMinutos * 60000);
    const tempoRestanteMs = prazo - agora;

    // Arredonda para cima para não mostrar "0 minutos" antes da hora
    const minutosRestantes = Math.ceil(tempoRestanteMs / 60000);

    if (minutosRestantes < 0) {
        return { status: 'ATRASADO', minutosRestantes };
    }

    // Alerta quando resta apenas 25% do tempo ou menos
    const limiteAlerta = tempoPreparoMinutos * 0.25;
    if (minutosRestantes <= limiteAlerta) {
        return { status: 'ALERTA', minutosRestantes };
    }

    return { status: 'NORMAL', minutosRestantes };
}