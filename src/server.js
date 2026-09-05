import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { askPersonalTrainer } from './config/openai.js';

// Carrega as variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração dos Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend (pasta pages)
const pagesPath = path.join(__dirname, '..', 'pages');
app.use(express.static(pagesPath));

/**
 * Histórico mantido em memória (sem banco de dados), separado por conversa.
 * Chave: conversaId (string) | Valor: array de { role, content }
 * Isso permite vários "projetos"/conversas no painel lateral, cada um com
 * seu próprio contexto. Sem conversaId, usa a conversa 'default'.
 */
const conversas = new Map();

function getHistorico(conversaId) {
  const id = conversaId || 'default';
  if (!conversas.has(id)) conversas.set(id, []);
  return conversas.get(id);
}

// ==================== ROTAS DA API ==================== //

/**
 * Rota principal do chat.
 * POST /chat
 * Entrada: { "mensagem": "Oi" }  (opcional: "conversaId" para múltiplas conversas)
 * Saída:   { "response": "Olá! Como posso ajudá-lo hoje?" }
 *
 * Fluxo: recebe a mensagem -> adiciona o System Prompt (dentro de askPersonalTrainer)
 * -> envia a conversa para a OpenAI -> devolve a resposta.
 */
app.post('/chat', async (req, res) => {
  try {
    const { mensagem, conversaId } = req.body;

    if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
      return res.status(400).json({
        response: 'Por favor, envie uma mensagem válida no campo "mensagem".',
      });
    }

    const cleanMessage = mensagem.trim();
    const messages = getHistorico(conversaId);

    // Guarda a mensagem do usuário no histórico da conversa
    messages.push({ role: 'user', content: cleanMessage });

    // Chama o agente (que injeta o System Prompt e o histórico recente)
    const resposta = await askPersonalTrainer(cleanMessage, messages);

    // Guarda a resposta da IA no histórico
    messages.push({ role: 'assistant', content: resposta });

    // Devolve a resposta no formato exigido pela especificação
    return res.status(200).json({ response: resposta });
  } catch (error) {
    console.error('Erro ao processar mensagem no chat:', error);
    return res.status(500).json({
      response: 'Erro interno ao processar sua solicitação com a NutriFit.',
    });
  }
});

/**
 * Nova Conversa: limpa o histórico em memória (de uma conversa específica ou de todas).
 * POST /nova-conversa   Body opcional: { "conversaId": "..." }
 */
app.post('/nova-conversa', (req, res) => {
  const { conversaId } = req.body || {};
  if (conversaId) {
    conversas.delete(conversaId);
  } else {
    conversas.clear();
  }
  return res.status(200).json({
    response: 'Conversa reiniciada com sucesso.',
  });
});

/**
 * Rota de status do servidor e diagnóstico da API.
 * GET /health
 */
app.get('/health', (req, res) => {
  let total = 0;
  for (const msgs of conversas.values()) total += msgs.length;
  return res.status(200).json({
    status: 'online',
    agent: 'NutriFit - Alimentação, Treino & Resultados',
    conversas: conversas.size,
    messagesStored: total,
    timestamp: new Date().toISOString(),
  });
});

// Redireciona qualquer rota não mapeada para o index.html do frontend
app.use((req, res) => {
  res.sendFile(path.join(pagesPath, 'index.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor NutriFit rodando na porta ${PORT}`);
  console.log(`🌐 Acesse no navegador: http://localhost:${PORT}`);
  console.log(`💬 API de Chat disponível em: http://localhost:${PORT}/chat`);
  console.log(`====================================================`);
});
