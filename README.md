# 🍕 Pizzaria Mauá - Frontend

Interface web da **Pizzaria Mauá**, desenvolvida para apoiar a operação da casa em diferentes perfis de uso: **Mesa**, **Cozinha**, **Caixa** e **Gerência**.

O sistema foi pensado para funcionar de forma integrada com o backend da pizzaria, oferecendo uma experiência rápida para o cliente no tablet da mesa e, ao mesmo tempo, um painel completo para os setores internos acompanharem pedidos, pagamentos, cardápio e mesas em tempo real.

* Backend da pizzaria, disponível em [Backend Pizzaria Mauá](https://github.com/anibele/Pizzaria_BackEnd-SpringBootJPA-).
* Este projeto ainda está em desenvolvimento e pode sofrer alterações. Sugestões e contribuições são bem-vindas.
---

## Visão geral

Este projeto é o frontend da operação da pizzaria e centraliza as principais rotinas do atendimento:

- visualização do cardápio digital na mesa;
- criação e atualização de pedidos;
- acompanhamento da produção na cozinha;
- monitoramento de pagamentos no caixa;
- gestão de produtos, mesas e indicadores pela gerência.

---

## Funcionalidades

### Mesa / Cliente
- acesso ao cardápio digital por tablet;
- onboarding com tela de boas-vindas e tutorial interativo;
- montagem do carrinho e envio de itens para a cozinha;
- adição de novos itens a pedidos já abertos;
- solicitação de pagamento via PIX, cartão ou dinheiro;
- telas de contexto para mesa livre, reservada, em manutenção e standby;

### Cozinha
- visualização dos pedidos em tempo real;
- separação automática entre itens de preparo rápido e preparo lento;
- destaque de pedidos atrasados e ordenação por prioridade;
- atualização do status dos itens para controle de produção;
- alertas sonoros e visuais para novos pedidos, itens adicionados e solicitações de pagamento.

### Caixa
- monitoramento dos pedidos que aguardam pagamento;
- visualização do faturamento do dia;
- confirmação de recebimento;
- modal com detalhes do pedido selecionado;
- notificações automáticas quando uma mesa solicita fechamento.

### Gerência
- dashboard principal com visão geral da operação;
- atalhos para cardápio, mesas e pedidos;
- painel analítico com indicadores do negócio;
- gestão de produtos e mesas;
- navegação por perfis com rotas protegidas.

---

## Como o sistema foi desenvolvido

O frontend foi estruturado para ser componentizado, escalável e orientado por contexto, usando uma arquitetura moderna de React com TypeScript.

### Principais decisões técnicas
- **React + TypeScript** para tipagem forte e melhor manutenção;
- **Vite** para ambiente de desenvolvimento rápido e build otimizado;
- **React Router** para controle de rotas públicas e protegidas;
- **Axios** com interceptors para autenticação via JWT e tratamento global de erros;
- **React Query** para gerenciamento de requisições, cache e sincronização de dados;
- **Context API** para autenticação, notificações e onboarding;
- **PrimeReact** e **Lucide React** para interface e ícones;
- persistência local em **localStorage** e **sessionStorage** para carrinho e fluxo de tutorial;
- organização por módulos em `pages`, `componentes`, `hooks`, `contexts`, `services` e `routes`.

### Fluxos importantes
- o login retorna token e perfil do usuário;
- o backend define a navegação inicial de acordo com o cargo;
- rotas sensíveis são protegidas por perfil;
- a cozinha e o caixa recebem feedback visual e sonoro em tempo real;
- o cardápio da mesa se adapta ao status da mesa no sistema.

---

## Tecnologias utilizadas

- React
- TypeScript
- Vite
- React Router DOM
- Axios
- TanStack React Query
- PrimeReact
- Lucide React
- Chart.js
- ESLint

---

## Requisitos

- Node.js 18+;
- npm;
- backend da pizzaria em execução, disponível em [Backend Pizzaria Mauá](https://github.com/anibele/Pizzaria_BackEnd-SpringBootJPA-).
- variável de ambiente apontando para a URL da API.

> O frontend utiliza `VITE_API_BASE_URL`. Os valores `VITE_*` são públicos e incorporados ao build; nunca devem conter senhas, JWTs ou outras credenciais.

---

## Como executar o projeto

O projeto principal está dentro da pasta `pizzaria_maua_frontend`.

### 1) Acesse a pasta do projeto

```powershell
cd .\pizzaria_maua_frontend
```

### 2) Crie o arquivo `.env`

Na raiz de `pizzaria_maua_frontend`, copie `.env.example` para `.env` e ajuste a URL. Para frontend e backend na mesma máquina:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Para tablets, use um endereço do computador do backend alcançável pela rede local. Exemplo ilustrativo:

```env
VITE_API_BASE_URL=http://192.168.1.100:8080
```

### 3) Instale as dependências

```powershell
npm install
```

### 4) Execute em modo desenvolvimento

```powershell
npm run dev
```

O Vite normalmente disponibiliza a aplicação em:

```text
http://localhost:5176
```

---

## Transporte e configuração de produção

`VITE_API_BASE_URL` aceita uma URL completa HTTP/HTTPS (inclusive porta e caminho base) ou um caminho iniciado por uma única barra. Barras finais são removidas. Valores vazios, espaços, protocolos diferentes de HTTP(S), credenciais embutidas, query strings, fragmentos e caminhos ambíguos são recusados antes da criação da instância HTTP. A mensagem de erro não reproduz o valor configurado.

O `.env` antigo com apenas `VITE_BACKEND_IP` continua funcionando em `npm run dev`, usando `http://<host>:8080`. Esse fallback só existe quando `VITE_API_BASE_URL` está ausente; um valor explícito inválido não aciona fallback. Reinicie o Vite após mudar o ambiente.

**Migração obrigatória para produção/preview:** configure `VITE_API_BASE_URL` antes de `npm run build` e gere novamente os arquivos. O build não transforma o `.env` existente nem verifica a disponibilidade do servidor. Um build sem a variável explícita recusa iniciar o cliente HTTP no navegador; não usa silenciosamente o IP legado ou localhost. Alterar a variável apenas ao servir arquivos já compilados não altera a URL incorporada.

Com TLS disponibilizado pela infraestrutura, por exemplo:

```env
VITE_API_BASE_URL=https://api.exemplo.com
```

O servidor ou proxy precisa oferecer HTTPS com certificado válido para o endereço utilizado. A configuração do React não instala certificados nem habilita TLS no Spring Boot. Uma página HTTPS recusa uma API HTTP, inclusive no desenvolvimento. HTTP explicitamente configurado continua permitido quando a própria página é HTTP, para desenvolvimento ou publicação em rede local controlada; nesse cenário, senhas e JWTs trafegam sem confidencialidade TLS. No tablet, `localhost` identifica o próprio tablet, não o computador do backend. O frontend não substitui o host configurado pelo hostname do navegador.

### Proxy reverso na mesma origem

É possível configurar `VITE_API_BASE_URL=/api` quando um proxy **externo já estiver configurado** para encaminhar esse caminho ao backend. Nenhum proxy de desenvolvimento ou de produção é criado por esta mudança. O proxy deve retirar apenas o prefixo externo, uma vez: `/api/auth/me` → `/auth/me`, `/api/mesas` → `/mesas`. Não acrescente `/api` novamente nos serviços do frontend.

O dashboard já possui o caminho real `/api/dashboard` no backend. Com o prefixo externo `/api`, a URL pública correspondente é `/api/api/dashboard/resumo`, encaminhada para `/api/dashboard/resumo`; esses dois segmentos têm funções diferentes e não devem ser removidos indiscriminadamente. Pode-se escolher outro prefixo externo, como `/backend`, para evitar essa sobreposição. Um caminho relativo herda o protocolo e a origem da página.

### CORS

Se frontend e API tiverem origens diferentes (protocolo, host ou porta), a configuração CORS do backend deve autorizar a origem efetiva do frontend, os métodos utilizados e os cabeçalhos `Authorization`, `Content-Type` e `Idempotency-Key`. O backend consultado utiliza uma lista explícita de origens na configuração de segurança; não se deve presumir que uma nova origem HTTPS já esteja autorizada. A adaptação do servidor deve ser feita separadamente, quando necessária. CORS não criptografa o tráfego e não substitui TLS ou autorização por recurso. O proxy na mesma origem evita a necessidade de CORS entre navegador e API.

---

## Scripts disponíveis

```powershell
npm run dev      # sobe o ambiente de desenvolvimento
npm run build    # gera a versão de produção
npm run lint     # executa a validação com ESLint
npm run preview  # pré-visualiza o build gerado
```

---

## Autenticação e perfis

O sistema trabalha com os seguintes perfis:

- `MESA`
- `COZINHA`
- `GERENTE`
- `CAIXA`

Após o login, o usuário é direcionado automaticamente para a área correspondente ao seu perfil.

---

## Destaques da implementação

- interface adaptada para diferentes perfis de uso;
- roteamento com proteção por cargo;
- comunicação com o backend via API centralizada;
- feedback visual com modais, badges, cards e estados de carregamento;
- notificações com sons e animações para eventos importantes;
- foco em operação real de restaurante com experiência fluida para mesa e equipe interna.

---

## Observações

Este repositório contém as imagens do cardápio e os arquivos de áudio usados na experiência visual e sonora da aplicação.

Se você for configurar o projeto em outro ambiente, verifique se o endereço completo informado em `VITE_API_BASE_URL` está acessível pelo dispositivo que abre o frontend. Domínios e IPs desta documentação são apenas exemplos; nenhuma implantação pública ou infraestrutura de proxy é presumida.

---

## Autor e informações adicionais

Projeto frontend desenvolvido para a **Pizzaria Mauá** na Disciplina de Programação para a Web do curso de Sistemas de Informação da [UFN](https://ufn.edu.br/).
Feito por [Gustavo Anibele](https://github.com/anibele), com supervisão do professor [Herysson Figueiredo](https://github.com/herysson).
Qualquer dúvida ou sugestão, [entre em contato por e-mail](mailto:gustavoanibele@gmail.com).
