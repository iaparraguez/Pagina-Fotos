import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Albums from './components/Albums';
import About from './components/About';
import AdminPanel from './components/AdminPanel';
import UploadImage from './components/UploadImage';
import Footer from './components/Footer';

export default function App() {
  return (
    <Router>
      <div className="bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/albums" element={<Albums />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/upload" element={<UploadImage />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
