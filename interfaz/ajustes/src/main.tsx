import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getApi } from './api';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

getApi()
  .then(async api => {
    const config = await api.get_config();
    document.title = `${config.env.assistantName || 'Jarvis'} — Ajustes`;
    root.render(<App api={api} config={config} />);
  })
  .catch(err => {
    root.render(<pre style={{ color: '#FF8A80', padding: 24, font: '12px ui-monospace, monospace' }}>No pude cargar los ajustes: {String(err)}</pre>);
  });
