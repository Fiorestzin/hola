import { createContext, useState, useContext, useCallback } from 'react';

const SnackbarContext = createContext();

export const useSnackbar = () => useContext(SnackbarContext);

export const SnackbarProvider = ({ children }) => {
    const [snackbar, setSnackbar] = useState(null);

    const showSnackbar = useCallback((message, type = 'info', undoAction = null, duration = 5000) => {
        setSnackbar({ message, type, undoAction, duration, id: Date.now() });
    }, []);

    const hideSnackbar = useCallback(() => {
        setSnackbar(null);
    }, []);

    return (
        <SnackbarContext.Provider value={{ snackbar, showSnackbar, hideSnackbar }}>
            {children}
        </SnackbarContext.Provider>
    );
};
