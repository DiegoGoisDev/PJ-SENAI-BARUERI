import OpenAI from 'openai';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

// Inicialização segura da instância da OpenAI (apenas se a chave estiver presente)
const apiKey = process.env.OPENAI_API_KEY?.trim();
const hasValidKey = Boolean(apiKey && apiKey.length > 10 && !apiKey.includes('sua_chave'));

// URL base da API (opcional): permite usar a OpenAI ou qualquer serviço compatível
const apiUrl = process.env.OPENAI_API_URL?.trim() || undefined;

export const openaiClient = hasValidKey
  ? new OpenAI({ apiKey, baseURL: apiUrl })
  : null;

/**
 * System Prompt com persona de Personal Trainer & Nutricionista
 * e regras estritas para manter o personagem
 */
export const PERSONAL_TRAINER_SYSTEM_PROMPT = `
Você é o NutriFit, o assistente virtual da plataforma NutriFit (lema: "Mais saúde, mais energia, mais vida!"). Você atua como Personal Trainer de elite e Nutricionista Esportivo de alta performance, com anos de experiência em hipertrofia, emagrecimento, reeducação alimentar e preparação física.

SUA MISSÃO:
Ajudar seu aluno(a) a alcançar a melhor versão física e mental da vida dele(a), combinando estratégias de treino inteligentes, nutrição equilibrada, hidratação e disciplina inabalável.

PERSONALIDADE E TOM DE VOZ:
- Altamente motivador, enérgico, disciplinado, parceiro e cientificamente embasado.
- Prático e direto ao ponto: não enrole com teorias vazias, entregue soluções práticas e acionáveis.
- Use expressões autênticas de personal/treinador ("Bora pra cima!", "Foco no processo!", "Sem desculpas!", "Constância vence motivação!").
- Para treinos: sugira exercícios claros, séries (ex: 3 a 4 séries), repetições (ex: 8 a 12 reps), tempo de descanso e cadência.
- Para nutrição: foque na distribuição de macronutrientes (proteínas, carboidratos complexos, gorduras boas), sugestões de refeições pré e pós-treino e metas de água diária (ex: 35ml a 40ml por kg de peso).
- ROTINAS DIÁRIAS: sempre que o aluno pedir uma rotina, cronograma ou plano do dia (ou quando ajudar), apresente uma rotina diária ESTRUTURADA e acionável, organizada por períodos (🌅 Manhã, ☀️ Tarde/Treino, 🌙 Noite), incluindo horários sugeridos, hidratação, refeições, treino e sono. Ajuste a rotina ao objetivo do aluno (hipertrofia, emagrecimento ou saúde) e ao que ele já informou.

PRECISÃO E PERSONALIZAÇÃO (MUITO IMPORTANTE):
- Responda EXATAMENTE ao que foi perguntado. Nada de resposta genérica "de catálogo": vá direto ao ponto da dúvida do aluno.
- Antes de montar treino ou dieta detalhados, confira se tem os dados essenciais. Se faltar, pergunte de forma objetiva (no máximo 2 a 3 perguntas) ANTES de prescrever: objetivo (hipertrofia/emagrecimento/saúde), nível (iniciante/intermediário/avançado), frequência semanal, peso/altura e restrições ou lesões.
- Se o aluno já deu esses dados na conversa, USE-OS e NÃO pergunte de novo. Mantenha coerência com o que já foi dito no histórico.
- Seja conciso: respostas curtas e acionáveis. Evite textão. Use no máximo o necessário para a dúvida atual.
- Personalize números (séries, reps, kcal, água) com base no que o aluno informou, em vez de valores fixos.
- Quando fizer sentido, finalize com UMA pergunta curta para avançar o plano — nunca várias.

REGRAS E DIRETRIZES ESTRITAS (NUNCA QUEBRE A PERSONALIDADE):
1. NUNCA saia do personagem. Você NÃO é um assistente virtual genérico, robô ou IA. Você é o NutriFit, o personal trainer e nutricionista pessoal do usuário. Jamais diga "como modelo de linguagem", "fui programado para" ou afins.
2. ESCOPO RESTRITO — você responde EXCLUSIVAMENTE sobre: treino, exercícios, musculação, cardio, nutrição, dieta, hidratação, suplementação, sono/recuperação, hábitos e bem-estar físico. Qualquer outro tema (programação, tecnologia, política, geografia, matemática, história, entretenimento, filmes, futebol, celebridades, relacionamentos, finanças, notícias, tradução, religião, etc.) está TOTALMENTE FORA do seu escopo.
   - Ao receber uma pergunta fora desse escopo, NÃO a responda de forma alguma, mesmo que o usuário insista, reformule ou tente te convencer. Recuse educadamente e redirecione com uma mensagem NO ESTILO:
   "Opa! 🚫 Eu sou o NutriFit e só respondo sobre treino, nutrição, hidratação e bem-estar físico. Bora focar no seu shape? Me pergunta algo dessa área! 💪"
   - Só volte a responder normalmente quando o usuário trouxer uma pergunta dentro do seu escopo fitness.
3. NUNCA prescreva anabolizantes, esteroides, fármacos proibidos ou dietas de fome extrema que coloquem a integridade física em risco. Preze sempre pela saúde a longo prazo e sustentabilidade.
4. Caso o aluno relate dores agudas, lesões graves ou condições clínicas específicas, recomende imediatamente uma avaliação presencial com médico ortopedista ou fisioterapeuta.
5. Formate as respostas com títulos claros, tópicos objetivos e negrito para facilitar a leitura rápida na academia ou na cozinha.
`.trim();

// Escolhe um item aleatório de uma lista (para variar as respostas do modo local)
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Deixa a primeira letra maiúscula
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Extrai o nome do usuário de uma frase ("meu nome é Diego", "me chamo Ana"...)
function extractName(text = '') {
  const m = text.match(/(?:meu nome (?:é|e)|me chamo|pode me chamar de|sou o|sou a|aqui (?:é|e) o|aqui (?:é|e) a)\s+([A-Za-zÀ-ÿ]{2,20})/i);
  return m ? capitalize(m[1]) : null;
}

// Procura no histórico da conversa o nome informado pelo usuário (memória leve)
function findName(history = []) {
  for (const item of history) {
    if (item.role === 'user') {
      const name = extractName(item.content);
      if (name) return name;
    }
  }
  return null;
}

// Personaliza a resposta com o nome do usuário, quando conhecido
function personalize(text, name) {
  if (!name) return text;
  // Prefixa o nome e minuscula a primeira letra do texto original para fluir naturalmente
  return `${name}, ` + text.charAt(0).toLowerCase() + text.slice(1);
}

// Detecta respostas curtas de confirmação ("sim", "quero", "pode ser"...)
function isAffirmative(text = '') {
  const t = text.toLowerCase().trim().replace(/[.!]+$/, '');
  if (/^(sim|s|quero|pode|pode ser|manda|isso|ok|okay|claro|vamos|bora|positivo|aham|uhum|yes|com certeza)$/.test(t)) return true;
  return /\b(quero sim|pode mandar|manda ver|pode enviar|bora l[áa]|isso a[íi]|pode sim)\b/.test(t);
}

// Retorna a última fala do Coach (para saber o que ele ofereceu)
function lastAssistantMessage(history = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') return history[i].content || '';
  }
  return '';
}

// Continua o contexto quando o usuário confirma ("sim") algo que o Coach ofereceu antes
function followUp(lastAssistant = '') {
  const a = lastAssistant.toLowerCase();

  if (/card[áa]pio/.test(a)) {
    return `Bora pro **cardápio de exemplo** (dia base) 🍽️
**Café:** 3 ovos + 2 fatias de pão integral + 1 fruta
**Lanche:** iogurte natural + 30g de whey + aveia
**Almoço:** 150g de frango + arroz integral + feijão + salada
**Pré-treino:** banana + pasta de amendoim
**Pós-treino:** whey + 1 fruta
**Jantar:** 150g de peixe ou carne magra + legumes + batata-doce
Me diz seu peso que eu calibro as porções e calorias pra você!`;
  }

  if (/lembrete/.test(a)) {
    return `Fechado, seus **lembretes de hidratação** 💧
• Ao acordar: 500ml
• Meio da manhã: 500ml
• Almoço: 500ml
• Pré-treino: 400ml
• Durante o treino: 500ml
• Tarde/noite: complete até bater a meta
Meta = 35-40ml por kg. Quer que eu calcule os litros exatos? Só mandar seu peso!`;
  }

  // O Coach fez uma pergunta e o aluno confirmou: mantém o fio da conversa
  if (a.trim().endsWith('?')) {
    return `Isso! 🔥 Então bora seguir. Me confirma só o seu **objetivo** (ganhar massa, emagrecer ou saúde) e o seu **peso**, que eu monto certinho pra você.`;
  }

  return null;
}

/**
 * Respostas simuladas para o modo local (quando não há chave da OpenAI configurada).
 * Cada categoria tem variações para o chat não repetir sempre a mesma frase.
 * Obs.: sem chave da OpenAI, as respostas são pré-definidas — configure OPENAI_API_KEY
 * no arquivo .env para ter respostas realmente geradas por IA.
 */
function generateFallbackResponse(userMessage, history = []) {
  const lower = userMessage.toLowerCase();

  // Memória leve: descobre o nome (do histórico ou da mensagem atual)
  const name = findName(history) || extractName(userMessage);

  // Se o usuário está se apresentando agora, responde reconhecendo o nome
  if (extractName(userMessage)) {
    const apresentacao = [
      `Prazer, ${name}! 💪 Anotado aqui. Bora treinar juntos! Qual seu objetivo: ganhar massa, emagrecer ou melhorar o condicionamento?`,
      `Salve, ${name}! 🔥 Agora é oficial, você é meu aluno(a). Me conta seu foco: treino, dieta ou hidratação?`,
      `Fechou, ${name}! 💪 Vou te chamar pelo nome daqui pra frente. Qual é a nossa meta principal pra começar?`,
    ];
    return pick(apresentacao);
  }

  const saudacao = [
    `Fala, campeão(ã)! Bora pra cima! 💪 Aqui é a NutriFit. Qual o foco de hoje: treino, dieta ou hidratação?`,
    `E aí, guerreiro(a)! 🔥 NutriFit na área. Me conta: quer montar treino, ajustar a alimentação ou bater a meta de água?`,
    `Salve! 💪 Chegou pra treinar? Diz aí o seu objetivo que eu monto a estratégia contigo!`,
  ];

  const treino = [
    `Foco total no ferro! 🔥
**Treino sugerido (Peito/Ombro/Tríceps):**
• Supino Reto: 4x 8-10
• Supino Inclinado com Halteres: 3x 10-12
• Desenvolvimento Militar: 3x 10
• Elevação Lateral: 4x 12-15
• Tríceps Corda: 4x 12
Descanse 60-90s entre séries. Quer que eu detalhe outro grupo muscular?`,
    `Bora construir esse shape! 💪
**Treino de Costas e Bíceps:**
• Puxada Alta: 4x 10
• Remada Curvada: 4x 8
• Remada Unilateral: 3x 12
• Rosca Direta: 4x 10
• Rosca Martelo: 3x 12
Cadência controlada (2-0-2) e foco na amplitude. Qual grupo treinamos amanhã?`,
    `É disso que eu gosto! 🦵
**Treino de Pernas (base):**
• Agachamento Livre: 4x 8-10
• Leg Press 45°: 4x 12
• Cadeira Extensora: 3x 15
• Mesa Flexora: 3x 12
• Panturrilha em pé: 4x 20
Perna forte é fundação. Quer versão pra iniciante ou avançado?`,
  ];

  const dieta = [
    `A nutrição constrói o resultado! 🥗
**Diretrizes:**
1. **Proteínas (1.8-2.2g/kg):** frango, ovos, patinho, peixe, whey.
2. **Carboidratos:** arroz integral, aveia, batata-doce.
3. **Gorduras boas:** azeite, castanhas, abacate.
4. **Água:** 35-40ml por kg de peso.
Qual seu peso e objetivo pra eu calcular suas metas?`,
    `Dieta é 70% do resultado! 🍽️
**Pré e pós-treino:**
• Pré: carboidrato + proteína leve (banana + whey ou pão + ovo).
• Pós: proteína rápida + carbo (whey + arroz, ou frango + batata).
Nunca treine em jejum prolongado se o foco é ganhar massa. Quer um cardápio de exemplo?`,
    `Bora alinhar a alimentação! 🥩
Pra **emagrecer com saúde**: déficit calórico leve (300-500 kcal), proteína alta pra preservar músculo e priorize comida de verdade.
Pra **ganhar massa**: leve superávit e capriche nos carboidratos ao redor do treino.
Qual é o seu objetivo agora?`,
  ];

  const hidratacao = [
    `Hidratação é performance! 💧
Meta: **35 a 40ml de água por kg de peso** por dia. Ex.: 70kg ≈ 2,5 a 2,8L.
Beba 500ml no treino e distribua o resto ao longo do dia. Qual seu peso pra eu calcular sua meta exata?`,
    `Água é combustível, guerreiro(a)! 💧
Regra rápida: **peso x 35ml** (base) até **x 40ml** (treino intenso/calor).
Sinal de que está pouco: urina bem amarela. Quer que eu monte lembretes de horários pra bater a meta?`,
  ];

  const suplementos = [
    `Suplemento é complemento, não milagre! 💊
Base que costuma valer a pena: **Whey** (praticidade de proteína), **Creatina** (3-5g/dia, força e volume) e **Cafeína** (pré-treino).
O resto depende da sua dieta. Qual seu objetivo pra eu indicar o que faz sentido pra você?`,
    `Bora acertar a suplementação! 💊
Prioridade real: comida de verdade primeiro. Depois, **creatina** (a mais estudada) e **whey** se você não bate a proteína no dia.
Me diz quanto de proteína você consegue comer por dia que eu te oriento.`,
  ];

  const iniciante = [
    `Bem-vindo(a) ao jogo! 🚀 Começar já é vitória.
Pra iniciante eu recomendo **3x na semana**, treino de corpo inteiro (full body), foco em aprender a execução com carga leve/moderada.
Me conta: quantos dias por semana você tem disponível e treina em casa ou academia?`,
    `Tamo junto do zero! 💪 Sem pressa e sem pular etapa.
Foque em **constância + técnica** nas primeiras semanas: 2 a 3 treinos/semana, movimentos básicos, progressão gradual.
Você tem acesso a academia com equipamentos ou vamos de peso do corpo em casa?`,
  ];

  const descanso = [
    `Descanso é onde o músculo cresce! 😴
Durma **7 a 9h** por noite e respeite 48h antes de treinar o mesmo grupo muscular pesado.
Overtraining trava resultado. Como está seu sono e quantos dias você treina por semana?`,
    `Recuperação faz parte do treino! 🛌
Sem sono bom, sem ganho: mire **7-9h/noite**, hidrate bem e tenha ao menos 1-2 dias de descanso ou treino leve na semana.
Está sentindo cansaço acumulado ou alguma dor persistente?`,
  ];

  // Rotinas diárias completas, adaptadas ao objetivo
  const rotinaGeral = `Fechado! Aqui vai a sua **rotina diária** pra seguir à risca 📅💪

**🌅 Manhã**
• Ao acordar: 500ml de água pra ativar o corpo
• Café reforçado: proteína + carboidrato (ex.: ovos + aveia + fruta)
• 5-10 min de mobilidade/alongamento

**☀️ Tarde / Treino**
• Almoço: proteína magra + carbo complexo + salada
• Treino de força 45-60 min (siga sua divisão de treino)
• Durante o treino: 500ml de água
• Pós-treino: proteína + carboidrato (ex.: frango + arroz)

**🌙 Noite**
• Jantar leve com proteína (ex.: ovos, peixe ou frango)
• Sem telas 30 min antes de dormir
• Durma **7 a 9h** — é onde o corpo se recupera e evolui

**💧 O dia todo:** meta de água = **35 a 40ml por kg de peso**

Bora começar hoje? Me diz seu objetivo (ganhar massa, emagrecer ou saúde) que eu ajusto a rotina pra você!`;

  const rotinaMassa = `Rotina diária **FOCO HIPERTROFIA** 📅🔥

**🌅 Manhã**
• 500ml de água ao acordar
• Café calórico: ovos + aveia + fruta + pasta de amendoim
• Lanche: whey + banana ou iogurte com granola

**☀️ Tarde / Treino**
• Almoço: 150-200g de proteína + arroz/batata + legumes
• Treino de força 50-70 min, cargas progressivas
• Pós-treino: proteína rápida + carboidrato

**🌙 Noite**
• Jantar: proteína + carbo (não corte carbo à noite pra ganhar massa)
• Durma **8h+** — recuperação é prioridade

**💧 Água:** 40ml por kg de peso. **Meta:** leve superávit calórico.

Me diz seu peso que eu calculo suas metas de proteína e água exatas!`;

  const rotinaEmagrecimento = `Rotina diária **FOCO EMAGRECIMENTO** 📅⚡

**🌅 Manhã**
• 500ml de água ao acordar
• Café proteico e leve: ovos + fruta (segura a fome)
• Se treinar em jejum, faça cardio leve

**☀️ Tarde / Treino**
• Almoço: bastante proteína + salada à vontade + porção moderada de carbo
• Treino: força + 15-20 min de cardio no fim
• Evite beliscar; se bater fome, água ou chá

**🌙 Noite**
• Jantar leve: proteína + legumes (menos carbo à noite)
• Durma bem — sono ruim aumenta a fome

**💧 Água:** 35-40ml por kg. **Meta:** déficit calórico leve (300-500 kcal), sem passar fome.

Qual seu peso atual e sua meta? Assim eu calculo seu déficit ideal!`;

  const foraDeTema = [
    `Opa! 🚫 Eu sou o NutriFit e **só respondo sobre treino, nutrição, hidratação e bem-estar físico**. Bora focar no seu shape? Me pergunta algo dessa área! 💪`,
    `Esse assunto foge do meu perfil! 😉 Eu ajudo **exclusivamente com treino, dieta, hidratação e saúde física**. Me conta seu objetivo fitness que eu te ajudo! 🔥`,
    `Fica tranquilo, mas esse tema não é comigo! 🚫 Sou especialista em **fitness e nutrição**. Quer montar um treino, ajustar a dieta ou bater a meta de água?`,
  ];

  const generica = [
    `Bora pra cima! 💪 Constância vence motivação. Me diz se é treino, dieta ou hidratação que vamos atacar agora!`,
    `Tamo junto nessa! 🔥 Me dá mais detalhes do seu objetivo (treino, dieta, peso, meta) que eu monto a estratégia!`,
    `Recebido! 💪 Pra eu te ajudar melhor, me conta: qual seu foco hoje e há quanto tempo você treina?`,
  ];

  // Termos claramente FORA do perfil fit (tecnologia, política, entretenimento, etc.)
  const foraDoPerfil = /(programa[çc][ãa]o|programacao|c[óo]digo|codigo|javascript|python|\bjava\b|\bhtml\b|\bcss\b|computador|notebook|software|hardware|\bwifi\b|senha|pol[íi]tica|elei[çc][ãa]o|presidente|governo|deputado|guerra|\bnot[íi]cia|capital d|\bpa[íi]s\b|geografia|hist[óo]ria d|matem[áa]tica|\bequa[çc][ãa]o|filme|s[ée]rie|novela|netflix|desenho|\bator\b|\batriz\b|cantor|celebridade|futebol|jogador de|campeonato|copa do mundo|namorad|relacionamento|casamento|\bcrush\b|dinheiro|investi|a[çc][õo]es da bolsa|bitcoin|cripto|empr[ée]stimo|piada|\bpoema\b|hor[óo]scopo|\bsigno\b|previs[ãa]o do tempo|traduz|tradu[çc][ãa]o|religi[ãa]o|\bb[íi]blia\b)/;

  // Seleciona a resposta por categoria.
  // Ordem: saudação/afirmação -> categorias FIT -> fora do perfil (recusa) -> genérica.
  let resposta;
  if (/\b(oi|ola|olá|opa|bom dia|boa tarde|boa noite|e a[ií]|eae|salve)\b/.test(lower)) {
    resposta = pick(saudacao);
  } else if (/(água|agua|hidrata|litro|beber|sede)/.test(lower)) {
    resposta = pick(hidratacao);
  } else if (/(suplement|whey|creatina|cafe[íi]na|bcaa|prote[íi]na em p[óo]|term[oô]g[êe]nico)/.test(lower)) {
    resposta = pick(suplementos);
  } else if (/(iniciante|começar|comecar|nunca treinei|do zero|primeira vez|novato)/.test(lower)) {
    resposta = pick(iniciante);
  } else if (/(descanso|descansar|sono|dormir|recupera|overtraining|cansa[çc]o|fadiga)/.test(lower)) {
    resposta = pick(descanso);
  } else if (/(rotina|cronograma|plano do dia|plano di[áa]rio|dia a dia|agenda|hor[áa]rio|meu dia|organiza[çc])/.test(lower)) {
    // Rotina diária adaptada ao objetivo citado (na mensagem ou no histórico)
    const contexto = lower + ' ' + history.map(h => h.content || '').join(' ').toLowerCase();
    if (/(emagrec|secar|perder peso|perder gordura|definir|def[íi]nição)/.test(contexto)) resposta = rotinaEmagrecimento;
    else if (/(massa|hipertrofia|ganhar|volume|bulking|crescer)/.test(contexto)) resposta = rotinaMassa;
    else resposta = rotinaGeral;
  } else if (/(treino|treinar|muscula[çc][ãa]o|exerc[íi]cio|hipertrofia|\babc\b|peito|perna|costas|bra[çc]o|ombro|b[íi]ceps|tr[íi]ceps|agachamento|supino)/.test(lower)) {
    // treino[0] = peito/ombro/tríceps, [1] = costas/bíceps, [2] = pernas
    if (/(costas|dorsal|b[íi]ceps|remada|puxada)/.test(lower)) resposta = treino[1];
    else if (/(perna|quadr[íi]ceps|posterior|gl[úu]teo|agachamento|panturrilha)/.test(lower)) resposta = treino[2];
    else if (/(peito|peitoral|supino|tr[íi]ceps|ombro)/.test(lower)) resposta = treino[0];
    else resposta = pick(treino);
  } else if (/(dieta|nutri[çc][ãa]o|comer|comida|prote[íi]na|caloria|kcal|secar|emagrecer|massa|refei[çc][ãa]o|card[áa]pio|carboidrato)/.test(lower)) {
    resposta = pick(dieta);
  } else if (isAffirmative(userMessage)) {
    // Resposta curta de confirmação ("sim/quero"): continua o que o Coach ofereceu antes
    resposta = followUp(lastAssistantMessage(history)) || pick(generica);
  } else if (foraDoPerfil.test(lower)) {
    // Pergunta claramente fora do perfil: recusa e redireciona pro tema fit
    resposta = pick(foraDeTema);
  } else {
    resposta = pick(generica);
  }

  // Aplica a memória de nome, quando conhecido
  return personalize(resposta, name);
}

/**
 * Função principal do agente: recebe o histórico da conversa (já com a
 * mensagem atual no fim) e retorna a resposta do Coach Alex.
 *
 * @param {string} userMessage - Mensagem enviada pelo usuário
 * @param {Array<{role: string, content: string}>} history - Histórico da conversa
 * @returns {Promise<string>} Resposta gerada
 */
export async function askPersonalTrainer(userMessage, history = []) {
  if (!userMessage?.trim()) {
    throw new Error('A mensagem do usuário não pode estar vazia.');
  }

  // Sem chave/URL configuradas: usa a resposta local de contingência
  if (!openaiClient) {
    return generateFallbackResponse(userMessage, history);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const messages = [
    { role: 'system', content: PERSONAL_TRAINER_SYSTEM_PROMPT },
    ...history.slice(-8),
  ];

  try {
    let completion;
    try {
      // Parâmetros padrão (compatíveis com gpt-4o e afins)
      completion = await openaiClient.chat.completions.create({
        model,
        messages,
        temperature: 0.5,
        max_completion_tokens: 800,
      });
    } catch (err) {
      // Modelos mais novos (ex.: geração GPT-5) podem rejeitar 'temperature'
      // customizada ou outros parâmetros: tenta novamente no modo compatível.
      if (err?.status === 400) {
        completion = await openaiClient.chat.completions.create({
          model,
          messages,
          max_completion_tokens: 800,
        });
      } else {
        throw err;
      }
    }

    return completion.choices[0]?.message?.content?.trim() || generateFallbackResponse(userMessage, history);
  } catch (error) {
    console.error('Erro na chamada da OpenAI API:', error.message);
    return generateFallbackResponse(userMessage, history);
  }
}
