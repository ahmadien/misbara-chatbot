import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  ChatMessage,
  LoadingIndicator,
  ChatInput,
  Sidebar,
  WelcomeScreen,
  TopBar

} from '../components'
import { PlusCircle } from 'lucide-react'
import { useConversations, useAppState, actions } from '../store'
import { genAIResponse, type Message, HARMONY_PROMPT_AR, HARMONY_PROMPT_EN, PROMPT1_AR, PROMPT1_EN, translations } from '../utils'

function Home() {
  const {
    conversations,
    currentConversationId,
    currentConversation,
    setCurrentConversationId,
    createNewConversation,
    updateConversationTitle,
    deleteConversation,
    addMessage,
  } = useConversations()
  
  const { isLoading, setLoading, language } = useAppState()

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.body.classList.add('dark')
  }, [])

  // Memoize messages to prevent unnecessary re-renders
  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation]
  )
  const hasMessages = messages.length > 0

  // Local state
  const [input, setInput] = useState('')
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null)
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [inputDisabled, setInputDisabled] = useState(true) // Start disabled by default

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, []);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const createTitleFromInput = useCallback((text: string) => {
    const words = text.trim().split(/\s+/)
    const firstThreeWords = words.slice(0, 3).join(' ')
    return firstThreeWords + (words.length > 3 ? '...' : '')
  }, []);

  // Helper function to process AI response
// Improved processAIResponse function with better error handling and debugging
// Replace this in your src/routes/index.tsx

const processAIResponse = useCallback(async (conversationId: string, userMessage: Message) => {
  try {
    let promptToUse: { value: string; enabled: boolean } | undefined
    if (systemPrompt) {
      promptToUse = {
        value: systemPrompt,
        enabled: true,
      }
    }

    console.log('Making AI request with:', {
      messageCount: [...messages, userMessage].length,
      hasSystemPrompt: !!promptToUse?.enabled,
      conversationId
    });

    // Get AI response
    const response = await genAIResponse({
      data: {
        messages: [...messages, userMessage],
        systemPrompt: promptToUse,
      },
    })

    console.log('Response received:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('API Error:', errorData);
      throw new Error(errorData.error || 'Failed to fetch AI response')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No reader found in response - response.body is null')
    }

    const decoder = new TextDecoder()
    let done = false
    let buffer = ''
    let newMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
    }
    
    let chunkCount = 0;
    
    console.log('Starting to read stream...');
    
    while (!done) {
      try {
        const result = await reader.read()
        done = result.done
        chunkCount++;
        
        if (result.value) {
          const chunk = decoder.decode(result.value, { stream: true })
          buffer += chunk
          
          console.log(`Chunk ${chunkCount}:`, {
            chunkLength: chunk.length,
            bufferLength: buffer.length,
            chunkPreview: chunk.substring(0, 100)
          });
          
          // Process complete lines
          let newlineIndex = buffer.indexOf('\n')
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)
            
            if (line) {
              console.log('Processing line:', line);
              
              try {
                const json = JSON.parse(line)
                console.log('Parsed JSON:', json);
                
                if (json.type === 'content_block_delta' && json.delta?.text) {
                  newMessage = {
                    ...newMessage,
                    content: newMessage.content + json.delta.text,
                  }
                  setPendingMessage(newMessage)
                  console.log('Updated message length:', newMessage.content.length);
                } else if (json.type === 'error') {
                  console.error('Stream error:', json.error);
                  throw new Error(json.error || 'Streaming error occurred')
                } else {
                  console.log('Unhandled event type:', json.type);
                }
              } catch (parseError) {
                console.error('Error parsing streaming response:', {
                  line,
                  error: parseError,
                  parseError
                });
                // Continue processing instead of failing completely
              }
            }
            newlineIndex = buffer.indexOf('\n')
          }
        } else {
          console.log(`Chunk ${chunkCount}: empty value, done=${done}`);
        }
      } catch (readError) {
        console.error('Error reading from stream:', readError);
        done = true; // Exit loop on read error
        break;
      }
    }
    
    console.log('Stream reading completed:', {
      totalChunks: chunkCount,
      finalMessageLength: newMessage.content.length,
      bufferRemaining: buffer.length
    });

    setPendingMessage(null)
    
    if (newMessage.content.trim()) {
      console.log('Adding AI response to conversation:', conversationId)
      await addMessage(conversationId, newMessage)
      
      // Ensure the full response is rendered before showing the subscription link
      await new Promise(resolve => setTimeout(resolve, 500))
      await addMessage(conversationId, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `<a href="https://www.ajnee.com" target="_blank" class="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-red-600 hover:opacity-90">${translations[language].subscribe}</a>`
      })
      setInputDisabled(true)
    } else {
      console.warn('No content received from AI response');
      throw new Error('No content received from AI response')
    }
  } catch (error) {
    console.error('Error in AI response:', error)
    setPendingMessage(null)
    
    // Add an error message to the conversation
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: 'Sorry, I encountered an error generating a response. Please try again.',
    }
    await addMessage(conversationId, errorMessage)
  }
}, [messages, addMessage, systemPrompt, language, setPendingMessage, setInputDisabled])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const currentInput = input
    setInput('') // Clear input early for better UX
    setLoading(true)
    setError(null)
    
    const conversationTitle = createTitleFromInput(currentInput)

    try {
      // Create the user message object
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: currentInput.trim(),
      }
      
      let conversationId = currentConversationId

      // If no current conversation, create one in Convex first
      if (!conversationId) {
        try {
          console.log('Creating new Convex conversation with title:', conversationTitle)
          // Create a new conversation with our title
          const convexId = await createNewConversation(conversationTitle)
          
          if (convexId) {
            console.log('Successfully created Convex conversation with ID:', convexId)
            conversationId = convexId
            
            // Add user message directly to Convex
            console.log('Adding user message to Convex conversation:', userMessage.content)
            await addMessage(conversationId, userMessage)
          } else {
            console.warn('Failed to create Convex conversation, falling back to local')
            // Fallback to local storage if Convex creation failed
            const tempId = Date.now().toString()
            const tempConversation = {
              id: tempId,
              title: conversationTitle,
              messages: [],
            }
            
            actions.addConversation(tempConversation)
            conversationId = tempId
            
            // Add user message to local state
            actions.addMessage(conversationId, userMessage)
          }
        } catch (error) {
          console.error('Error creating conversation:', error)
          throw new Error('Failed to create conversation')
        }
      } else {
        // We already have a conversation ID, add message directly to Convex
        console.log('Adding user message to existing conversation:', conversationId)
        await addMessage(conversationId, userMessage)
      }
      
      // Process with AI after message is stored
      await processAIResponse(conversationId, userMessage)
      
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error processing your request.',
      }
      if (currentConversationId) {
        await addMessage(currentConversationId, errorMessage)
      }
      else {
        if (error instanceof Error) {
          setError(error.message)
        } else {
          setError('An unknown error occurred.')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, createTitleFromInput, currentConversationId, createNewConversation, addMessage, processAIResponse, setLoading]);

  const handleNewChat = useCallback(() => {
    // Reset the current conversation so the welcome screen is shown
    setCurrentConversationId(null)
    setSystemPrompt(null)
    setInputDisabled(true) // Keep disabled for new chats
  }, [setCurrentConversationId])

  const handleDefineProblem = useCallback(async () => {
    const instruction = language === 'ar' ? HARMONY_PROMPT_AR : HARMONY_PROMPT_EN
    const prompt = language === 'ar' ? PROMPT1_AR : PROMPT1_EN
    const id = await createNewConversation('Problem')
    await addMessage(id, {
      id: Date.now().toString(),
      role: 'assistant',
      content: instruction
    })
    setCurrentConversationId(id)
    setSystemPrompt(prompt)
    setInputDisabled(false) // Enable input when problem is defined
    setInput('')
  }, [language, createNewConversation, addMessage, setCurrentConversationId])

  const handleDeleteChat = useCallback(async (id: string) => {
    await deleteConversation(id)
  }, [deleteConversation]);

  const handleUpdateChatTitle = useCallback(async (id: string, title: string) => {
    await updateConversationTitle(id, title)
    setEditingChatId(null)
    setEditingTitle('')
  }, [updateConversationTitle]);

  return (
    <div className="relative flex h-screen bg-black text-white">
      <TopBar />


      {/* Sidebar - Always show on desktop, hidden on mobile */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        handleNewChat={handleNewChat}
        setCurrentConversationId={setCurrentConversationId}
        handleDeleteChat={handleDeleteChat}
        editingChatId={editingChatId}
        setEditingChatId={setEditingChatId}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        handleUpdateChatTitle={handleUpdateChatTitle}
      />

      {/* Floating New Chat Button - Only on mobile */}
      <button
        onClick={handleNewChat}
        className="fixed bottom-32 right-4 z-20 md:hidden bg-red-600 text-white p-4 rounded-full shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-600"
        title="New Chat"
      >
        <PlusCircle className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div className="flex flex-col flex-1">
        {error && (
          <p className="w-full max-w-3xl p-4 mx-auto font-bold text-red-600">{error}</p>
        )}
        {hasMessages ? (
          <>
            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 pb-24 overflow-y-auto"
            >
              <div className="w-full max-w-3xl px-4 mx-auto">
                {[...messages, pendingMessage]
                  .filter((message): message is Message => message !== null)
                  .map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                {isLoading && <LoadingIndicator />}
              </div>
            </div>

            {/* Input */}
            
            <ChatInput
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={inputDisabled}
            />
          </>
        ) : (
          <WelcomeScreen
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={inputDisabled}
            onDefineProblem={handleDefineProblem}
          />
        )}
      </div>

    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})