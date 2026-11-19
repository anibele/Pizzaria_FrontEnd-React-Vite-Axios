import { useState, useSyncExternalStore } from 'react';
import { RelogioFinanceiro } from '../services/dataFinanceira';

export function useDataFinanceira() {
    const [relogio] = useState(() => new RelogioFinanceiro({
        janela: typeof window !== 'undefined' ? window : undefined,
        documento: typeof document !== 'undefined' ? document : undefined,
    }));
    return useSyncExternalStore(relogio.assinar, relogio.obterData, relogio.obterData);
}
