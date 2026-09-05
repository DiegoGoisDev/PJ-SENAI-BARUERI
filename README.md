# 💪 NutriFit — Assistente Virtual (Alimentação • Treino • Resultados)

Assistente virtual inteligente com o tema **academia / personal trainer**, desenvolvido como Situação de Aprendizagem (Projeto Final — Assistente Virtual com IA / SENAI).

A IA atua como a **NutriFit** (lema: *"Mais saúde, mais energia, mais vida!"*), um personal trainer e nutricionista esportivo, respondendo dúvidas sobre treino, dieta, hidratação e hábitos de forma motivadora. O front-end (HTML, CSS e JavaScript) se comunica via **Fetch API** com uma API em **Node.js + Express**, que acessa a **API da OpenAI**.

> Sem banco de dados. O histórico da conversa é mantido em memória no servidor e no navegador (LocalStorage).

---

## 🛠 Tecnologias

**Front-end:** HTML5 · CSS3 · JavaScript · Fetch API
**Back-end:** Node.js · Express · API da OpenAI

---

## 📁 Estrutura

```
PJ-SENAI-BARUERI/
├── pages/                 # Front-end
│   ├── index.html         # Interface do chat
│   ├── nutricao.css       # Estilos (tema fitness + modo claro/escuro)
│   └── nutricao.js        # Lógica do chat (Fetch, histórico, temas)
├── src/                   # Back-end
│   ├── server.js          # Servidor Express e rotas da API
│   ├── config/openai.js   # Integração com a OpenAI + System Prompt
│   ├── .env.example       # Modelo de variáveis de ambiente
│   └── package.json
└── README.md
```

---

## 🚀 Como executar

1. Instale as dependências:
   ```bash
   cd src
   npm install
   ```

2. Crie o arquivo `.env` a partir do modelo e informe sua chave da OpenAI:
   ```bash
   cp .env.example .env
   ```
   ```
   PORT=3000
   OPENAI_API_KEY=sk-sua-chave-aqui
   OPENAI_API_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   ```

   > `OPENAI_API_URL` é opcional: aponta o agente para a OpenAI (padrão) ou para qualquer serviço compatível (proxy, LLM local, etc.).

   > Sem chave válida, o sistema roda em **modo de contingência**, com respostas locais simuladas — útil para demonstração.

3. Inicie o servidor:
   ```bash
   npm start
   ```

4. Acesse no navegador: **http://localhost:3000**

---

## 🌐 API

### `POST /chat`
Envia a mensagem do usuário e retorna a resposta da IA.

**Entrada**
```json
{ "mensagem": "Oi" }
```

**Saída**
```json
{ "response": "Fala, campeão! Bora pra cima! 💪 Qual o objetivo de hoje?" }
```

### `POST /nova-conversa`
Reinicia o histórico da conversa mantido em memória.

**Saída**
```json
{ "response": "Conversa reiniciada com sucesso." }
```

### `GET /health`
Diagnóstico do servidor.

**Saída**
```json
{
  "status": "online",
  "agent": "NutriFit - Alimentação, Treino & Resultados",
  "messagesStored": 0,
  "timestamp": "2026-09-05T12:00:00.000Z"
}
```

---

## 🔄 Fluxo

1. O usuário digita uma mensagem.
2. O JavaScript envia para a API via **Fetch** (`POST /chat`).
3. A API adiciona o **System Prompt** (persona da NutriFit).
4. A API envia a conversa para a **OpenAI**.
5. A OpenAI retorna a resposta.
6. A API devolve a resposta (`{ response }`).
7. O front-end exibe a resposta na tela.

---

## ✅ Funcionalidades

**Obrigatórias**
- Interface de chat com tema de academia
- Área de mensagens, campo de digitação, botão **Enviar** e **Nova Conversa**
- Envio via Fetch e exibição da resposta da IA
- Histórico mantido durante toda a conversa
- Indicador de carregamento ("NutriFit está pensando...")
- Tratamento de erros com mensagem amigável
- Distinção visual entre mensagens do usuário e da IA

**Extras (bônus)**
- 🌗 Modo claro e escuro
- ⌨️ Enviar com **Enter**
- 📋 Copiar respostas da IA
- 🔢 Contador de mensagens
- 🕒 Horário das mensagens
- ⬇️ Scroll automático
- ✍️ Markdown simples (negrito, itálico, listas)
- 💾 Persistência com LocalStorage

---

## 🧠 System Prompt

A persona **NutriFit** é definida em [`src/config/openai.js`](src/config/openai.js): personal trainer e nutricionista motivador, com tom energético, focado exclusivamente em treino, nutrição, hidratação e bem-estar físico, com regras de segurança (não prescreve fármacos proibidos, recomenda avaliação médica em caso de lesões e mantém o personagem).

---

Curso IACHAT • SENAI • Situação de Aprendizagem
