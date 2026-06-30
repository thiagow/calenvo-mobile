'use client'

import * as React from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'

export interface CustomAlertDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmText?: string
    variant?: 'info' | 'success' | 'warning' | 'error'
    onConfirm?: () => void
}

const variantConfig = {
    info: {
        icon: Info,
        className: 'text-blue-500',
    },
    success: {
        icon: CheckCircle2,
        className: 'text-green-500',
    },
    warning: {
        icon: AlertTriangle,
        className: 'text-yellow-500',
    },
    error: {
        icon: AlertCircle,
        className: 'text-red-500',
    },
}

export function CustomAlertDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmText = 'OK',
    variant = 'info',
    onConfirm,
}: CustomAlertDialogProps) {
    const config = variantConfig[variant]
    const Icon = config.icon

    const handleConfirm = () => {
        onConfirm?.()
        onOpenChange(false)
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${config.className}`} />
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleConfirm}>
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
