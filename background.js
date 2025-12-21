chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateComment") {
    generateContent(request.action, { postContent: request.postContent, parentComment: request.parentComment, promptType: request.promptType })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "summarizePost") {
    generateContent(request.action, { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "rewritePost") {
    generateContent(request.action, { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "generateMessageReply") {
    generateContent(request.action, { history: request.history })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function generateContent(action, context) {
  let prompt;

  if (action === "generateComment") {
    if (context.parentComment) {
      // REPLY MODE: Assist Reply
      prompt = `
        Context: I am replying to a comment on a LinkedIn post.
        Original Post: "${context.postContent}"
        Comment I am replying to: "${context.parentComment}"
        
        Task: Write a reply that appreciates the commenter and shares extra knowledge.
        
        Rules:
        1. APPRECIATE: Start by genuinely appreciating the commenter's thought (e.g., "Great point," "I love this perspective").
        2. ADD VALUE: Share a specific, related insight or fact that expands on their comment.
        3. TONE: Professional, collaborative, and human-like. Avoid robotic phrasing.
        4. FORMATTING: Plain text only. No bold/italics.
        5. LENGTH: Keep it under 3 sentences.
        6. ENGAGE: End with a relevant follow-up question to keep the conversation going.
        7. NO HASHTAGS.
      `;
    } else {
      // COMMENT MODE: AI Comment
      prompt = `
        Analyze this LinkedIn post by the author: "${context.postContent}"
        
        Your goal: Write a unique, human-like comment that stands out and doesn't look AI-generated.
        
        Instructions:
        1. **NO GENERIC OPENERS**: Strictly AVOID starting with "Great post", "Thanks for sharing", "Insightful", "I agree", or "This is a great reminder". Jump straight into your thought.
        2. **PICK ONE ANGLE**: Do not summarize the post. Pick ONE specific point, sentence, or concept from the text and add a unique perspective, a counter-point, or a "did you know" fact.
        3. **VARY YOUR STYLE**: Write like a busy professional. Be direct. Sometimes be witty, sometimes serious.
        4. **TONE**: Match the author's vibe (formal vs. casual).
        5. **FORMATTING**: Plain text only. No bold/italics.
        6. **LENGTH**: Keep it concise (1-3 sentences).
        7. **ENGAGE**: End with a relevant, specific question (not "What do you think?").
        8. **NO HASHTAGS**.
      `;
    }
  } else if (action === "summarizePost") {
    prompt = `
      Read this LinkedIn post: "${context.postContent}"
      
      Task: Create a concise summary of what this post is about.
      
      Rules:
      1. FORMAT: Use 3-5 short bullet points (using standard hyphens "-").
      2. CLARITY: Be direct and easy to read.
      3. LENGTH: Maximum 50 words total.
      4. TONE: Informative and neutral.
      5. OUTPUT: Just the summary points, no intro text.
    `;
  } else if (action === "rewritePost") {
    prompt = `
      You are a world-class LinkedIn ghostwriter. Rewrite the following draft to be a high-performing, viral-worthy LinkedIn post.

      Draft: "${context.postContent}"

      Follow these "Perfect Post" rules strictly:
      1. **HOOK**: The first two sentences MUST be compelling to get people to click "See more". They should be punchy and intriguing.
      2. **SIMPLICITY**: Avoid jargon and overly complex language. Keep sentences and paragraphs short to improve readability.
      3. **FORMATTING**: 
         - Use **bold text** for emphasis (Unicode bolding like 𝐇𝐞𝐚𝐝𝐥𝐢𝐧𝐞 is okay if appropriate, but standard markdown **bold** is preferred if the platform supports it, otherwise use Unicode). 
         - Use bullet points (•) to break up walls of text.
         - Use single-sentence paragraphs.
      4. **CTA**: End with a clear Call to Action (e.g., a question or a statement that prompts readers to comment or click a link).
      5. **HASHTAGS**: Add exactly 3-5 relevant hashtags to increase visibility. Mix niche and broad tags.
      6. **GRAMMAR**: Ensure the text is grammar-error-free and flows naturally like a human wrote it.
      
      **CRITICAL OUTPUT RULE**: Return ONLY the rewritten post content. Do NOT include any introductory text like "Here is the rewritten post". Start directly with the Hook.
    `;
  } else if (action === "generateMessageReply") {
    prompt = `
      Context: I am in a private LinkedIn conversation.
      
      Conversation History (Most recent last):
      ${context.history}
      
      Task: Write a natural, professional reply to the last message.
      
      Rules:
      1. **ANALYZE LAST MESSAGE**: Look closely at the very last message in the history. Your reply must directly address it.
      2. **MANDATORY QUESTION**: You MUST end your reply with a specific, relevant question based on the last message to keep the conversation going. This is critical.
      3. **GREETING**: If this is the start of a conversation (or history is < 2 messages), start with "Glad to connect!" or "Thanks for reaching out!" and ask "How is your work going?".
      4. **TONE**: Professional, warm, and human-like.
      5. **LENGTH**: Keep it concise (2-4 sentences).
      6. **FORMATTING**: Plain text only.
    `;
  }

  // 2. Call Cloudflare Worker (Secure Proxy)
  const workerUrl = "https://linkedin-ai-proxy.info-rana012.workers.dev/";

  try {
    console.log("Sending request to worker:", workerUrl);

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Worker Error:", response.status, errText);
      throw new Error(`Server Error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("Worker Response:", result);

    if (result.candidates && result.candidates[0].content) {
      return result.candidates[0].content.parts[0].text.trim();
    } else if (result.text) {
      return result.text.trim();
    } else if (result.reply) {
      return result.reply.trim();
    } else if (typeof result === 'string') {
      return result.trim();
    } else if (result.error) {
      throw new Error(result.error.message || "Unknown API Error");
    } else {
      return JSON.stringify(result);
    }

  } catch (error) {
    console.error("Generation failed:", error);
    throw new Error("Failed to connect to AI. Please check your internet or try again later. Details: " + error.message);
  }
}