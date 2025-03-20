export interface Message {
    role: 'user' | 'assistant';
    content: string;
  }
  
  export interface ChatWindowProps {
    id: number;
    autoTest: boolean;
    testMessages: string[];
    onTestComplete: (id: number) => void;
  }
  
  export interface QuestionListProps {
    questions: string[];
    setQuestions: (questions: string[]) => void;
    disabled: boolean;
  }