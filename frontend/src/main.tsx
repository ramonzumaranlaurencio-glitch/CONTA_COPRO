import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { EnterpriseWorkspace } from '../../src/features/accounting/EnterpriseWorkspace';
import './styles.css';
import '../../src/styles/enterprise-theme.css';
import '../../src/styles/sidebar.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentProvider theme={webLightTheme}>
      <EnterpriseWorkspace />
    </FluentProvider>
  </React.StrictMode>,
);
