'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square } from 'lucide-react';
import { ChatWindow } from './chat-window';
import { QuestionList } from './question-list';
import { DEFAULT_TEST_MESSAGES } from '@/data/questions';

export const ChatApp: React.FC = () => {
  const [windowCount, setWindowCount] = useState('3');
  const [windows, setWindows] = useState<number[]>([]);
  const [isAutoTesting, setIsAutoTesting] = useState(false);
  const [completedTests, setCompletedTests] = useState(0);
  const [testMessages, setTestMessages] = useState(DEFAULT_TEST_MESSAGES);

  const startTest = () => {
    if (testMessages.length === 0) {
      alert('Please add at least one test question');
      return;
    }
    
    const count = parseInt(windowCount);
    if (count > 0) {
      setWindows(Array.from({ length: count }, (_, i) => i + 1));
      setIsAutoTesting(true);
      setCompletedTests(0);
    }
  };

  const stopTest = () => {
    setIsAutoTesting(false);
    setWindows([]);
    setCompletedTests(0);
  };

  const handleTestComplete = () => {
    setCompletedTests(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Ollama Chat Stress Test</h1>
        <div className="flex items-center space-x-4 mb-4">
          <Input
            type="number"
            value={windowCount}
            onChange={(e) => setWindowCount(e.target.value)}
            className="w-24"
            min="1"
            max="20"
            disabled={isAutoTesting}
          />
          {!isAutoTesting ? (
            <Button onClick={startTest} disabled={testMessages.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Start Test
            </Button>
          ) : (
            <Button onClick={stopTest} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Stop Test
            </Button>
          )}
          <div className="text-sm text-gray-500">
            Tests completed: {completedTests}
          </div>
        </div>
      </div>

      <QuestionList 
        questions={testMessages}
        setQuestions={setTestMessages}
        disabled={isAutoTesting}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {windows.map(id => (
          <ChatWindow 
            key={id} 
            id={id}
            autoTest={isAutoTesting}
            testMessages={testMessages}
            onTestComplete={handleTestComplete}
          />
        ))}
      </div>
    </div>
  );
};