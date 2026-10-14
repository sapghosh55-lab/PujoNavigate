import React from 'react';
import { PandalMap } from './components/PandalMap';
import { MOCK_PANDALS } from './data/mockPandals';

export const App: React.FC = () => {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PandalMap pandals={MOCK_PANDALS} />
    </main>
  );
};

export default App;
