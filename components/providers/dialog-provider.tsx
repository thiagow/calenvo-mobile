'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CustomAlertDialog } from '@/components/ui/custom-alert-dialog'

interface ConfirmOptions {
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'destructive'
}

interface AlertOptions {
    title: string
    description: string
    confirmText?: string
    variant?: 'info' | 'success' | 'warning' | 'error'
}

interface DialogContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>
    alert: (options: AlertOptions) => Promise<void>
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
    const [confirmState, setConfirmState] = useState<{
        open: boolean
        options: ConfirmOptions | null
        resolve: ((value: boolean) => void) | null
    }>({
        open: false,
        options: null,
        resolve: null,
    })

    const [alertState, setAlertState] = useState<{
        open: boolean
        options: AlertOptions | null
        resolve: (() => void) | null
    }>({
        open: false,
        options: null,
        resolve: null,
    })

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({
                open: true,
                options,
                resolve,
            })
        })
    }, [])

    const alert = useCallback((options: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            setAlertState({
                open: true,
                options,
                resolve,
            })
        })
    }, [])

    const handleConfirm = () => {
        confirmState.resolve?.(true)
        setConfirmState({ open: false, options: null, resolve: null })
    }

    const handleCancel = () => {
        confirmState.resolve?.(false)
        setConfirmState({ open: false, options: null, resolve: null })
    }

    const handleAlertConfirm = () => {
        alertState.resolve?.()
        setAlertState({ open: false, options: null, resolve: null })
    }

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}

            {confirmState.options && (
                <ConfirmDialog
                    open={confirmState.open}
                    onOpenChange={(open) => {
                        if (!open) handleCancel()
                    }}
                    title={confirmState.options.title}
                    description={confirmState.options.description}
                    confirmText={confirmState.options.confirmText}
                    cancelText={confirmState.options.cancelText}
                    variant={confirmState.options.variant}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}

            {alertState.options && (
                <CustomAlertDialog
                    open={alertState.open}
                    onOpenChange={(open) => {
                        if (!open) handleAlertConfirm()
                    }}
                    title={alertState.options.title}
                    description={alertState.options.description}
                    confirmText={alertState.options.confirmText}
                    variant={alertState.options.variant}
                    onConfirm={handleAlertConfirm}
                />
            )}
        </DialogContext.Provider>
    )
}

export function useDialog() {
    const context = useContext(DialogContext)
    if (!context) {
        throw new Error('useDialog must be used within DialogProvider')
    }
    return context
}
