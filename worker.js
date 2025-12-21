/**
 * LinkedIn AI Commenter - Cloudflare Worker
 * 
 * This worker acts as a secure proxy between your Chrome extension and Google's Gemini AI API.
 * It keeps your API key safe by storing it on Cloudflare's edge network instead of in the extension.
 * 
 * Setup Instructions:
 * 1. Go to https://dash.cloudflare.com
 * 2. Navigate to Workers & Pages > Create Application > Create Worker
 * 3. Replace the default code with this file
 * 4. Add your Gemini API key as an environment variable (see README-CLOUDFLARE-SETUP.md)
 * 5. Deploy and copy your worker URL
 */

// CORS Headers - Allows your Chrome extension to communicate with this worker
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
    async fetch(request, env) {
        // Handle preflight OPTIONS request (CORS)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        // Only allow POST requests
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: 'Method not allowed. Please use POST.'
            }), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        try {
            // 1. Get the API key from environment variables
            const GEMINI_API_KEY = env.GEMINI_API_KEY;

            if (!GEMINI_API_KEY) {
                return new Response(JSON.stringify({
                    error: 'API key not configured. Please add GEMINI_API_KEY to your worker environment variables.'
                }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // 2. Parse the request from the Chrome extension
            const requestData = await request.json();
            const { prompt, contents } = requestData;

            if (!prompt && !contents) {
                return new Response(JSON.stringify({
                    error: 'Missing prompt or contents in request body.'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // 3. Configure Gemini API settings
            const GEMINI_MODEL = 'gemini-1.5-flash'; // Fast and efficient model
            const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

            // 4. Prepare the request body for Gemini
            const geminiRequestBody = {
                contents: contents || [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.9,        // Higher = more creative, Lower = more focused
                    topK: 40,                // Limits vocabulary to top K tokens
                    topP: 0.95,              // Nucleus sampling threshold
                    maxOutputTokens: 1024,   // Maximum length of response
                    stopSequences: []
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            // 5. Call the Gemini API
            const geminiResponse = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(geminiRequestBody)
            });

            // 6. Handle Gemini API errors
            if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error('Gemini API Error:', geminiResponse.status, errorText);

                return new Response(JSON.stringify({
                    error: `Gemini API Error (${geminiResponse.status}): ${errorText}`,
                    details: errorText
                }), {
                    status: geminiResponse.status,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // 7. Parse and return the Gemini response
            const geminiData = await geminiResponse.json();

            // Return the full Gemini response to the extension
            return new Response(JSON.stringify(geminiData), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            // Handle any unexpected errors
            console.error('Worker Error:', error);

            return new Response(JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                stack: error.stack
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};
