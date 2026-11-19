import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { adaptarParaCaixa } from '../src/services/adapter.ts';
import { recuperarCarrinho } from '../src/services/carrinhoPersistido.ts';
import { GestorAdicao } from '../src/services/adicaoPendente.ts';
import { CHAVE_ADICAO_PENDENTE } from '../src/services/sessaoAdicao.ts';
import { GestorAbertura, CHAVE_ABERTURA_PENDENTE } from '../src/services/aberturaPendente.ts';
import { ModalDetalhesPedido } from '../src/componentes/ModalDetalhesPedido.tsx';
import CardPedidoCozinha from '../src/componentes/CardPedidoCozinha.tsx';

const item = { id: 31, produtoId: 4, produtoNome: 'Pizza <Especial>', quantidade: 2, precoUnitario: 17.25,
    status: 'PENDENTE', dataHoraInclusao: '2026-11-19T19:00:00', tempoPreparoMinutos: 20, dataHoraConclusao: null };
const pedido = patch => ({ id: 15, numeroMesa: 7, dataHora: '2026-11-19T19:00:00', status: 'ABERTO', formaPagamento: null, faturamento: 34.5, itens: [{ ...item }], ...patch });
const produto = { id: 4, nome: 'Pizza Mauá', categoria: 'PIZZAS', descricao: null, precoBase: 19.5, imagemUrl: '', ativo: true, qtdEstoque: 10 };

test('FE014: adaptador consome numeroMesa e campos achatados do DTO real', () => {
    const resultado = adaptarParaCaixa(pedido());
    assert.equal(resultado.numeroMesa, 7); assert.equal(resultado.itens[0].produtoId, 4);
    assert.equal(resultado.itens[0].produtoNome, item.produtoNome); assert.equal(resultado.itens[0].precoUnitario, 17.25);
    assert.equal(resultado.faturamento, 34.5); assert.equal(resultado.formaPagamento, null);
});
test('FE014: total nulo usa precos historicos dos itens; zero legitimo nao e substituido', () => {
    assert.equal(adaptarParaCaixa(pedido({ faturamento: null })).faturamento, 34.5);
    assert.equal(adaptarParaCaixa(pedido({ faturamento: 0 })).faturamento, 0);
    assert.equal(item.dataHoraConclusao, null);
});
test('FE014: estados reais sao mantidos e estrutura antiga nao fabrica campos ou zeros', () => {
    for (const status of ['ABERTO','AGUARDANDO_PAGAMENTO','FINALIZADO']) assert.equal(adaptarParaCaixa(pedido({ status })).status, status);
    for (const p of [pedido({ numeroMesa: undefined, mesa: { numero: 7 } }), pedido({ status: 'CANCELADO' }),
        pedido({ itens: [{ produto: { id: 4, nome: 'Antigo', precoBase: 99 }, quantidade: 1 }] }), pedido({ itens: [{}] })]) {
        assert.throws(() => adaptarParaCaixa(p), /incompatíveis/);
    }
});
test('FE014: modal consome DTO transformado com numero, nome e preco corretos', () => {
    const html = renderToStaticMarkup(createElement(ModalDetalhesPedido, { isOpen: true, onClose() {}, pedido: adaptarParaCaixa(pedido()) }));
    assert.match(html,/Mesa 7/); assert.match(html,/Pizza &lt;Especial&gt;/); assert.match(html,/34\.50/);
    assert.doesNotMatch(html,/Item sem nome/);
});
test('FE014: cozinha consome o mesmo DTO com formaPagamento nula e metadados de preparo', () => {
    const html = renderToStaticMarkup(createElement(CardPedidoCozinha, { pedido: pedido(), operacoes: {}, onMarcarComoEntregue() {}, onVerificar() {} }));
    assert.match(html,/MESA 7/); assert.match(html,/Pizza &lt;Especial&gt;/); assert.match(html,/2x/);
});
test('FE014: carrinho valido preserva dados e aceita descricao nula ou opcional', () => {
    for (const descricao of [null, undefined, { breveDescricao: null, tempoMedioPreparo: '20 min', pratoVegano: false, ingredientes: null }]) {
        const dados = [{ produto: { ...produto, descricao }, quantidade: 2 }]; const raw = JSON.stringify(dados);
        const recuperado = recuperarCarrinho(raw);
        assert.equal(recuperado.erro,null); assert.deepEqual(recuperado.itens,JSON.parse(raw)); assert.equal(JSON.stringify(dados),raw);
    }
    assert.deepEqual(recuperarCarrinho(null),{ itens: [], erro: null });
});
test('FE014: JSON corrompido e estruturas incompativeis ficam bloqueados em vez de serem enviados', () => {
    const valido = { produto, quantidade: 1 };
    for (const raw of ['{', 'null', '{}', '[null]', JSON.stringify([{ ...valido, quantidade: 0 }]),
        JSON.stringify([{ ...valido, quantidade: '2' }]), JSON.stringify([{ produto: {}, quantidade: 1 }]),
        JSON.stringify([valido,valido]), JSON.stringify([{ ...valido, produto: { ...produto, precoBase: '10' } }])]) {
        const resultado = recuperarCarrinho(raw); assert.ok(resultado.erro); assert.deepEqual(resultado.itens,[]);
    }
});
test('FE014: carrinho invalido nao remove nem libera registros incertos malformados', async () => {
    const memoria = new Map([[CHAVE_ADICAO_PENDENTE,'{'],[CHAVE_ABERTURA_PENDENTE,'{}']]);
    const storage = { getItem: k => memoria.get(k) ?? null, setItem: (k,v) => memoria.set(k,v), removeItem: k => memoria.delete(k) };
    const contexto = { sessao: 'original', username: 'clienteA', role: 'MESA', numeroMesa: 7 };
    const adicao = new GestorAdicao(storage,contexto,()=>contexto), abertura = new GestorAbertura(storage,contexto,()=>contexto);
    assert.ok(recuperarCarrinho('{').erro);
    await adicao.enviar(15,[{ produtoId: 4, quantidade: 1 }],()=>assert.fail(),()=>assert.fail());
    await abertura.enviar([{ produtoId: 4, quantidade: 1 }],()=>assert.fail(),()=>assert.fail());
    assert.equal(adicao.obterEstado().bloqueada,true); assert.equal(abertura.obterEstado().protegida,true);
    assert.equal(memoria.get(CHAVE_ADICAO_PENDENTE),'{'); assert.equal(memoria.get(CHAVE_ABERTURA_PENDENTE),'{}');
});
