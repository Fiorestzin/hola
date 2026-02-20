import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { SnackbarProvider } from './context/SnackbarContext'
import Snackbar from './components/ui/Snackbar'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SnackbarProvider>
            <App />
            <Snackbar />
        </SnackbarProvider>
    </React.StrictMode>,
)
