// Execução explícita: node tests/responsividade.browser.mjs
// Chrome instalado + CDP nativo do Node; sem API real, credenciais reais ou dependências novas.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destino = mkdtempSync(path.join(tmpdir(), 'pizzaria-fe016-'));
const chromeBin = process.env.CHROME_BIN || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chromeBin) throw new Error('Informe CHROME_BIN com um Chrome/Edge instalado. Nenhuma instalação é feita pelo roteiro.');
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
async function portaLivre() {
    const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const porta = server.address().port; await new Promise(resolve => server.close(resolve)); return porta;
}
const porta = await portaLivre(), debug = await portaLivre(), origem = `http://127.0.0.1:${porta}`;
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(porta), '--strictPort'],
    { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, VITE_API_BASE_URL: `${origem}/fixture-api` } });
const chrome = spawn(chromeBin, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', `--remote-debugging-port=${debug}`, `--user-data-dir=${path.join(destino, 'profile')}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
let socket;
const resultados = [], falhas = [], erros = [];
let mutacoes = 0, chamadas = 0, verificacoes = 0, perfil = 'MESA';
try {
    async function esperarHTTP(url) {
        for (let i = 0; i < 100; i++) {
            try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return r; } catch { /* servidor iniciando */ }
            await pausa(100);
        }
        throw new Error('Servidor local não iniciou.');
    }
    await esperarHTTP(origem);
    const tabs = await (await esperarHTTP(`http://127.0.0.1:${debug}/json`)).json();
    socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const pendentes = new Map(); let sequencia = 0;
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequencia, timer = setTimeout(() => { pendentes.delete(id); reject(new Error(`Timeout CDP: ${method}`)); }, 20000);
        pendentes.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const produtos = Array.from({ length: 6 }, (_, i) => ({ id: i + 4, nome: `Pizza Especial da Casa ${i + 1} com Queijos, Tomates e Manjericão`,
        categoria: 'PIZZAS', descricao: { breveDescricao: 'Pizza tradicional preparada na hora.', tempoMedioPreparo: '20 minutos', pratoVegano: i === 0,
            ingredientes: ['Queijo', 'Tomate', 'Manjericão'] }, precoBase: 35 + i, imagemUrl: '/src/assets/LogoPizzaria.png', ativo: true, qtdEstoque: 20 }));
    const pedido = { id: 15, numeroMesa: 7, dataHora: '2026-11-19T19:00:00', formaPagamento: null, faturamento: 210, status: 'ABERTO',
        itens: produtos.map((p, i) => ({ id: 31 + i, produtoId: p.id, produtoNome: p.nome, quantidade: i + 1, precoUnitario: p.precoBase,
            status: i % 2 ? 'EM_PREPARO' : 'PENDENTE', dataHoraInclusao: '2026-11-19T19:00:00', tempoPreparoMinutos: i % 2 ? 40 : 15, dataHoraConclusao: null })) };
    socket.addEventListener('message', event => {
        const m = JSON.parse(event.data);
        if (m.id) { const p = pendentes.get(m.id); pendentes.delete(m.id); if (m.error) p?.reject(m.error); else p?.resolve(m.result); return; }
        if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.text);
        if (m.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = m.params, url = new URL(request.url);
        if (url.origin === origem && !url.pathname.startsWith('/fixture-api')) {
            void cdp('Fetch.continueRequest', { requestId }).catch(() => {}); return;
        }
        chamadas++;
        if (!['GET', 'OPTIONS'].includes(request.method)) mutacoes++;
        const p = url.pathname; let data = [];
        if (p.endsWith('/auth/me')) data = { username: 'usuario-sintetico', role: perfil, numeroMesa: perfil === 'MESA' ? 7 : null };
        else if (/\/mesas\/7$/.test(p)) data = { id: 7, numero: 7, status: 'OCUPADA', ativo: true };
        else if (p.endsWith('/mesas')) data = [{ id: 7, numero: 7, status: 'OCUPADA', ativo: true }, { id: 8, numero: 8, status: 'LIVRE', ativo: true }];
        else if (p.includes('/produtos')) data = produtos;
        else if (p.endsWith('/aberto')) data = pedido;
        else if (p.endsWith('/cozinha')) data = [pedido];
        else if (p.endsWith('/finalizados')) data = [{ ...pedido, status: 'FINALIZADO', formaPagamento: 'PIX' }];
        else if (p.endsWith('/faturamento')) data = 210;
        else if (p.endsWith('/resumo')) data = { faturamento: 210, ticketMedio: 35, tempoMedioCozinhaMinutos: 20, taxaBebidas: 0 };
        else if (p.endsWith('/rankings')) data = { topPizzas: [], gargalos: [] };
        void cdp('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }).catch(() => {});
    });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const avaliar = async expression => {
        const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error('Falha na avaliação do DOM.'); return r.result?.value;
    };
    async function aguardar(seletor) {
        for (let i = 0; i < 100; i++) { if (await avaliar(`!!document.querySelector(${JSON.stringify(seletor)})`)) {
            await avaliar(`Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))]).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
            await pausa(350); return;
        } await pausa(100); }
        throw new Error(`Elemento não carregado: ${seletor}`);
    }
    let inicializador;
    async function navegar(role, rota, cheio = false, aviso = '') {
        perfil = role;
        if (inicializador) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: inicializador });
        const itens = cheio ? produtos.slice(0, 4).map((produto, i) => ({ produto, quantidade: i + 1 })) : [];
        inicializador = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear();sessionStorage.clear();localStorage.setItem('token','token-sintetico');sessionStorage.setItem('pizzaria_tutorial_concluido','true');localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),${JSON.stringify(JSON.stringify({ versao: 1, proprietario: { username: 'usuario-sintetico', numeroMesa: 7 }, itens }))});${aviso === 'pendencia' ? "sessionStorage.setItem('pizzaria-abertura-pendente','{');" : ''}${aviso === 'carrinho' ? "localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),'{');" : ''}` })).identifier;
        await cdp('Page.navigate', { url: origem + rota });
    }
    const verificar = (ok, nome, dados) => { verificacoes++; if (!ok) falhas.push({ nome, dados }); };
    async function captura(nome) { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(destino, `${nome}.png`), Buffer.from(r.data, 'base64')); }
    const medidas = async () => avaliar(`(()=>{const rect=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null};return{viewport:innerWidth,scroll:document.documentElement.scrollWidth,produtos:rect('.coluna-cardapio'),carrinho:rect('.coluna-pedido'),card:rect('.card-produto'),cards:[...document.querySelectorAll('.card-produto,.card-cozinha')].map(e=>e.getBoundingClientRect().toJSON()),botoes:[...document.querySelectorAll('.btn-entregar,.btn-qty')].map(e=>e.getBoundingClientRect().toJSON())}})()`);
    for (const [w, h] of [[768, 1024], [800, 1280], [1024, 768], [1280, 800], [1366, 768], [390, 844], [832, 1024], [833, 1024]]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        for (const cheio of [false, true]) {
            await navegar('MESA', '/cardapio', cheio); await aguardar('.card-produto');
            const m = await medidas(); resultados.push({ tela: 'cardapio', w, h, cheio, ...m });
            verificar(m.scroll <= w, `Cardápio sem overflow ${w} cheio=${cheio}`, m);
            verificar(m.card.width >= 250 && m.produtos.width >= m.card.width - 1, `Card completo ${w}`, m);
            const lado = m.carrinho.left >= m.produtos.right - 1;
            verificar(lado ? m.cards.every(c => c.right <= m.carrinho.left - 15) : m.carrinho.top >= m.produtos.bottom + 15,
                `Produtos e carrinho sem interseção ${w}`, m);
            if ([768, 390].includes(w) && cheio) await captura(`cardapio-${w}`);
            if (cheio) {
                const envio = await avaliar(`(()=>{const e=document.querySelector('[data-tour="step-4"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{habilitado:!e.disabled,clicavel:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
                verificar(envio.habilitado && envio.clicavel, `Envio acessível com carrinho cheio ${w}`, envio);
            }
            await avaliar(`document.querySelector('.btn-detalhes').click()`); await aguardar('.modal-detalhes-card');
            const modal = await avaliar(`document.querySelector('.modal-detalhes-card').getBoundingClientRect().toJSON()`);
            verificar(modal.left >= 0 && modal.right <= w && modal.top >= 0 && modal.bottom <= h, `Modal comum dentro da viewport ${w}`, modal);
            await avaliar(`document.querySelector('.modal-detalhes-fechar').click()`);
        }
        await navegar('COZINHA', '/pedidos'); await aguardar('.card-cozinha');
        const cozinha = await medidas(); resultados.push({ tela: 'cozinha', w, h, ...cozinha });
        verificar(cozinha.scroll <= w && cozinha.cards.every(c => c.left >= 0 && c.right <= w), `Cozinha sem corte ${w}`, cozinha);
        verificar(cozinha.botoes.every(b => b.left >= 0 && b.right <= w), `Conclusão visível ${w}`, cozinha);
        const cabecalho = await avaliar(`['.nav-cozinha-logo','.nav-cozinha-acoes'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON())`);
        verificar(cabecalho.every(r => r.left >= 0 && r.right <= w), `Cabeçalho cozinha visível ${w}`, cabecalho);
        if (w === 390) await captura('cozinha-390');
        await navegar('GERENTE', '/mesas'); await aguardar('.grid-mesas .card-mesa');
        const menu = await avaliar(`({scroll:document.documentElement.scrollWidth,links:[...document.querySelectorAll('.menu-gerente-link')].map(e=>e.getBoundingClientRect().toJSON())})`);
        resultados.push({ tela: 'menu', w, h, ...menu }); verificar(menu.scroll <= w && menu.links.length === 5 && menu.links.every(r => r.left >= 0 && r.right <= w), `Menu acessível ${w}`, menu);
        await avaliar(`document.querySelector('.nav-avatar').click()`); await pausa(100);
        const dropdown = await avaliar(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Logout'));const r=e.getBoundingClientRect();return{rect:r.toJSON(),clicavel:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
        resultados.push({ tela: 'dropdown', w, h, ...dropdown }); verificar(dropdown.clicavel && dropdown.rect.left >= 0 && dropdown.rect.right <= w, `Dropdown clicável ${w}`, dropdown);
        if (w === 390) await captura('dropdown-390');
        // Exercita o clique real e a navegação de logout apenas nesta sessão sintética.
        if (dropdown.clicavel) {
        await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: dropdown.rect.x + dropdown.rect.width / 2, y: dropdown.rect.y + dropdown.rect.height / 2, button: 'left', clickCount: 1 });
        await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dropdown.rect.x + dropdown.rect.width / 2, y: dropdown.rect.y + dropdown.rect.height / 2, button: 'left', clickCount: 1 });
        await aguardar('input[type=password]'); verificar(await avaliar(`location.pathname==='/login'`), `Logout sintético ${w}`, {});
        }
        await navegar('GERENTE', '/dashboard'); await aguardar('.dashboard-container');
        verificar(await avaliar(`document.documentElement.scrollWidth<=innerWidth`), `Dashboard sem overflow ${w}`, {});
        await navegar('CAIXA', '/caixa/arquivo'); await aguardar('.btn-alternador');
        await avaliar(`[...document.querySelectorAll('.btn-alternador')].find(e=>e.textContent.includes('Tabela')).click()`); await aguardar('.p-datatable');
        verificar(await avaliar(`document.documentElement.scrollWidth<=innerWidth`), `Arquivo tabela sem overflow da página ${w}`, {});
        if ([768, 390].includes(w)) {
            await navegar('MESA', '/cardapio', true, 'pendencia'); await aguardar('.carrinho-conteudo[role=status]');
            verificar(await avaliar(`(()=>{const e=document.querySelector('.carrinho-conteudo[role=status]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>0&&getComputedStyle(e).visibility==='visible'})()`), `Aviso de pendência visível ${w}`, {});
            await navegar('MESA', '/cardapio', false, 'carrinho'); await aguardar('.error-card[role=alert]');
            verificar(await avaliar(`(()=>{const e=document.querySelector('.error-card button');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`), `Revisão explícita acessível ${w}`, {});
        }
    }
    verificar(mutacoes === 0, 'Nenhuma mutação HTTP disparada', { mutacoes }); verificar(erros.length === 0, 'Sem exceções de execução', erros);
    writeFileSync(path.join(destino, 'medidas.json'), JSON.stringify({ resultados, verificacoes, falhas, erros, chamadas, mutacoes }, null, 2));
    console.log(JSON.stringify({ evidencias: destino, cenarios: resultados.length, verificacoes, falhas, erros, chamadas, mutacoes }));
    if (falhas.length) process.exitCode = 1;
    await cdp('Browser.close').catch(() => {});
} finally { socket?.close(); chrome.kill(); vite.kill(); }
