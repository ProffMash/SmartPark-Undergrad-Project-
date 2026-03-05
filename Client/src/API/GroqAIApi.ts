import { SYSTEM_PROMPT } from './systemPrompt';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

/**
 * Call Groq chat completions API (OpenAI-compatible).
 */
export async function generateTextResponse(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) {
    console.error('VITE_GROQ_API_KEY is not set');
    return 'AI assistant is not configured. Please contact support.';
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Groq ${res.status}:`, err);
      if (res.status === 429) {
        return "I'm getting a lot of requests right now. Please try again in a moment.";
      }
      throw new Error(`Groq API error ${res.status}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || "I'm here to help! What would you like to know about SmartPark?";
  } catch (error: any) {
    console.error('Groq API error:', error);
    throw error;
  }
}
