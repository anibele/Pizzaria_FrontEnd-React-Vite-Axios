import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { imprimirComanda } from '../src/services/gerarComanda.ts';
import { adaptarParaCaixa } from '../src/services/adapter.ts';

const pedidoBase = () => ({
    id: 15, numeroMesa: 1, dataHora: '2026-11-18T18:30:00', status: 'FINALIZADO', formaPagamento: 'PIX', faturamento: 48,
    itens: [{ produtoId: 3, produtoNome: 'Pizza Margherita', quantidade: 2, precoUnitario: 19.95 },
        { produtoId: 4, produtoNome: 'Suco de maçã', quantidade: 1, precoUnitario: 8.1 }],
});

// Captura a saída do serviço real, sem abrir janela nem imprimir fisicamente.
function simularImpressao(pedido, bloquearPopup = false) {
    let html = '', documentosFechados = 0, impressões = 0, janelasFechadas = 0;
    const aberturas = [], avisos = [];
    const popup = {
        document: { write: texto => { html += texto; }, close: () => { documentosFechados++; } },
        print: () => { impressões++; }, close: () => { janelasFechadas++; },
    };
    const windowAnterior = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const alertAnterior = Object.getOwnPropertyDescriptor(globalThis, 'alert');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        screen: { width: 1920, height: 1080 },
        open: (...args) => { aberturas.push(args); return bloquearPopup ? null : popup; },
    } });
    Object.defineProperty(globalThis, 'alert', { configurable: true, value: aviso => { avisos.push(aviso); } });
    try { imprimirComanda(pedido); }
    finally {
        if (windowAnterior) Object.defineProperty(globalThis, 'window', windowAnterior); else delete globalThis.window;
        if (alertAnterior) Object.defineProperty(globalThis, 'alert', alertAnterior); else delete globalThis.alert;
    }
    return { html, popup, aberturas, avisos, documentosFechados,
        get impressões() { return impressões; }, get janelasFechadas() { return janelasFechadas; } };
}

test('FE-001: nome contendo img e evento chega ao documento como texto escapado', () => {
    const pedido = pedidoBase();
    pedido.itens[0].produtoNome = '<img src=x onerror="window.__testeInjecao=true">';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes('<td class="col-nome">&lt;img src=x onerror=&quot;window.__testeInjecao=true&quot;&gt;</td>'));
    assert.doesNotMatch(html, /<img\b/i);
    assert.equal((html.match(/<script\b/gi) || []).length, 1); // Apenas o script fixo de impressão.
});

test('nomes comuns, acentos e emoji permanecem intactos na comanda', () => {
    const pedido = pedidoBase(); pedido.itens[0].produtoNome = 'Pizza Mauá, maçã e açaí 🍕';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes('<td class="col-nome">Pizza Mauá, maçã e açaí 🍕</td>'));
    assert.ok(html.includes('<td class="col-nome">Suco de maçã</td>'));
});

test('nome com os cinco caracteres HTML especiais preserva sua representacao textual', () => {
    const pedido = pedidoBase(); pedido.itens[0].produtoNome = 'Pizza <Especial> & "Queijo" d\'água';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes('<td class="col-nome">Pizza &lt;Especial&gt; &amp; &quot;Queijo&quot; d&#39;água</td>'));
    assert.doesNotMatch(html, /<Especial>/);
});

test('fechamento de celulas, script e tags sintéticas nao alteram a estrutura gerada', () => {
    const pedido = pedidoBase();
    pedido.itens[0].produtoNome = '</td></tr></tbody></table><script>window.__testeInjecao=true</script><svg onload="window.__testeInjecao=true">';
    const { html } = simularImpressao(pedido);
    assert.equal((html.match(/<table>/g) || []).length, 1);
    assert.equal((html.match(/<tbody>/g) || []).length, 1);
    assert.equal((html.match(/<tr>/g) || []).length, 3);
    assert.equal((html.match(/<td\b/g) || []).length, 6);
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.doesNotMatch(html, /<svg\b|<script>window\.__testeInjecao/i);
    assert.ok(html.includes('&lt;/td&gt;&lt;/tr&gt;&lt;/tbody&gt;&lt;/table&gt;&lt;script&gt;'));
});

test('mesa e titulo nao permitem sair do contexto textual mesmo com tipo inesperado da API', () => {
    const pedido = pedidoBase(); pedido.numeroMesa = '</title><img src=x onerror="window.__testeInjecao=true">';
    const { html } = simularImpressao(pedido);
    const mesa = '&lt;/title&gt;&lt;img src=x onerror=&quot;window.__testeInjecao=true&quot;&gt;';
    assert.ok(html.includes(`<title>Cupom - Mesa ${mesa}</title>`));
    assert.ok(html.includes(`<h3>MESA ${mesa}</h3>`));
    assert.equal((html.match(/<\/title>/g) || []).length, 1);
    assert.doesNotMatch(html, /<img\b/i);
});

test('status e pagamento recebidos da API sao inseridos como texto', () => {
    const pedido = pedidoBase();
    pedido.status = '<b>FINALIZADO</b> & "ok"';
    pedido.formaPagamento = '<img src=x onerror="window.__testeInjecao=true"> d\'água';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes('STATUS: &lt;b&gt;FINALIZADO&lt;/b&gt; &amp; &quot;ok&quot;</p>'));
    assert.ok(html.includes('PAGAMENTO: &lt;img src=x onerror=&quot;window.__testeInjecao=true&quot;&gt; d&#39;água</p>'));
    assert.doesNotMatch(html, /<img\b|<b>FINALIZADO/i);
});

test('quantidade inesperada nao injeta celulas ou elementos ativos', () => {
    const pedido = pedidoBase(); pedido.itens[0].quantidade = '2</td><img src=x>';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes('<td class="col-qtd">2&lt;/td&gt;&lt;img src=x&gt;x</td>'));
    assert.doesNotMatch(html, /<img\b/i);
    assert.equal((html.match(/<td\b/g) || []).length, 6);
});

test('quantidades, subtotais, faturamento, data e status validos mantem a formatacao', () => {
    const pedido = pedidoBase(); const { html } = simularImpressao(pedido);
    assert.ok(html.includes('<td class="col-qtd">2x</td>'));
    assert.ok(html.includes('<td class="col-qtd">1x</td>'));
    assert.ok(html.includes('<td class="col-preco">R$ 39.90</td>'));
    assert.ok(html.includes('<td class="col-preco">R$ 8.10</td>'));
    assert.ok(html.includes('<span>R$ 48.00</span>'));
    assert.ok(html.includes(`DATA: ${new Date(pedido.dataHora).toLocaleString('pt-BR')}</p>`));
    assert.ok(html.includes('STATUS: FINALIZADO</p>'));
    assert.ok(html.includes('PAGAMENTO: PIX</p>'));
    assert.equal((html.match(/<thead>/g) || []).length, 1);
    assert.equal((html.match(/<tbody>/g) || []).length, 1);
    assert.ok(html.includes('class="col-qtd text-left">QTD'));
    assert.ok(html.includes('class="col-nome text-left">ITEM'));
    assert.ok(html.includes('class="col-preco">TOTAL'));
});

test('data com marcacao e convertida por Date e nao e interpolada como HTML original', () => {
    const pedido = pedidoBase(); pedido.dataHora = '<img src=x onerror="window.__testeInjecao=true">';
    const { html } = simularImpressao(pedido);
    assert.ok(html.includes(`DATA: ${new Date(pedido.dataHora).toLocaleString('pt-BR')}</p>`));
    assert.doesNotMatch(html, /<img\b/i);
});

test('entidades literais, nomes vazios e nomes longos nao sao removidos nem decodificados', () => {
    for (const [nome, esperado] of [['', ''], ['Pizza &lt;Especial&gt;', 'Pizza &amp;lt;Especial&amp;gt;'],
        ['Mauá '.repeat(1000), 'Mauá '.repeat(1000)]]) {
        const pedido = pedidoBase(); pedido.itens[0].produtoNome = nome;
        const { html } = simularImpressao(pedido);
        assert.ok(html.includes(`<td class="col-nome">${esperado}</td>`));
    }
});

test('valores opcionais da impressao continuam validos; adaptador recusa DTO sem campos reais', () => {
    for (const pagamento of [null, undefined, '']) {
        const pedido = pedidoBase(); pedido.numeroMesa = null; pedido.formaPagamento = pagamento;
        const { html } = simularImpressao(pedido);
        assert.ok(html.includes('<title>Cupom - Mesa Avulsa</title>'));
        assert.ok(html.includes('<h3>MESA AVULSA</h3>'));
        assert.ok(html.includes(`PAGAMENTO: ${pagamento ?? 'NÃO INFORMADA'}</p>`));
    }
    assert.throws(() => adaptarParaCaixa({ id: 15, numeroMesa: 1, dataHora: '2026-11-18T18:30:00', status: 'FINALIZADO', itens: [{}] }), /incompatíveis/);
});

test('janela recebe documento completo e script fixo imprime e fecha na ordem existente', () => {
    const fluxo = simularImpressao(pedidoBase());
    assert.deepEqual(fluxo.aberturas, [['', '', 'width=450,height=700,top=190,left=735']]);
    assert.equal(fluxo.documentosFechados, 1); assert.deepEqual(fluxo.avisos, []);
    assert.ok(fluxo.html.includes('<!DOCTYPE html>')); assert.ok(fluxo.html.includes('</html>'));
    assert.ok(fluxo.html.includes('width: 300px')); assert.ok(fluxo.html.includes('@media print'));
    const script = fluxo.html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const timers = [];
    runInNewContext(script, { window: fluxo.popup, setTimeout: (callback, delay) => { timers.push({ callback, delay }); } });
    assert.equal(timers.length, 1); assert.equal(timers[0].delay, 300);
    assert.equal(fluxo.impressões, 0); timers[0].callback(); assert.equal(fluxo.impressões, 1);
    assert.equal(fluxo.janelasFechadas, 0); fluxo.popup.onafterprint(); assert.equal(fluxo.janelasFechadas, 1);
});

test('popup bloqueado preserva aviso e nao tenta escrever ou imprimir', () => {
    const fluxo = simularImpressao(pedidoBase(), true);
    assert.deepEqual(fluxo.avisos, ['Por favor, permita os pop-ups para imprimir a comanda.']);
    assert.equal(fluxo.html, ''); assert.equal(fluxo.documentosFechados, 0);
    assert.equal(fluxo.impressões, 0); assert.equal(fluxo.janelasFechadas, 0);
});
