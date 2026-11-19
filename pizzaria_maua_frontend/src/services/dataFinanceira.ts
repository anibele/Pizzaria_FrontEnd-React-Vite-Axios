const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dataFinanceira(agora = new Date()): string {
    const partes = formatoDia.formatToParts(agora);
    const obter = (tipo: string) => partes.find(p => p.type === tipo)!.value;
    return `${obter('year')}-${obter('month')}-${obter('day')}`;
}
export const chaveFaturamento = (dia: string) => ['faturamento', dia] as const;
export const chaveIndicadores = (dia: string) => ['dashboard-indicadores', dia] as const;

type Eventos = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
interface OpcoesRelogio {
    agora?: () => Date;
    janela?: Eventos;
    documento?: Eventos;
    agendar?: (callback: () => void, atraso: number) => ReturnType<typeof setTimeout>;
    cancelar?: (timer: ReturnType<typeof setTimeout>) => void;
}

// Checagem local alinhada ao minuto: não consulta a API nem cria polling financeiro extra.
export class RelogioFinanceiro {
    private agora: () => Date;
    private valor: string;
    private ouvintes = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private opcoes: OpcoesRelogio;
    constructor(opcoes: OpcoesRelogio = {}) {
        this.opcoes = opcoes; this.agora = opcoes.agora || (() => new Date()); this.valor = dataFinanceira(this.agora());
    }
    obterData = () => this.valor;
    private reagendar() {
        if (this.timer !== undefined) (this.opcoes.cancelar || clearTimeout)(this.timer);
        this.timer = undefined;
        if (this.ouvintes.size) this.timer = (this.opcoes.agendar || setTimeout)(this.verificar, 60000 - this.agora().getTime() % 60000);
    }
    verificar = () => {
        const dia = dataFinanceira(this.agora());
        if (dia !== this.valor) { this.valor = dia; this.ouvintes.forEach(o => o()); }
        this.reagendar();
    };
    assinar = (ouvinte: () => void) => {
        this.ouvintes.add(ouvinte);
        if (this.ouvintes.size === 1) {
            this.opcoes.janela?.addEventListener('focus', this.verificar);
            this.opcoes.janela?.addEventListener('pageshow', this.verificar);
            this.opcoes.documento?.addEventListener('visibilitychange', this.verificar);
            this.verificar();
        }
        return () => {
            this.ouvintes.delete(ouvinte);
            if (!this.ouvintes.size) {
                this.opcoes.janela?.removeEventListener('focus', this.verificar);
                this.opcoes.janela?.removeEventListener('pageshow', this.verificar);
                this.opcoes.documento?.removeEventListener('visibilitychange', this.verificar);
                this.reagendar();
            }
        };
    };
}
