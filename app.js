class WCAGAnalyzer {
  constructor() {
    this.currentResult = null;
    this.isAnalyzing = false;

    this.handleAnalyze = this.handleAnalyze.bind(this)
    this.switchTab = this.switchTab.bind(this)

    this.init()
  }


  init() {
    console.log(" Inicializando WCAG Analyzer...")
    this.setupEventListeners()
    this.createGauges()
    console.log(" WCAG Analyzer inicializado com sucesso!")
  }


  setupEventListeners() {
    const analyzeBtn = document.getElementById("analyzeBtn")
    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", this.handleAnalyze)
    }

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault()
        this.handleAnalyze()
      }
    })
  }


  // faz as validações do resultado da IA
  // chama o back end
  async handleAnalyze() {
    const sourceCode = document.getElementById("sourceCode")?.value?.trim()

    if (!sourceCode) {
      this.showAlert("Por favor, insira o código-fonte para análise.", "error")
      document.getElementById("sourceCode")?.focus()
      return
    }

    this.hideAlert()
    this.clearResults() 
    this.setAnalyzing(true)

    try {
      console.log(" Iniciando análise de acessibilidade...")
      
      const connector = new AIConnector();
      const result = await connector.analyzeAccessibility(sourceCode);

      // valida se é json
      if (result.isValidCode === false) {
        throw new Error(result.message);
      }
      
      this.currentResult = result;
      this.displayResults(result);

      console.log(" Análise concluída com sucesso!")
    } catch (error) {
      console.error(" Erro na análise:", error)
      this.showAlert(error.message, "error")

      this.currentResult = null;
      this.clearResults();

    } finally {
      this.setAnalyzing(false)
    }
  }


  setAnalyzing(analyzing) {
    this.isAnalyzing = analyzing
    const analyzeBtn = document.getElementById("analyzeBtn")

    if (analyzeBtn) {
      analyzeBtn.disabled = analyzing
      analyzeBtn.innerHTML = analyzing
        ? '<div class="spinner" style="width: 16px; height: 16px; margin: 0;"></div> Analisando...'
        : `Analisar Acessibilidade`
    }
    
    if (analyzing) {
        this.toggleElement("placeholderGauges", true);
        this.toggleElement("loadingGauges", false);
    } else {
        this.toggleElement("loadingGauges", true);
    }
  }

  showAlert(message, type = "error") {
    const alert = document.getElementById("errorAlert")
    if (!alert) return

    alert.textContent = message
    alert.className = `alert ${type === "success" ? "success" : ""}`
    alert.classList.remove("hidden")

    if (type === "success") {
      setTimeout(() => this.hideAlert(), 4000)
    }

    alert.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  hideAlert() {
    const alert = document.getElementById("errorAlert")
    if (alert) {
      alert.classList.add("hidden")
    }
  }

  toggleElement(id, shouldBeHidden) {
    const element = document.getElementById(id)
    if (element) {
      element.classList.toggle("hidden", shouldBeHidden)
    }
  }

  //graficos
  createGauges() {
    const container = document.getElementById("gaugesContainer")
    if (!container) return

    const levels = [
      { name: "A", color: "#eab308", total: 31, description: "Básico" },
      { name: "AA", color: "#3b82f6", total: 24, description: "Padrão" },
      { name: "AAA", color: "#10b981", total: 31, description: "Máximo" },
    ]

    container.innerHTML = levels
      .map(
        (level) => `
      <div class="gauge">
        <div style="position: relative; display: inline-block;">
          <svg width="140" height="140" class="gauge-svg">
            <circle cx="70" cy="70" r="58" class="gauge-bg"></circle>
            <circle 
              id="gauge${level.name}" 
              cx="70" 
              cy="70" 
              r="58" 
              class="gauge-progress"
              stroke="${level.color}"
              stroke-dasharray="364.42"
              stroke-dashoffset="364.42"
            ></circle>
          </svg>
          <div class="gauge-text">
            <div class="gauge-value" style="color: ${level.color};" id="value${level.name}">0/${level.total}</div>
            <div class="gauge-percentage" id="percent${level.name}">0%</div>
          </div>
        </div>
        <div class="gauge-label">
          <div class="gauge-level" style="color: ${level.color};">Nível ${level.name}</div>
          <div class="gauge-description">${level.description}</div>
        </div>
      </div>
    `,
      )
      .join("")
  }

  updateGauge(level, passed, total) {
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0
    const circumference = 364.42
    const offset = circumference - (percentage / 100) * circumference

    const gaugeElement = document.getElementById(`gauge${level}`)
    const valueElement = document.getElementById(`value${level}`)
    const percentElement = document.getElementById(`percent${level}`)

    if (gaugeElement) {
      setTimeout(() => {
        gaugeElement.style.strokeDashoffset = offset
      }, 100)
    }

    if (valueElement) valueElement.textContent = `${passed}/${total}`
    if (percentElement) percentElement.textContent = `${percentage}%`
  }

  //função principal da interface
  displayResults(result) {
    if (!result) {
      this.clearResults();
      return;
    }
    console.log(" Exibindo resultados:", result)

    setTimeout(() => this.updateGauge("A", result.levelStats.A.passed, 31), 200)
    setTimeout(() => this.updateGauge("AA", result.levelStats.AA.passed, 24), 400)
    setTimeout(() => this.updateGauge("AAA", result.levelStats.AAA.passed, 31), 600)

    this.toggleElement("gaugesContainer", false)
    this.toggleElement("placeholderGauges", true)

    this.updateSummary(result)
    this.showResultsSection(result)
    this.showSuggestionsSection(result.suggestions)

    setTimeout(() => {
      document.getElementById("resultsSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 1000)
  }

  clearResults() {
    this.toggleElement("gaugesContainer", true);
    this.toggleElement("placeholderGauges", false);
    this.toggleElement("summaryBox", true);
    this.toggleElement("resultsSection", true);
    this.toggleElement("suggestionsSection", true);

    this.updateGauge("A", 0, 31);
    this.updateGauge("AA", 0, 24);
    this.updateGauge("AAA", 0, 31);
  }

  updateSummary(result) {
    const elements = {
      totalPassed: document.getElementById("totalPassed"),
      totalFailed: document.getElementById("totalFailed"),
      totalScore: document.getElementById("totalScore"),
      summaryBox: document.getElementById("summaryBox"),
    }

    if (elements.totalPassed) elements.totalPassed.textContent = result.overallStats.totalPassed
    if (elements.totalFailed) elements.totalFailed.textContent = result.overallStats.totalFailed
    if (elements.totalScore) elements.totalScore.textContent = result.score
    if (elements.summaryBox) elements.summaryBox.classList.remove("hidden")
  }

  //mostra os criteros
  showResultsSection(result) {
    const section = document.getElementById("resultsSection")
    const content = document.getElementById("resultsContent")

    if (!section || !content) return

    content.innerHTML = `
      <div style="text-align: center; background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); padding: 2rem; border-radius: 0.75rem; margin-bottom: 2rem;">
        <div class="conformance-badge badge-${result.conformanceLevel.toLowerCase().replace(" ", "-")}">
          Nível de Conformidade: ${result.conformanceLevel}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 700; color: #059669;">${result.overallStats.totalPassed}</div>
            <div style="font-size: 0.875rem; color: #6b7280; font-weight: 500;">Total Atendidos</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 700; color: #dc2626;">${result.overallStats.totalFailed}</div>
            <div style="font-size: 0.875rem; color: #6b7280; font-weight: 500;">Total Não Atendidos</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 700; color: #2563eb;">${result.score}%</div>
            <div style="font-size: 0.875rem; color: #6b7280; font-weight: 500;">Pontuação Geral</div>
          </div>
        </div>
      </div>
      <div class="tab-list">
        <button class="tab-button active" onclick="analyzer.switchTab('level-a')">
          Nível A (${result.levelStats.A.passed}/${result.levelStats.A.total})
        </button>
        <button class="tab-button" onclick="analyzer.switchTab('level-aa')">
          Nível AA (${result.levelStats.AA.passed}/${result.levelStats.AA.total})
        </button>
        <button class="tab-button" onclick="analyzer.switchTab('level-aaa')">
          Nível AAA (${result.levelStats.AAA.passed}/${result.levelStats.AAA.total})
        </button>
      </div>
      <div id="level-a" class="tab-content active">
        ${this.createLevelContent("A", result.levelA, result.levelStats.A)}
      </div>
      <div id="level-aa" class="tab-content">
        ${this.createLevelContent("AA", result.levelAA, result.levelStats.AA)}
      </div>
      <div id="level-aaa" class="tab-content">
        ${this.createLevelContent("AAA", result.levelAAA, result.levelStats.AAA)}
      </div>
    `
    section.classList.remove("hidden")
  }
  
  //usado para não dar BO e qubrar tudo com os acentos e pontuação do json retornado pela ia
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
         .replace(/`/g, "&#96;");
  }

  createLevelContent(level, data, stats) {
    const total = stats.total;
    const colors = {
      A: { bg: "#fefce8", border: "#eab308", text: "#92400e" },
      AA: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
      AAA: { bg: "#f0fdf4", border: "#10b981", text: "#047857" },
    }
    const color = colors[level]

    return `
      <div style="background: ${color.bg}; padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid ${color.border}; margin-bottom: 1.5rem;">
        <h3 style="font-weight: 600; color: ${color.text}; margin-bottom: 1rem; font-size: 1.25rem;">
          Critérios Nível ${level} (${level === "A" ? "Básico" : level === "AA" ? "Padrão" : "Máximo"}) - ${total} critérios
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.875rem;">
          <div style="color: #059669; font-weight: 500;">
             Atendidos: ${stats.passed}/${total} (${Math.round((stats.passed / total) * 100)}%)
          </div>
          <div style="color: #dc2626; font-weight: 500;">
             Não Atendidos: ${stats.failed}/${total} (${Math.round((stats.failed / total) * 100)}%)
          </div>
        </div>
      </div>
      <div class="criteria-grid">
        <div>
          <h4 style="color: #059669; margin-bottom: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>
            Critérios Atendidos (${stats.passed})
          </h4>
          <div class="criteria-list">
            ${
              data.passed.length > 0
                ? data.passed.map((criterion) => `<div class="criteria-item criteria-passed"><div class="criteria-title">${this.escapeHtml(criterion.title)}</div><div class="criteria-description">${this.escapeHtml(criterion.description)}</div></div>`).join("") 
                : '<p style="color: #6b7280; font-style: italic;">Nenhum critério atendido neste nível.</p>'
            }
          </div>
        </div>
        <div>
          <h4 style="color: #dc2626; margin-bottom: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            Critérios Não Atendidos (${stats.failed})
          </h4>
          <div class="criteria-list">
            ${
              data.failed.length > 0
                ? data.failed.map((criterion) => `
                    <div class="criteria-item criteria-failed">
                        <div class="criteria-title">${this.escapeHtml(criterion.title)}</div>
                        <div class="criteria-description">${this.escapeHtml(criterion.description)}</div>
                        ${criterion.codeSnippet ? `
                        <div class="code-snippet-container">
                            <div class="code-snippet-header">Trecho de Código Relevante</div>
                            <pre class="code-snippet"><code>${this.escapeHtml(criterion.codeSnippet)}</code></pre>
                        </div>
                        ` : ''}
                    </div>`).join("") 
                : '<p style="color: #6b7280; font-style: italic;">Não foi encontrado critérios não atendidos neste nível!</p>'
            }
          </div>
        </div>
      </div>
    `
  }

  //mostra sugestoes
  showSuggestionsSection(suggestions) {
    const section = document.getElementById("suggestionsSection")
    const grid = document.getElementById("suggestionsGrid")

    if (!section || !grid) return

    if (suggestions && suggestions.length > 0) {
      grid.innerHTML = suggestions
        .map(
          (suggestion, index) => `
        <div class="suggestion-card">
          <div style="display: flex; align-items: flex-start; gap: 1rem;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; width: 2.5rem; height: 2.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${index + 1}</div>
            <div style="flex: 1;">
              <h4 style="font-weight: 700; color: #111827; margin-bottom: 0.75rem; font-size: 1.125rem;">${this.escapeHtml(suggestion.title)}</h4>
              <p style="color: #374151; line-height: 1.6; margin-bottom: 1rem;">${this.escapeHtml(suggestion.description)}</p>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${this.getPriorityColor(suggestion.priority).bg}; color: ${this.getPriorityColor(suggestion.priority).text};"
                title="Prioridade: ${suggestion.priority}">🔥 ${suggestion.priority}</span>
                <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${this.getImpactColor(suggestion.impact).bg}; color: ${this.getImpactColor(suggestion.impact).text};"
                title="Impacto: ${suggestion.impact}">📊 ${suggestion.impact}</span>
              </div>
            </div>
          </div>
        </div>
      `, 
        )
        .join("")
    } else {
      grid.innerHTML = `
        <div style="text-align: center; padding: 3rem; grid-column: 1 / -1;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin: 0 auto 1rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Excelente trabalho! 🎉</h3>
          <p style="color: #6b7280;">Não foram identificadas sugestões específicas para este código-fonte. Isso indica que o código já está bem estruturado para acessibilidade!</p>
        </div>
      `
    }

    section.classList.remove("hidden")
  }

  getPriorityColor(priority) {
    const colors = {
      Alta: { bg: "#fef2f2", text: "#991b1b" },
      Média: { bg: "#fef3c7", text: "#92400e" },
      Baixa: { bg: "#f0fdf4", text: "#166534" },
    }
    return colors[priority] || colors["Média"]
  }

  getImpactColor(impact) {
    const colors = {
      Alto: { bg: "#eff6ff", text: "#1e40af" },
      Médio: { bg: "#f3f4f6", text: "#374151" },
      Baixo: { bg: "#f9fafb", text: "#6b7280" },
    }
    return colors[impact] || colors["Médio"]
  }


  switchTab(tabId) {
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.remove("active")
    })

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active")
    })

    const button = document.querySelector(`[onclick="analyzer.switchTab('${tabId}')"]`)
    const tabContent = document.getElementById(tabId)

    if (button) button.classList.add("active")
    if (tabContent) tabContent.classList.add("active")
  }
}

class AIConnector {
  constructor() {
    this.apiEndpoint = "/api/analyze-accessibility"
    this.statusEndpoint = "/api/status"
  }

  //chama o back end
  async analyzeAccessibility(sourceCode) {
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new Error("Código-fonte não pode estar vazio")
    }

    try {
      console.log("🔍 Enviando código para análise no backend...")

      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode: sourceCode.trim() }),
      })

      const result = await response.json()

      if (result.hasOwnProperty('isValidCode') && result.isValidCode === false) {
          console.log("Backend indicou código inválido. Retornando para handleAnalyze.");
          return result; 
      }

      //console.log("OBJETO RECEBIDO NO FRONTEND ANTES DA VALIDAÇÃO:", result);
      console.log("pasouuuuuuuuuuuu aquiiiiiiiii")
      if (!response.ok) {
        throw new Error(result.message || `Erro do servidor (${response.status})`)
      }

      if (!this.validateWCAGResult(result)) {
        throw new Error("Resposta do servidor em formato inválido")
      }

      console.log(" Análise concluída com sucesso!")
      return result
    } catch (error) {
      console.error(" Erro na comunicação com o backend:", error)
      throw error
    }
  }


validateWCAGResult(result) {
    console.log("%c--- INICIANDO VALIDAÇÃO NO FRONTEND ---", "color: blue; font-weight: bold;");
    console.log("Objeto recebido para validação:", result);

    if (!result || typeof result !== 'object') {
        console.error("FALHA NA VALIDAÇÃO: O resultado não é um objeto válido.");
        return false;
    }

    const requiredFields = [
        "conformanceLevel", "score", "overallStats", "levelStats",
        "levelA", "levelAA", "levelAAA", "suggestions",
    ];

    let allFieldsPresent = true;
    console.log("Verificando campos obrigatórios...");
    
    for (const field of requiredFields) {
        if (result.hasOwnProperty(field)) {
            console.log(`- Campo "${field}"... ✅ OK`);
        } else {
            console.error(`!!! CAMPO OBRIGATÓRIO AUSENTE: "${field}" !!!`);
            allFieldsPresent = false;
        }
    }

    if (!allFieldsPresent) {
        console.error("--- VALIDAÇÃO FALHOU: Pelo menos um campo obrigatório está ausente. ---");
        return false;
    }

    console.log("%c--- VALIDAÇÃO BEM-SUCEDIDA: Todos os campos estão presentes. ---", "color: green; font-weight: bold;");
    return true;
  } 
}



let analyzer

document.addEventListener("DOMContentLoaded", () => {
  try {
    analyzer = new WCAGAnalyzer()
    console.log(" WCAG Analyzer carregado e pronto para uso!")
  } catch (error) {
    console.error(" Erro ao inicializar WCAG Analyzer:", error)
  }
})

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && analyzer) {
    console.log(" Página visível - WCAG Analyzer ativo")
  }
})

if (typeof window !== "undefined") {
  window.WCAGAnalyzer = WCAGAnalyzer
}

document.addEventListener("DOMContentLoaded", () => {
    
    const sourceCodeInput = document.getElementById("sourceCode");
    const charCounterElement = document.getElementById("charCounter");

    if (sourceCodeInput && charCounterElement) {
        
        const maxLength = sourceCodeInput.maxLength;

        function updateCounter() {
            const currentLength = sourceCodeInput.value.length;
            charCounterElement.textContent = `${currentLength} / ${maxLength} caracteres`;
        }

        updateCounter();

        sourceCodeInput.addEventListener("input", updateCounter);
    }
});