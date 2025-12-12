// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard'; // your moved code
import ServiceDetail from './pages/ServiceDetail'; // New detail page
import Datasets from './pages/Datasets'; // Ocean Middleware Datasets
import './group-card.css';


import { Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter basename="/monitoring">
      <Routes>
        <Route path="/" element={<Navigate replace to="/home" />} />
        <Route path="/home" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
        <Route path="/datasets" element={<Datasets />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
