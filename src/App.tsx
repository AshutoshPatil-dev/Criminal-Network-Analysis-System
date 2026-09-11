import { AppProvider } from './store';
import Layout from './components/Layout';
import NexusCopilot from './components/NexusCopilot';

export default function App() {
  return (
    <AppProvider>
      <Layout />
      <NexusCopilot />
    </AppProvider>
  );
}