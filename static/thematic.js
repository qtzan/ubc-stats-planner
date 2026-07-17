// ---------------------------------------------------------------------------
// Tab switching between "Choose a Concentration" and "See Saved Paths"
// ---------------------------------------------------------------------------

const tabButtons = {
    choose: document.getElementById('tab-btn-choose'),
    saved: document.getElementById('tab-btn-saved'),
};
const tabPanels = {
    choose: document.getElementById('tab-panel-choose'),
    saved: document.getElementById('tab-panel-saved'),
};

function showTab(name) {
    Object.keys(tabPanels).forEach(key => {
        tabPanels[key].classList.toggle('hidden', key !== name);
        tabButtons[key].classList.toggle('bg-blue-600', key === name);
        tabButtons[key].classList.toggle('text-white', key === name);
        tabButtons[key].classList.toggle('bg-gray-200', key !== name);
        tabButtons[key].classList.toggle('text-gray-900', key !== name);
    });
}

tabButtons.choose?.addEventListener('click', () => showTab('choose'));
tabButtons.saved?.addEventListener('click', () => showTab('saved'));

document.getElementById('saved-paths-login-prompt')?.addEventListener('click', () => {
    openAuthModal('Please log in or sign up to see your saved paths.');
});

// ---------------------------------------------------------------------------
// Remove a saved path
// ---------------------------------------------------------------------------

document.querySelectorAll('.remove-saved-path-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const response = await fetch(`/api/saved-paths/${id}/delete`, { method: 'POST' });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Something went wrong.');
            return;
        }

        document.querySelector(`.saved-path[data-id="${id}"]`)?.remove();
    });
});
