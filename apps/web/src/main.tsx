import React from 'react';
import ReactDOM from 'react-dom/client';
import AccessKeyGate from './components/AccessKeyGate';
import Dashboard from './pages/Dashboard';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessKeyGate>
      <Dashboard />
    </AccessKeyGate>
  </React.StrictMode>,
);
