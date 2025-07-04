import { createServerFn } from '@tanstack/react-start'
import OpenAI from 'openai'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// CORRECTED: Using the proper Responses API format

export const genAIResponse = createServerFn({ method: 'POST', response: 'raw' })
  .validator(
    (d: {
      messages: Array<Message>
      systemPrompt?: { value: string; enabled: boolean }
    }) => d,
  )
  .handler(async ({ data }) => {
    // Check for API key in environment variables or Amplify secrets
    let apiKey = process.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY

    if (!apiKey) {
      try {
        const { secret } = await import('@aws-amplify/backend')
        const secretKey = await secret('VITE_OPENAI_API_KEY')
        if (secretKey) {
          apiKey = secretKey.toString()
        }
      } catch (err) {
        console.warn('Unable to load AWS Amplify secret:', err)
      }
    }

    if (!apiKey) {
      console.error('No OpenAI API key found')
      throw new Error(
        'Missing API key: Please set OPENAI_API_KEY in your environment variables, VITE_OPENAI_API_KEY in your .env file, or add it as a secret in Amplify.'
      )
    }

    console.log('OpenAI API Key available:', apiKey.substring(0, 10) + '...');

    const openai = new OpenAI({
      apiKey
    })

    // Filter out error messages and empty messages
    const formattedMessages = data.messages
      .filter(
        (msg) =>
          msg.content.trim() !== '' &&
          !msg.content.startsWith('Sorry, I encountered an error'),
      )

    if (formattedMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid messages to send' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = data.systemPrompt?.enabled
      ? data.systemPrompt.value
      : null

    console.log('Request details:', {
      messageCount: formattedMessages.length,
      hasCustomPrompt: !!systemPrompt,
      systemPromptLength: systemPrompt ? systemPrompt.length : 0,
    });

    try {
      console.log('Creating Responses API stream...');
      
      // Create the input in the correct format - simple array with role and content
      const input = [
        ...(systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }]
          : []),
        ...formattedMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content.trim()
        }))
      ];

      console.log('Input format:', JSON.stringify(input.map(msg => ({
        role: msg.role,
        contentLength: msg.content.length,
        contentPreview: msg.content.substring(0, 100) + '...'
      })), null, 2));

      // Use the Responses API with proper configuration
      const stream = await openai.responses.create({
        model: 'gpt-4o-mini',
        input: input,
        stream: true,
      });

      console.log('Responses API stream created successfully');

      const encoder = new TextEncoder()
      
      const readable = new ReadableStream({
        async start(controller) {
          try {
            console.log('Starting to process Responses API stream...');
            let eventCount = 0;
            
            for await (const event of stream) {
              eventCount++;
              console.log(`Event ${eventCount}:`, {
                type: event.type,
                hasData: !!event.delta,
                deltaPreview: event.delta ? event.delta.substring(0, 50) + '...' : 'no delta'
              });
              
              // Handle text delta events
              if (event.type === 'response.output_text.delta') {
                const text = event.delta;
                if (text) {
                  const json = JSON.stringify({
                    type: 'content_block_delta',
                    delta: { text },
                  });
                  controller.enqueue(encoder.encode(json + '\n'));
                }
              }
              // Handle completion
              else if (event.type === 'response.done') {
                console.log('Responses API stream completed');
                break;
              }
              // Handle errors
              else if (event.type === 'error') {
                console.error('Responses API stream error event:', event);
                throw new Error(event.error?.message || 'Unknown Responses API error');
              }
              else {
                console.log('Unhandled event type:', event.type);
              }
            }
            
            console.log(`Responses API stream completed after ${eventCount} events`);
          } catch (streamError) {
            console.error('Responses API streaming error:', streamError);
            const errorJson = JSON.stringify({
              type: 'error',
              error: 'Responses API streaming error: ' + (streamError instanceof Error ? streamError.message : String(streamError))
            });
            controller.enqueue(encoder.encode(errorJson + '\n'));
          } finally {
            controller.close();
          }
        },
        
        cancel() {
          console.log('Responses API stream cancelled by client');
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        },
      })

    } catch (error) {
      console.error('Responses API failed:', error);
      
      // Enhanced error handling without fallback
      let errorMessage = 'Responses API failed'
      let statusCode = 500
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please try again in a moment.'
          statusCode = 429
        } else if (error.message.includes('authentication') || error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please check your OpenAI API key.'
          statusCode = 401
        } else if (error.message.includes('model') || error.message.includes('400')) {
          errorMessage = 'Invalid request. The model or parameters may be incorrect.'
          statusCode = 400
        } else if (error.message.includes('responses') || error.message.includes('not supported')) {
          errorMessage = 'Responses API not available. Your API key may not have access to this feature.'
          statusCode = 403
        } else {
          errorMessage = error.message
        }
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : String(error)
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })