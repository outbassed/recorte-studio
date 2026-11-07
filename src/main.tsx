import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/app.css';
import { useUI } from './state/uiStore';
import { Editor } from './components/layout/Editor';
import { ProjectsScreen } from './components/layout/ProjectsScreen';
import { FeedbackLayer } from './components/dialogs/OtherDialogs';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { leaveEditor, openProjectById, restoreProjectFromUrl } from './features/projects/session';
import { getProjectIdFromUrl, updateProjectsUrl } from './features/projects/urls';
import { useProjectStore } from './state/projectStore';
import { toast } from './state/uiStore';

function App() {
  const screen = useUI((s) => s.screen);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Recarregar mantém o projeto indicado no endereço; a raiz abre Meus projetos.
    void restoreProjectFromUrl().finally(() => setReady(true));
    const onHistoryChange = () => {
      const id = getProjectIdFromUrl();
      const openedId = useProjectStore.getState().project?.id;
      if (id === openedId) return;
      if (!id) {
        if (openedId) void leaveEditor('none');
        return;
      }
      void openProjectById(id, 'none').then((found) => {
        if (found) return;
        updateProjectsUrl('replace');
        toast('Este projeto não está salvo neste navegador.', 'error');
        if (useProjectStore.getState().project) void leaveEditor('none');
      }).catch(() => toast('Não foi possível abrir este projeto.', 'error'));
    };
    window.addEventListener('popstate', onHistoryChange);
    // Pede ao navegador para não apagar os projetos sob pressão de espaço.
    void navigator.storage?.persist?.();
    return () => window.removeEventListener('popstate', onHistoryChange);
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
