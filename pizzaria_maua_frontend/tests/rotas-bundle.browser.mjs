// Build: VITE_API_BASE_URL=/fixture-api npm run build
// node tests/rotas-bundle.browser.mjs [--medir-apenas] [--dist DIRETORIO]
// Chrome instalado + CDP nativo do Node; sem API real, credenciais reais ou dependências novas.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const medirApenas = process.argv.includes('--medir-apenas');
const dist = process.argv.includes('--dist') ? path.resolve(process.argv[process.argv.indexOf('--dist') + 1]) : path.join(root, 'dist');
if (!existsSync(path.join(dist, 'index.html'))) throw new Error('Execute o build controlado antes do teste.');
const destino = mkdtempSync(path.join(tmpdir(), 'pizzaria-fe018-'));
const chromeBin = process.env.CHROME_BIN || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chromeBin) throw new Error('Informe CHROME_BIN com um Chrome/Edge instalado. Nenhuma instalação é feita pelo roteiro.');
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
async function portaLivre() {
    const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const porta = server.address().port; await new Promise(resolve => server.close(resolve)); return porta;
}
const porta = await portaLivre(), debug = await portaLivre(), origem = `http://127.0.0.1:${porta}`;
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', dist, '--host', '127.0.0.1', '--port', String(porta), '--strictPort'],
    { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, VITE_API_BASE_URL: `${origem}/fixture-api` } });
const chrome = spawn(chromeBin, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', `--remote-debugging-port=${debug}`, `--user-data-dir=${path.join(destino, 'profile')}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
let socket;
const resultados = [], falhas = [], erros = [];
let mutacoes = 0, chamadas = 0, verificacoes = 0, externasBloqueadas = 0, perfil = 'MESA', livre = false;
const mutacoesPendentes = [];
const scripts = new Set(), requisicoes = new Map();
let reterChunk = false, falharChunk = false;
const chunksRetidos = [];
const auth = [];
let abertura = false;
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
        if (m.method === 'Network.requestWillBeSent') {
            const u = new URL(m.params.request.url);
            if (u.origin === origem && u.pathname.endsWith('.js')) scripts.add(u.pathname);
            requisicoes.set(m.params.requestId, {url:u.pathname});
        }
        if (m.method === 'Network.loadingFinished' && requisicoes.has(m.params.requestId)) requisicoes.get(m.params.requestId).transferido=m.params.encodedDataLength;
        if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.text);
        if (m.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = m.params, url = new URL(request.url);
        if (/DashboardGerente-.*\.js$/.test(url.pathname) && (reterChunk || falharChunk)) {
            if (reterChunk) chunksRetidos.push(requestId);
            else void cdp('Fetch.failRequest',{requestId,errorReason:'Failed'});
            return;
        }
        // Fontes remotas ou scripts injetados pelo ambiente nunca saem para a rede.
        if (url.origin !== origem) {
            externasBloqueadas++;
            void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
                .catch(() => { erros.push('Falha ao bloquear recurso externo.'); }); return;
        }
        if (url.origin === origem && !url.pathname.startsWith('/fixture-api') && request.method === 'GET') {
            void cdp('Fetch.continueRequest', { requestId }).catch(() => {}); return;
        }
        chamadas++;
        if (url.pathname.endsWith('/auth/login') && request.method === 'POST') {
            auth.push('login');
            void cdp('Fetch.fulfillRequest',{requestId,responseCode:200,body:Buffer.from(JSON.stringify({token:'token-sintetico'})).toString('base64'),responseHeaders:[{name:'Content-Type',value:'application/json'}]});return;
        }
        if (url.pathname.endsWith('/auth/me')) auth.push('me');
        if (url.pathname.endsWith('/pedidos') && request.method === 'POST') {
            const dados=JSON.parse(request.postData);if(dados.numeroMesa!==7||dados.itens.length!==1)erros.push('Abertura fora do contexto sintético');abertura=true;livre=false;mutacoes++;
            void cdp('Fetch.fulfillRequest',{requestId,responseCode:200,body:Buffer.from(JSON.stringify(pedido)).toString('base64'),responseHeaders:[{name:'Content-Type',value:'application/json'}]});return;
        }
        if (!['GET', 'OPTIONS'].includes(request.method)) {
            if (!(request.method === 'PATCH' && url.pathname.endsWith('/pedidos/15/finalizar'))
                && !(request.method === 'DELETE' && url.pathname.endsWith('/mesas/7'))) {
                erros.push('Mutação fora das fixtures previstas.');
                void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {}); return;
            }
            mutacoes++; mutacoesPendentes.push({requestId, method:request.method, caminho:url.pathname}); return;
        }
        const p = url.pathname; let data = [];
        if (p.endsWith('/auth/me')) data = { username: 'usuario-sintetico', role: perfil, numeroMesa: perfil === 'MESA' ? 7 : null };
        else if (/\/mesas\/7$/.test(p)) data = { id: 7, numero: 7, status: livre ? 'LIVRE' : 'OCUPADA', ativo: true };
        else if (p.endsWith('/mesas')) data = [{ id: 7, numero: 7, status: 'OCUPADA', ativo: true }, { id: 8, numero: 8, status: 'LIVRE', ativo: true }];
        else if (p.includes('/produtos')) data = produtos;
        else if (p.endsWith('/aberto')) data = pedido;
        else if (p.endsWith('/cozinha')) data = [pedido];
        else if (p.endsWith('/finalizados')) data = [{ ...pedido, status: 'FINALIZADO', formaPagamento: 'PIX' }];
        else if (p.endsWith('/faturamento')) data = 210;
        else if (p.endsWith('/resumo')) data = { faturamento: 210, ticketMedio: 35, tempoMedioCozinhaMinutos: 20, taxaBebidas: 0 };
        else if (p.endsWith('/rankings')) data = { topPizzas: [], gargalos: [] };
        else if (p.endsWith('/vendas-hora') || p.endsWith('/pagamentos')) data = [];
        else {
            erros.push('Consulta fora das fixtures previstas.');
            void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {}); return;
        }
        void cdp('Fetch.fulfillRequest', { requestId, responseCode: p.endsWith('/aberto') && livre && !abertura ? 404 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }).catch(() => {});
    });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable'); await cdp('Network.setCacheDisabled',{cacheDisabled:true}); await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
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
    async function navegar(role, rota, cheio = false, aviso = '', token = true) {
        perfil = role;
        if (inicializador) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: inicializador });
        const itens = cheio ? produtos.slice(0, 4).map((produto, i) => ({ produto, quantidade: i + 1 })) : [];
        inicializador = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
            const timeoutOriginal=window.setTimeout, cancelarOriginal=window.clearTimeout;
            window.__cronometrosAtivos=new Map();window.__iniciosCronometro=0;
            window.setTimeout=(callback,ms,...args)=>{
                if(ms!==180000)return timeoutOriginal(callback,ms,...args);
                let id;const executar=()=>{if(!window.__cronometrosAtivos.has(id))return;window.__cronometrosAtivos.delete(id);cancelarOriginal(id);callback(...args)};
                id=timeoutOriginal(executar,ms);window.__cronometrosAtivos.set(id,executar);window.__iniciosCronometro++;
                window.__ativarStandby=executar;return id;
            };
            window.clearTimeout=id=>{window.__cronometrosAtivos.delete(id);cancelarOriginal(id)};
            localStorage.clear();sessionStorage.clear();${token ? "localStorage.setItem('token','token-sintetico');" : ''}sessionStorage.setItem('pizzaria_tutorial_concluido','true');localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),${JSON.stringify(JSON.stringify({ versao: 1, proprietario: { username: 'usuario-sintetico', numeroMesa: 7 }, itens }))});${aviso === 'pendencia' ? "sessionStorage.setItem('pizzaria-abertura-pendente','{');" : ''}${aviso === 'carrinho' ? "localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),'{');" : ''}` })).identifier;
        await cdp('Page.navigate', { url: origem + rota });
    }
    const verificar = (ok, nome, dados) => { verificacoes++; if (!ok) falhas.push({ nome, dados }); };
    async function tecla(key, shift = false) {
        const codigos = { Tab: 9, Enter: 13, ' ': 32, Escape: 27 };
        const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: codigos[key], modifiers: shift ? 8 : 0 };
        await cdp('Input.dispatchKeyEvent', { ...base, type: 'keyDown', ...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{}) });
        await cdp('Input.dispatchKeyEvent', { ...base, type: 'keyUp' }); await pausa(40);
    }
    async function focar(seletor) { await avaliar(`document.querySelector(${JSON.stringify(seletor)}).focus()`); }
    async function abrir(seletor) { await focar(seletor); await tecla('Enter'); await aguardar('[role=dialog]'); }
    const dentro = () => avaliar(`!!document.activeElement.closest('[role=dialog]')`);
    const conferir = (ok,nome,dados={}) => {verificar(ok,nome,dados);if(!ok)throw new Error(nome)};
    const ir = async rota => {await avaliar(`history.pushState({},'',${JSON.stringify(rota)});dispatchEvent(new PopStateEvent('popstate'))`)};
    const sair = async () => {
        await avaliar(`localStorage.removeItem('token');dispatchEvent(new StorageEvent('storage',{key:'token',newValue:null,storageArea:localStorage}))`);
        await aguardar('input[type=password]');
        conferir(await avaliar(`location.pathname==='/login'&&!document.querySelector('.dashboard-title,.card-cozinha,.card-produto')`),'Logout remove conteúdo protegido');
    };
    await cdp('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
    await navegar('MESA','/cardapio');await aguardar('.card-produto');
    const inicialMesa = [...scripts];
    const transferenciaMesa=[...requisicoes.values()].filter(r=>inicialMesa.includes(r.url)).reduce((a,r)=>a+(r.transferido||0),0);
    conferir(medirApenas || !inicialMesa.some(s=>/DashboardGerente-|ArquivoCaixa-|column\.esm-|auto-/.test(s)),'MESA não solicita chunks administrativos ou Chart.js', {inicialMesa});
    if (!medirApenas) {
        for (const [role,rota,seletor] of [['MESA','/cardapio','.card-produto'],['COZINHA','/pedidos','.card-cozinha'],['CAIXA','/caixa','.caixa-container'],['GERENTE','/dashboard','.dashboard-title']]) {
            await navegar(role,'/login',false,'',false);await aguardar('input[type=password]');const n=auth.length;
            await avaliar(`(()=>{for(const [id,v] of [['username','usuario-sintetico'],['senha','senha-ficticia']]){const e=document.getElementById(id)||document.querySelector('input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))}})()`);
            await avaliar(`document.querySelector('button[type=submit]').click()`);await aguardar(seletor);
            conferir(auth.slice(n).includes('login')&&auth.slice(n).includes('me'),`${role}: login e identidade reais via HTTP simulado`);
            conferir(await avaliar(`location.pathname===${JSON.stringify(rota)}`),`${role}: destino autorizado`);
            if(role==='MESA') {
                await abrir('.btn-detalhes');await tecla('Escape');conferir(await avaliar(`document.activeElement.matches('.btn-detalhes')`),'Produto retorna foco');
                await avaliar(`document.querySelector('.card-produto .btn-accent').click()`);await aguardar('.item-carrinho-nome');
                await avaliar(`window.__ativarStandby()`);await aguardar('.standby-fullscreen-container');conferir(await avaliar(`document.activeElement.matches('.standby-fullscreen-container')`),'Standby preserva foco');await tecla('Enter');await aguardar('.card-produto');
            }
            if(role==='COZINHA') conferir(await avaliar(`document.querySelectorAll('.badge-timer').length>0`),'Cozinha mantém estados de preparo');
            if(role==='CAIXA') {
                await ir('/caixa/arquivo');await aguardar('.btn-alternador');
                conferir([...scripts].some(s=>/ArquivoCaixa-.*\.js$/.test(s)),'Arquivo é solicitado sob demanda');
                await ir('/caixa');await aguardar('.caixa-container');
            }
            if(role==='GERENTE') {
                conferir([...scripts].some(s=>/DashboardGerente-.*\.js$/.test(s)),'Dashboard é solicitado sob demanda');
                await avaliar(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Inteligência')).click()`);await aguardar('canvas');
                conferir([...scripts].some(s=>/auto-.*\.js$/.test(s)),'Gráficos carregam Chart.js somente ao abrir a aba analítica');
                for(const [destino,alvo] of [['/mesas','.grid-mesas'],['/produtos','.gerente-produtos-container'],['/dashboard','.dashboard-title']]) {await ir(destino);await aguardar(alvo);conferir(true,`Gerente navega para ${destino}`)}
            }
            await sair();
        }
        livre=true;abertura=false;await navegar('MESA','/cardapio');await aguardar('.tela-inicio-fullscreen-container');
        await avaliar(`document.querySelector('.tela-inicio-fullscreen-container').click()`);await aguardar('.onboarding-modal');await tecla('Escape');await aguardar('.card-produto');
        await avaliar(`document.querySelector('.card-produto .btn-accent').click()`);await aguardar('[data-tour=step-4]:not(:disabled)');const antesAbertura=mutacoes;
        await avaliar(`document.querySelector('[data-tour=step-4]').click()`);await aguardar('.btn-fechamento');
        conferir(abertura&&mutacoes===antesAbertura+1,'Abertura explícita usa mesa autenticada sem repetir POST');await sair();
        const chunksGerenciais=()=>[...requisicoes.values()].filter(r=>/DashboardGerente-.*\.js$/.test(r.url)).length;
        const antesAnonimo=chunksGerenciais();
        await navegar('GERENTE','/dashboard',false,'',false);await aguardar('input[type=password]');conferir(true,'Anônimo não acessa dashboard');
        conferir(chunksGerenciais()===antesAnonimo,'Guarda anônima não inicia importação protegida');
        const antesPerfil=chunksGerenciais();
        await navegar('MESA','/dashboard');await aguardar('h2');conferir(await avaliar(`location.pathname==='/unauthorized'`),'Perfil inadequado não acessa dashboard');
        conferir(chunksGerenciais()===antesPerfil,'Perfil inadequado não solicita chunk gerencial');
        await navegar('CAIXA','/caixa/arquivo');await aguardar('.btn-alternador');await cdp('Page.reload',{ignoreCache:true});await aguardar('.btn-alternador');conferir(true,'Reload direto recupera identidade e rota autorizada');
        // Cada navegação completa cria um novo contexto de módulos; o chunk ainda pode estar pendente.
        reterChunk=true;await navegar('GERENTE','/dashboard');await aguardar('[role=status]');
        for(let i=0;i<100&&!chunksRetidos.length;i++)await pausa(50);
        conferir(chunksRetidos.length>0,'Chunk gerencial realmente pendente');await sair();
        reterChunk=false;for(const requestId of chunksRetidos.splice(0))await cdp('Fetch.continueRequest',{requestId});await pausa(300);
        conferir(await avaliar(`location.pathname==='/login'&&!document.querySelector('.dashboard-title')`),'Chunk tardio não reativa sessão');
        falharChunk=true;await navegar('GERENTE','/dashboard');await aguardar('[role=alert] button');
        conferir(await avaliar(`document.querySelector('[role=alert]').textContent.includes('Recarregar tela')`),'Falha do chunk oferece recuperação explícita');
        falharChunk=false;await avaliar(`document.querySelector('[role=alert] button').click()`);await aguardar('.dashboard-title');conferir(true,'Recarga explícita recupera rota após falha do chunk');
        await sair();await navegar('MESA','/cardapio');await aguardar('.card-produto');
        conferir(await avaliar(`!document.querySelector('.dashboard-title,.btn-alternador')`),'Troca para MESA não mostra conteúdo administrativo anterior');
    }
    conferir(mutacoesPendentes.length===0,'Nenhuma mutação sintética fica pendente');
    conferir(erros.length===0,'Sem exceções inesperadas',erros);
    const relatorio={inicialMesa,transferenciaMesa,verificacoes,falhas,erros,scripts:[...scripts],externasBloqueadas,mutacoesSimuladas:mutacoes};
    writeFileSync(path.join(destino,'medidas.json'),JSON.stringify(relatorio,null,2));console.log(JSON.stringify({evidencias:destino,...relatorio}));
    if(falhas.length)process.exitCode=1;
    await cdp('Browser.close').catch(()=>{});
} finally {socket?.close();chrome.kill();vite.kill();}
