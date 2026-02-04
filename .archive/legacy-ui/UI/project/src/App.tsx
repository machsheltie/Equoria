import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Stable from './pages/Stable';
import Competitions from './pages/Competitions';
import World from './pages/World';
import Social from './pages/Social';
import Settings from './pages/Settings';
import HorseProfile from './pages/HorseProfile';
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="stable" element={<Stable />} />
        <Route path="stable/:horseId" element={<HorseProfile />} />
        <Route path="competitions" element={<Competitions />} />
        <Route path="world" element={<World />} />
        <Route path="social" element={<Social />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
