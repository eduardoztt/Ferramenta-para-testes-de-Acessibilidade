# 🔍 Ferramenta de Análise de Acessibilidade WCAG

## Protipo de ferramenta para testesde acessibilidade web baseada nas diretrizes WCAG 2.2.


### Passo a Passo para realizar a instalação e rodar a ferramenta:
1 - instalar o node.js: https://nodejs.org/en/download

2 - instalar o github no computador, caso ja não tenha: https://git-scm.com/install/windows

3 - abrir o CMD e clonar o projeto: git clone 

4 - se solicitado para logar com a conta do git, realizar o login para terminar de clonar

5 - ainda no CMD abrir a pasta clonada

6 - dentro da pasta, baixar as depedencias: npm install express cors dotenv node-fetch

7 - criar o arquivo .env na raiz do projeto e adicionar o seguinte codigo com a chave da API, se necessario mandar mensagem no privado para ter acesso a chave

```bash
AI_PROVIDER=google
GOOGLE_AI_API_KEY="adicione aqui a chave da API"

PORT=3001
NODE_ENV=development
```
8 - agora dentro da pasta rodar a ferramenta: npm start

9 - abrir no navegador o caminho: http://localhost:3001/

