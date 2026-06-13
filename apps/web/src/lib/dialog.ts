import { create } from 'zustand';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

export interface PromptOptions {
    title?: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    inputType?: 'text' | 'number';
    prefix?: string;
}

interface DialogState {
    open: boolean;
    mode: 'confirm' | 'prompt';
    options: Partial<ConfirmOptions & PromptOptions>;
    resolve?: (value: any) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    prompt: (options: PromptOptions) => Promise<string | null>;
    close: (value: any) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
    open: false,
    mode: 'confirm',
    options: { message: '' },
    confirm: (options) =>
        new Promise<boolean>((resolve) =>
            set({ open: true, mode: 'confirm', options, resolve }),
        ),
    prompt: (options) =>
        new Promise<string | null>((resolve) =>
            set({ open: true, mode: 'prompt', options, resolve }),
        ),
    close: (value) => {
        const r = get().resolve;
        set({ open: false, resolve: undefined });
        r?.(value);
    },
}));

// Imperative helpers usable from any handler without hooks:
//   if (!(await confirmDialog({ message: 'Delete this?' }))) return;
//   const name = await promptDialog({ title: 'Rename', defaultValue: current });
export const confirmDialog = (options: ConfirmOptions) =>
    useDialogStore.getState().confirm(options);

export const promptDialog = (options: PromptOptions) =>
    useDialogStore.getState().prompt(options);
