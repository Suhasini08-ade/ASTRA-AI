import React from 'react';
import { useLocation } from 'react-router-dom';
import AIChat from '../components/AIChat';

export default function AIAssistant() {
  const location = useLocation();
  const initialQuery = location.state?.initialQuery || '';

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <AIChat initialPrompt={initialQuery} />
    </div>
  );
}
