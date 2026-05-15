import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This finds the <div id="root"> in index.html and puts your game inside it
// NOTE: No StrictMode wrapper — it causes double-rendering which tanks performance
// on a 24,000-line single-component game
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
