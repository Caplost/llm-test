'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message, ChatWindowProps } from '@/types/chat';
import { LoadingDots } from './loading-dots';

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  id, 
  autoTest, 
  testMessages, 
  onTestComplete,
  model
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testIndex, setTestIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (autoTest && testMessages.length > 0) {
      timeoutRef.current = setTimeout(() => {
        const questionIndex = testIndex % testMessages.length;
        sendMessage(testMessages[questionIndex]);
      }, 1000);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoTest, testIndex, testMessages]);

  // Focus input on first render
  useEffect(() => {
    if (!autoTest && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoTest]);

  const sendMessage = async (text?: string) => {
    const messageToSend = text || input;
    if (!messageToSend.trim()) return;

    const newMessage: Message = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [...messages, newMessage],
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      if (autoTest) {
        setTestIndex(prev => prev + 1);
        onTestComplete(id);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error: Failed to get response' 
      }]);
    }

    setIsLoading(false);
  };

  return (
    <Card className="flex flex-col h-[450px] overflow-hidden shadow-md border-muted group hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base font-medium">Chat Window {id}</CardTitle>
          {autoTest && (
            <Badge variant="secondary" className="font-normal">
              Q{testIndex + 1}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-xs font-normal">
            <Sparkles className="h-3 w-3" />
            {model}
          </Badge>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[calc(450px-112px)] p-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Send a message to start the conversation</p>
              {autoTest && <p className="text-xs mt-2">Automatic testing will begin shortly...</p>}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3 w-full animate-in fade-in-0 slide-in-from-bottom-3 duration-500",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 max-w-[85%] shadow-sm",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 w-full animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-muted shadow-sm">
                    <LoadingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex w-full items-center space-x-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || autoTest}
            className="flex-1"
          />
          <Button 
            type="submit"
            size="icon"
            disabled={isLoading || autoTest || !input.trim()}
            variant="default"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};