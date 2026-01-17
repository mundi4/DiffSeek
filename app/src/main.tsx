import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { createTheme, MantineProvider } from '@mantine/core';

const theme = createTheme({
    /** Put your mantine theme override here */
});

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <MantineProvider >
            <App />
        </MantineProvider>
    </StrictMode>,
)
