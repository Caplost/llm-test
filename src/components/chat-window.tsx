'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { Message, ChatWindowProps } from '@/types/chat';

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  id, 
  autoTest, 
  testMessages, 
  onTestComplete 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testIndex, setTestIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          model: 'deepseek',
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
    <Card className="w-96 h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <CardTitle className="text-lg">Chat Window {id}</CardTitle>
        <div className="text-sm text-gray-500">
          {autoTest && `Q${testIndex + 1}`}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        <ScrollArea className="flex-1 pr-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 p-3 rounded-lg ${
                msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={isLoading || autoTest}
            className="flex-1"
          />
          <Button 
            onClick={() => sendMessage()}
            disabled={isLoading || autoTest}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};