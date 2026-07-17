// ---------------------------------------------------------------------------
// Auth modal (shared across every page — login/signup/logout, and a
// prompt-to-continue modal used by any login-gated action)
// ---------------------------------------------------------------------------

const authModal = document.getElementById('auth-modal');
const authModalPrompt = document.getElementById('auth-modal-prompt');
const authError = document.getElementById('auth-error');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

function showAuthForm(form) {
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    authError.classList.add('hidden');
    form.classList.remove('hidden');
}

function openAuthModal(promptMessage) {
    if (promptMessage) {
        authModalPrompt.textContent = promptMessage;
        authModalPrompt.classList.remove('hidden');
    } else {
        authModalPrompt.classList.add('hidden');
    }
    showAuthForm(loginForm);
    authModal.classList.remove('hidden');
}

function closeAuthModal() {
    authModal.classList.add('hidden');
}

if (authModal) {
    document.getElementById('show-login-btn')?.addEventListener('click', () => openAuthModal());
    document.getElementById('show-signup-btn')?.addEventListener('click', () => {
        showAuthForm(signupForm);
        authModalPrompt.classList.add('hidden');
        authModal.classList.remove('hidden');
    });
    document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
    document.getElementById('switch-to-signup').addEventListener('click', () => showAuthForm(signupForm));
    document.getElementById('switch-to-login').addEventListener('click', () => showAuthForm(loginForm));
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        fetch('/logout', { method: 'POST' }).then(() => location.reload());
    });

    async function submitAuthForm(form, url) {
        authError.classList.add('hidden');
        const response = await fetch(url, { method: 'POST', body: new FormData(form) });
        const data = await response.json();

        if (!response.ok) {
            authError.textContent = data.error || 'Something went wrong.';
            authError.classList.remove('hidden');
            return;
        }

        location.reload();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitAuthForm(loginForm, '/login');
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitAuthForm(signupForm, '/signup');
    });
}
