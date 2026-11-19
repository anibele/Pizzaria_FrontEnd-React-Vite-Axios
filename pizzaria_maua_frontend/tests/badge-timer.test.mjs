import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BadgeTimerKds from '../src/componentes/BadgeTimerKds.tsx';
import { calcularPrioridadeKds } from '../src/services/kdsCalculadora.ts';

// O badge recebe o status calculado; os limites pertencem à calculadora utilizada pela cozinha.
const inclusao = '2026-11-19T15:00:00Z';
for (const [nome, decorrido, status, minutos, texto, icone] of [
    ['normal', 0, 'NORMAL', 20, '20m restantes', 'clock'],
    ['antes do alerta', 14, 'NORMAL', 6, '6m restantes', 'clock'],
    ['limite inclusivo de 25%', 15, 'ALERTA', 5, '5m restantes', 'triangle-alert'],
    ['dentro do alerta', 19, 'ALERTA', 1, '1m restantes', 'triangle-alert'],
    ['zero ainda não está atrasado', 20, 'ALERTA', 0, '0m restantes', 'triangle-alert'],
    ['fração negativa arredondada para zero', 20.5, 'ALERTA', -0, '0m restantes', 'triangle-alert'],
    ['primeiro minuto negativo', 21, 'ATRASADO', -1, 'Atrasado 1m', 'flame'],
    ['atraso negativo usa valor absoluto', 27, 'ATRASADO', -7, 'Atrasado 7m', 'flame'],
]) {
    test(`FE018 BadgeTimerKds: ${nome}`, t => {
        t.mock.timers.enable({ apis: ['Date'], now: Date.parse(inclusao) + decorrido * 60000 });
        const calculo = calcularPrioridadeKds(inclusao, 20);
        assert.equal(calculo.status, status);
        assert.equal(calculo.minutosRestantes, minutos);
        const html = renderToStaticMarkup(createElement(BadgeTimerKds, calculo));
        assert.match(html, new RegExp(`class="badge-timer ${status.toLowerCase()}"`));
        assert.ok(html.includes(`<span>${texto}</span>`));
        assert.ok(html.includes(`lucide-${icone}`));
    });
}

test('FE018 BadgeTimerKds: ausência de tempo mantém zero normal previsto pelo contrato', () => {
    const html = renderToStaticMarkup(createElement(BadgeTimerKds, calcularPrioridadeKds('', 0)));
    assert.match(html, /class="badge-timer normal"/);
    assert.match(html, /<span>0m restantes<\/span>/);
});
