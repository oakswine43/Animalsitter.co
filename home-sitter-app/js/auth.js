// js/auth.js
// Handles login / signup overlay using PetCareDB (no demo users)

(function () {
  const overlay = document.getElementById('authOverlay');
  const closeBtn = document.getElementById('authCloseBtn');
  const authTabs = Array.from(document.querySelectorAll('.auth-tab'));
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authError = document.getElementById('authError');
  const logoutBtn = document.getElementById('logoutBtn');

  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');

  const signupNameInput = document.getElementById('overlaySignupName');
  const signupEmailInput = document.getElementById('overlaySignupEmail');
  const signupPasswordInput = document.getElementById('overlaySignupPassword');
  const signupRoleInput = document.getElementById('overlaySignupRole');

  const SESSION_KEY = 'petcare_current_user_id';

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || '';
    authError.style.display = msg ? 'block' : 'none';
  }

  function setActiveTab(tabName) {
    authTabs.forEach((btn) => {
      const target = btn.getAttribute('data-auth-tab');
      const active = target === tabName;
      btn.classList.toggle('active', active);
    });

    if (tabName === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
    }
  }

  function updateHeaderUserUI(user) {
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const roleLabel = document.getElementById('currentUserRoleLabel');
    const pill = document.getElementById('userSwitcherToggle');

    if (!user) {
      if (nameEl) nameEl.textContent = 'Guest';
      if (roleEl) roleEl.textContent = 'Guest';
      if (roleLabel) roleLabel.textContent = 'Guest';
      if (pill) pill.textContent = 'Guest ▾';
      // Also clear global state
      if (window.PetCareState && typeof window.PetCareState.setCurrentUser === 'function') {
        window.PetCareState.setCurrentUser(null);
      }
      return;
    }

    const prettyRole = user.role
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
      : 'Guest';

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (roleEl) roleEl.textContent = prettyRole;
    if (roleLabel) roleLabel.textContent = prettyRole;
    if (pill) pill.textContent = `${prettyRole} ▾`;

    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === 'function') {
      window.PetCareState.setCurrentUser(user);
    }
  }

  function setCurrentUserSession(user) {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, user.id);
    }
    updateHeaderUserUI(user || null);
  }

  function findUserById(id) {
    if (!window.PetCareDB) return null;
    return window.PetCareDB.findUserById(id);
  }

  function handleLoginSuccess(user) {
    showError('');
    setCurrentUserSession(user);
    if (overlay) overlay.style.display = 'none';
  }

  // ----- PUBLIC API (for openAuthBtn inline onclick) -----
  const PetCareAuth = {
    show(whichTab) {
      if (!overlay) return;
      overlay.style.display = 'block';
      showError('');
      setActiveTab(whichTab === 'signup' ? 'signup' : 'login');
    },
    hide() {
      if (overlay) overlay.style.display = 'none';
    }
  };
  window.PetCareAuth = PetCareAuth;

  // ----- EVENT HOOKS -----

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      PetCareAuth.hide();
    });
  }

  // Switch tabs
  authTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-auth-tab');
      setActiveTab(tab);
      showError('');
    });
  });

  // Login submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!window.PetCareDB) {
        showError('User database not available.');
        return;
      }

      const email = (loginEmailInput.value || '').trim();
      const password = loginPasswordInput.value || '';

      const user = window.PetCareDB.findUserByEmail(email);

      if (!user || user.password !== password) {
        showError('Invalid email or password.');
        return;
      }

      handleLoginSuccess(user);
    });
  }

  // Signup submit
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!window.PetCareDB) {
        showError('User database not available.');
        return;
      }

      const name = (signupNameInput.value || '').trim();
      const email = (signupEmailInput.value || '').trim();
      const password = signupPasswordInput.value || '';
      const role = signupRoleInput.value || 'client';

      try {
        const user = window.PetCareDB.createUser({ name, email, password, role });
        handleLoginSuccess(user);
      } catch (err) {
        showError(err.message || 'Could not create account.');
      }
    });
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUserSession(null);
    });
  }

  // ----- AUTO-LOAD CURRENT USER ON PAGE LOAD -----
  (function restoreSessionOnLoad() {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        updateHeaderUserUI(null);
        return;
      }
      const user = findUserById(id);
      if (user) {
        updateHeaderUserUI(user);
      } else {
        updateHeaderUserUI(null);
      }
    } catch (err) {
      console.warn('Failed to restore session', err);
      updateHeaderUserUI(null);
    }
  })();
})();
