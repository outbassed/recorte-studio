import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/app.css';
import { useUI } from './state/uiStore';
import { Editor } from './components/layout/Editor';
import { ProjectsScreen } from './components/layout/ProjectsScreen';
import { FeedbackLayer } from './components/dialogs/OtherDialogs';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { restoreLastProject } from './features/projects/session';

function App() {
  const screen = useUI((s) => s.screen);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Recupera a última edição depois de recarregar a página.
    void restoreLastProject().finally(() => setReady(true));
    // Pede ao navegador para não apagar os projetos sob pressão de espaço.
    void navigator.storage?.persist?.();
  }, []);
  if (!ready) return <div className="boot" role="status">Carregando Recorte Studio…</div>;
  return (
    <ErrorBoundary>
      {screen === 'editor' ? <Editor /> : <ProjectsScreen />}
      <FeedbackLayer />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
