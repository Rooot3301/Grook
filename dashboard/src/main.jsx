import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { applyThemeFromStorage } from './theme.js';
import './styles.css';

// Applique le thème avant le premier render pour éviter le flash de style.
applyThemeFromStorage();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
