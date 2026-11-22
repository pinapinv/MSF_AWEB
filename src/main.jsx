import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router'
import Layout from './Layout'
import App from './App'
import Login from './Login'
import Admin from './Admin'
import './index.css'

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><Routes>
  <Route element={<Layout />}>
    <Route index element={<App />} />
    <Route path="login" element={<Login />} />
    <Route path="admin" element={<Admin />} />
    <Route path="admin/inventario" element={<Admin inventario />} />
    <Route path="inventario" element={<Navigate to="/admin/inventario" replace />} />
    <Route path="*" element={<main className="container empty"><h1>Página no encontrada</h1><Link to="/">Volver al catálogo</Link></main>} />
  </Route>
</Routes></BrowserRouter></StrictMode>)
