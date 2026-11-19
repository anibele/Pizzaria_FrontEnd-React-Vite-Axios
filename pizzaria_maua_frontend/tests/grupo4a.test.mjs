import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { SessaoAutenticada } from '../src/services/sessaoAutenticada.ts';
import { ControleHttpSessao, instalarInterceptoresSessao } from '../src/services/httpSessao.ts';
import { CHAVE_SESSAO_ADICAO, CHAVE_ADICAO_PENDENTE, contextoAtualAdicao, definirVinculoAutenticado } from '../src/services/sessaoAdicao.ts';
import { CHAVE_ABERTURA_PENDENTE, GestorAbertura } from '../src/services/aberturaPendente.ts';
import { GestorAdicao } from '../src/services/adicaoPendente.ts';


class Memory {
    dados = new Map();
    getItem(k) { return this.dados.get(k) ?? null; }
    setItem(k,v) { this.dados.set(k,v); }
    removeItem(k) { this.dados.delete(k); }
}
const user = (username = 'A', numeroMesa = 7) => ({ username, numeroMesa, role: 'MESA' });
const tick = () => new Promise(r => setImmediate(r));
const adiada = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const falha = status => ({ response: { status } });
function ambiente(t) {
    const local = new Memory(), pendencias = new Memory();
    const anterior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
    const abas = [];
    function aba(responder = c => c.url === '/auth/login' ? { token: 'jwt-A' } : user()) {
        const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
        const controle = new ControleHttpSessao(), chamadas = [], navegacoes = [];
        const http = axios.create({ adapter: async config => {
            chamadas.push(config);
            try { return { config, status: 200, headers: {}, data: await responder(config) }; }
            catch (erro) { throw { ...erro, config }; }
        } });
        instalarInterceptoresSessao(http, local, controle);
        const gestor = new SessaoAutenticada(http, local, cache, controle, u => navegacoes.push(u));
        controle.expirar = gestor.logout; controle.revalidar = gestor.revalidarVinculo;
        const s = { gestor, cache, controle, http, chamadas, navegacoes }; abas.push(s); return s;
    }
    const evento = (s, key, newValue = local.getItem(key)) => s.gestor.sincronizarArmazenamento({ key, newValue });
    function gravar(u, token) {
        local.setItem('token', token); local.setItem('user', JSON.stringify(u));
        local.setItem(CHAVE_SESSAO_ADICAO, JSON.stringify({ username: u.username, role: u.role, sessao: `marcador-${u.username}` }));
    }
    t.after(() => { abas.forEach(a => { a.gestor.parar(); a.cache.clear(); }); definirVinculoAutenticado(null);
        if (anterior) Object.defineProperty(globalThis, 'localStorage', anterior); else delete globalThis.localStorage; });
    return { local, pendencias, aba, evento, gravar };
}

test('FE005: logout sincronizado elimina identidade/cache e preserva registros de abertura e adicao', async t => {
    const s = ambiente(t), a = s.aba(), b = s.aba();
    await a.gestor.login('A','sintetica'); await b.gestor.restaurar();
    const contexto = contextoAtualAdicao(7), itens = [{ produtoId: 3, quantidade: 1 }];
    const abertura = new GestorAbertura(s.pendencias, contexto, () => contextoAtualAdicao(7));
    const adicao = new GestorAdicao(s.pendencias, contexto, () => contextoAtualAdicao(7));
    await abertura.enviar(itens, async () => { throw falha(undefined); }, () => assert.fail());
    await adicao.enviar(15, itens, async () => { throw falha(undefined); }, () => assert.fail());
    const originais = new Map(s.pendencias.dados);
    b.cache.setQueryData(['dados-protegidos'], [1,2]); const versao = b.gestor.obterEstado().versao;
    a.gestor.logout(); s.evento(b, 'token', null); await tick();
    assert.equal(b.gestor.obterEstado().user, null); assert.equal(b.cache.getQueryData(['dados-protegidos']), undefined);
    assert.ok(b.gestor.obterEstado().versao > versao); assert.deepEqual(s.pendencias.dados, originais);
    assert.equal(s.pendencias.getItem(CHAVE_ADICAO_PENDENTE), originais.get(CHAVE_ADICAO_PENDENTE));
    assert.equal(s.pendencias.getItem(CHAVE_ABERTURA_PENDENTE), originais.get(CHAVE_ABERTURA_PENDENTE));
    assert.equal(b.chamadas.length, 1); // Apenas /me do reload, sem replay mutável.
});

test('FE005: login em outra aba revalida /me antes de publicar outra identidade', async t => {
    const s = ambiente(t), p = adiada(); let novo = false;
    const a = s.aba(c => c.url === '/auth/login' ? { token: 'jwt-A' } : novo ? p.promise : user());
    await a.gestor.login('A','sintetica'); a.cache.setQueryData(['mesa'], 7);
    s.gravar(user('B',12), 'jwt-B'); novo = true; s.evento(a,'token');
    assert.equal(a.gestor.obterEstado().user, null); assert.equal(a.cache.getQueryData(['mesa']), undefined);
    assert.equal(contextoAtualAdicao(7), null);
    p.resolve(user('B',12)); await tick();
    assert.equal(a.gestor.obterEstado().user.username, 'B');
    assert.equal(a.chamadas.at(-1).headers.Authorization, 'Bearer jwt-B');
    assert.equal(a.chamadas.filter(c => c.method !== 'get').length, 1);
});

test('FE005: evento atrasado de logout nao encerra sessao mais recente', async t => {
    const s = ambiente(t), a = s.aba(c => c.url === '/auth/login' ? { token: 'jwt-B' } : user('B',12));
    await a.gestor.login('B','sintetica'); const versao = a.gestor.obterEstado().versao;
    s.evento(a,'token',null); s.evento(a,CHAVE_SESSAO_ADICAO,'marcador-antigo'); s.evento(a,null,null); await tick();
    assert.equal(a.gestor.obterEstado().user.username, 'B'); assert.equal(a.gestor.obterEstado().versao, versao);
    assert.equal(a.chamadas.length, 2);
});

test('FE005: resposta /me anterior ao evento storage nao sobrescreve login de outra aba', async t => {
    const s = ambiente(t), p = adiada();
    const a = s.aba(c => c.headers.Authorization === 'Bearer jwt-A' ? p.promise : user('B',12));
    s.gravar(user(), 'jwt-A'); const antiga = a.gestor.restaurar(); await tick();
    s.gravar(user('B',12), 'jwt-B'); p.resolve(user()); await antiga; await tick();
    assert.equal(a.gestor.obterEstado().user.username, 'B'); assert.equal(s.local.getItem('token'), 'jwt-B');
    assert.ok(a.chamadas.every(c => c.method === 'get'));
});

test('FE005: 401 de /me antigo nao remove credenciais da outra aba', async t => {
    const s = ambiente(t), p = adiada();
    const a = s.aba(c => c.headers.Authorization === 'Bearer jwt-A' ? p.promise : user('B',12));
    s.gravar(user(), 'jwt-A'); const antiga = a.gestor.restaurar(); await tick();
    s.gravar(user('B',12), 'jwt-B'); p.reject(falha(401)); await antiga; await tick();
    assert.equal(s.local.getItem('token'), 'jwt-B'); assert.equal(a.gestor.obterEstado().user.username, 'B');
});

test('FE005: evento durante /me pendente cancela resposta anterior e recupera identidade atual', async t => {
    const s = ambiente(t), p = adiada();
    const a = s.aba(c => c.headers.Authorization === 'Bearer jwt-A' ? p.promise : user('B',12));
    s.gravar(user(), 'jwt-A'); const antiga = a.gestor.restaurar(); await tick();
    s.gravar(user('B',12), 'jwt-B'); s.evento(a,'token'); await tick();
    assert.equal(a.gestor.obterEstado().user.username, 'B'); p.resolve(user()); await antiga;
    assert.equal(a.gestor.obterEstado().user.username, 'B');
});

test('FE005: duas mudancas consecutivas de armazenamento descartam a identidade intermediaria', async t => {
    const s = ambiente(t), p = adiada(); let b = false;
    const a = s.aba(c => c.url === '/auth/login' ? { token: 'jwt-A' } : b && c.headers.Authorization === 'Bearer jwt-B' ? p.promise : c.headers.Authorization === 'Bearer jwt-C' ? user('C',14) : user());
    await a.gestor.login('A','sintetica'); s.gravar(user('B',12),'jwt-B'); b = true; s.evento(a,'token'); await tick();
    s.gravar(user('C',14),'jwt-C'); s.evento(a,'token'); await tick(); p.resolve(user('B',12)); await tick();
    assert.equal(a.gestor.obterEstado().user.username, 'C'); assert.equal(s.local.getItem('token'),'jwt-C');
});

test('FE005: objeto usuario alterado exige /me e nunca e usado como prova de perfil', async t => {
    const s = ambiente(t), a = s.aba(); await a.gestor.login('A','sintetica');
    s.local.setItem('user', JSON.stringify({ username: 'forjado', role: 'GERENTE', numeroMesa: null })); s.evento(a,'user');
    assert.equal(a.gestor.obterEstado().user, null); await tick();
    assert.deepEqual(a.gestor.obterEstado().user, user());
    const total = a.chamadas.length; s.evento(a,'user'); s.evento(a,CHAVE_SESSAO_ADICAO); await tick();
    assert.equal(a.chamadas.length, total); // Sem loop de propagacao de /me.
});

test('FE005: 401 antigo e descartado mesmo com JWT igual e nonce de sessao diferente', async t => {
    const s = ambiente(t), p = adiada(), a = s.aba(c => c.url === '/mesas/7' ? p.promise : c.url === '/auth/login' ? { token: 'jwt-A' } : user());
    await a.gestor.login('A','sintetica'); const resposta = a.http.get('/mesas/7').catch(e => e); await tick();
    s.local.setItem(CHAVE_SESSAO_ADICAO, JSON.stringify({ username: 'A', role: 'MESA', sessao: 'outra-sessao' }));
    p.reject(falha(401)); assert.ok(axios.isCancel(await resposta)); assert.equal(s.local.getItem('token'),'jwt-A');
    assert.equal(a.gestor.obterEstado().user.username,'A');
});

test('FE005: logout de instancia desatualizada nao apaga sessao persistida mais recente', async t => {
    const s = ambiente(t), a = s.aba(); await a.gestor.login('A','sintetica');
    s.gravar(user('B',12),'jwt-B'); a.gestor.logout();
    assert.equal(s.local.getItem('token'),'jwt-B'); assert.equal(a.gestor.obterEstado().user,null);
});

test('FE005: falha de leitura durante storage invalida cache e encerra loading sem assumir identidade', async t => {
    const s = ambiente(t), a = s.aba(); await a.gestor.login('A','sintetica'); a.cache.setQueryData(['mesa'],7);
    s.local.getItem = () => { throw new Error('indisponivel'); }; s.evento(a,'user',null); await tick();
    assert.equal(a.gestor.obterEstado().user,null); assert.equal(a.gestor.obterEstado().loading,false);
    assert.equal(a.cache.getQueryData(['mesa']),undefined); assert.equal(a.chamadas.length,2);
});

test('FE005: falha ao substituir nonce nao reutiliza contexto anterior durante novo login', async t => {
    const s = ambiente(t), a = s.aba(); await a.gestor.login('A','sintetica'); const anterior = s.local.getItem(CHAVE_SESSAO_ADICAO);
    const remover = s.local.removeItem.bind(s.local); s.local.removeItem = k => { if (k === CHAVE_SESSAO_ADICAO) throw new Error('falha'); remover(k); };
    await assert.rejects(a.gestor.login('A','sintetica'));
    assert.equal(a.gestor.obterEstado().user,null); assert.equal(contextoAtualAdicao(7),null);
    assert.equal(s.local.getItem(CHAVE_SESSAO_ADICAO), anterior);
});

for (const [codigo, texto] of [[401, /senha incorretos/], [403, /autorizar o acesso/], [500, /servidor está indisponível/], [undefined, /conexão/]]) {
    test(`FE006: login ${codigo ?? 'rede'} possui mensagem adequada sem logs sensiveis`, async t => {
        const s = ambiente(t), a = s.aba(() => { throw { ...falha(codigo), config: { senha: 'segredo-sintetico', token: 'token-sintetico' } }; });
        const logs = [], antigo = console.error; console.error = (...args) => logs.push(args);
        try { await assert.rejects(a.gestor.login('A','segredo-sintetico'), erro => {
            assert.match(erro.message,texto); assert.ok(!erro.message.includes('segredo-sintetico')); assert.ok(!erro.message.includes('token-sintetico')); return true;
        }); } finally { console.error = antigo; }
        assert.deepEqual(logs,[]); assert.equal(a.navegacoes.length,0); assert.equal(a.chamadas.length,1);
        assert.equal(a.gestor.obterEstado().loading,false);
    });
}

test('FE006: timeout nao e apresentado como credencial incorreta', async t => {
    const s = ambiente(t), a = s.aba(() => { throw { code: 'ECONNABORTED' }; });
    await assert.rejects(a.gestor.login('A','sintetica'), /conexão/); assert.equal(a.gestor.obterEstado().user,null);
});

test('FE006: login malformado e distinguido de falha de conexao', async t => {
    const s = ambiente(t), a = s.aba(() => ({})); await assert.rejects(a.gestor.login('A','sintetica'), /resposta de login inválida/);
    assert.equal(a.gestor.obterEstado().loading,false); assert.equal(a.chamadas.length,1);
});

test('FE005: listener nativo filtra a area de armazenamento e e removido na desmontagem', async t => {
    const s = ambiente(t), a = s.aba(c => c.url === '/auth/login' ? { token: 'jwt-A' } : c.headers.Authorization === 'Bearer jwt-B' ? user('B',12) : user());
    await a.gestor.login('A','sintetica');
    const alvo = new EventTarget(), remover = a.gestor.observarArmazenamento(alvo,s.local);
    function evento(area) {
        const e = new Event('storage');
        Object.defineProperties(e,{ key: { value: 'token' }, newValue: { value: s.local.getItem('token') }, storageArea: { value: area } });
        alvo.dispatchEvent(e);
    }
    s.gravar(user('B',12),'jwt-B'); evento(s.pendencias); assert.equal(a.gestor.obterEstado().user.username,'A');
    evento(s.local); await tick(); assert.equal(a.gestor.obterEstado().user.username,'B');
    const chamadas = a.chamadas.length; remover(); s.gravar(user('C',14),'jwt-C'); evento(s.local); await tick();
    assert.equal(a.gestor.obterEstado().user.username,'B'); assert.equal(a.chamadas.length,chamadas);
});

test('FE006: indisponibilidade de /me nao e apresentada como credenciais incorretas', async t => {
    const s = ambiente(t), a = s.aba(c => { if (c.url === '/auth/login') return { token: 'jwt-A' }; throw falha(500); });
    await assert.rejects(a.gestor.login('A','sintetica'), /servidor está indisponível para recuperar/);
    assert.equal(a.gestor.obterEstado().user,null); assert.equal(a.gestor.obterEstado().podeRecuperar,true);
    assert.equal(a.chamadas.length,2);
});
