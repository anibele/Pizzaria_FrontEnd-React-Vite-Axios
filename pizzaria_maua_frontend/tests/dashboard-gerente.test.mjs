import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { dataFinanceira, chaveFaturamento } from '../src/services/dataFinanceira.ts';

registerHooks({
    resolve(specifier, context, next) {
        if (/^primereact\/[^/]+$/.test(specifier)) return next(`${specifier}/${specifier.split('/')[1]}.cjs.js`, context);
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.endsWith('/src/services/api.ts')) return { format: 'module', shortCircuit: true,
            source: 'export default { get: async () => { throw new Error("Rede bloqueada no teste SSR"); } };' };
        return next(url, context);
    },
});
const { default: DashboardGerente } = await import('../src/pages/DashboardGerente.tsx');
function preparar(t) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-20T02:59:59Z') });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: Infinity } } });
    t.after(() => cache.clear());
    return { cache, chave: chaveFaturamento(dataFinanceira()),
        renderizar: () => renderToStaticMarkup(createElement(QueryClientProvider, { client: cache },
            createElement(MemoryRouter, null, createElement(DashboardGerente)))) };
}

test('Gerente financeiro: loading não apresenta zero como valor confirmado', t => {
    const s = preparar(t), html = s.renderizar();
    assert.match(html, /Carregando/); assert.doesNotMatch(html, /R\$ 0\.00/);
    assert.doesNotMatch(html, /Atualizar faturamento/);
});
for (const valor of [0, 123.45]) test(`Gerente financeiro: sucesso válido ${valor}`, t => {
    const s = preparar(t); s.cache.setQueryData(s.chave, valor);
    const html = s.renderizar();
    assert.ok(html.includes(`R$ ${valor.toFixed(2)}`)); assert.doesNotMatch(html, /Indisponível/);
    assert.doesNotMatch(html, /Atualizar faturamento/);
});
test('Gerente financeiro: erro inicial oferece recuperação e não inventa zero', async t => {
    const s = preparar(t);
    await assert.rejects(s.cache.fetchQuery({ queryKey: s.chave, queryFn: async () => { throw new Error('Falha sintética'); } }));
    const html = s.renderizar();
    assert.match(html, /Indisponível/); assert.match(html, /Atualizar faturamento/); assert.doesNotMatch(html, /R\$ 0\.00/);
});
test('Gerente financeiro: erro após sucesso não apresenta cache antigo como atual', async t => {
    const s = preparar(t); s.cache.setQueryData(s.chave, 245);
    await assert.rejects(s.cache.fetchQuery({ queryKey: s.chave, queryFn: async () => { throw new Error('Falha sintética'); } }));
    assert.equal(s.cache.getQueryData(s.chave), 245);
    const html = s.renderizar();
    assert.match(html, /Indisponível/); assert.doesNotMatch(html, /R\$ 245\.00|R\$ 0\.00/);
    assert.match(html, /Atualizar faturamento/);
});
test('Gerente financeiro: data do dispositivo não escolhe a chave do faturamento', t => {
    const tz = process.env.TZ;
    t.after(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });
    process.env.TZ = 'Asia/Tokyo';
    const s = preparar(t); s.cache.setQueryData(chaveFaturamento('2026-11-19'), 119); s.cache.setQueryData(chaveFaturamento('2026-11-20'), 220);
    const html = s.renderizar(); assert.match(html, /R\$ 119\.00/); assert.doesNotMatch(html, /R\$ 220\.00/);
});
