import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './hooks/useAuth'
import App from './App'
import './styles/globals.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
