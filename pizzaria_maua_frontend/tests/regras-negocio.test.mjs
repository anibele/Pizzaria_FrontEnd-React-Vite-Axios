import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motivoNovosItens, podeSolicitarPagamento, produtoDisponivel, adicionarUnidade, motivoSelecao } from '../src/services/regrasCardapio.ts';
import CardProduto from '../src/componentes/CardProduto.tsx';
import PedidoMesa from '../src/componentes/PedidoMesa.tsx';
import ComandaMesa from '../src/componentes/ComandaMesa.tsx';
import { GestorAdicao, enviarAdicao } from '../src/services/adicaoPendente.ts';
import { CHAVE_ADICAO_PENDENTE } from '../src/services/sessaoAdicao.ts';
import { GestorAbertura, CHAVE_ABERTURA_PENDENTE } from '../src/services/aberturaPendente.ts';
const mesa = patch => ({ id: 1, numero: 7, ativo: true, status: 'OCUPADA', ...patch });
const pedido = patch => ({ id: 15, numeroMesa: 7, status: 'ABERTO', dataHora: '2026-11-19T19:00:00', formaPagamento: null, faturamento: 10, itens: [], ...patch });
const produto = patch => ({ id: 4, nome: 'Pizza', categoria: 'PIZZAS', precoBase: 10, imagemUrl: '/imagem-sintetica.png', ativo: true, qtdEstoque: 2, ...patch });
const item = { id: 31, produtoId: 4, produtoNome: 'Pizza', quantidade: 1, precoUnitario: 10, status: 'PENDENTE', dataHoraInclusao: '2026-11-19T19:00:00', tempoPreparoMinutos: 20, dataHoraConclusao: null };
const contexto = { sessao: 'nonce-original', username: 'clienteA', role: 'MESA', numeroMesa: 7 };
function memoria() { const dados = new Map(); return { dados, getItem: k => dados.get(k) ?? null, setItem: (k,v) => dados.set(k,v), removeItem: k => dados.delete(k) }; }

test('FE012: somente mesa ativa LIVRE abre pedido; pedido ABERTO requer mesa OCUPADA correspondente', () => {
    assert.equal(motivoNovosItens(mesa({ status: 'LIVRE' }),null),null);
    assert.equal(motivoNovosItens(mesa(),pedido()),null);
    for (const [m,p] of [[mesa({ ativo: false }),pedido()], [mesa({ status: 'OCUPADA' }),null],
        [mesa({ status: 'RESERVADA' }),null], [mesa({ status: 'MANUTENCAO' }),null],
        [mesa(),pedido({ status: 'AGUARDANDO_PAGAMENTO' })], [mesa(),pedido({ status: 'FINALIZADO' })],
        [mesa({ status: 'LIVRE' }),pedido()], [mesa(),pedido({ numeroMesa: 9 })], [undefined,undefined]]) assert.ok(motivoNovosItens(m,p));
});
test('Pagamento exige itens PRONTO e preserva estado e mesa', () => {
    for (const estados of [[], ['PENDENTE'], ['EM_PREPARO'], ['PENDENTE','PRONTO'], ['EM_PREPARO','PRONTO'], ['PRONTO','PRONTO']]) {
        const itens = estados.map(status => ({ ...item, status }));
        const pronto = estados.length > 0 && estados.every(status => status === 'PRONTO');
        assert.equal(podeSolicitarPagamento(mesa(),pedido({ itens })),pronto);
    }
    const itens = [{ ...item, status: 'PRONTO' }];
    for (const p of [null,pedido({ itens, status: 'AGUARDANDO_PAGAMENTO' }),pedido({ itens, status: 'FINALIZADO' }),pedido({ itens, numeroMesa: 9 })]) assert.equal(podeSolicitarPagamento(mesa(),p),false);
    for (const m of [mesa({ ativo: false }),mesa({ status: 'LIVRE' }),undefined]) assert.equal(podeSolicitarPagamento(m,pedido({ itens })),false);
});

test('Comanda real bloqueia preparo e libera somente itens prontos com demais permissoes', () => {
    for (const estados of [[], ['PENDENTE'], ['EM_PREPARO'], ['PENDENTE','PRONTO'], ['PRONTO','PRONTO']]) {
        const pronto = estados.length > 0 && estados.every(status => status === 'PRONTO');
        const props = { itensConsumidos: estados.map(status => ({ ...item, status })), todosItensProntos: pronto, onAbrirPagamento() {} };
        const html = renderToStaticMarkup(createElement(ComandaMesa, props));
        assert.equal(html.includes('disabled=""'), !pronto);
        if (!pronto) assert.match(html,/O pagamento ser\u00e1 liberado/);
        for (const extra of [{ pagamentoPermitido: false },{ aguardandoPagamento: true }]) {
            assert.match(renderToStaticMarkup(createElement(ComandaMesa,{ ...props, ...extra })),/disabled=""/);
        }
    }
    // A guarda do handler protege inclusive uma invocacao direta sem clicar no botao.
    for (const pronto of [false,true]) {
        let chamadas = 0;
        const arvore = ComandaMesa({ itensConsumidos: [{ ...item, status: pronto ? 'PRONTO' : 'PENDENTE' }], todosItensProntos: pronto, onAbrirPagamento() { chamadas++; } });
        arvore.props.children.at(-1).props.onClick();
        assert.equal(chamadas, pronto ? 1 : 0);
    }
});
test('FE012: estoque e atividade sao verificados para todas as categorias sem excecao inventada', () => {
    for (const categoria of ['PIZZAS','BEBIDAS','SOBREMESAS','ACOMPANHAMENTOS']) {
        assert.equal(produtoDisponivel(produto({ categoria }),2),true);
        assert.equal(produtoDisponivel(produto({ categoria, qtdEstoque: 0 })),false);
        assert.equal(produtoDisponivel(produto({ categoria, ativo: false })),false);
        assert.equal(produtoDisponivel(produto({ categoria }),3),false);
    }
});
test('FE012: card real desabilita adicionar produto sem estoque ou mesa bloqueada', () => {
    for (const props of [{ produto: produto({ qtdEstoque: 0 }) }, { produto: produto({ ativo: false }) }, { produto: produto(), bloqueado: true }]) {
        const html = renderToStaticMarkup(createElement(CardProduto,{ ...props, onVerDetalhes() {}, onAdicionar() {} }));
        assert.match(html,/class="btn btn-accent" disabled=""/);
    }
});
test('FE012: atualizacao funcional usada no carrinho impede ultrapassar estoque com toques repetidos', () => {
    let itens = [];
    for (let toque = 0; toque < 10; toque++) itens = adicionarUnidade(itens,produto());
    assert.equal(itens.length,1); assert.equal(itens[0].quantidade,2);
    assert.equal(adicionarUnidade(itens,produto()),itens);
});
test('FE012: selecao e revalidada contra catalogo atual, incluindo quantidade acumulada', () => {
    const itens = [{ produto: produto(), quantidade: 2 }];
    assert.equal(motivoSelecao(itens,[produto()]),null);
    assert.ok(motivoSelecao(itens,[produto({ qtdEstoque: 1 })])); assert.ok(motivoSelecao(itens,[]));
    assert.ok(motivoSelecao([...itens,...itens],[produto()])); assert.ok(motivoSelecao(itens,[produto({ ativo: false })]));
    assert.equal(itens[0].quantidade,2);
});
test('FE012: pedido aguardando pagamento bloqueia novo envio, mas UI mantem retry seguro da intencao pendente', () => {
    const base = { carrinho: [{ produto: produto(), quantidade: 1 }], criando: false, adicionando: false,
        pedidoAtivo: pedido({ status: 'AGUARDANDO_PAGAMENTO' }), itensConsumidos: [item], possuiItensConsumidos: true, todosItensProntos: false,
        onRemoverOuDiminuir() {}, onAdicionarAoCarrinho() {}, onEnviarParaCozinha() {}, onAbrirPagamento() {}, onRevisarAdicao() {},
        adicaoPendente: false, mensagemAdicao: null, reenvioPermitido: false, podeRevisarAdicao: false, motivoBloqueio: 'Pagamento já solicitado.', pagamentoPermitido: false };
    const html = renderToStaticMarkup(createElement(PedidoMesa,base));
    assert.match(html,/disabled="" class="btn btn-primary"/);
    const incerto = renderToStaticMarkup(createElement(PedidoMesa,{ ...base, adicaoPendente: true, reenvioPermitido: true, motivoEstoque: 'Sem estoque' }));
    assert.match(incerto,/class="btn btn-primary">Tentar novamente/); assert.doesNotMatch(incerto,/Enviar à Cozinha/);
});
test('FE012: 409 ou rede nao produzem novo envio automatico; retry incerto preserva chave e snapshot', async () => {
    for (const conflito of [true,false]) {
        const storage = memoria(), gestor = new GestorAdicao(storage,contexto,()=>contexto); let chamadas = 0, chave;
        const http = axios.create({ adapter: async config => {
            chamadas++; chave ??= config.headers['Idempotency-Key']; assert.equal(config.headers['Idempotency-Key'],chave);
            assert.deepEqual(JSON.parse(config.data),[{ produtoId: 4, quantidade: 1 }]);
            if (chamadas === 1) throw { config, response: conflito ? { status: 409, data: { mensagem: 'Apenas pedidos ABERTOS podem receber novos itens.' } } : undefined };
            return { config, status: 200, headers: {}, data: pedido() };
        } });
        await gestor.enviar(15,[{ produtoId: 4, quantidade: 1 }],op=>enviarAdicao(http,op),()=>assert.fail());
        assert.equal(chamadas,1); assert.ok(storage.getItem(CHAVE_ADICAO_PENDENTE));
        if (!conflito) {
            assert.ok(motivoNovosItens(mesa(),pedido({ status: 'AGUARDANDO_PAGAMENTO' })));
            assert.equal(produtoDisponivel(produto({ qtdEstoque: 0 })),false);
            await gestor.enviar(999,[{ produtoId: 99, quantidade: 5 }],op=>enviarAdicao(http,op),()=>{});
            assert.equal(chamadas,2); assert.equal(storage.getItem(CHAVE_ADICAO_PENDENTE),null);
        }
    }
});
test('FE012: abertura incerta nao e liberada por uma mesa aparentemente livre', async () => {
    const storage = memoria(), gestor = new GestorAbertura(storage,contexto,()=>contexto); let chamadas = 0;
    await gestor.enviar([{ produtoId: 4, quantidade: 1 }], async () => { chamadas++; throw new Error('rede'); },()=>assert.fail());
    const original = storage.getItem(CHAVE_ABERTURA_PENDENTE);
    assert.equal(motivoNovosItens(mesa({ status: 'LIVRE' }),null),null);
    await gestor.enviar([{ produtoId: 4, quantidade: 2 }],async()=>{ chamadas++; },()=>assert.fail());
    assert.equal(chamadas,1); assert.equal(storage.getItem(CHAVE_ABERTURA_PENDENTE),original);
});
