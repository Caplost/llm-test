'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuestionListProps } from '@/types/chat';

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  setQuestions,
  disabled
}) => {
  const [newQuestion, setNewQuestion] = useState('');

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setQuestions([...questions, newQuestion.trim()]);
      setNewQuestion('');
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Test Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Enter a new test question"
            className="flex-1"
            disabled={disabled}
          />
          <Button 
            onClick={addQuestion}
            disabled={disabled || !newQuestion.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
        <ScrollArea className="h-48 w-full">
          {questions.map((question, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <div className="flex-1 p-2 bg-gray-50 rounded">
                {question}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(index)}
                disabled={disabled}
              >
                <Trash className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </ScrollArea>
        {questions.length === 0 && (
          <Alert>
            <AlertDescription>
              No questions added. Please add some test questions before starting the test.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};