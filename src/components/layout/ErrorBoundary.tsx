import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportProjectJson } from '@/features/export/pipeline';
import { downloadBlob } from '@/features/projects/session';
import { useProjectStore } from '@/state/projectStore';

/** Falha de interface não pode custar o trabalho: oferece backup antes de recarregar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de interface', error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    const project = useProjectStore.getState().project;
    return (
      <div className="crash" role="alert">
        <h1>Algo deu errado na interface</h1>
        <p>Seu projeto continua salvo neste navegador. Baixe uma cópia por segurança e recarregue a página.</p>
        <pre>{this.state.error.message}</pre>
        <div className="btn-row">
          {project && <button type="button" className="btn" onClick={() => downloadBlob(exportProjectJson(project), `${project.title}-recuperado.json`)}>Baixar cópia do projeto</button>}
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Recarregar</button>
        </div>
      </div>
    );
  }
}
