import { writable } from 'svelte/store';

export const dialogStore = writable({
    show: false,
    type: 'alert', // alert | confirm
    title: '',
    message: '',
    resolve: null
});

export const showAlert = (message, title = '알림') => {
    return new Promise((resolve) => {
        dialogStore.set({ show: true, type: 'alert', title, message, resolve });
    });
};

export const showConfirm = (message, title = '확인') => {
    return new Promise((resolve) => {
        dialogStore.set({ show: true, type: 'confirm', title, message, resolve });
    });
};

export const handleDialogAction = (result) => {
    dialogStore.update((curr) => {
        if (curr.resolve) curr.resolve(result);
        return { ...curr, show: false, resolve: null };
    });
};
