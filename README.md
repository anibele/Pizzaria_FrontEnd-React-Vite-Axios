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
- variável de ambiente apontando para o IP do backend.

> O frontend utiliza a variável `VITE_BACKEND_IP` em um arquivo .env para montar a URL da API no endereço `http://<IP>:8080`.

---

## Como executar o projeto

O projeto principal está dentro da pasta `pizzaria_maua_frontend`.

### 1) Acesse a pasta do projeto

```powershell
cd .\pizzaria_maua_frontend
```

### 2) Crie o arquivo `.env`

Na raiz de `pizzaria_maua_frontend`, crie um arquivo chamado `.env` com a variável abaixo:

```env
VITE_BACKEND_IP=SEU_IP_DO_BACKEND
```

Exemplo:

```env
VITE_BACKEND_IP=192.168.0.10
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
http://localhost:5173
```

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

Se você for configurar o projeto em outro ambiente, verifique também se o backend está exposto na porta correta (`8080`) e se o IP informado em `VITE_BACKEND_IP` está acessível pela máquina onde o frontend será executado.

---

## Autor e informações adicionais

Projeto frontend desenvolvido para a **Pizzaria Mauá** na Disciplina de Programação para a Web do curso de Sistemas de Informação da [UFN](https://ufn.edu.br/).
Feito por [Gustavo Anibele](https://github.com/anibele), com supervisão do professor [Herysson Figueiredo](https://github.com/herysson).
Qualquer dúvida ou sugestão, [entre em contato por e-mail](mailto:gustavoanibele@gmail.com).