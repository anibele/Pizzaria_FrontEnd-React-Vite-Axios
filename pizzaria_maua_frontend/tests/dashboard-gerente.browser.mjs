// node tests/dashboard-gerente.browser.mjs
// Vite controlado, relógio sintético e API somente leitura interceptada antes da navegação.
// Chrome instalado + CDP nativo do Node; sem API real, credenciais reais ou dependências novas.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destino = mkdtempSync(path.join(tmpdir(), 'pizzaria-dashboard-regressao-'));
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
let verificacoes = 0, externasBloqueadas = 0;
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

    let modo='valor', valor=123.45, fase='', contador=0, canceladas=0;
    const consultas=[], retidas=[], evidencias=[];
    const responder=(id,codigo,dado)=>cdp('Fetch.fulfillRequest',{requestId:id,responseCode:codigo,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(dado)).toString('base64')});
    socket.addEventListener('message',event=>{
        const m=JSON.parse(event.data);
        if(m.id){const p=pendentes.get(m.id);pendentes.delete(m.id);if(m.error&&/Invalid InterceptionId/i.test(m.error.message)){canceladas++;p?.resolve({cancelada:true})}else if(m.error)p?.reject(m.error);else p?.resolve(m.result);return;}
        if(m.method==='Runtime.exceptionThrown')erros.push(m.params.exceptionDetails.text);
        if(m.method!=='Fetch.requestPaused')return;
        const {requestId,request}=m.params,u=new URL(request.url);
        if(u.origin!==origem){externasBloqueadas++;void cdp('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
        if(request.method!=='GET'){erros.push('Mutacao inesperada bloqueada');void cdp('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
        if(!u.pathname.startsWith('/fixture-api')){void cdp('Fetch.continueRequest',{requestId});return;}
        if(u.pathname.endsWith('/auth/me')){void responder(requestId,200,{username:'gerente-sintetico',role:'GERENTE',numeroMesa:null});return;}
        if(u.pathname.endsWith('/faturamento')){
            const data=u.searchParams.get('data');consultas.push({fase,modo,data,id:++contador});
            if(modo==='retido'){retidas.push({requestId,data});return;}
            if(modo==='rede'){void cdp('Fetch.failRequest',{requestId,errorReason:'ConnectionFailed'});return;}
            const dado=modo==='por-data'?(data==='2026-11-19'?119:220):valor;
            void responder(requestId,modo==='500'?500:modo==='404'?404:200,dado);return;
        }
        if(u.pathname.endsWith('/cozinha')||u.pathname.endsWith('/finalizados')||u.pathname.endsWith('/vendas-hora')||u.pathname.endsWith('/pagamentos')){void responder(requestId,200,[]);return;}
        if(u.pathname.endsWith('/resumo')){void responder(requestId,200,{faturamento:99,ticketMedio:9,tempoMedioCozinhaMinutos:12,taxaBebidas:10});return;}
        if(u.pathname.endsWith('/rankings')){void responder(requestId,200,{topPizzas:[],gargalos:[]});return;}
        erros.push('Consulta inesperada bloqueada');void cdp('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
    });
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Network.setCacheDisabled',{cacheDisabled:true});await cdp('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    await cdp('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});

    const avaliar=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Avaliação de DOM falhou');return r.result?.value};
    async function esperar(expression){for(let i=0;i<240;i++){if(await avaliar(expression)){await avaliar('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');return;}await pausa(50);}throw new Error('Condição não atingida: '+expression);}
    async function ate(fn){for(let i=0;i<240;i++){if(fn())return;await pausa(50);}throw new Error('Consulta esperada não chegou');}
    let inicializador;
    async function abrir(nome,tz='America/Sao_Paulo',iso='2026-11-20T02:59:59Z'){
        fase=nome;await cdp('Emulation.setTimezoneOverride',{timezoneId:tz});
        if(inicializador)await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:inicializador});
        inicializador=(await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
            const RealDate=Date;window.__agora=RealDate.parse(${JSON.stringify(iso)});
            window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__agora]))}static now(){return window.__agora}};
            const intervalOriginal=window.setInterval, cancelarInterval=window.clearInterval;window.__polls=new Map();
            window.setInterval=(cb,ms,...args)=>{const id=intervalOriginal(cb,ms,...args);if(ms===5000)window.__polls.set(id,()=>cb(...args));return id};
            window.clearInterval=id=>{window.__polls.delete(id);cancelarInterval(id)};
            window.__consultar=()=>[...window.__polls.values()].forEach(f=>f());
            const timeoutOriginal=window.setTimeout,cancelarTimeout=window.clearTimeout;window.__minutos=new Map();
            window.setTimeout=(cb,ms,...args)=>{
                if(ms!==60000-Date.now()%60000)return timeoutOriginal(cb,ms,...args);
                let id;const executar=()=>{if(!window.__minutos.has(id))return;window.__minutos.delete(id);cancelarTimeout(id);cb(...args)};
                id=timeoutOriginal(executar,ms);window.__minutos.set(id,executar);return id;
            };
            window.clearTimeout=id=>{window.__minutos.delete(id);cancelarTimeout(id)};
            window.__minuto=()=>[...window.__minutos.values()].forEach(f=>f());
            localStorage.clear();sessionStorage.clear();localStorage.setItem('token','token-sintetico');
        `})).identifier;
        await cdp('Page.navigate',{url:origem+'/dashboard'});
        await esperar(`!!document.querySelector('.dashboard-title')`);
    }
    const cartao=()=>avaliar(`(()=>{const el=document.querySelector('.dashboard-metrics-grid .metric-info');return{valor:el.querySelector('p').textContent,botao:el.querySelector('button')?.textContent,busy:el.querySelector('button')?.getAttribute('aria-busy'),focoBotao:el.querySelector('button')===document.activeElement,diaSP:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())}})()`);
    function verificar(ok,nome,dados={}){verificacoes++;evidencias.push({nome,ok,...dados});if(!ok)throw new Error(nome+': '+JSON.stringify(dados));}
    async function valorExibido(valor){await esperar(`document.querySelector('.metric-info p').textContent===${JSON.stringify(valor)}`);}
    async function consultar(){const n=consultas.length;await avaliar('window.__consultar()');await ate(()=>consultas.length>n);}
    async function liberar(data,valor,codigo=200){const lista=retidas.filter(r=>r.data===data);retidas.splice(0,retidas.length,...retidas.filter(r=>r.data!==data));for(const r of lista)await responder(r.requestId,codigo,valor);}
    async function atualizar(){await avaliar(`document.querySelector('.metric-info button').focus()`);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
    modo='retido';await abrir('loading');await ate(()=>retidas.length>0);
    let f=await cartao();verificar(f.valor==='Carregando...'&&!f.valor.includes('0.00')&&!f.botao,'Loading não inventa zero nem apresenta recuperação',f);
    modo='valor';valor=123.45;await liberar('2026-11-19',valor);await valorExibido('R$ 123.45');verificar(!(await cartao()).botao,'Valor positivo sem botão permanente');
    modo='retido';await consultar();await ate(()=>retidas.length>0);f=await cartao();
    verificar(f.valor==='R$ 123.45'&&!f.botao,'Refetch automático normal preserva valor sem botão',f);
    modo='valor';await liberar('2026-11-19',123.45);
    valor=0;await abrir('zero');await valorExibido('R$ 0.00');f=await cartao();verificar(f.valor==='R$ 0.00'&&!f.botao,'Zero legítimo sem botão permanente',f);
    for(const [nome,m,v] of [['http500','500',null],['conexao','rede',null],['nulo','valor',null],['objeto','valor',{}],['string','valor','123.45'],['http404','404',null]]){
        modo=m;valor=v;await abrir(nome);await ate(()=>consultas.filter(q=>q.fase===nome).length>=4);await valorExibido('Indisponível');f=await cartao();
        verificar(f.botao==='Atualizar faturamento'&&!f.valor.includes('R$'),`${nome}: erro explícito e recuperação`,f);
    }
    modo='retido';await atualizar();await ate(()=>retidas.length>0);await valorExibido('Carregando...');
    verificar(await avaliar(`!document.querySelector('.metric-refresh')&&document.activeElement===document.querySelector('.metric-info p')`),'Retry sem cache mantém foco no resultado durante loading');
    modo='valor';await liberar('2026-11-19',27);await valorExibido('R$ 27.00');
    verificar(await avaliar(`!document.querySelector('.metric-refresh')&&document.activeElement===document.querySelector('.metric-info p')`),'Recuperação sem cache remove botão e preserva destino de foco');
    // Erro de refetch conserva data no QueryClient; a apresentação deve priorizar isError.
    modo='valor';valor=245;await abrir('cache');await valorExibido('R$ 245.00');fase='cache-erro';modo='500';await consultar();
    await ate(()=>consultas.filter(q=>q.fase===fase).length>=4);await valorExibido('Indisponível');verificar(true,'Erro após sucesso não confirma valor antigo');
    // Recuperação explícita, foco persistente e bloqueio de cliques repetidos durante o GET.
    modo='retido';const antes=consultas.length;await atualizar();await ate(()=>retidas.length>0);await esperar(`document.querySelector('.metric-info button').getAttribute('aria-busy')==='true'`);
    verificar((await cartao()).focoBotao,'Foco preservado durante atualização');
    await atualizar();await avaliar(`document.querySelector('.metric-info button').click()`);await pausa(80);
    verificar(consultas.length===antes+1,'Atualização pendente não duplica GET');
    modo='valor';valor=18;await liberar('2026-11-19',18);await valorExibido('R$ 18.00');
    verificar(await avaliar(`!document.querySelector('.metric-refresh')&&document.activeElement===document.querySelector('.metric-info p')`),'Recuperação remove botão e transfere foco ao resultado');
    valor=0;await consultar();await valorExibido('R$ 0.00');verificar(true,'Polling de leitura recupera zero válido');
    modo='500';await consultar();await ate(()=>consultas.filter(q=>q.fase===fase).length>=4);await valorExibido('Indisponível');
    await avaliar(`document.querySelector('.metric-refresh').focus()`);modo='valor';valor=0;await consultar();await valorExibido('R$ 0.00');
    verificar(await avaliar(`!document.querySelector('.metric-refresh')&&document.activeElement===document.querySelector('.metric-info p')`),'Polling recupera falha e preserva foco ao retirar ação');
    // O relógio real do hook é acionado sem eventos de foco na primeira virada.
    modo='por-data';await abrir('virada');await valorExibido('R$ 119.00');
    verificar(await avaliar('window.__minutos.size===1'),'Strict Mode mantém um relógio financeiro ativo');
    await avaliar(`window.__agora=Date.parse('2026-11-20T03:00:01Z');window.__minuto()`);await valorExibido('R$ 220.00');
    verificar(consultas.filter(q=>q.fase===fase&&q.data==='2026-11-20').length===1,'Virada troca período uma vez sem refetch concorrente');
    await consultar();verificar(consultas.at(-1).data==='2026-11-20','Polling acompanha a data nova');
    await avaliar(`window.dispatchEvent(new Event('blur'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.__agora=Date.parse('2026-11-21T03:00:01Z');Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))`);
    await ate(()=>consultas.some(q=>q.fase===fase&&q.data==='2026-11-21'));await valorExibido('R$ 220.00');verificar(true,'Retomada por foco e visibilidade recupera o dia 21');
    await avaliar(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Inteligência')).click()`);await esperar(`!!document.querySelector('.painel-analitico-container')`);
    await avaliar(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Visão Geral')).click()`);await valorExibido('R$ 220.00');await consultar();
    verificar(consultas.at(-1).data==='2026-11-21','Alternância de abas preserva o período');
    await abrir('tokyo','Asia/Tokyo');await valorExibido('R$ 119.00');verificar(consultas.filter(q=>q.fase===fase).every(q=>q.data==='2026-11-19'),'Data de São Paulo independe do timezone de Tóquio');
    // Refetch antigo retido, seguido de mudança de chave e GET do dia novo também retido.
    await abrir('atrasada');await valorExibido('R$ 119.00');modo='retido';await consultar();await ate(()=>retidas.some(r=>r.data==='2026-11-19'));
    await avaliar(`window.__agora=Date.parse('2026-11-20T03:00:01Z');window.__minuto()`);await ate(()=>retidas.some(r=>r.data==='2026-11-20'));await valorExibido('Carregando...');
    verificar(true,'Dia novo não apresenta cache anterior durante loading');
    await liberar('2026-11-19',999);f=await cartao();verificar(f.valor==='Carregando...','Resposta antiga não substitui o período atual',f);
    modo='por-data';await liberar('2026-11-20',220);await valorExibido('R$ 220.00');verificar(true,'Resposta do período novo aparece corretamente');
    // Falha do novo período também não volta ao valor antigo.
    await abrir('novo-dia-erro');await valorExibido('R$ 119.00');modo='500';await avaliar(`window.__agora=Date.parse('2026-11-20T03:00:01Z');window.__minuto()`);
    await ate(()=>consultas.filter(q=>q.fase===fase&&q.data==='2026-11-20').length>=4);await valorExibido('Indisponível');verificar(true,'Falha do dia novo não apresenta zero nem valor do dia anterior');
    // Logout durante leitura pendente descarta UI e recursos do contexto anterior.
    modo='retido';await abrir('logout');await ate(()=>retidas.length>0);
    await avaliar(`localStorage.removeItem('token');dispatchEvent(new StorageEvent('storage',{key:'token',newValue:null,storageArea:localStorage}))`);await esperar(`!!document.querySelector('input[type=password]')`);
    verificar(await avaliar(`window.__minutos.size===0&&window.__polls.size===0`),'Logout limpa relógio e polling do dashboard');
    await liberar('2026-11-19',999);await avaliar(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    verificar(await avaliar(`location.pathname==='/login'&&!document.querySelector('.dashboard-title')`),'Resposta após logout não restaura dados financeiros');
    modo='por-data';await abrir('remontagem','America/Sao_Paulo','2026-11-20T03:00:01Z');await valorExibido('R$ 220.00');verificar(true,'Remontagem lazy inicializa com a data vigente');
    verificar(erros.length===0,'Nenhuma exceção ou requisição inesperada', {erros});
    writeFileSync(path.join(destino,'evidencias.json'),JSON.stringify({verificacoes,evidencias,consultas,erros,externasBloqueadas,canceladas,mutacoes:0},null,2));
    console.log(JSON.stringify({evidencias:destino,verificacoes,erros,externasBloqueadas,canceladas,mutacoes:0}));
    await cdp('Browser.close').catch(()=>{});
}finally{socket?.close();chrome.kill();vite.kill();}
