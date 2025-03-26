

import './App.scss'

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'



// ____________________ Components ____________________

import FileValidator from './components/FileValidator';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/ogm-validator" element={<FileValidator />} />
        {/* Add more routes here */}
      </Routes>
    </Router>
  );
}
