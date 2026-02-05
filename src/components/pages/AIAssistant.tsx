import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { aiResponses, ChatMessage } from '@/data/mockData';
import { cn } from '@/lib/utils';

const starterPrompts = [
  '查询 Dept_01 关于 LPSC 合成的最新 SOP',
  '对比硫化物与氧化物电解质的成本趋势',
  '生成 2025 Q4 部门预算消耗报表',
];

export function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAIResponse = (userMessage: string): string => {
    if (userMessage.includes('LPSC') || userMessage.includes('SOP') || userMessage.includes('合成')) {
      return aiResponses['LPSC'];
    }
    if (userMessage.includes('成本') || userMessage.includes('对比') || userMessage.includes('趋势')) {
      return aiResponses['成本趋势'];
    }
    if (userMessage.includes('预算') || userMessage.includes('报表') || userMessage.includes('Q4')) {
      return aiResponses['预算'];
    }
    return aiResponses['default'];
  };

  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));

    const aiResponse: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getAIResponse(message),
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, aiResponse]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">AI 助手</h1>
        <p className="text-muted-foreground mt-1 text-sm">智能研发问答与文献分析</p>
      </div>

      {/* Chat Container - Glass Effect */}
      <div className="flex-1 bg-white/60 backdrop-blur-xl rounded-2xl border border-border/30 flex flex-col overflow-hidden shadow-sm">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            // Welcome Screen
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">固态电池研发 AI 助手</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                检索文献、分析专利、生成报告。选择下方快捷提示开始。
              </p>

              {/* Starter Prompts */}
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-3.5 py-2 bg-accent/50 hover:bg-accent text-foreground rounded-full text-sm transition-all duration-200 hover:scale-[1.02] border border-border/30"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 animate-fade-in',
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    message.role === 'user'
                      ? 'bg-foreground'
                      : 'bg-gradient-to-br from-primary to-blue-600'
                  )}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-background" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-foreground text-background rounded-tr-md'
                      : 'bg-accent/50 text-foreground rounded-tl-md border border-border/30'
                  )}>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.role === 'assistant' ? (
                        <div 
                          className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1 prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded prose-table:text-xs"
                          dangerouslySetInnerHTML={{ 
                            __html: message.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/## (.*?)(?=\n|$)/g, '<h3 class="text-base">$1</h3>')
                              .replace(/### (.*?)(?=\n|$)/g, '<h4 class="text-sm">$1</h4>')
                              .replace(/\n/g, '<br/>')
                              .replace(/\| (.*?) \|/g, (match) => `<span class="font-mono bg-accent/50 px-1 rounded text-xs">${match}</span>`)
                          }} 
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                    <p className={cn(
                      'text-xs mt-2 opacity-50',
                      message.role === 'user' ? 'text-right' : 'text-left'
                    )}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-accent/50 rounded-2xl rounded-tl-md px-4 py-3 border border-border/30">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border/30 bg-white/40">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题..."
              className="flex-1 h-11 px-4 rounded-xl border border-border/30 bg-white/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
