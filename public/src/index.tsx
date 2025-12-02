import React from 'react';
import { createRoot } from 'react-dom/client';
import TILPTimeTracker from './App'; // Import your main component

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <TILPTimeTracker />
  </React.StrictMode>
);
