import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcoesMesa, excluirMesa, alterarAtivacaoMesa, consultarMesa } from '../src/services/acoesMesa.ts';
import { ModalAcoesMesa } from '../src/componentes/ModalAcoesMesa.tsx';

const mesa = { id: 10, numero: 1, status: 'LIVRE', ativo: true };
const outra = { id: 20, numero: 2, status: 'RESERVADA', ativo: true };
const erroHttp = (status, mensagem = 'Mensagem de negócio') => ({ response: { status, data: { mensagem, message: 'Campo errado' } } });
const turno = () => new Promise(resolve => setImmediate(resolve));
function pendente() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function criar(t, opcoes = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['mesa-dados'], [mesa, outra]);
    const exclusoes = [], ativacoes = [], consultas = [];
    let mesaServidor = mesa;
    const gestor = new AcoesMesa(client, {
        excluir: async numero => {
            exclusoes.push(numero);
            if (opcoes.excluir) await opcoes.excluir(numero);
            mesaServidor = null;
        },
        ativacao: async dados => {
            ativacoes.push(dados);
            if (opcoes.ativacao) await opcoes.ativacao(dados);
            mesaServidor = { ...mesaServidor, ativo: dados.ativo };
        },
        consultar: (numero, signal) => {
            consultas.push({ numero, signal });
            return opcoes.consultar ? opcoes.consultar(numero, signal, consultas.length) : Promise.resolve(mesaServidor);
        },
    });
    t.after(() => { gestor.limpar(); client.clear(); });
    const dados = () => client.getQueryData(['mesa-dados']);
    const html = () => renderToStaticMarkup(createElement(ModalAcoesMesa, {
        isOpen: true, numeroMesa: 1, estado: gestor.obterEstado(), onClose() {}, onExcluir() {}, onDesativar() {}, onVerificar() {},
    }));
    return { client, gestor, exclusoes, ativacoes, consultas, dados, html };
}

test('contratos HTTP: DELETE e PATCH separados, timeout e GET sem transformar erros em ausência', async () => {
    const chamadas = [];
    const http = axios.create({ adapter: async config => {
        chamadas.push(config);
        return { config, status: config.method === 'get' ? 200 : 204, headers: {}, data: config.method === 'get' ? mesa : '' };
    } });
    const controle = new AbortController();
    await excluirMesa(http, 1);
    await alterarAtivacaoMesa(http, { numero: 1, ativo: false });
    assert.deepEqual(await consultarMesa(http, 1, controle.signal), mesa);
    assert.deepEqual(chamadas.map(c => [c.method, c.url, c.timeout]), [
        ['delete', '/mesas/1', 15000], ['patch', '/mesas/1/ativacao?ativo=false', 15000], ['get', '/mesas/1', 15000],
    ]);
    assert.equal(chamadas[2].signal, controle.signal);
    const ausente = axios.create({ adapter: async () => { throw erroHttp(404); } });
    assert.equal(await consultarMesa(ausente, 1, controle.signal), null);
    const proibido = axios.create({ adapter: async () => { throw erroHttp(403); } });
    await assert.rejects(consultarMesa(proibido, 1, controle.signal), e => e.response.status === 403);
});

test('exclusão lenta mantém mesa e modal, bloqueia repetição e só anuncia sucesso após 204', async t => {
    const resposta = pendente();
    const s = criar(t, { excluir: () => resposta.promise });
    const envio = s.gestor.executar(mesa, 'excluir'); await turno();
    assert.deepEqual(s.exclusoes, [1]);
    assert.deepEqual(s.dados(), [mesa, outra]);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    assert.equal(s.gestor.obterEstado().processando, true);
    assert.ok(!s.html().includes('com sucesso'));
    assert.equal((s.html().match(/disabled=""/g) || []).length, 4);
    await s.gestor.executar(mesa, 'excluir');
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.exclusoes.length, 1);
    assert.equal(s.ativacoes.length, 0);
    resposta.resolve(); await envio;
    assert.deepEqual(s.dados(), [outra]);
    assert.equal(s.gestor.obterEstado().sucesso, true);
    assert.ok(s.html().includes('excluída com sucesso'));
    assert.equal(s.client.getQueryState(['mesa-dados']).isInvalidated, true);
    assert.equal(s.ativacoes.length, 0);
});

for (const status of [400, 401, 403, 404, 409, 500]) {
    test(`DELETE ${status}: nenhuma desativação automática nem confirmação falsa`, async t => {
        const s = criar(t, { excluir: async () => { throw erroHttp(status); } });
        await s.gestor.executar(mesa, 'excluir');
        assert.equal(s.exclusoes.length, 1);
        assert.equal(s.ativacoes.length, 0);
        assert.equal(s.gestor.obterEstado().sucesso, false);
        assert.equal(s.gestor.obterEstado().processando, false);
        assert.equal(s.consultas.length, status === 401 || status === 403 ? 1 : 2);
        assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
        assert.ok(s.html().includes('role="alert"'));
        assert.ok(!s.html().includes('com sucesso'));
    });
}

for (const mensagem of ['Nao e possivel excluir a mesa pois existem registros vinculados.', 'Operacao concorrente em andamento.', 'A mesa possui um vínculo de usuário incompatível.']) {
    test(`409 informa a mensagem real sem presumir histórico: ${mensagem}`, async t => {
        const s = criar(t, { excluir: async () => { throw erroHttp(409, mensagem); } });
        await s.gestor.executar(mesa, 'excluir');
        assert.ok(s.gestor.obterEstado().mensagem.includes(mensagem));
        assert.ok(!s.gestor.obterEstado().mensagem.includes('Campo errado'));
        assert.equal(s.ativacoes.length, 0);
    });
}

test('desativação após conflito só ocorre por uma nova escolha explícita do gerente', async t => {
    const s = criar(t, { excluir: async () => { throw erroHttp(409, 'Registros vinculados.'); } });
    await s.gestor.executar(mesa, 'excluir');
    assert.equal(s.ativacoes.length, 0);
    await s.gestor.executar(mesa, 'desativar');
    assert.deepEqual(s.ativacoes, [{ numero: 1, ativo: false }]);
    assert.equal(s.dados().find(m => m.numero === 1).ativo, false);
    assert.equal(s.gestor.obterEstado().sucesso, true);
    assert.equal(s.exclusoes.length, 1);
});

test('desativação lenta não anuncia sucesso nem altera ativo antes da confirmação', async t => {
    const resposta = pendente();
    const s = criar(t, { ativacao: () => resposta.promise });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    await s.gestor.executar(mesa, 'desativar');
    await s.gestor.executar(mesa, 'excluir');
    assert.equal(s.ativacoes.length, 1);
    assert.equal(s.exclusoes.length, 0);
    resposta.resolve(); await envio;
    assert.equal(s.dados().find(m => m.numero === 1).ativo, false);
    assert.equal(s.gestor.obterEstado().sucesso, true);
    assert.equal(s.consultas.length, 2);
    assert.ok(s.gestor.obterEstado().mensagem.includes('Consulta atual: mesa desativada'));
});

for (const status of [400, 401, 403, 404, 409, 500]) {
    test(`PATCH ${status}: mantém informação confirmada e não apresenta desativação como sucesso`, async t => {
        const s = criar(t, { ativacao: async () => { throw erroHttp(status); } });
        await s.gestor.executar(mesa, 'desativar');
        assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
        assert.equal(s.gestor.obterEstado().sucesso, false);
        assert.equal(s.gestor.obterEstado().processando, false);
        assert.equal(s.exclusoes.length, 0);
        assert.equal(s.ativacoes.length, 1);
    });
}

for (const [nome, erro] of [['rede', new Error('Network Error')], ['timeout', { code: 'ECONNABORTED' }], ['500', erroHttp(500)]]) {
    test(`DELETE ${nome}: consulta resultado perdido sem repetir nem executar PATCH`, async t => {
        const s = criar(t, { excluir: async () => { throw erro; }, consultar: async (_, __, n) => n === 1 ? mesa : null });
        await s.gestor.executar(mesa, 'excluir');
        assert.deepEqual(s.dados(), [outra]);
        assert.equal(s.exclusoes.length, 1);
        assert.equal(s.ativacoes.length, 0);
        assert.equal(s.gestor.obterEstado().sucesso, false);
        assert.ok(s.gestor.obterEstado().mensagem.includes('Na consulta atual, a mesa não está mais cadastrada'));
    });
}

test('PATCH com resposta perdida atualiza o estado consultado sem afirmar confirmação do envio', async t => {
    const s = criar(t, { ativacao: async () => { throw new Error('resposta perdida'); },
        consultar: async (_, __, n) => n === 1 ? mesa : { ...mesa, ativo: false } });
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.dados().find(m => m.numero === 1).ativo, false);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    assert.ok(s.gestor.obterEstado().mensagem.includes('Consulta atual: mesa desativada'));
    assert.equal(s.ativacoes.length, 1);
});

test('resultado incerto exige verificar antes de permitir outra ação e não reenvia automaticamente', async t => {
    let online = false;
    const s = criar(t, { excluir: async () => { throw new Error('timeout'); }, consultar: async (_, __, n) => {
        if (n > 1 && !online) throw new Error('offline');
        return mesa;
    } });
    await s.gestor.executar(mesa, 'excluir');
    assert.equal(s.gestor.obterEstado().verificar, true);
    assert.ok(s.html().includes('Verificar mesa'));
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.ativacoes.length, 0);
    assert.equal(s.exclusoes.length, 1);
    online = true;
    await s.gestor.verificar(mesa);
    assert.equal(s.gestor.obterEstado().verificar, false);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    assert.equal(s.ativacoes.length, 0);
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.ativacoes.length, 1);
});

test('consulta inicial indisponível impede mutações e libera fechamento do modal', async t => {
    const s = criar(t, { consultar: async () => { throw new Error('offline'); } });
    await s.gestor.executar(mesa, 'excluir');
    assert.equal(s.consultas.length, 1);
    assert.equal(s.exclusoes.length, 0);
    assert.equal(s.ativacoes.length, 0);
    assert.equal(s.gestor.obterEstado().processando, false);
    assert.match(s.html(), /<button class="btn-fechar-modal-X"/);
});

test('mesa inexistente na consulta não recebe DELETE nem PATCH', async t => {
    const s = criar(t, { consultar: async () => null });
    await s.gestor.executar(mesa, 'excluir');
    assert.deepEqual(s.dados(), [outra]);
    assert.equal(s.exclusoes.length, 0);
    assert.equal(s.ativacoes.length, 0);
    assert.equal(s.gestor.obterEstado().sucesso, false);
});

test('concorrência: 409 atualiza situação da mesa sem presumir exclusão ou desativação', async t => {
    const ocupada = { ...mesa, status: 'OCUPADA' };
    const s = criar(t, { excluir: async () => { throw erroHttp(409, 'A mesa possui registros vinculados.'); },
        consultar: async (_, __, n) => n === 1 ? mesa : ocupada });
    await s.gestor.executar(mesa, 'excluir');
    assert.deepEqual(s.dados().find(m => m.numero === 1), ocupada);
    assert.equal(s.ativacoes.length, 0);
    assert.equal(s.gestor.obterEstado().sucesso, false);
});

test('reativação rápida permanece explícita e aguarda confirmação', async t => {
    const desativada = { ...mesa, ativo: false };
    const s = criar(t, { consultar: async (_, __, n) => n === 1 ? desativada : mesa });
    await s.gestor.executar(desativada, 'ativar');
    assert.deepEqual(s.ativacoes, [{ numero: 1, ativo: true }]);
    assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
    assert.equal(s.gestor.obterEstado().sucesso, true);
});

test('estado desejado já confirmado por consulta não dispara outro PATCH', async t => {
    const s = criar(t, { consultar: async () => ({ ...mesa, ativo: false }) });
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.ativacoes.length, 0);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    assert.ok(s.gestor.obterEstado().mensagem.includes('já está desativada'));
});

test('cadastro substituído com mesmo número exige nova confirmação e não altera a nova mesa', async t => {
    const substituta = { ...mesa, id: 99 };
    const s = criar(t, { consultar: async () => substituta });
    await s.gestor.executar(mesa, 'excluir');
    assert.deepEqual(s.dados().find(m => m.numero === 1), substituta);
    assert.equal(s.exclusoes.length, 0);
    assert.equal(s.ativacoes.length, 0);
    assert.ok(s.gestor.obterEstado().mensagem.includes('substituída'));
});

test('leitura tardia não sobrescreve atualização concorrente da mesma mesa', async t => {
    const leitura = pendente();
    const s = criar(t, { consultar: () => leitura.promise });
    const envio = s.gestor.executar(mesa, 'excluir');
    const atualizada = { ...mesa, status: 'OCUPADA' };
    s.client.setQueryData(['mesa-dados'], [atualizada, outra]);
    leitura.resolve(mesa); await envio;
    assert.deepEqual(s.dados(), [atualizada, outra]);
    assert.equal(s.exclusoes.length, 0);
    assert.equal(s.gestor.obterEstado().verificar, true);
});

test('cancelamento de listagem antiga impede que resposta anterior restaure mesa excluída', async t => {
    const s = criar(t);
    const resposta = pendente();
    let signal;
    const leitura = s.client.fetchQuery({ queryKey: ['mesa-dados'], queryFn: contexto => {
        signal = contexto.signal; return resposta.promise;
    } }).catch(() => {});
    // A consulta prévia da ação cancela esta listagem antes de atualizar o cache.
    const operacao = s.gestor.executar(mesa, 'excluir');
    await operacao;
    assert.equal(signal.aborted, true);
    resposta.resolve([mesa, outra]); await leitura; await turno();
    assert.deepEqual(s.dados(), [outra]);
});

test('desmontagem durante consulta aborta leitura e não dispara mutação tardia', async t => {
    const leitura = pendente();
    const s = criar(t, { consultar: () => leitura.promise });
    const envio = s.gestor.executar(mesa, 'excluir');
    s.gestor.limpar();
    assert.equal(s.consultas[0].signal.aborted, true);
    leitura.resolve(mesa); await envio;
    assert.equal(s.exclusoes.length, 0);
    assert.deepEqual(s.dados(), [mesa, outra]);
    assert.equal(s.gestor.obterEstado().mensagem, null);
});

test('resposta da exclusão após desmontagem não publica sucesso nem altera cache', async t => {
    const resposta = pendente();
    const s = criar(t, { excluir: () => resposta.promise });
    const envio = s.gestor.executar(mesa, 'excluir'); await turno();
    s.gestor.limpar();
    resposta.resolve(); await envio;
    assert.deepEqual(s.dados(), [mesa, outra]);
    assert.equal(s.gestor.obterEstado().sucesso, false);
    assert.equal(s.gestor.obterEstado().mensagem, null);
});

test('PATCH 204 atrasado preserva cache mais recente e consulta o estado atual sem outro PATCH', async t => {
    const resposta = pendente(), leitura = pendente();
    const recente = { ...mesa, status: 'OCUPADA', ativo: true };
    const s = criar(t, { ativacao: () => resposta.promise,
        consultar: (_, __, n) => n === 1 ? Promise.resolve(mesa) : leitura.promise });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    s.client.setQueryData(['mesa-dados'], [recente, outra]);
    resposta.resolve(); await turno();
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.consultas.length, 2);
    leitura.resolve(recente); await envio;
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.ativacoes.length, 1);
    assert.equal(s.gestor.obterEstado().sucesso, true);
    assert.ok(s.gestor.obterEstado().mensagem.includes('Consulta atual: mesa ativa'));
});

test('204 seguido de GET com erro preserva dados recentes inclusive ao cancelar uma listagem antiga', async t => {
    const resposta = pendente(), antiga = pendente();
    const recente = { ...mesa, ativo: true, status: 'OCUPADA' };
    const s = criar(t, { ativacao: () => resposta.promise, consultar: async (_, __, n) => {
        if (n === 1) return mesa;
        throw erroHttp(500);
    } });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    let signal;
    const listagem = s.client.fetchQuery({ queryKey: ['mesa-dados'], queryFn: contexto => {
        signal = contexto.signal; return antiga.promise;
    } }).catch(() => {});
    s.client.setQueryData(['mesa-dados'], [recente, outra]);
    resposta.resolve(); await envio;
    assert.equal(signal.aborted, true);
    antiga.resolve([mesa, outra]); await listagem;
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.gestor.obterEstado().sucesso, true);
    assert.equal(s.gestor.obterEstado().verificar, true);
    assert.ok(s.gestor.obterEstado().mensagem.includes('Operação confirmada'));
    assert.ok(s.gestor.obterEstado().mensagem.includes('Não foi possível verificar o estado atual'));
    assert.equal(s.ativacoes.length, 1);
    assert.equal(s.consultas.length, 2);
});

test('GET de reconciliação antigo não sobrescreve uma consulta posterior já aplicada ao cache', async t => {
    const leitura = pendente();
    const recente = { ...mesa, status: 'OCUPADA', ativo: true };
    const s = criar(t, { consultar: (_, __, n) => n === 1 ? Promise.resolve(mesa)
        : n === 2 ? leitura.promise : Promise.resolve(recente) });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    await s.client.fetchQuery({ queryKey: ['mesa-dados'], queryFn: async () => [recente, outra], staleTime: 0 });
    leitura.resolve({ ...mesa, ativo: false }); await envio;
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.gestor.obterEstado().verificar, true);
    assert.ok(s.gestor.obterEstado().mensagem.includes('mudaram durante a consulta'));
    await s.gestor.verificar(mesa);
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.gestor.obterEstado().verificar, false);
    assert.equal(s.ativacoes.length, 1);
});

test('consulta posterior com valores iguais aos anteriores também impede reconciliação antiga de regredir o cache', async t => {
    const leitura = pendente();
    const s = criar(t, { consultar: (_, __, n) => n === 1 ? Promise.resolve(mesa) : leitura.promise });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    const referencia = s.dados().find(m => m.numero === 1);
    // O outro operador reativou a mesa: o GET mais recente voltou aos valores
    // anteriores. Structural sharing conserva a referência, mas a leitura é nova.
    await s.client.fetchQuery({ queryKey: ['mesa-dados'], queryFn: async () => [{ ...mesa }, { ...outra }], staleTime: 0 });
    assert.equal(s.dados().find(m => m.numero === 1), referencia);
    leitura.resolve({ ...mesa, ativo: false }); await envio;
    assert.deepEqual(s.dados(), [mesa, outra]);
    assert.equal(s.gestor.obterEstado().verificar, true);
    assert.equal(s.ativacoes.length, 1);
});

test('operações explícitas sucessivas de desativar e ativar publicam apenas estados consultados', async t => {
    const s = criar(t);
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.dados().find(m => m.numero === 1).ativo, false);
    await s.gestor.executar(mesa, 'ativar');
    assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
    await s.gestor.executar(mesa, 'desativar');
    assert.equal(s.dados().find(m => m.numero === 1).ativo, false);
    assert.deepEqual(s.ativacoes, [{ numero: 1, ativo: false }, { numero: 1, ativo: true }, { numero: 1, ativo: false }]);
    assert.equal(s.consultas.length, 6);
    assert.equal(s.exclusoes.length, 0);
});

for (const falhaConsulta of [false, true]) {
    test(`DELETE 204 atrasado preserva outro cadastro no mesmo número; GET falha=${falhaConsulta}`, async t => {
        const resposta = pendente();
        const substituta = { ...mesa, id: 99, status: 'OCUPADA' };
        const s = criar(t, { excluir: () => resposta.promise, consultar: async (_, __, n) => {
            if (n === 1) return mesa;
            if (falhaConsulta) throw new Error('offline');
            return substituta;
        } });
        const envio = s.gestor.executar(mesa, 'excluir'); await turno();
        s.client.setQueryData(['mesa-dados'], [substituta, outra]);
        resposta.resolve(); await envio;
        assert.deepEqual(s.dados(), [substituta, outra]);
        assert.equal(s.exclusoes.length, 1);
        assert.equal(s.ativacoes.length, 0);
        assert.equal(s.consultas.length, 2);
        assert.equal(s.gestor.obterEstado().sucesso, true);
        assert.equal(s.gestor.obterEstado().verificar, falhaConsulta);
        if (!falhaConsulta) assert.ok(s.gestor.obterEstado().mensagem.includes('outro cadastro ocupa este número'));
    });
}

test('listagem iniciada antes do 204 não sobrescreve a reconciliação posterior', async t => {
    const resposta = pendente(), antiga = pendente(), nova = pendente();
    const desativada = { ...mesa, ativo: false };
    const s = criar(t, { ativacao: () => resposta.promise,
        consultar: (_, __, n) => n === 1 ? Promise.resolve(mesa) : nova.promise });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    let signal;
    const listagem = s.client.fetchQuery({ queryKey: ['mesa-dados'], queryFn: contexto => {
        signal = contexto.signal; return antiga.promise;
    } }).catch(() => {});
    resposta.resolve(); await turno();
    assert.equal(signal.aborted, true);
    assert.equal(s.dados().find(m => m.numero === 1).ativo, true);
    nova.resolve(desativada); await envio;
    antiga.resolve([mesa, outra]); await listagem; await turno();
    assert.deepEqual(s.dados(), [desativada, outra]);
    assert.equal(s.ativacoes.length, 1);
});

test('desmontagem durante GET posterior ao 204 ignora resposta e preserva cache novo', async t => {
    const leitura = pendente();
    const recente = { ...mesa, status: 'OCUPADA' };
    const s = criar(t, { consultar: (_, __, n) => n === 1 ? Promise.resolve(mesa) : leitura.promise });
    const envio = s.gestor.executar(mesa, 'desativar'); await turno();
    assert.equal(s.consultas.length, 2);
    s.gestor.limpar();
    assert.equal(s.consultas[1].signal.aborted, true);
    s.client.setQueryData(['mesa-dados'], [recente, outra]);
    leitura.resolve({ ...mesa, ativo: false }); await envio;
    assert.deepEqual(s.dados(), [recente, outra]);
    assert.equal(s.gestor.obterEstado().mensagem, null);
    assert.equal(s.ativacoes.length, 1);
});
