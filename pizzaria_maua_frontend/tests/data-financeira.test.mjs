import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { dataFinanceira, RelogioFinanceiro, chaveFaturamento, chaveIndicadores } from '../src/services/dataFinanceira.ts';
import { consultarFaturamento } from '../src/services/consultasOperacionais.ts';

function relogio(iso = '2026-11-20T02:59:59.999Z') {
    let instante = new Date(iso), proximo = 0;
    const timers = new Map(), janela = new EventTarget(), documento = new EventTarget();
    const r = new RelogioFinanceiro({ agora: () => instante, janela, documento,
        agendar: (callback, atraso) => { const id = ++proximo; timers.set(id,{ callback, atraso }); return id; }, cancelar: id => timers.delete(id) });
    return { r, timers, janela, documento, agora: iso => { instante = new Date(iso); } };
}

test('FE015: dia civil financeiro muda na meia-noite de Sao Paulo sem deslocamento UTC', () => {
    assert.equal(dataFinanceira(new Date('2026-11-20T02:59:59.999Z')),'2026-11-19');
    assert.equal(dataFinanceira(new Date('2026-11-20T03:00:00.000Z')),'2026-11-20');
    assert.equal(dataFinanceira(new Date('2028-03-01T02:59:59Z')),'2028-02-29');
});
test('FE015: timezone do dispositivo nao altera o dia da pizzaria', () => {
    const anterior = process.env.TZ;
    try {
        for (const TZ of ['Asia/Tokyo','Pacific/Honolulu','UTC']) {
            process.env.TZ = TZ; assert.equal(dataFinanceira(new Date('2026-11-20T02:30:00Z')),'2026-11-19');
        }
    } finally { if (anterior === undefined) delete process.env.TZ; else process.env.TZ = anterior; }
});
test('FE015: timer alinhado a virada publica nova data e atualiza ambas as chaves financeiras', () => {
    const s = relogio(); let notificacoes = 0; const remover = s.r.assinar(()=>notificacoes++);
    const antigo = s.r.obterData(), timer = [...s.timers.values()][0]; assert.equal(timer.atraso,1);
    s.agora('2026-11-20T03:00:00Z'); timer.callback();
    assert.equal(notificacoes,1); assert.equal(s.r.obterData(),'2026-11-20');
    assert.notDeepEqual(chaveFaturamento(antigo),chaveFaturamento(s.r.obterData()));
    assert.notDeepEqual(chaveIndicadores(antigo),chaveIndicadores(s.r.obterData()));
    remover(); assert.equal(s.timers.size,0);
});
test('FE015: foco, pageshow e visibilidade recuperam dia apos suspensao sem notificacoes repetidas', () => {
    const s = relogio(); let notificacoes = 0; const remover = s.r.assinar(()=>notificacoes++);
    s.agora('2026-11-22T15:00:00Z'); s.janela.dispatchEvent(new Event('focus'));
    assert.equal(s.r.obterData(),'2026-11-22'); assert.equal(notificacoes,1);
    s.janela.dispatchEvent(new Event('pageshow')); s.documento.dispatchEvent(new Event('visibilitychange'));
    assert.equal(notificacoes,1); assert.equal(s.timers.size,1);
    remover(); s.agora('2026-11-23T15:00:00Z'); s.janela.dispatchEvent(new Event('focus'));
    assert.equal(notificacoes,1); assert.equal(s.timers.size,0);
});
test('FE015: remonta como Strict Mode sem acumular timers e nao atualiza consultas a cada minuto', () => {
    const s = relogio(); let atualizacoes = 0;
    const primeira = s.r.assinar(()=>atualizacoes++); primeira();
    const segunda = s.r.assinar(()=>atualizacoes++); assert.equal(s.timers.size,1);
    s.agora('2026-11-20T02:59:59.999Z'); [...s.timers.values()][0].callback(); assert.equal(atualizacoes,0);
    segunda(); assert.equal(s.timers.size,0);
});
test('FE015: falha HTTP no novo dia nao reutiliza faturamento anterior nem inventa zero; retry de leitura recupera', async () => {
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const antigo = '2026-11-19', novo = '2026-11-20'; let falhar = true; const datas = [];
    cache.setQueryData(chaveFaturamento(antigo),42);
    cache.setQueryData(['pedidos','finalizados','2026-01-01'],[{ id: 9 }]);
    const http = axios.create({ adapter: async config => {
        assert.equal(config.method,'get'); datas.push(config.params.data);
        if (falhar) throw { config, response: { status: 500 } };
        return { config, status: 200, headers: {}, data: 0 };
    } });
    const opcoes = { queryKey: chaveFaturamento(novo), queryFn: ({ signal }) => consultarFaturamento(http,novo,signal) };
    await assert.rejects(cache.fetchQuery(opcoes));
    assert.equal(cache.getQueryState(chaveFaturamento(novo)).status,'error'); assert.equal(cache.getQueryData(chaveFaturamento(novo)),undefined);
    assert.equal(cache.getQueryData(chaveFaturamento(antigo)),42);
    assert.deepEqual(cache.getQueryData(['pedidos','finalizados','2026-01-01']),[{ id: 9 }]);
    falhar = false; assert.equal(await cache.fetchQuery(opcoes),0); assert.deepEqual(datas,[novo,novo]); cache.clear();
});
test('FE015: resposta atrasada do dia anterior permanece no periodo antigo', async () => {
    const cache = new QueryClient(); let resolver;
    const anterior = cache.fetchQuery({ queryKey: chaveFaturamento('2026-11-19'), queryFn: () => new Promise(r => { resolver = r; }) });
    await cache.fetchQuery({ queryKey: chaveFaturamento('2026-11-20'), queryFn: async () => 5 });
    resolver(42); await anterior;
    assert.equal(cache.getQueryData(chaveFaturamento('2026-11-20')),5);
    assert.equal(cache.getQueryData(chaveFaturamento('2026-11-19')),42); cache.clear();
});
