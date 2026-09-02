// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { CartProvider } from '@/lib/context/CartContext'
import App from './App'
import './app/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </React.StrictMode>
)
