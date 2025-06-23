// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard'; // your moved code
import ServiceDetail from './pages/ServiceDetail'; // New detail page


import { Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      {/* <nav>
        <Link to="/">Dashboard</Link> | <Link to="/admin">Admin</Link>
      </nav> */}
      <Routes>
        <Route path="/" element={<Navigate replace to="/monitoring/home" />} />
        <Route path="/monitoring/home" element={<Dashboard />} />
        <Route path="/monitoring/admin" element={<Admin />} />
        <Route path="/monitoring/service/:id" element={<ServiceDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
