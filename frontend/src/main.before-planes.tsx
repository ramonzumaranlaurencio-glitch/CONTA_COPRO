import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { EnterpriseWorkspace } from '../../src/features/accounting/EnterpriseWorkspace';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import './styles.css';
import '../../src/styles/enterprise-theme.css';
import '../../src/styles/sidebar.css';

const App = () => {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <EnterpriseWorkspace />
    </FluentProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
