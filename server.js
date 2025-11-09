require("dotenv").config()
const express = require("express")
const cors = require("cors")
const path = require("path")
const app = express()

// Configuração das API keys
// Verifica a variavel AI_PROVIDER, da pasta .env
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || "openai",
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4",
  },
  google: {
    apiKey: process.env.GOOGLE_AI_API_KEY,
    model: "gemini-2.5-pro",
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: "meta-llama/llama-4-scout-17b-16e-instruct", 
  },
}

app.use(cors())
app.use(express.json({ limit: "10mb" }))

app.use(express.static(__dirname))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"))
})

app.post("/api/analyze-accessibility", async (req, res) => {
  try {
    const { sourceCode } = req.body

    if (!sourceCode || sourceCode.trim().length === 0) {
      return res.status(400).json({
        error: "Código-fonte é obrigatório",
        message: "Por favor, forneça o código-fonte para análise",
      })
    }

    console.log(" Iniciando análise de acessibilidade...")
    console.log(` Tamanho do código: ${sourceCode.length} caracteres`)

    const prompt = buildWCAGPrompt(sourceCode) 

   
    //decide qual modelo ta configurado no .env para fazer a requisicao
    let result
    if (AI_CONFIG.provider === "openai" && AI_CONFIG.openai.apiKey) {
      console.log(" Usando OpenAI...")
      result = await callOpenAI(prompt)
      
    } else if (AI_CONFIG.provider === "google" && AI_CONFIG.google.apiKey) {
      console.log(" Usando Google AI...")
      result = await callGoogleAI(prompt)


    } else if (AI_CONFIG.provider === "groq" && AI_CONFIG.groq.apiKey) {
      console.log(" Usando Groq...")
      result = await callGroqAI(prompt)

    } else {
      console.error(" Erro de configuração: Nenhuma API Key de IA válida fornecida para o provedor selecionado.")
      return res.status(503).json({
        error: "Serviço Indisponível",
        message: "A ferramenta não está configurada corretamente para se conectar à IA.",
      })
    }

    console.log(" Análise concluída com sucesso!")
    console.log("--- OBJETO SENDO ENVIADO PARA O FRONTEND ---", JSON.stringify(result, null, 2));

    res.json(result)
  } catch (error) {
    console.error(" Erro na análise:", error.message)
    res.status(500).json({
      error: "Erro ao Processar a Análise",
      message: `Ocorreu uma falha na comunicação com o serviço de IA. Detalhe: ${error.message}`,
    })
  }
})

// Função para chamar GPT 
async function callOpenAI(prompt) {
  const fetch = (await import("node-fetch")).default

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.openai.model,
      messages: [
        {
          role: "system",
          content: "Você é um especialista em acessibilidade web WCAG 2.2. Retorne apenas JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim()
  return JSON.parse(cleanedContent)
}


// Função para chamar o groq
async function callGroqAI(prompt) {
  const fetch = (await import("node-fetch")).default

  //caminho da requisição
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.groq.apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.groq.model,
      messages: [
        {
          role: "system",
          content: "Você é um especialista em acessibilidade web WCAG 2.2. Retorne apenas JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Groq API Error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  
  if (!data.choices || data.choices.length === 0) {
      throw new Error("Groq API Error: Resposta não contém 'choices'.");
  }

  const content = data.choices[0].message.content
  const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim()
  
  try {
      return JSON.parse(cleanedContent);
  } catch (error) {
      console.error("DEU ERRO!");
      console.error("Erro específico:", error.message);
      throw new Error("A IA (Groq) retornou um JSON com sintaxe inválida.");
  }
}

// Função para chamar o gemini
async function callGoogleAI(prompt) {
  const fetch = (await import("node-fetch")).default;
  //caminho da requisição
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.google.model}:generateContent?key=${AI_CONFIG.google.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = data.error || {};
    throw new Error(`Google AI API Error: ${error.message || response.statusText}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error(`A resposta da IA foi bloqueada. Motivo: ${data.promptFeedback.blockReason}`);
    } else {
      throw new Error("A IA retornou uma resposta vazia ou em formato inesperado.");
    }
  }

  const content = data.candidates[0].content.parts[0].text;
  const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();



  try {
    return JSON.parse(cleanedContent);
  } catch (error) {
 
    console.error("!!! ERROOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO: A IA retornou um JSON com sintaxe inválida denovoooooooooooo");
    console.error("erro específico:", error.message);
    console.log("o motivo do erro:");
    console.log(cleanedContent);

    
    throw new Error("A IA retornou um JSON com sintaxe inválida. Verifique o log do backend para detalhes.");
  }
}

// É A PARTE MAIS IMPORTANTE, FICAR MUDANDO E TESTANDO COM OUTROS PROMPS PARA MELHORAR O RETORNO
// Função para construir prompt WCAG que é enviado para a IA
// O FOCO PRINCIPAL DA FERRAMENTA
function buildWCAGPrompt(sourceCode) {
  return `Você é um especialista em acessibilidade web e diretrizes WCAG 2.2.

IMPORTANTE: Retorne APENAS um JSON válido, sem texto adicional, comentários ou formatação markdown. PARA DESTACAR CÓDIGO DENTRO DE STRINGS, USE ASPAS SIMPLES ('), NUNCA O ACENTO GRAVE (\`).

Passo 1: Verificação do Tipo de Código.
Primeiro, analise o código-fonte fornecido para determinar se ele corresponde a código de frontend para uma aplicação web (HTML, CSS, JavaScript, ou frameworks como React, Vue, Angular).

Passo 2: Geração da Resposta. 
- SE o código NÃO FOR de frontend web, retorne APENAS o seguinte JSON e pare:
{
  "isValidCode": false,
  "message": "O código enviado não foi identificado como código frontend web.
  Por favor, verifique-o e envie novamente."
}

- SE o código FOR de frontend web, prossiga com a análise de acessibilidade e retorne APENAS um JSON com a seguinte estrutura:
{
  "conformanceLevel": "A" | "AA" | "AAA" | "Não Conforme",
  "score": number (0-100),
  "overallStats": {
    "totalPassed": number,
    "totalFailed": number,
    "totalCriteria": 86
  },
  "levelStats": {
    "A": { "passed": number, "failed": number, "total": 31 },
    "AA": { "passed": number, "failed": number, "total": 24 },
    "AAA": { "passed": number, "failed": number, "total": 31 }
  },
  "levelA": {
    "passed": [
      { "title": "1.1.1 - Nome do Critério", "description": "Descrição do que foi encontrado" }
    ],
    "failed": [
      { "title": "1.1.1 - Nome do Critério", "description": "Descrição do problema encontrado" }
    ]
  },
  "levelAA": {
    "passed": [...],
    "failed": [...]
  },
  "levelAAA": {
    "passed": [...],
    "failed": [...]
  },
  "suggestions": [
    {
      "title": "Título da Sugestão",
      "description": "Descrição detalhada da melhoria",
      "priority": "Alta" | "Média" | "Baixa",
      "impact": "Alto" | "Médio" | "Baixo"
    }
  ]
}

Passo 3: Lógica de Classificação de Critérios (REGRA PRINCIPAL)
Você DEVE classificar CADA um dos 86 critérios em UMA das duas listas: 'passed' ou 'failed'.

1.  **Lógica para 'failed' (Falhou):**
    * Use esta lista APENAS SE o código-fonte *ativamente VIOLA* a regra.
    * Exemplo: Uma '<img>' existe, mas *não tem* o atributo 'alt'.

2.  **Lógica para 'passed' (Passou):**
    * Use esta lista para DUAS CONDIÇÕES:
    * 1. Se o código-fonte *CUMPRE* a regra (ex: Uma '<img>' existe e *tem* o atributo 'alt').
    * 2. Se o critério *NÃO SE APLICA* (ex: O critério é sobre vídeos, mas 'Não há vídeos na página').
    * A descrição DEVE explicar o motivo de ter passado (seja por cumprimento ou por não se aplicar).

3.  **Regra de Ouro:** UM CRITÉRIO SÓ PODE ESTAR EM 'failed' SE HOUVER UMA VIOLAÇÃO REAL. Todo o resto é 'passed'.

Você deve verificar o código-fonte explicitamente contra CADA UM dos seguintes critérios do WCAG 2.2:

--- CRITÉRIOS DE ANÁLISE DE NÍVEL A ---
1.  **1.1.1 Conteúdo não textual:** Verifique se todas as tags **<img>**, **<area>** e **<input type="image">** possuem um atributo **alt**. Se a imagem for puramente decorativa, o **alt** deve estar presente, mas vazio (**alt=""**). Para ícones ou botões sem texto visível, verifique se há **aria-label** ou **aria-labelledby**.
2.  **1.2.1 Somente áudio e somente vídeo (pré-gravado):** Se houver tags **<audio>** ou **<video>** sem trilha de vídeo ou áudio, respectivamente, verifique se há um link para uma transcrição textual ou uma alternativa textual na página.
3.  **1.2.2 Legendas (pré-gravadas):** Se houver tags **<video>** com áudio, verifique a presença de tags **<track kind="captions">** associadas ou legendas embutidas.
4.  **1.2.3 Descrição de áudio ou alternativa de mídia (pré-gravada):** Se houver tags **<video>**, verifique se há uma trilha de audiodescrição (**<track kind="descriptions">**) ou um link para uma transcrição textual que inclua descrições visuais.
5.  **1.3.1 Informações e Relacionamentos:** Verifique o uso correto de tags semânticas para estrutura: cabeçalhos (**<h1>** a **<h6>**) usados em ordem hierárquica, listas (**<ul>**, **<ol>**, **<dl>**), tabelas com cabeçalhos (**<th>**, **scope**), landmarks (**<main>**, **<nav>**, **<aside>**), e formulários (**<label>**, **<fieldset>**, **<legend>**).
6.  **1.3.2 Sequência Significativa:** Analise a ordem dos elementos no DOM. Verifique se a ordem faz sentido quando lida linearmente, mesmo que o CSS altere a posição visual. A ordem do código deve preservar o significado.
7.  **1.3.3 Características sensoriais:** Procure por instruções no texto que dependam apenas de forma, tamanho, localização visual, orientação ou som (ex: "Clique no botão quadrado à direita"). Essas instruções devem ter alternativas textuais.
8.  **1.4.1 Uso da cor:** Verifique se informações (como estados de erro, links visitados) são indicadas *apenas* pela cor. Deve haver um indicador adicional (texto, ícone, sublinhado). Analise o CSS em busca dessas pistas.
9.  **1.4.2 Controle de áudio:** Procure por tags **<audio autoplay>** ou JavaScript que inicie áudio automaticamente. Se o áudio durar mais de 3 segundos, verifique se há controles visíveis para pausar, parar ou ajustar o volume independentemente do sistema.
10. **2.1.1 Teclado:** Verifique se todos os elementos interativos (**<a>**, **<button>**, **<input>**, **<select>**, **<textarea>**, elementos com **tabindex="0"**) são focalizáveis e operáveis usando apenas o teclado (Enter, Espaço, Setas).
11. **2.1.2 Sem armadilha de teclado:** Verifique se o foco do teclado, ao entrar em um componente (como um modal ou widget), pode também sair dele usando apenas o teclado (geralmente Tab ou Esc).
12. **2.1.4 Atalhos de teclado de caracteres:** Procure por JavaScript (**addEventListener** para **keydown**/**keypress**) que implemente atalhos usando apenas letras, números ou símbolos (sem Ctrl/Alt/Shift). Verifique se há como desativar, remapear ou se só funcionam quando o componente tem foco.
13. **2.2.1 Tempo ajustável:** Procure por JavaScript (**setTimeout**, **setInterval**) que imponha limites de tempo (ex: para sessões, respostas). Verifique se o usuário é avisado e pode desligar, ajustar ou estender o tempo.
14. **2.2.2 Pausar, Parar, Esconder:** Para conteúdo que se move, pisca ou rola automaticamente por mais de 5s (carrosséis, banners animados, tickers - via JS ou CSS animation), verifique se há controles visíveis para pausar, parar ou ocultar. Para conteúdo que se atualiza automaticamente (feeds), verifique controles para pausar ou ajustar a frequência.
15. **2.3.1 Três flashes ou abaixo do limite:** Analise CSS animations ou JavaScript que possam causar mudanças rápidas de brilho ou cor em uma área. Verifique se isso ocorre mais de 3 vezes por segundo. *Nota: Difícil de garantir 100% com análise estática.*
16. **2.4.1 Blocos de desvio:** Verifique se o primeiro elemento focalizável na página é um link interno (ex: **<a href="#main-content">Pular para conteúdo</a>**) que permite saltar blocos repetitivos (cabeçalho, menu). O uso correto de landmarks (**<main>**) também ajuda.
17. **2.4.2 Página intitulada:** Verifique se a tag **<title>** dentro do **<head>** existe, não está vazia e descreve o conteúdo ou propósito da página.
18. **2.4.3 Ordem de Foco:** Analise a ordem dos elementos interativos no DOM. Verifique se a sequência de foco ao pressionar Tab é lógica e corresponde à ordem visual. Procure por **tabindex** com valores positivos (> 0), que geralmente indicam problemas.
19. **2.4.4 Objetivo do link (em contexto):** Verifique o texto dentro das tags **<a>**. Evite textos genéricos como "clique aqui", "saiba mais". O propósito deve ser claro pelo texto do link ou pelo parágrafo/item de lista/célula de tabela onde ele se encontra. Verifique também **aria-label** ou **aria-labelledby**.
20. **2.5.1 Gestos de ponteiro:** Se houver JavaScript que detecte gestos complexos (pinch-to-zoom, swipe), verifique se existe uma alternativa operável com cliques simples (botões de zoom, botões de paginação).
21. **2.5.2 Cancelamento de ponteiro:** Verifique os event listeners em JavaScript. Ações devem ser preferencialmente acionadas no **click** ou **mouseup**/**touchend**. Se **mousedown**/**touchstart** for usado, deve haver uma forma de cancelar a ação (ex: movendo o dedo/mouse para fora) antes do **mouseup**/**touchend**.
22. **2.5.3 Etiqueta no nome:** Para botões ou links que contêm texto, verifique se o atributo **aria-label**, caso exista, inclui o texto visível para evitar confusão.
23. **2.5.4 Atuação de movimento:** Procure por JavaScript que use **DeviceMotionEvent** ou **DeviceOrientationEvent**. Verifique se a funcionalidade acionada por movimento tem uma alternativa por controle na interface (botão, link) e se há uma opção para desativar a detecção de movimento.
24. **3.1.1 Idioma da página:** Verifique se a tag **<html>** possui o atributo **lang** com um valor válido e não vazio (ex: **lang="pt-BR"**, **lang="en"**).
25. **3.2.1 Em foco:** Procure por JavaScript com **onfocus** ou **addEventListener('focus', ...)** em elementos interativos. Verifique se essas ações não causam automaticamente uma mudança de contexto (abrir nova janela, ir para outra página, etc.).
26. **3.2.2 Na entrada:** Procure por JavaScript com **onchange**, **oninput** ou **addEventListener('change', ...)** em campos de formulário (**<input>**, **<select>**, **<textarea>**). Verifique se a alteração do valor não causa automaticamente uma mudança de contexto.
27. **3.2.6 Ajuda Consistente:** Se mecanismos de ajuda (link para contato, chat, FAQ) estiverem presentes, verifique se eles aparecem em um local relativo consistente em diferentes templates de página (ex: sempre no cabeçalho ou rodapé).
28. **3.3.1 Identificação de erros:** Se houver validação de formulário (HTML5 ou JS), verifique se os erros são comunicados em texto (não apenas por cor) e se o campo com erro é claramente identificado (ex: com **aria-invalid="true"** e a mensagem de erro associada via **aria-describedby**).
29. **3.3.2 Etiquetas ou instruções:** Verifique se todos os campos de formulário (**<input>**, **<textarea>**, **<select>**) têm uma tag **<label>** associada via atributo **for**, ou se estão encapsulados pela label, ou usam **aria-label**/**aria-labelledby**. Placeholders não são substitutos adequados para labels.
30. **3.3.7 Entrada redundante:** Em formulários de múltiplos passos, verifique se informações fornecidas em um passo (ex: endereço de entrega) são preenchidas automaticamente ou facilmente selecionáveis em passos posteriores (ex: endereço de cobrança), se aplicável.
31. **4.1.2 Nome, Função, Valor:** Verifique se todos os componentes interativos têm um nome acessível (texto visível, **alt**, **aria-label**), uma função (tag HTML semântica como **<button>** ou ARIA role como **role="button"**) e, se aplicável, um estado ou valor (como **aria-checked**, **aria-expanded**, valor de um campo).

--- CRITÉRIOS DE NÍVEL AA ---
32. **1.2.4 Legendas (Ao Vivo):** Se houver streaming de vídeo com áudio, verifique a disponibilidade de legendas em tempo real. *Nota: Difícil verificar automaticamente.*
33. **1.2.5 Descrição de áudio (pré-gravada):** Se houver tags **<video>**, verifique se há uma trilha de audiodescrição (**<track kind="descriptions">**) ou uma versão alternativa do vídeo com audiodescrição.
34. **1.3.4 Orientação:** Verifique se o CSS ou JavaScript não força uma orientação de tela específica (ex: bloqueio em modo retrato) a menos que seja essencial (ex: app de piano).
35. **1.3.5 Identificar a finalidade da entrada:** Para campos de formulário que coletam informações sobre o usuário (nome, endereço, email, etc.), verifique se o atributo **autocomplete** está presente com um valor apropriado (ex: **autocomplete="name"**, **autocomplete="email"**).
36. **1.4.3 Contraste (Mínimo):** Verifique o contraste de cor entre o texto e o fundo no CSS. A taxa deve ser ≥ 4.5:1 para texto normal e ≥ 3:1 para texto grande (18pt ou 14pt negrito). *Nota: A análise estática pode não pegar todas as combinações ou imagens de fundo.*
37. **1.4.4 Redimensionar texto:** Verifique se o layout é flexível (usa unidades relativas como **em**, **rem**, **%**) e permite que o usuário aumente o zoom do texto no navegador em até 200% sem que o conteúdo se sobreponha ou exija rolagem horizontal. Evite alturas fixas em contêineres de texto.
38. **1.4.5 Imagens de Texto:** Verifique se o texto principal é apresentado como texto real (HTML) e não como imagens contendo texto, a menos que seja essencial (logotipo) ou customizável pelo usuário.
39. **1.4.10 Refluxo:** Verifique se o layout se adapta a uma largura de viewport de 320 pixels CSS sem exigir rolagem horizontal (rolagem vertical é permitida). Evite **width** fixo em elementos de bloco principais.
40. **1.4.11 Contraste não textual:** Verifique o contraste de cor (≥ 3:1) entre componentes de interface (bordas de input, fundos de botão) e o fundo adjacente, e entre partes de gráficos essenciais para a compreensão.
41. **1.4.12 Espaçamento de texto:** Verifique se o CSS não impede que o usuário substitua estilos de espaçamento (line-height, letter-spacing, word-spacing, paragraph spacing) sem perda de conteúdo. Evite **!important** nesses estilos.
42. **1.4.13 Conteúdo em foco ou ao passar o mouse:** Para tooltips, menus suspensos ou popovers que aparecem em hover/focus, verifique se: podem ser dispensados (Esc), o mouse pode se mover sobre eles sem que sumam, e permanecem visíveis até o usuário os dispensar ou mover o foco/hover.
43. **2.4.5 Múltiplas maneiras:** Em sites com múltiplas páginas, verifique se há mais de uma forma de navegação (menu principal, busca, mapa do site, links no conteúdo). Exceção: páginas em um processo sequencial (checkout).
44. **2.4.6 Títulos e rótulos:** Verifique se os cabeçalhos (**<h1>**-**<h6>**) e rótulos (**<label>**) são claros e descrevem o tópico ou propósito do conteúdo/controle que representam.
45. **2.4.7 Foco Visível:** Verifique se o CSS não remove o indicador de foco padrão do navegador (ex: **outline: none;** em elementos interativos sem fornecer um estilo alternativo para **:focus** ou **:focus-visible**). O indicador de foco deve ser sempre visível.
46. **2.4.11 Foco não obscurecido (mínimo):** Verifique se nenhum conteúdo criado pelo autor (cabeçalhos fixos, banners de cookie, modais não focados) cobre *completamente* um elemento quando ele recebe foco do teclado.
47. **2.5.7 Movimentos de Arrasto:** Se houver funcionalidade de arrastar e soltar (drag and drop), verifique se existe uma alternativa operável com cliques simples (botões "mover para cima/baixo", etc.).
48. **2.5.8 Tamanho do alvo (mínimo):** Verifique se o tamanho de alvos de clique/toque (botões, links, ícones) é de pelo menos 24x24 pixels CSS, ou se há espaçamento suficiente entre alvos menores.
49. **3.1.2 Linguagem das Partes:** Se houver trechos de texto em um idioma diferente do principal da página, verifique se eles estão envolvidos por um elemento com o atributo **lang** apropriado (ex: **<span lang="en">**).
50. **3.2.3 Navegação Consistente:** Em sites com múltiplas páginas, verifique se os blocos de navegação repetidos (menu principal, breadcrumbs) aparecem na mesma ordem relativa em todas as páginas.
51. **3.2.4 Identificação Consistente:** Verifique se componentes com a mesma funcionalidade (ícone de busca, link para "carrinho") usam a mesma identificação (texto, ícone, rótulo acessível) em todo o site.
52. **3.3.3 Sugestão de erro:** Se a validação de formulário (JS) detecta um erro, verifique se, além de indicar o erro, são fornecidas sugestões de como corrigi-lo (quando aplicável).
53. **3.3.4 Prevenção de erros (legais, financeiros, de dados):** Para formulários que submetem dados importantes (compras, exclusão de conta), verifique se há um mecanismo para reverter, corrigir ou confirmar a ação antes da submissão final.
54. **3.3.8 Autenticação Acessível (Mínimo):** Se houver um processo de login, verifique se ele não depende *unicamente* de um teste de função cognitiva (memorizar senha, resolver captcha complexo) sem oferecer uma alternativa (login social, autenticação de dois fatores via código) ou um mecanismo de ajuda (copiar/colar senha).
55. **4.1.3 Mensagens de status:** Procure por mensagens que aparecem dinamicamente para informar o usuário (ex: "Item adicionado ao carrinho", "Formulário enviado com sucesso"). Verifique se essas mensagens estão em um container com ARIA **role="status"** ou **aria-live="polite"** para serem anunciadas por leitores de tela sem roubar o foco.

--- CRITÉRIOS DE NÍVEL AAA ---
- **1.2.6 Língua de Sinais (Pré-gravada):** Interpretação em língua de sinais para todos os vídeos com áudio.
- **1.2.7 Audiodescrição Estendida (Pré-gravada):** Audiodescrição estendida quando as pausas no áudio original são insuficientes.
- **1.2.8 Mídia Alternativa (Pré-gravada):** Uma alternativa de mídia completa (como uma transcrição interativa) para mídias sincronizadas.
- **1.2.9 Apenas Áudio (Ao Vivo):** Uma alternativa para conteúdo de áudio ao vivo (como uma transcrição em tempo real).
- **1.3.6 Identificar a Finalidade:** A finalidade de componentes, ícones e regiões deve ser determinável por software.
- **1.4.6 Contraste (Avançado):** O contraste de texto deve ser de pelo menos 7:1 (ou 4.5:1 para textos grandes).
- **1.4.7 Áudio de Fundo Baixo ou Inexistente:** O áudio de fundo em uma fala deve ser baixo ou poder ser desligado.
- **1.4.8 Apresentação Visual:** O usuário deve poder controlar cores, largura do texto, espaçamento e justificação.
- **1.4.9 Imagens de Texto (Sem Exceção):** Use imagens de texto apenas para decoração ou quando a forma do texto é essencial (ex: logotipos).
- **2.1.3 Teclado (Sem Exceção):** Todas as funcionalidades devem ser operáveis por teclado, sem exceções.
- **2.2.3 Sem Tempo:** O tempo não deve ser um fator essencial para a realização de tarefas.
- **2.2.4 Interrupções:** Interrupções (exceto emergências) devem poder ser adiadas ou suprimidas pelo usuário.
- **2.2.5 Re-autenticação:** Ao expirar uma sessão, o usuário pode se reautenticar e continuar a atividade sem perda de dados.
- **2.2.6 Tempo Limite:** O usuário deve ser avisado sobre a duração da inatividade que causará perda de dados.
- **2.3.2 Três Flashes:** Nenhuma parte do conteúdo pode piscar mais de três vezes por segundo.
- **2.3.3 Animação a partir de Interações:** Animações iniciadas por interação devem poder ser desativadas.
- **2.4.8 Localização:** Informações sobre a localização do usuário dentro de um conjunto de páginas devem estar disponíveis.
- **2.4.9 Finalidade do Link (Apenas Link):** O propósito de cada link deve ser claro apenas pelo texto do próprio link.
- **2.4.10 Títulos de Seção:** O conteúdo deve ser organizado com títulos de seção.
- **2.4.12 Foco Não Obscurecido (Avançado):** Nenhuma parte de um componente em foco deve ser obscurecida por outro conteúdo.
- **2.4.13 Aparência do Foco:** O indicador de foco deve ter contraste e tamanho suficientes.
- **2.5.5 Tamanho do Alvo (Avançado):** O tamanho de alvos de clique deve ser de pelo menos 44x44 pixels CSS.
- **2.5.6 Mecanismos de Entrada Concorrentes:** O conteúdo não deve restringir o uso das modalidades de entrada da plataforma (mouse, toque, teclado, etc.).
- **3.1.3 Palavras Incomuns:** Um mecanismo para explicar jargões, expressões idiomáticas ou palavras incomuns deve estar disponível.
- **3.1.4 Abreviações:** Um mecanismo para explicar o significado de abreviações deve estar disponível.
- **3.1.5 Nível de Leitura:** Para textos que exigem um nível de leitura muito avançado, uma versão mais simples deve ser fornecida.
- **3.1.6 Pronúncia:** Um mecanismo para identificar a pronúncia correta de palavras ambíguas deve estar disponível.
- **3.2.5 Mudança a Pedido:** Mudanças de contexto devem ocorrer apenas a pedido do usuário ou poder ser desativadas.
- **3.3.5 Ajuda:** Ajuda sensível ao contexto deve estar disponível.
- **3.3.6 Prevenção de Erros (Todos):** Para qualquer envio de informação, a ação deve ser reversível, verificada ou confirmada.
- **3.3.9 Autenticação Acessível (Avançada):** Testes de função cognitiva não são necessários para autenticação.

SEJA PRECISO: Base-se nas diretrizes enviadas e forneça análises específicas do código fornecido.

CÓDIGO-FONTE PARA ANÁLISE:

${sourceCode}`
}

// rota de status para verificar se o servidor está funcionando
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    provider: AI_CONFIG.provider,
    hasGoogle: !!AI_CONFIG.google.apiKey,
    timestamp: new Date().toISOString(),
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(` Servidor rodando na porta ${PORT}`)
  console.log(` Acesse: http://localhost:${PORT}`)
  console.log(` Provedor IA: ${AI_CONFIG.provider}`)
  console.log(` Status: http://localhost:${PORT}/api/status`)
})

module.exports = app