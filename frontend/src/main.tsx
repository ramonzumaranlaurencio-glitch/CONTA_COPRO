import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { EnterpriseWorkspace } from '../../src/features/accounting/EnterpriseWorkspace';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import './styles.css';
import '../../src/styles/enterprise-theme.css';
import '../../src/styles/sidebar.css';
import PlanComparisonPage from '../../src/features/billing/PlanComparisonPage';

type AuthUser = { rbacRole: string; displayRole: string; plan: string };

const App = () => {
  const [user, setUser] = useState<AuthUser | null>(null);

  if (!user) {
    return (
      <LoginScreen
        onLogin={(rbacRole, displayRole, plan) =>
          setUser({ rbacRole, displayRole, plan })
        }
      />
    );
  }

  return (
    <FluentProvider theme={webLightTheme}>
      {window.location.pathname === '/planes' ? (
        <PlanComparisonPage />
      ) : (
        <EnterpriseWorkspace userRole={user.rbacRole} userPlan={user.plan} />
      )}
    </FluentProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
