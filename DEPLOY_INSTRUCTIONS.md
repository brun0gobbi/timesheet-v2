# Como Publicar sua Versão de Demonstração (Netlify Drop)

A maneira mais rápida de colocar seu dashboard online para mostrar para outras pessoas é usando o **Netlify Drop**.

## Passo 1: Gerar a Versão Final (Build)

Eu já executei o comando de build para você. Isso criou uma pasta chamada `dist` dentro do seu projeto. Esta pasta contém todos os arquivos otimizados prontos para o site.

**Caminho da pasta:**
`C:\Users\bruno.gobbi\.gemini\antigravity\scratch\timesheet-v2\dashboard\dist`

## Passo 2: Publicar

1. Acesse o site: [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Se não estiver logado, faça login (pode usar GitHub ou Google).
3. Você verá uma área dizendo **"Drag and drop your site folder here"**.
4. Abra o Explorador de Arquivos do Windows na pasta do projeto e arraste a pasta `dist` inteira para essa área no navegador.
5. Aguarde o upload (é rápido).

## Passo 3: Configuração Final (Opcional)

- O site vai te dar um link aleatório (ex: `exquisite-pudding-123.netlify.app`).
- Você pode clicar em **"Site settings" > "Change site name"** para colocar algo como `poletto-dashboard-demo.netlify.app`.

---
**Nota Importante sobre a IA:**
Como a chave de API é gratuita, se muitas pessoas acessarem ao mesmo tempo, o erro de limite (429) pode ocorrer novamente. Isso é normal para uma versão de demonstração.
