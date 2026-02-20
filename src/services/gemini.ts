export const GEMINI_MODELS = [
    'gemini-2.5-flash',      // Padrão (Melhor qualidade/capacidade) - Se esgotar cota...
    'gemini-2.5-flash-lite', // Fallback 1 (Mais leve, cota separada) - ...usa este.
    'gemini-1.5-flash'       // Fallback 2 (Emergência/Legado)
];

/**
 * Função genérica para chamar a API Gemini com fallback automático de modelos.
 * Tenta cada modelo na lista GEMINI_MODELS até obter sucesso ou esgotar as tentativas.
 */
export async function generateGeminiContent(apiKey: string, prompt: string, temperature: number = 0.7): Promise<string> {
    const cleanKey = apiKey.trim(); // Remove espaços acidentais
    let lastError: any = null;

    for (const model of GEMINI_MODELS) {
        try {
            console.log(`🤖 Tentando modelo IA: ${model}...`);
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: temperature,
                            maxOutputTokens: 8192
                        }
                    })
                }
            );

            if (!response.ok) {
                // Se der erro 429 (Cota) ou 404 (Modelo não encontrado) ou 5xx (Erro servidor),
                // lança erro para cair no catch e tentar o próximo modelo.
                const errorData = await response.json();
                throw new Error(`Erro ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            const parts = result.candidates?.[0]?.content?.parts || [];
            const text = parts.map((p: any) => p.text || '').join('');

            if (!text) {
                throw new Error('Resposta vazia da API');
            }

            console.log(`✅ Sucesso com modelo: ${model}`);
            console.log('📝 Texto Gerado:', text); // Log para debug visual
            return text;

        } catch (error) {
            console.error(`❌ ERRO NO BROWSER com modelo ${model}:`, error); // Log explícito
            lastError = error;
            // Continua para o próximo loop (próximo modelo)
        }
    }

    // Se saiu do loop, todos falharam
    throw lastError || new Error('Todos os modelos de IA falharam.');
}
