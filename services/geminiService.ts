import { GoogleGenAI } from "@google/genai";
import { NicheConfig } from '../types';

export const generateBlogDraft = async (
  apiKey: string,
  niche: NicheConfig,
  title: string,
  context: string,
  userPrompt: string
): Promise<string> => {
  if (!apiKey) throw new Error("API Key가 없습니다. 설정에서 키를 입력해주세요.");

  const ai = new GoogleGenAI({ apiKey });

  const fullPrompt = `
    역할: 당신은 ${niche.label} 분야의 전문 블로거입니다.
    
    작업: 다음 정보를 바탕으로 블로그 포스팅 초안을 작성하세요.
    
    [제목]
    ${title}
    
    [참고 자료 및 문맥]
    ${context}
    
    [사용자 필수 요구사항]
    ${userPrompt}
    
    [출력 형식]
    - 언어: 한국어 (자연스러운 블로그 말투)
    - 형식: Markdown
    - 제목은 H1 (#)으로 시작하세요.
    - 주요 섹션은 H2 (##), 소제목은 H3 (###)를 사용하세요.
    - 중요한 단어나 문장은 **굵게** 표시하여 가독성을 높이세요.
      (단, Q&A 섹션, 자주묻는질문 섹션, FAQ 섹션에서는 볼드체를 사용하지 마세요)
    - 마크다운 코드 블록(\`\`\`)으로 감싸지 말고 순수 텍스트로 출력하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: niche.systemInstruction,
        temperature: 0.75, // 조금 더 창의적인 표현을 위해 약간 높임
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};