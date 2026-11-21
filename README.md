# 💼 GastoPro — Gestão Financeira Pessoal

<div align="center">

![GastoPro Banner](assets/logo-symbol.png)

**Aplicativo web de finanças pessoais com dashboard inteligente, sincronização em nuvem e suporte offline.**

[![Status](https://img.shields.io/badge/Status-Produção-10b981?style=for-the-badge&logo=checkmarx&logoColor=white)](https://github.com/Dev-Aylton/gastopro-app)
[![Versão](https://img.shields.io/badge/Versão-4.81-6366f1?style=for-the-badge)](https://github.com/Dev-Aylton/gastopro-app)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20·%20CSS3%20·%20JavaScript-f59e0b?style=for-the-badge&logo=javascript&logoColor=white)](https://github.com)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-5a67d8?style=for-the-badge&logo=pwa&logoColor=white)](https://github.com)
[![Testes](https://img.shields.io/badge/Testes-670%20casos-10b981?style=for-the-badge&logo=jest&logoColor=white)](https://github.com)
[![Licença](https://img.shields.io/badge/Licença-MIT-0ea5e9?style=for-the-badge)](LICENSE)

[🚀 Demo ao Vivo](#-demonstração) · [📖 Documentação](#-sumário) · [🐛 Reportar Bug](https://github.com/Dev-Aylton/gastopro-app/issues) · [💡 Sugerir Feature](https://github.com/Dev-Aylton/gastopro-app/issues)

</div>

---

## 📚 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Demonstração](#-demonstração)
- [Arquitetura](#-arquitetura)
- [Tecnologias](#-tecnologias)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Como Executar](#-como-executar)
- [Configuração do Supabase](#-configuração-do-supabase)
- [Banco de Dados](#-banco-de-dados)
- [Segurança e Privacidade](#-segurança-e-privacidade)
- [Testes](#-testes)
- [PWA e Offline](#-pwa-e-offline)
- [Decisões Técnicas](#-decisões-técnicas)
- [Roadmap](#-roadmap)
- [Autor](#-autor)
- [Licença](#-licença)

---

## 🎯 Sobre o Projeto

O **GastoPro** nasceu da necessidade real de transformar uma planilha complexa de controle orçamentário em uma aplicação web moderna, acessível e segura. Desenvolvido do zero por um estudante de **Análise e Desenvolvimento de Sistemas**, o projeto evoluiu de um app puramente local para uma plataforma **multiusuário com sincronização em tempo real** via Supabase.

### Por que GastoPro?

A maioria dos aplicativos de finanças pessoais disponíveis no mercado exige pagamento de assinatura, envia seus dados para servidores de terceiros sem transparência ou é excessivamente simples para quem quer controle real. O GastoPro resolve isso sendo:

- **100% local-first** — seus dados são armazenados no próprio dispositivo (IndexedDB) com sincronização opcional na nuvem
- **Transparente** — código aberto, sem telemetria ativa por padrão
- **Completo** — cobre todos os aspectos do orçamento pessoal: receitas, despesas fixas e variáveis, cartões de crédito, empréstimos, metas e relatórios
- **Gratuito** — sem planos pagos ou limitações artificiais

---

## ✨ Funcionalidades

### 📊 Dashboard e Saúde Financeira

O dashboard oferece uma visão consolidada e inteligente das finanças do mês selecionado:

- **Resumo em tempo real** — Total Recebido, Gastos Fixos, Gastos Variáveis e Saldo Livre, atualizados a cada lançamento
- **Metodologia 50/30/20** — diagnóstico visual automático com barras de progresso coloridas (verde/amarelo/vermelho)
- **Orçamento diário** — cálculo da sobra média por dia até o fim do mês, ajustado ao calendário real
- **Gráfico de rosca** — distribuição de gastos por categoria via Chart.js com interatividade
- **Alertas inteligentes** — notificações de dívidas vencidas, cartões próximos do limite e metas comprometidas
- **Saldo consolidado** — visão unificada de todas as contas bancárias (PF e PJ) com filtros
- **Resumo do cartão** — limite usado e próximo vencimento diretamente no dashboard

### 💰 Lançamentos — Receitas e Despesas

- **Cadastro completo** — descrição, valor, data, categoria, conta, forma de pagamento e status pago/pendente
- **Categorias de receita** — Salário, Adiantamento, Renda Extra, Rendimentos, Outros
- **Categorias de despesa** — mais de 16 categorias predefinidas com ícones
- **Formas de pagamento** — Pix, débito, dinheiro, transferência (entram pagos), boleto e datas futuras (entram pendentes)
- **Competência mensal** — lançamentos vinculados ao mês da data informada, com navegação independente
- **Edição e exclusão** com confirmação e proteção de dados

### 💳 Cartões de Crédito

- **Cadastro de cartões** — nome, bandeira, limite, dia de fechamento e dia de vencimento
- **Aba Carteira** — limite total, parcelas em aberto, disponível, barra de uso, próximo vencimento
- **Compras parceladas** — detalhamento completo com valor total, número de parcelas e mês de início
- **Cálculo de limite** — baseado nas parcelas não pagas; ajuste manual com campo "Já gasto antes do app"
- **Integração dashboard** — resumo compacto do uso do cartão com atalho direto
- **Próximo vencimento** — cálculo automático respeitando fechamento e virada de mês

### 📋 Gastos Fixos e Recorrentes

- **Templates de lançamento** — cadastre uma vez, o app lança automaticamente nos meses do período
- **Baixa independente por mês** — marque pago em um mês sem afetar os demais
- **Alternância Ativo/Inativo** — pause despesas sem excluí-las
- **Filtros por tipo** — visualize separadamente fixos, variáveis e dívidas

### 🏦 Contas Bancárias (PF e PJ)

- **Cadastro** — nome, instituição, tipo (PF ou PJ) e saldo inicial
- **Saldo calculado** — atualizado automaticamente com todos os lançamentos vinculados
- **Ajuste manual** — corrija o saldo quando necessário sem apagar histórico
- **Exclusão segura** — desvincula lançamentos sem apagá-los
- **Filtro PF/PJ** — visualize separadamente contas pessoais e empresariais

### 🏛️ Empréstimos e Financiamentos

- **Formulário dedicado** — valor recebido, data, valor da parcela, número de parcelas, data de início
- **Resumo de parcelas** — pagas, restantes, próxima parcela e valor total devedor
- **Detecção de conflitos** — alerta se já existe um lançamento semelhante cadastrado
- **Barra de progresso** — visualização percentual do pagamento (badge "🎉 Quitado!" ao concluir)
- **Cálculo de saldo devedor** — com precisão de centavos usando aritmética inteira

### 🎯 Metas Financeiras

- **Metas por categoria** — defina tetos de gasto mensais para cada categoria de despesa
- **Alertas nos limiares de 80% e 100%** — notificações visuais quando se aproxima ou ultrapassa a meta
- **Integração dashboard** — seção dedicada com status de todas as metas do mês
- **Sincronização cloud** — metas sincronizadas com a tabela `goals` do Supabase

### 📈 Simulador Financeiro

- **Simulação de quitação antecipada** — calcule quantos meses economiza pagando um valor extra mensal ou pontual em uma dívida
- **Corte de categoria** — simule o impacto anual de reduzir gastos em uma categoria em X%
- **Projeção mensal** — gráfico de evolução do saldo devedor mês a mês com e sem o pagamento extra
- **Base histórica** — usa os últimos meses cadastrados para calcular a média real de gastos por categoria

### 📊 Relatórios em PDF

- **Flexibilidade de período** — relatório mensal, anual ou por intervalo personalizado
- **Geração local** — PDF gerado 100% no navegador, sem enviar dados para servidores
- **Conteúdo completo** — totais, distribuição por categoria, dívidas, metas, diagnóstico 50/30/20
- **Detalhamento opcional** — inclua ou exclua a listagem individual de lançamentos
- **Compartilhamento** — botão de compartilhar em dispositivos compatíveis (Web Share API)

### 📥 Importação de Extratos

- **Formatos suportados** — CSV, TXT, OFX (SGML e XML), XML de NF-e/NFC-e, PDF com texto selecionável
- **Limites** — CSV/TXT/OFX/XML: até 1 MB; PDF: até 10 MB e 30 páginas
- **Detecção automática** — identifica colunas Data, Descrição e Valor sem configuração manual
- **Pré-visualização editável** — confira e ajuste cada linha antes de confirmar a importação
- **Categorização automática** — mais de 80 palavras-chave para classificar lançamentos
- **Deduplicação** — detecta e alerta sobre lançamentos possivelmente duplicados
- **Lote de até 500 linhas** — importação em lotes com feedback de progresso
- **Texto bruto** — cole linhas de extrato, código Pix ou linha digitável de boleto

### 🪄 Wizard de Lançamento Rápido

- **4 passos** — Renda → Gastos Fixos → Gastos Variáveis → Diagnóstico 50/30/20
- **Multi-renda** — adicione múltiplas fontes de renda em um único fluxo
- **Checklist de fixos** — revise os gastos fixos já cadastrados sem sair do wizard
- **Grid de categorias** — adicione gastos variáveis por categorias com ícones
- **Salvamento em lote** — todos os lançamentos são salvos de uma vez com sincronização automática

### 🔔 Central de Avisos

- **6 tipos de alerta** com prioridade dinâmica:
  - 🔴 **Crítico** — saldo insuficiente, vencimento hoje/atrasado, cartão em 100% do limite
  - 🟡 **Atenção** — cartão acima de 80%, vencimento próximo, gasto atípico, pagamentos importados para conferir
  - 🔵 **Info** — previsão de saldo no fim do mês
- **Ações de toque** — toque no aviso para navegar diretamente para o item relacionado
- **Persistência de dispensa** — avisos dispensados são lembrados por situação
- **Contador no sino** — badge com o total de avisos não lidos e cor do mais grave

### 🔐 Autenticação e Perfil

- **Login com e-mail e senha** — cadastro, login, recuperação de senha por e-mail
- **Login com Google** — OAuth 2.0 via Supabase Auth
- **Foto de perfil** — upload com recorte (JPEG 256×256), URL do Google ou imagem local
- **Multi-dispositivo** — dados sincronizados automaticamente entre aparelhos via Realtime do Supabase
- **Modo local** — funciona 100% offline sem criar conta
- **Isolamento de dados** — Row Level Security (RLS) no Supabase garante que cada usuário veja apenas seus dados

### 💾 Backup e Restauração

- **Exportação JSON** — backup completo de todos os dados em um arquivo local
- **Restauração com prévia** — visualize o conteúdo antes de restaurar
- **Duas estratégias** — mesclagem por ID (preserva dados existentes) ou substituição total
- **Sincronização automática** — após restauração, dados sincronizam com o Supabase

### ♿ Acessibilidade

- **Navegação por teclado** — Tab, Shift+Tab, Enter, Esc para todos os elementos interativos
- **Gerenciamento de foco** — foco retorna ao elemento correto ao fechar modais
- **ARIA attributes** — `aria-label`, `aria-expanded`, `aria-hidden`, `role` em todos os componentes
- **Contraste** — cores com contraste calculado ≥ 4,5:1 (WCAG AA)
- **Tema claro/escuro** — alternância com preferência persistida localmente

### 📱 PWA — Progressive Web App

- **Instalável** — adicione ao celular ou desktop como app nativo
- **Offline-first** — Service Worker com estratégia Network First + Cache Fallback (timeout 4s)
- **Atualização automática** — detecta nova versão e solicita recarga
- **Manifest completo** — ícones, cores, orientação, categorias

---

## 🖥️ Demonstração

> 🚧 **Demo ao vivo:** [gastopro.app](https://gastopro.app) *(em breve)*

### Screenshots

| Dashboard | Lançamentos | Cartões |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Lançamentos](docs/screenshots/transactions.png) | ![Cartões](docs/screenshots/cards.png) |

| Importação | Simulador | Relatório |
|---|---|---|
| ![Importação](docs/screenshots/import.png) | ![Simulador](docs/screenshots/simulator.png) | ![Relatório](docs/screenshots/report.png) |

---

## 🏗️ Arquitetura

O GastoPro é uma **Single Page Application (SPA)** em Vanilla JS — sem framework de UI, sem bundler, sem dependências de runtime além do Chart.js e Supabase. Essa escolha foi deliberada: demonstra domínio dos fundamentos da web sem "magia" de frameworks.

```
┌─────────────────────────────────────────────────┐
│                   Navegador                      │
│  ┌───────────────┐    ┌────────────────────┐    │
│  │  index.html   │    │   Service Worker   │    │
│  │  (SPA Shell)  │    │  (Offline Cache)   │    │
│  └───────┬───────┘    └────────────────────┘    │
│          │                                       │
│  ┌───────▼──────────────────────────────────┐   │
│  │              js/app.js                   │   │
│  │  (Orquestrador: UI, eventos, navegação)  │   │
│  └──┬──────┬──────┬────┬──────┬────────────┘   │
│     │      │      │    │      │                  │
│  data  loans  sim  rep  import  supabase.js      │
│  .js   .js   .js  .js  ter.js  (Cloud Sync)     │
│     │                           │                │
│  IndexedDB                   Supabase            │
│  (Primary)                   (Auth + Realtime)   │
│  localStorage                                    │
│  (Fallback)                                      │
└─────────────────────────────────────────────────┘
```

### Camadas da Aplicação

| Camada | Arquivo(s) | Responsabilidade |
|---|---|---|
| **UI/Orquestração** | `js/app.js` | Renderização, eventos, navegação, modais |
| **Dados** | `js/data.js` | IndexedDB, localStorage, migração, sync |
| **Cloud** | `js/supabase.js` | Autenticação, Realtime, RLS |
| **Domínio** | `js/loans.js`, `js/simulator.js` | Lógica de negócio financeiro |
| **Features** | `js/importer.js`, `js/report.js`, `js/categories.js` | Funcionalidades específicas |
| **UX** | `js/onboarding.js`, `js/a11y.js`, `js/theme.js` | Experiência do usuário |
| **PWA** | `sw.js`, `manifest.json` | Instalação e offline |

### Padrões e Decisões de Arquitetura

- **Global namespace modular** — cada módulo expõe sua API via `window.GastoPro*` (ex: `window.GastoProLoans`, `window.GastoProSimulator`)
- **IIFE (Immediately Invoked Function Expression)** — encapsulamento sem módulos ES6, compatível com todos os browsers modernos
- **Armazenamento híbrido** — IndexedDB como primário (maior capacidade), localStorage como fallback
- **Fuso horário explícito** — todas as datas usam `Intl.DateTimeFormat` com `America/Sao_Paulo` para evitar bugs de UTC offset
- **Precisão financeira** — valores monetários calculados em centavos inteiros para evitar erros de ponto flutuante
- **Realtime via WebSocket** — Supabase Realtime com `postgres_changes` para sincronização em tempo real entre dispositivos

---

## 🛠️ Tecnologias

### Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| HTML5 | — | Estrutura semântica, Web APIs |
| CSS3 | — | Design system com Custom Properties, Grid, Flexbox |
| JavaScript ES2021 | — | Lógica da aplicação (sem framework) |
| Chart.js | 4.x | Gráficos do dashboard e simulador |
| Font Awesome | 6.x | Iconografia |
| jsPDF | — | Geração de PDF no navegador |

### Backend (BaaS)

| Tecnologia | Uso |
|---|---|
| **Supabase Auth** | Autenticação com e-mail/senha e OAuth Google |
| **Supabase Database** | PostgreSQL com Row Level Security (RLS) |
| **Supabase Realtime** | Sincronização em tempo real entre dispositivos |
| **Supabase Storage** | Armazenamento de avatares de perfil |

### Armazenamento Local

| Tecnologia | Uso |
|---|---|
| **IndexedDB** | Armazenamento principal de dados financeiros |
| **localStorage** | Fallback, preferências de UI, tema, sessão |

### Ferramentas de Desenvolvimento

| Ferramenta | Uso |
|---|---|
| **GitHub Pages** | Hospedagem estática gratuita |
| **Jest** | 670 casos de teste automatizados |
| **Service Worker API** | Cache offline, instalação PWA |

---

## 📁 Estrutura de Arquivos

```
gastopro-app/
├── index.html                 # SPA Shell — estrutura, views, modais, sidebar
├── 404.html                   # Página apresentada para endereços não encontrados
├── manifest.json              # PWA — nome, ícones, cores, categorias
├── sw.js                      # Service Worker — cache offline, atualização
├── privacidade.html           # Política de Privacidade
│
├── css/
│   └── style.css              # Design system completo — tokens, componentes, temas
│
├── js/
│   ├── app.js                 # Orquestrador principal — UI, eventos, navegação (~15k linhas)
│   ├── data.js                # Camada de dados — IndexedDB, sync, migração (~4k linhas)
│   ├── supabase.js            # Integração Supabase — auth, realtime, RLS (~2.4k linhas)
│   ├── loans.js               # Módulo de empréstimos — cálculos, conflitos
│   ├── simulator.js           # Simulador financeiro — quitação antecipada, corte de categoria
│   ├── importer.js            # Importador de extratos — CSV, OFX, PDF, NF-e
│   ├── report.js              # Gerador de relatórios PDF — jsPDF
│   ├── categories.js          # Sistema de categorias — ícones, cores, keywords
│   ├── onboarding.js          # Onboarding de novos usuários
│   ├── a11y.js                # Acessibilidade — foco, navegação por teclado
│   ├── theme.js               # Alternância de tema claro/escuro
│   ├── cache-assets.js        # Lista de assets para pre-cache do SW
│   ├── xlsx-writer.js         # Exportação XLSX
│   └── vendor/                # Dependências externas (Chart.js, jsPDF, Supabase SDK)
│
├── assets/
│   ├── icon-192.png           # Ícone PWA 192×192
│   ├── icon-512.png           # Ícone PWA 512×512
│   ├── icon-maskable-512.png  # Ícone PWA maskable 512×512
│   ├── logo-symbol.png        # Símbolo da marca
│   ├── default_avatar.jpg     # Avatar padrão masculino
│   └── default_avatar_fem.jpg # Avatar padrão feminino
│
├── supabase/
│   └── migrations/            # Migrations SQL do banco de dados
│
└── tests/
    ├── gastopro.test.js       # Suíte de testes (670 casos)
    └── test-runner.html       # Runner de testes no browser
```

---

## 🚀 Como Executar

### Pré-requisitos

- Qualquer servidor HTTP estático (sem build step necessário)
- Browser moderno (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Opção 1 — Sem instalação (recomendado para explorar)

```bash
# Clone o repositório
git clone https://github.com/Dev-Aylton/gastopro-app.git
cd gastopro-app

# Abra com qualquer servidor HTTP estático
# Usando Python (disponível na maioria dos sistemas):
python -m http.server 8080

# Ou usando Node.js:
npx serve .

# Acesse http://localhost:8080
```

> ⚠️ **Importante:** Abrir `index.html` diretamente via `file://` não funciona para o Service Worker e algumas Web APIs. Use sempre um servidor HTTP.

### Opção 2 — VS Code + Live Server

1. Instale a extensão **Live Server** no VS Code
2. Clique com o botão direito em `index.html` → **Open with Live Server**

### Opção 3 — GitHub Pages

O projeto está configurado para deploy automático no GitHub Pages. Faça fork e ative em:

**Settings → Pages → Source: main branch / (root)**

---

## ⚙️ Configuração do Supabase

O app funciona **100% offline** sem configurar o Supabase. A sincronização em nuvem é **opcional**.

### Para ativar a sincronização:

1. **Crie um projeto** em [supabase.com](https://supabase.com) (plano gratuito disponível)

2. **Execute as migrations** na ordem do diretório `supabase/migrations/`

3. **Configure as variáveis** em `js/supabase.js`:
```javascript
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anonima-aqui';
```

4. **Configure o OAuth do Google** (opcional) no dashboard do Supabase em:
   Authentication → Providers → Google

> 🔐 **Segurança:** A chave `anon` do Supabase é pública por design. O isolamento de dados é garantido pelas **Row Level Security (RLS) policies** no banco de dados — cada usuário acessa apenas seus próprios registros.

---

## 🗄️ Banco de Dados

### Tabelas Principais

```sql
-- Usuários e perfis
profiles          -- nome, avatar, configurações
                  
-- Dados financeiros (isolados por user_id via RLS)
entries           -- lançamentos de receitas e despesas
templates         -- gastos fixos e recorrentes
accounts          -- contas bancárias
credit_cards      -- cartões de crédito
credit_card_purchases  -- compras parceladas
goals             -- metas por categoria

-- Comunicação
messages          -- canal "Fale comigo" entre usuários e admin
```

### Row Level Security (RLS)

Todas as tabelas financeiras possuem policies RLS que garantem:

```sql
-- Exemplo da policy de entries
CREATE POLICY "users_own_entries" ON entries
  FOR ALL
  USING (auth.uid() = user_id);
```

Nenhuma operação é possível sem autenticação; o próprio banco rejeita acessos cruzados.

### Realtime

O canal Realtime usa `postgres_changes` para sincronizar atualizações entre dispositivos do mesmo usuário em tempo real, sem polling.

---

## 🔐 Segurança e Privacidade

### Princípios

- **Local-first** — todos os dados financeiros são salvos no dispositivo (IndexedDB). A nuvem é opt-in.
- **Zero telemetria por padrão** — analytics e rastreamento começam desativados; o usuário opt-in explicitamente.
- **Arquivos processados localmente** — extratos importados são lidos pelo browser, nunca enviados a servidores.
- **Chave pública segura** — a `anon key` do Supabase é segura para ficar no código frontend; RLS é a proteção real.

### Autenticação

- Senhas armazenadas com hash seguro pelo Supabase Auth (bcrypt)
- Sessões com tokens JWT de curta duração com renovação automática
- OAuth Google com validação de estado CSRF
- Logout limpa todos os dados de sessão do localStorage

### Painel Admin

- Acesso restrito a usuários confirmados pelo RPC `is_admin()` no banco
- Exibe apenas métricas agregadas — nunca lançamentos, valores ou dados individuais

---

## 🧪 Testes

O projeto possui **670 casos de teste** cobrindo:

- Lógica de cálculos financeiros (empréstimos, simulador, cartões)
- Camada de dados (IndexedDB, sincronização, migração)
- Validações de formulário
- Importador de extratos (CSV, OFX, PDF)
- Utilitários de data e fuso horário
- Integração com Supabase (mockado)

### Executar os testes

```bash
# No browser — abra o test runner
open tests/test-runner.html

# Ou via servidor local
npx serve . && open http://localhost:3000/tests/test-runner.html
```

### Cobertura

| Módulo | Casos | Status |
|---|---|---|
| `data.js` | ~180 | ✅ |
| `app.js` | ~220 | ✅ |
| `loans.js` | ~80 | ✅ |
| `simulator.js` | ~60 | ✅ |
| `importer.js` | ~90 | ✅ |
| `supabase.js` | ~40 | ✅ (mockado) |
| **Total** | **670** | **0 falhas** |

> ⚠️ Testes de UI e interações de toque não são verificados automaticamente — use o app real para validação visual.

---

## 📱 PWA e Offline

### Como instalar

**Android/Chrome:** Menu (⋮) → "Adicionar à tela inicial"

**iOS/Safari:** Compartilhar (⬆) → "Adicionar à Tela de Início"

**Desktop/Chrome:** Ícone de instalação (⊕) na barra de endereços

### Estratégia de Cache — Network First

```
1. Tenta buscar da rede (timeout: 4 segundos)
2. Se bem-sucedido → atualiza o cache e retorna a resposta
3. Se falhar (offline/timeout) → retorna do cache
4. Se não está no cache → retorna página offline
```

### Assets em Pre-Cache

Todos os arquivos JS, CSS e ícones são pre-cacheados na instalação do SW para garantir funcionamento offline imediato.

---

## 💡 Decisões Técnicas

### Por que Vanilla JS (sem React/Vue/Angular)?

- **Domínio dos fundamentos** — demonstra compreensão da DOM API, eventos e Web APIs sem abstrações
- **Performance** — sem overhead de reconciliação de VDOM ou compilação de templates
- **Zero dependências de runtime** — apenas Chart.js e Supabase SDK são carregados
- **Aprendizado** — construir um SPA do zero é o melhor caminho para entender o que frameworks fazem

### Por que IndexedDB em vez de localStorage?

- **Capacidade** — localStorage é limitado a ~5MB; IndexedDB suporta gigabytes
- **Assíncrono** — não bloqueia a thread principal
- **Tipos** — suporta objetos JS nativamente sem serialização JSON manual
- **Transações** — operações atômicas garantem consistência dos dados

### Por que Supabase em vez de Firebase?

- **SQL** — PostgreSQL com JOINs reais, índices e queries complexas
- **Row Level Security** — segurança implementada no banco, não no código da aplicação
- **Open source** — pode ser auto-hospedado; sem lock-in
- **Plano gratuito generoso** — 500MB de banco, 2GB de storage, 50k usuários ativos/mês

### Por que Precisão em Centavos?

Valores monetários são calculados internamente em centavos inteiros (`toCents()`) para evitar erros clássicos de ponto flutuante:

```javascript
// ❌ Erro de ponto flutuante
0.1 + 0.2 === 0.3 // false → 0.30000000000000004

// ✅ Centavos inteiros
Math.round(0.1 * 100) + Math.round(0.2 * 100) === 30 // true
```

---

## 🗺️ Roadmap

### v5.0 — Em Planejamento

- [ ] **Orçamento mensal por categoria** — defina limites e acompanhe em tempo real
- [ ] **Recorrência avançada** — suporte a semanal, quinzenal e anual
- [ ] **Exportação XLSX** — relatórios em planilha editável
- [ ] **Multi-moeda** — suporte a USD, EUR com cotação do dia
- [ ] **Anexos** — foto de comprovantes vinculada ao lançamento
- [ ] **Split de despesas** — divida gastos entre contas ou pessoas
- [ ] **API pública** — endpoints REST para integração com outros apps

### Melhorias Contínuas

- [ ] Paginação virtual em listas longas (> 500 itens)
- [ ] Exportação de gráficos como PNG
- [ ] Modo de demonstração com dados fictícios
- [ ] Internacionalização (i18n) para outros idiomas

---

## 👨‍💻 Autor

<div align="center">

**Aylton Alberto**

Estudante de **Análise e Desenvolvimento de Sistemas** · Uninter

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Dev-Aylton/gastopro-app)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/aylton-alberto-806726220/)
[![Email](https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:desenvolvedor.aylton@gmail.com)

</div>

### Sobre o Projeto

O GastoPro foi desenvolvido como projeto de portfólio para demonstrar habilidades em:

- **Desenvolvimento Web** — HTML5 semântico, CSS3 avançado, JavaScript ES2021
- **Arquitetura de Software** — design de SPA, padrões de módulo, separação de responsabilidades
- **Banco de Dados** — modelagem relacional, SQL, Row Level Security
- **Backend as a Service** — integração com Supabase, autenticação OAuth, Realtime
- **UX/UI Design** — design system com tokens, acessibilidade WCAG, responsividade
- **Testes** — 670 casos de teste com cobertura de lógica de negócio
- **PWA** — Service Worker, estratégias de cache, instalação nativa
- **Boas Práticas** — código limpo, documentação, versionamento semântico

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License** — você pode usar, modificar e distribuir livremente, mantendo os créditos ao autor.

```
MIT License

Copyright (c) 2026 Aylton Alberto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

<div align="center">

**GastoPro** — feito com 💚 e muito JavaScript

[⬆ Voltar ao topo](#-gastopro--gestão-financeira-pessoal)

</div>
