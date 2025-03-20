'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash, MessageSquarePlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuestionListProps } from '@/types/chat';
import { cn } from '@/lib/utils';

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
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          Test Questions
        </CardTitle>
        <CardDescription>
          Add questions that will be sent to all chat windows during testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            addQuestion();
          }}
          className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2"
        >
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Enter a new test question"
            className="min-h-24 sm:min-h-[80px] resize-none flex-1"
            disabled={disabled}
          />
          <Button 
            type="submit"
            disabled={disabled || !newQuestion.trim()}
            className="mt-2 sm:mt-0 sm:self-end"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </form>

        {questions.length === 0 ? (
          <Alert variant="default" className="bg-muted">
            <AlertDescription>
              No questions added. Please add some test questions before starting the test.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-md">
            <ScrollArea className="h-[300px] rounded-md">
              <div className="p-4 space-y-2">
                {questions.map((question, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "group flex items-start space-x-2 rounded-md border p-3 text-sm",
                      disabled && "opacity-70"
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-medium">Question {index + 1}</div>
                      <div className="mt-1 text-muted-foreground">{question}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(index)}
                      disabled={disabled}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};