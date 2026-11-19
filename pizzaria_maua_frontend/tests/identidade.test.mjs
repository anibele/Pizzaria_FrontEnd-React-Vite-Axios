import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { SessaoAutenticada } from '../src/services/sessaoAutenticada.ts';
import { ControleHttpSessao, instalarInterceptoresSessao } from '../src/services/httpSessao.ts';
import { validarIdentidade } from '../src/services/identidadeAutenticada.ts';
import { contextoAtualAdicao, definirVinculoAutenticado, CHAVE_ADICAO_PENDENTE, CHAVE_SESSAO_ADICAO } from '../src/services/sessaoAdicao.ts';
import { GestorAdicao } from '../src/services/adicaoPendente.ts';
import { GestorAbertura, CHAVE_ABERTURA_PENDENTE } from '../src/services/aberturaPendente.ts';

class Memory {
    dados = new Map();
    getItem(k) { return this.dados.get(k) ?? null; }
    setItem(k, v) { this.dados.set(k, v); }
    removeItem(k) { this.dados.delete(k); }
}
const usuario = (patch = {}) => ({ username: 'clienteA', role: 'MESA', numeroMesa: 7, ...patch });
const adiada = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(r => setImmediate(r));
const httpErro = status => ({ response: { status }, message: 'Falha sintética' });
function ambiente(t, responder = config => config.url === '/auth/login' ? { token: 'jwt-sintetico' } : usuario()) {
    const local = new Memory(), session = new Memory();
    const anterior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const anteriorSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const controle = new ControleHttpSessao(), chamadas = [], navegacoes = [];
    const http = axios.create({ adapter: async config => {
        chamadas.push(config);
        try { return { status: 200, headers: {}, config, data: await responder(config) }; }
        catch (erro) { throw { ...erro, config }; }
    } });
    instalarInterceptoresSessao(http, local, controle);
    const gestor = new SessaoAutenticada(http, local, cache, controle, u => navegacoes.push(u));
    controle.expirar = gestor.logout; controle.revalidar = gestor.revalidarVinculo;
    t.after(() => { gestor.parar(); cache.clear(); definirVinculoAutenticado(null);
        if (anterior) Object.defineProperty(globalThis, 'localStorage', anterior); else delete globalThis.localStorage;
        if (anteriorSession) Object.defineProperty(globalThis, 'sessionStorage', anteriorSession); else delete globalThis.sessionStorage; });
    return { local, session, cache, controle, chamadas, navegacoes, http, gestor };
}

for (const username of ['clienteA', 'tabletPrincipal', 'cliente999', 'mesa0001']) {
    test(`login ${username} usa identidade canonica e mesa 7, sem extrair digitos`, async t => {
        const s = ambiente(t);
        await s.gestor.login(username, 'senha-sintetica');
        assert.deepEqual(s.gestor.obterEstado().user, usuario());
        assert.equal(s.chamadas[0].url, '/auth/login');
        assert.deepEqual(JSON.parse(s.chamadas[0].data), { username, senha: 'senha-sintetica' });
        assert.equal(s.chamadas[1].url, '/auth/me'); assert.equal(s.chamadas[1].params, undefined);
        assert.equal(s.chamadas[1].headers.Authorization, 'Bearer jwt-sintetico');
        assert.equal(contextoAtualAdicao(7).username, 'clienteA'); assert.equal(contextoAtualAdicao(999), null);
        assert.equal(s.local.getItem('senha'), null);
    });
}
for (const role of ['GERENTE', 'COZINHA', 'CAIXA']) {
    test(`${role} nao precisa de mesa e troca de perfil esvazia cache`, async t => {
        const s = ambiente(t, c => c.url === '/auth/login' ? { token: 'jwt' } : usuario({ role, numeroMesa: null }));
        s.cache.setQueryData(['pedidos-cozinha'], ['dados antigos']);
        await s.gestor.login('entrada', 'sintetica');
        assert.equal(s.gestor.obterEstado().user.role, role); assert.equal(s.gestor.obterEstado().user.numeroMesa, null);
        assert.equal(s.cache.getQueryData(['pedidos-cozinha']), undefined); assert.equal(contextoAtualAdicao(7), null);
    });
}

test('validacao runtime recusa contratos incompletos ou vinculos invalidos', () => {
    for (const dados of [null, {}, usuario({ username: ' ' }), usuario({ role: 'ADMIN' }), usuario({ numeroMesa: null }),
        usuario({ numeroMesa: 0 }), usuario({ numeroMesa: -1 }), usuario({ numeroMesa: 1.5 }), usuario({ numeroMesa: '7' }),
        usuario({ role: 'GERENTE', numeroMesa: 7 }), { username: 'gerente', role: 'GERENTE' }]) assert.throws(() => validarIdentidade(dados));
});

test('sessao so e publicada depois de GET /me valido; token candidato nao e persistido antes', async t => {
    const pendente = adiada(); const s = ambiente(t, c => c.url === '/auth/login' ? { token: 'jwt' } : pendente.promise);
    const login = s.gestor.login('entrada', 'sintetica'); await tick();
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(s.gestor.obterEstado().loading, true);
    assert.equal(s.local.getItem('token'), null); assert.equal(contextoAtualAdicao(7), null);
    pendente.resolve(usuario()); await login; assert.deepEqual(s.gestor.obterEstado().user, usuario());
});

for (const codigo of [401, 403, 500, undefined]) {
    test(`GET identidade falha ${codigo ?? 'rede'} sem liberar sessao parcial e permite recuperacao adequada`, async t => {
        let falhar = true;
        const s = ambiente(t, c => { if (c.url === '/auth/login') return { token: 'jwt' };
            if (falhar) throw httpErro(codigo); return usuario(); });
        await assert.rejects(s.gestor.login('entrada', 'sintetica'));
        assert.equal(s.gestor.obterEstado().user, null); assert.equal(s.gestor.obterEstado().loading, false);
        assert.equal(s.gestor.obterEstado().podeRecuperar, codigo !== 401);
        assert.equal(s.navegacoes.length, 0);
        if (codigo !== 401) { falhar = false; await s.gestor.revalidar(); assert.deepEqual(s.gestor.obterEstado().user, usuario()); }
    });
}

test('credenciais incorretas nao sao confundidas com falha de recuperacao de identidade', async t => {
    const s = ambiente(t, () => { throw httpErro(401); });
    await assert.rejects(s.gestor.login('entrada', 'sintetica'), /senha incorretos/);
    assert.equal(s.chamadas.length, 1); assert.equal(s.gestor.obterEstado().podeRecuperar, false);
});

test('resposta de identidade invalida nao cria sessao', async t => {
    const s = ambiente(t, c => c.url === '/auth/login' ? { token: 'jwt' } : usuario({ numeroMesa: null }));
    await assert.rejects(s.gestor.login('entrada', 'sintetica'), /identidade inválida/);
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(contextoAtualAdicao(7), null);
});

test('reload com objeto legado e JWT existente consulta /me e preserva nonce de recuperacao', async t => {
    const s = ambiente(t);
    s.local.setItem('token', 'jwt-antigo'); s.local.setItem('user', JSON.stringify({ username: 'clienteA', role: 'MESA' }));
    const nonce = JSON.stringify({ username: 'clienteA', role: 'MESA', sessao: 'nonce-existente' });
    s.local.setItem(CHAVE_SESSAO_ADICAO, nonce);
    assert.equal(contextoAtualAdicao(7), null);
    await s.gestor.restaurar();
    assert.equal(s.chamadas.length, 1); assert.equal(s.chamadas[0].url, '/auth/me');
    assert.equal(s.local.getItem(CHAVE_SESSAO_ADICAO), nonce); assert.equal(contextoAtualAdicao(7).numeroMesa, 7);
});

test('reload com rede indisponivel termina loading e permite tentar somente GET', async t => {
    let falhar = true; const s = ambiente(t, () => { if (falhar) throw httpErro(undefined); return usuario(); });
    s.local.setItem('token', 'jwt'); await s.gestor.restaurar();
    assert.equal(s.gestor.obterEstado().loading, false); assert.equal(s.gestor.obterEstado().podeRecuperar, true);
    falhar = false; await s.gestor.revalidar();
    assert.ok(s.chamadas.every(c => c.method === 'get')); assert.equal(s.gestor.obterEstado().user.numeroMesa, 7);
});

test('logout durante GET pendente nao permite ressuscitar sessao nem apagar pendencias', async t => {
    const p = adiada(); const s = ambiente(t, () => p.promise); s.local.setItem('token', 'jwt');
    s.session.setItem(CHAVE_ADICAO_PENDENTE, 'snapshot original'); s.session.setItem(CHAVE_ABERTURA_PENDENTE, 'guarda original');
    const restauracao = s.gestor.restaurar(); await tick(); s.gestor.logout(); p.resolve(usuario()); await restauracao;
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(s.local.getItem('token'), null);
    assert.equal(s.session.getItem(CHAVE_ADICAO_PENDENTE), 'snapshot original');
    assert.equal(s.session.getItem(CHAVE_ABERTURA_PENDENTE), 'guarda original');
});

test('resposta atrasada de A nao substitui B, inclusive quando transporte ignora abort', async t => {
    const p = adiada(); let leitura = 0;
    // Mock HTTP direto ignora signal intencionalmente: a geração do gestor também deve proteger.
    const s = ambiente(t);
    const http = { post: async () => ({ data: { token: 'jwt-B' } }), get: async () => ({ status: 200, data: ++leitura === 1 ? await p.promise : usuario({ username: 'B', numeroMesa: 12 }) }) };
    const g = new SessaoAutenticada(http, s.local, s.cache, s.controle, () => {});
    s.local.setItem('token', 'jwt-A'); const a = g.restaurar(); await tick();
    await g.login('B', 'sintetica'); p.resolve(usuario()); await a;
    assert.equal(g.obterEstado().user.username, 'B'); assert.equal(contextoAtualAdicao(12).username, 'B');
});

for (const codigo of [200, 401]) {
    test(`resposta HTTP antiga ${codigo} nao altera cache ou encerra sessao B`, async t => {
        const p = adiada(); let pendente = true;
        const s = ambiente(t, c => { if (c.url === '/mesas/7' && pendente) return p.promise;
            return c.url === '/auth/login' ? { token: 'jwt-B' } : usuario({ username: 'B', numeroMesa: 12 }); });
        s.local.setItem('token', 'jwt-A');
        const antigo = s.http.get('/mesas/7').then(r => s.cache.setQueryData(['mesa'], r.data), e => e);
        await tick(); await s.gestor.login('B', 'sintetica');
        s.cache.setQueryData(['mesa'], { numero: 12 }); pendente = false;
        if (codigo === 401) p.reject(httpErro(401)); else p.resolve({ numero: 7 });
        const erro = await antigo; assert.ok(axios.isCancel(erro));
        assert.equal(s.gestor.obterEstado().user.username, 'B'); assert.deepEqual(s.cache.getQueryData(['mesa']), { numero: 12 });
    });
}

test('401 da sessao atual encerra identidade; 403 revalida vinculo uma vez sem repetir operacao', async t => {
    let numero = 7;
    const s = ambiente(t, c => { if (c.url === '/auth/login') return { token: 'jwt' };
        if (c.url === '/auth/me') return usuario({ numeroMesa: numero }); throw httpErro(403); });
    await s.gestor.login('entrada', 'sintetica'); numero = 12;
    await assert.rejects(s.http.get('/mesas/7')); await tick();
    assert.equal(s.gestor.obterEstado().user.numeroMesa, 12); assert.equal(contextoAtualAdicao(7), null);
    const total = s.chamadas.length; await assert.rejects(s.http.get('/mesas/12')); await tick();
    await assert.rejects(s.http.get('/mesas/12')); await tick();
    assert.equal(s.chamadas.length, total + 3); // dois GET recusados e uma revalidacao para a nova identidade.
    assert.equal(s.chamadas.filter(c => c.method !== 'get').length, 1);
});

test('401 corrente invalida vinculo e cache sem apagar operacoes incertas', async t => {
    const s = ambiente(t, c => { if (c.url === '/auth/login') return { token: 'jwt' }; if (c.url === '/auth/me') return usuario(); throw httpErro(401); });
    await s.gestor.login('entrada', 'sintetica'); s.cache.setQueryData(['mesa'], 7);
    await assert.rejects(s.http.get('/mesas/7'));
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(contextoAtualAdicao(7), null);
    assert.equal(s.cache.getQueryData(['mesa']), undefined);
});

test('falha de armazenamento nao libera identidade nem contexto mutavel', async t => {
    const s = ambiente(t); s.local.setItem = () => { throw new Error('quota'); };
    await assert.rejects(s.gestor.login('entrada', 'sintetica'));
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(contextoAtualAdicao(7), null);
});

for (const tipo of ['abertura', 'adicao']) {
    test(`mudanca de vinculo preserva ${tipo} incerta e bloqueia replay na mesa nova`, async t => {
        let numero = 7; const s = ambiente(t, c => c.url === '/auth/login' ? { token: 'jwt' } : usuario({ numeroMesa: numero }));
        await s.gestor.login('entrada', 'sintetica'); const contexto = contextoAtualAdicao(7);
        const g = tipo === 'abertura' ? new GestorAbertura(s.session, contexto, () => contextoAtualAdicao(7))
            : new GestorAdicao(s.session, contexto, () => contextoAtualAdicao(7));
        const itens = [{ produtoId: 3, quantidade: 2 }]; let envios = 0;
        const falhar = async () => { envios++; throw httpErro(undefined); };
        if (tipo === 'abertura') await g.enviar(itens, falhar, () => assert.fail());
        else await g.enviar(15, itens, falhar, () => assert.fail());
        const chave = tipo === 'abertura' ? CHAVE_ABERTURA_PENDENTE : CHAVE_ADICAO_PENDENTE;
        const original = s.session.getItem(chave); numero = 12; await s.gestor.revalidar();
        assert.equal(contextoAtualAdicao(7), null); assert.equal(contextoAtualAdicao(12).numeroMesa, 12);
        const novo = tipo === 'abertura' ? new GestorAbertura(s.session, contextoAtualAdicao(12), () => contextoAtualAdicao(12))
            : new GestorAdicao(s.session, contextoAtualAdicao(12), () => contextoAtualAdicao(12));
        if (tipo === 'abertura') { await novo.enviar(itens, falhar, () => assert.fail()); assert.equal(novo.obterEstado().protegida, true); }
        else { await novo.enviar(99, itens, falhar, () => assert.fail()); assert.equal(novo.obterEstado().bloqueada, true); }
        assert.equal(s.session.getItem(chave), original); assert.equal(envios, 1);
        assert.ok(s.chamadas.every(c => c.url.startsWith('/auth/')));
    });
}

for (const tipo of ['abertura', 'adicao']) {
    test(`resposta tardia de ${tipo} apos troca de usuario nao limpa carrinho ou guarda`, async t => {
        let numero = 7; const s = ambiente(t, c => c.url === '/auth/login' ? { token: `jwt-${numero}` } : usuario({ username: `cliente-${numero}`, numeroMesa: numero }));
        await s.gestor.login('A', 'sintetica'); const contexto = contextoAtualAdicao(7), p = adiada();
        const g = tipo === 'abertura' ? new GestorAbertura(s.session, contexto, () => contextoAtualAdicao(7))
            : new GestorAdicao(s.session, contexto, () => contextoAtualAdicao(7));
        const itens = [{ produtoId: 3, quantidade: 2 }];
        const envio = tipo === 'abertura' ? g.enviar(itens, () => p.promise, () => assert.fail('limpeza antiga'))
            : g.enviar(15, itens, () => p.promise, () => assert.fail('limpeza antiga'));
        const chave = tipo === 'abertura' ? CHAVE_ABERTURA_PENDENTE : CHAVE_ADICAO_PENDENTE;
        const original = s.session.getItem(chave);
        s.gestor.logout(); numero = 12; await s.gestor.login('B', 'sintetica');
        s.local.setItem('carrinho_mesa_12', 'selecao de B');
        p.resolve({}); await envio;
        assert.equal(s.session.getItem(chave), original); assert.equal(s.local.getItem('carrinho_mesa_12'), 'selecao de B');
        assert.equal(s.gestor.obterEstado().user.numeroMesa, 12);
    });
}

test('consulta QueryClient antiga nao repovoa cache apos troca de sessao', async t => {
    const p = adiada(); const s = ambiente(t, c => c.url === '/mesas/7' ? p.promise : c.url === '/auth/login' ? { token: 'jwt-B' } : usuario({ numeroMesa: 12 }));
    s.local.setItem('token', 'jwt-A');
    const consulta = s.cache.fetchQuery({ queryKey: ['mesa', 7], queryFn: async () => (await s.http.get('/mesas/7')).data }).catch(e => e);
    await tick(); await s.gestor.login('B', 'sintetica'); p.resolve({ numero: 7 }); await consulta; await tick();
    assert.equal(s.cache.getQueryData(['mesa', 7]), undefined);
    assert.equal(s.gestor.obterEstado().user.numeroMesa, 12);
});

test('reload com JWT expirado nao confia no usuario persistido e permite novo login', async t => {
    const s = ambiente(t, () => { throw httpErro(401); });
    s.local.setItem('token', 'jwt-expirado'); s.local.setItem('user', JSON.stringify(usuario()));
    await s.gestor.restaurar();
    assert.equal(s.gestor.obterEstado().user, null); assert.equal(s.gestor.obterEstado().loading, false);
    assert.equal(s.gestor.obterEstado().podeRecuperar, false); assert.equal(s.local.getItem('token'), null);
});

test('timeout ao recuperar identidade nao libera consultas dependentes nem reenvia login', async t => {
    const s = ambiente(t, () => { throw { code: 'ECONNABORTED' }; }); s.local.setItem('token', 'jwt');
    await s.gestor.restaurar(); assert.equal(s.gestor.obterEstado().user, null);
    assert.equal(contextoAtualAdicao(7), null); assert.equal(s.chamadas.length, 1);
    assert.equal(s.chamadas[0].url, '/auth/me'); assert.equal(s.gestor.obterEstado().loading, false);
});

test('interromper o provider impede publicacao tardia mesmo sem suporte a abort', async t => {
    const p = adiada(), s = ambiente(t);
    const gestor = new SessaoAutenticada({ get: async () => ({ status: 200, data: await p.promise }), post: async () => assert.fail() }, s.local, s.cache, s.controle, () => assert.fail());
    s.local.setItem('token', 'jwt'); const restauracao = gestor.restaurar(); gestor.parar(); p.resolve(usuario()); await restauracao;
    assert.equal(gestor.obterEstado().user, null); assert.equal(contextoAtualAdicao(7), null);
});

test('abertura confirmada permite nova adicao legitima no mesmo contexto autenticado', async t => {
    const s = ambiente(t); await s.gestor.login('entrada', 'sintetica'); const contexto = contextoAtualAdicao(7);
    const abertura = new GestorAbertura(s.session, contexto, () => contextoAtualAdicao(7));
    let aberturas = 0, adicoes = 0;
    await abertura.enviar([{ produtoId: 3, quantidade: 1 }], async dados => { aberturas++; assert.equal(dados.numeroMesa, 7); }, () => {});
    assert.equal(s.session.getItem(CHAVE_ABERTURA_PENDENTE), null);
    const adicao = new GestorAdicao(s.session, contexto, () => contextoAtualAdicao(7));
    await adicao.enviar(15, [{ produtoId: 4, quantidade: 2 }], async op => {
        adicoes++; assert.deepEqual(op.contexto, contexto); assert.equal(op.pedidoId, 15);
    }, () => {});
    assert.equal(aberturas, 1); assert.equal(adicoes, 1); assert.equal(s.session.getItem(CHAVE_ADICAO_PENDENTE), null);
});

for (const tipo of ['abertura', 'adicao']) {
    test(`reload de ${tipo} incerta mantem contexto original e recuperacao segura`, async t => {
        const s = ambiente(t); await s.gestor.login('entrada', 'sintetica');
        const contexto = contextoAtualAdicao(7), itens = [{ produtoId: 3, quantidade: 2 }];
        const g = tipo === 'abertura' ? new GestorAbertura(s.session, contexto, () => contextoAtualAdicao(7))
            : new GestorAdicao(s.session, contexto, () => contextoAtualAdicao(7));
        const falhar = async () => { throw httpErro(undefined); };
        if (tipo === 'abertura') await g.enviar(itens, falhar, () => assert.fail());
        else await g.enviar(15, itens, falhar, () => assert.fail());
        const chave = tipo === 'abertura' ? CHAVE_ABERTURA_PENDENTE : CHAVE_ADICAO_PENDENTE;
        const original = s.session.getItem(chave);
        s.gestor.parar(); assert.equal(contextoAtualAdicao(7), null);
        const recarregada = new SessaoAutenticada(s.http, s.local, s.cache, s.controle, () => {});
        await recarregada.restaurar(); assert.deepEqual(contextoAtualAdicao(7), contexto);
        if (tipo === 'abertura') {
            const nova = new GestorAbertura(s.session, contextoAtualAdicao(7), () => contextoAtualAdicao(7));
            await nova.enviar(itens, () => assert.fail('POST nao pode ser repetido'), () => assert.fail());
            assert.equal(nova.obterEstado().protegida, true); assert.equal(s.session.getItem(chave), original);
        } else {
            const nova = new GestorAdicao(s.session, contextoAtualAdicao(7), () => contextoAtualAdicao(7));
            await nova.enviar(999, [{ produtoId: 99, quantidade: 9 }], async op => {
                assert.equal(op.chave, JSON.parse(original).chave); assert.equal(op.pedidoId, 15);
                assert.deepEqual(op.itens, itens);
            }, () => {});
            assert.equal(s.session.getItem(chave), null);
        }
        assert.equal(s.chamadas.filter(c => c.url === '/auth/login').length, 1);
    });
}
