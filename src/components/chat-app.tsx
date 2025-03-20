'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, Settings } from 'lucide-react';
import { ChatWindow } from './chat-window';
import { QuestionList } from './question-list';
import { DEFAULT_TEST_MESSAGES } from '@/data/questions';
import { ThemeToggle } from './theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from './model-selector';

export const ChatApp: React.FC = () => {
  const [windowCount, setWindowCount] = useState('3');
  const [windows, setWindows] = useState<number[]>([]);
  const [isAutoTesting, setIsAutoTesting] = useState(false);
  const [completedTests, setCompletedTests] = useState(0);
  const [testMessages, setTestMessages] = useState(DEFAULT_TEST_MESSAGES);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedModel, setSelectedModel] = useState('deepseek');

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
      setActiveTab('chat');
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">LLM Response Tester</h1>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Configure your test parameters and questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="window-count" className="text-sm font-medium mb-2 block">
                  Number of Chat Windows
                </label>
                <Input
                  id="window-count"
                  type="number"
                  value={windowCount}
                  onChange={(e) => setWindowCount(e.target.value)}
                  className="w-full"
                  min="1"
                  max="20"
                  disabled={isAutoTesting}
                />
              </div>
              
              <ModelSelector 
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                disabled={isAutoTesting}
              />

              <div className="flex flex-col justify-end">
                <div className="flex items-center justify-between space-x-3">
                  {!isAutoTesting ? (
                    <Button 
                      onClick={startTest} 
                      disabled={testMessages.length === 0}
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Test
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopTest} 
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Test
                    </Button>
                  )}
                </div>
                <div className="text-sm mt-2 text-center">
                  <span className="font-medium">Tests completed:</span> {completedTests} 
                  {completedTests > 0 && ` / ${windows.length * testMessages.length}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">Chat Windows</TabsTrigger>
            <TabsTrigger value="questions">Test Questions</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="mt-6">
            {windows.length > 0 ? (
              <div className="h-[calc(100vh-300px)] w-full">
                <ScrollArea className="h-full w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
                    {windows.map(id => (
                      <ChatWindow 
                        key={id} 
                        id={id}
                        autoTest={isAutoTesting}
                        testMessages={testMessages}
                        onTestComplete={handleTestComplete}
                        model={selectedModel}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Settings className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-1">No active chat windows</h3>
                <p className="text-sm max-w-md text-center">
                  Configure the number of windows and press "Start Test" to begin testing LLM responses
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="questions" className="mt-6">
            <QuestionList 
              questions={testMessages}
              setQuestions={setTestMessages}
              disabled={isAutoTesting}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};