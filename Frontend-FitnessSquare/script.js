const API_BASE_URL = 'http://localhost:5000';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    // Prepend API_BASE_URL if url is relative (starts with /)
    const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

    try {
        const res = await fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (res.status === 401 || res.status === 403) {
            console.warn("Session expired or unauthorized. Logging out.");
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }

        // Return response object even if status is not 200, so caller can handle errors
        return res;
    } catch (err) {
        console.error("Fetch error:", err);
        return null; // Network error
    }
};

// Expose fetchWithAuth to global scope (redundant if defined globally, but keeps compatibility)
window.fetchWithAuth = fetchWithAuth;

// Utility to disable tracker inputs on past dates
window.restrictTrackerInput = (dateString, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const selectedDate = new Date(dateString);
    selectedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPast = selectedDate < today;

    // Find all input, select, textarea, button elements
    const elements = container.querySelectorAll('input:not([type="date"]), select, textarea, button:not(.close-btn)');

    elements.forEach(el => {
        // Exclude specific elements like modal controls
        if (el.id?.includes('close') || el.dataset.dismiss === 'modal') return;

        el.disabled = isPast;
        if (isPast) {
            el.style.opacity = '0.5';
            el.style.cursor = 'not-allowed';
            el.classList.add('disabled-past-date');
        } else {
            el.style.opacity = '';
            el.style.cursor = '';
            el.classList.remove('disabled-past-date');
        }
    });

    // Handle warning message
    let warningMsg = container.querySelector('.past-date-warning');
    if (isPast) {
        if (!warningMsg) {
            warningMsg = document.createElement('div');
            warningMsg.className = 'past-date-warning';
            warningMsg.style.color = '#f59e0b'; // warning color
            warningMsg.style.padding = '12px';
            warningMsg.style.margin = '10px 0';
            warningMsg.style.textAlign = 'center';
            warningMsg.style.fontWeight = '600';
            warningMsg.style.background = 'rgba(245, 158, 11, 0.1)';
            warningMsg.style.borderRadius = '8px';
            warningMsg.style.border = '1px solid rgba(245, 158, 11, 0.2)';
            warningMsg.innerHTML = '<i class="fas fa-lock" style="margin-right: 5px;"></i> Past dates are read-only.';

            // Try to find a good place to insert (like after header or at top of body)
            const insertPoint = container.querySelector('.checklist-modal-body, .checklist-modal-content, .card-body') || container;
            insertPoint.prepend(warningMsg);
        }
        warningMsg.style.display = 'block';
    } else {
        if (warningMsg) warningMsg.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Check for file:// protocol
    if (window.location.protocol === 'file:') {
        console.error(">>> CRITICAL: Application is running on file:// protocol.");
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:white;text-align:center;padding:10px;z-index:9999;font-weight:bold;';
        warningDiv.innerHTML = '⚠️ ERROR: You opened the HTML file directly. Please visit <a href="http://localhost:5000" style="color:yellow;">http://localhost:5000</a> instead!';
        document.body.prepend(warningDiv);
    }

    const token = localStorage.getItem('token');
    const header = document.getElementById('header');
    let quickChartInstance = null;
    let currentActivityFilter = 'daily';
    let globalPlanDates = null;
    let globalCurrentDateStr = new Date().toISOString().split('T')[0];

    // Sticky Header Logic (Only if header exists on the page)
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- Unified Navbar State Management ---
    function updateNavbarState() {
        const navLinks = document.querySelector('.nav-links');
        const loginLink = document.getElementById('navLogin');
        const actionBtn = document.getElementById('navAction');
        const logoutBtn = document.getElementById('logoutBtn');
        const profileLink = document.querySelector('.profile-link');
        const checklistBtn = document.getElementById('checklistBtn');

        const isLoggedIn = !!localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (loginLink) {
            if (isLoggedIn) {
                loginLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> LOGOUT';
                loginLink.href = '#';
                loginLink.id = 'logoutBtn'; // Change ID for logout handler
                loginLink.addEventListener('click', handleLogout);
            } else {
                loginLink.innerHTML = '<i class="far fa-user"></i> LOGIN';
                loginLink.href = 'login.html';
            }
        }

        if (actionBtn) {
            if (isLoggedIn) {
                actionBtn.innerText = 'Dashboard';
                if (user.role === 'admin') actionBtn.href = 'admin-dashboard.html';
                else if (user.role === 'trainer') actionBtn.href = 'trainer-dashboard.html';
                else actionBtn.href = 'dashboard.html';
            } else {
                actionBtn.innerText = 'Get a Demo';
                actionBtn.href = 'login.html';
            }
        }

        // Handle explicit logout buttons on dashboard pages
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }


        // Add profile link and notifications if logged in and it doesn't exist (and not admin)
        // 1. Add Notification Bell (For Member, Trainer, and Admin)
        if (isLoggedIn && navLinks && !document.getElementById('notificationWrapper') && user.role === 'member') {
            const notificationWrapper = document.createElement('div');
            notificationWrapper.className = 'nav-item notification-wrapper';
            notificationWrapper.id = 'notificationWrapper';
            notificationWrapper.style.marginRight = '15px'; // Spacing
            notificationWrapper.innerHTML = `
                <i class="fas fa-bell" style="color: white; font-size: 1.2rem; cursor: pointer;"></i>
                <span class="badge">0</span>
                <div class="notification-dropdown">
                    <div class="dropdown-header">
                        <span>Notifications</span>
                        <span class="mark-all-read">Mark all read</span>
                    </div>
                    <div class="notification-list">
                        <div class="empty-state">No notifications</div>
                    </div>
                </div>
            `;

            // Insert before profile link if it exists, otherwise append
            const existingProfile = navLinks.querySelector('.profile-link');
            if (existingProfile) {
                navLinks.insertBefore(notificationWrapper, existingProfile);
            } else {
                navLinks.appendChild(notificationWrapper);
            }

            // Event Listeners for Notifications
            const bellIcon = notificationWrapper.querySelector('.fa-bell');
            const dropdown = notificationWrapper.querySelector('.notification-dropdown');
            const markAllReadBtn = notificationWrapper.querySelector('.mark-all-read');

            bellIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other dropdowns if any (like profile)
                document.querySelectorAll('.dropdown-content').forEach(d => d.style.display = 'none');

                // Toggle this one
                dropdown.classList.toggle('active');
                console.log('Notification bell clicked, active:', dropdown.classList.contains('active'));
            });

            document.addEventListener('click', (e) => {
                if (!notificationWrapper.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });

            markAllReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await fetchWithAuth('/api/member/notifications/read-all', { method: 'POST' });
                    fetchNotifications();
                } catch (err) {
                    console.error("Error marking all read:", err);
                }
            });

            // Initial Fetch
            fetchNotifications();
            // Poll every 60s
            setInterval(fetchNotifications, 60000);
        }

        // 2. Add Profile Link (Only for Member and Trainer)
        if (
            isLoggedIn &&
            navLinks &&
            !profileLink &&
            (user.role === 'member' || user.role === 'trainer')
        ) {
            const newProfileLink = document.createElement('a');
            newProfileLink.href =
                user.role === 'trainer' ? 'trainer-profile.html' : 'profile-member.html';
            newProfileLink.className = 'profile-link';
            newProfileLink.innerHTML = '<i class="fas fa-user-circle"></i>';
            navLinks.appendChild(newProfileLink);
        }


        // Add Trainers link for members
        const trainersLink = navLinks ? navLinks.querySelector('a[href="member-trainers.html"]') : null;
        if (isLoggedIn && user.role === 'member' && navLinks && !trainersLink) {
            const newTrainersLink = document.createElement('a');
            newTrainersLink.href = 'member-trainers.html';
            newTrainersLink.innerText = 'Trainers';

            const separator = navLinks.querySelector('.nav-separator');
            if (separator) {
                navLinks.insertBefore(newTrainersLink, separator);
            } else {
                navLinks.appendChild(newTrainersLink);
            }
        }



    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (user.role === 'trainer') {
        document.getElementById('memberStats')?.remove();
        document.getElementById('dailyGoals')?.remove();
        document.getElementById('assignedTrainerSection')?.remove();
    }

    function handleLogout(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }


    async function fetchNotifications() {
        const wrapper = document.getElementById('notificationWrapper');
        if (!wrapper) return;

        try {
            const res = await fetchWithAuth('/api/member/notifications');
            if (res && res.ok) {
                const data = await res.json();
                // Combined lists
                const messages = data.messages || [];
                const systemNotes = data.systemNotifications || [];

                const combined = [
                    ...messages.map(m => ({
                        id: m.id,
                        content: m.content || `Message from ${m.senderId}`,
                        type: 'MESSAGE',
                        date: new Date(m.timestamp),
                        read: true // Messages assumed read on view logic elsewhere for now
                    })),
                    ...systemNotes.map(n => ({
                        id: n.id,
                        content: n.message,
                        type: 'SYSTEM',
                        date: new Date(n.createdAt),
                        read: n.read || false
                    }))
                ].sort((a, b) => b.date - a.date);

                renderNotificationList(combined, wrapper);
            }
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    }

    function renderNotificationList(items, wrapper) {
        const listContainer = wrapper.querySelector('.notification-list');
        const badge = wrapper.querySelector('.badge');

        const unreadCount = items.filter(i => !i.read).length;

        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }

        if (items.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No notifications</div>';
            return;
        }

        listContainer.innerHTML = items.map(item => {
            const icon = item.type === 'MESSAGE'
                ? '<i class="fas fa-envelope"></i>'
                : '<i class="fas fa-info-circle"></i>';

            const timeDiff = Math.floor((new Date() - item.date) / 60000);
            let timeStr = 'Just now';
            if (timeDiff > 0) timeStr = `${timeDiff}m ago`;
            if (timeDiff > 60) timeStr = `${Math.floor(timeDiff / 60)}h ago`;
            if (timeDiff > 1440) timeStr = `${Math.floor(timeDiff / 1440)}d ago`;

            return `
                <div class="notification-item ${!item.read ? 'unread' : ''}" onclick="handleNotificationClick('${item.type}', '${item.id}')">
                    <div class="notification-icon">${icon}</div>
                    <div class="notification-content">
                        <p>${item.content}</p>
                        <div class="notification-time">${timeStr}</div>
                    </div>
                    <div class="notification-actions">
                        <i class="fas fa-trash delete-btn" onclick="deleteNotification(event, '${item.id}', '${item.type}')" title="Delete"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Expose handler
    window.handleNotificationClick = async (type, id) => {
        if (type === 'SYSTEM') {
            try {
                await fetchWithAuth(`/api/member/notifications/${id}/read`, { method: 'POST' });
                // Refresh notifications to update badge/status
                fetchNotifications();
            } catch (e) { console.error(e); }
        }
    };

    window.deleteNotification = async (event, id, type) => {
        event.stopPropagation();
        if (!confirm('Delete this notification?')) return;

        try {
            const endpoint = type === 'MESSAGE' ? `/api/member/messages/${id}` : `/api/member/notifications/${id}`;
            const res = await fetchWithAuth(endpoint, { method: 'DELETE' });
            if (res && res.ok) {
                fetchNotifications();
            }
        } catch (e) { console.error('Error deleting notification:', e); }
    };

    updateNavbarState();

    // --- End Unified Navbar State Management ---

    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinksContainer = document.querySelector('.nav-links');

    if (hamburger && navLinksContainer) {
        hamburger.addEventListener('click', () => {
            navLinksContainer.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close menu when clicking outside or on a link
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinksContainer.contains(e.target)) {
                navLinksContainer.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });

        navLinksContainer.querySelectorAll('.nav-link, .dropdown-item, .login-link, .btn').forEach(link => {
            link.addEventListener('click', () => {
                navLinksContainer.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#' || !href.startsWith('#')) return;

            try {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            } catch (err) {
                // If querySelector fails (e.g. invalid chars in href), just let the default behavior happen
                console.warn('Smooth scroll failed for href:', href, err);
            }
        });
    });

    // Intersection Observer for Reveal Animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Initial state for animation elements
    const animateElements = document.querySelectorAll('.vertical-card, .stat-item');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });

    // Role Selection Logic (Login Page)
    const roleTabs = document.querySelectorAll('.role-tab');
    let selectedRole = 'member';

    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedRole = tab.dataset.role;

            // Visual feedback - change button color or text if needed
            const loginBtn = document.querySelector('#loginForm .btn-primary');
            if (selectedRole === 'trainer') {
                loginBtn.style.backgroundColor = '#111';
                loginBtn.style.color = 'var(--primary)';
                loginBtn.style.border = '2px solid var(--primary)';
                loginBtn.innerText = 'Trainer Sign In';
            } else {
                loginBtn.style.backgroundColor = 'var(--primary)';
                loginBtn.style.color = 'var(--dark)';
                loginBtn.style.border = 'none';
                loginBtn.innerText = 'Sign In';
            }
        });
    });

    // Login Form Submission
    const loginForm = document.getElementById('loginForm');

    // Password Toggle Logic
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function () {
            const targetId = this.dataset.target || 'password';
            const passwordInput = document.getElementById(targetId);

            if (passwordInput) {
                // Toggle type
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);

                // Toggle icon - using Font Awesome 6 classes
                this.classList.toggle('fa-eye');
                this.classList.toggle('fa-eye-slash');
            }
        });
    });

    if (loginForm) {
        initGoogleSignIn();
        const messageDiv = document.getElementById('formMessage');

        // Check for redirect messages
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('registered') === 'true') {
            messageDiv.innerText = 'Registration successful! Please sign in.';
            messageDiv.className = 'form-message success';
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const btn = document.getElementById('signInBtn');
            const originalText = btn.innerText;
            btn.innerText = 'Signing In...';
            btn.disabled = true;
            messageDiv.innerText = '';
            messageDiv.className = 'form-message';

            // Hide verification container if visible
            const verificationContainer = document.getElementById('verificationContainer');
            if (verificationContainer) verificationContainer.style.display = 'none';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role: selectedRole })
                });

                console.log(">>> Frontend: Login response status:", response.status);
                const contentType = response.headers.get("content-type");
                let data;
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    console.error(">>> Frontend: Received non-JSON response:", text);
                    data = { message: `Server error (${response.status}): ${text.substring(0, 100)}` };
                }

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (data.user.role === 'admin') window.location.href = 'admin-dashboard.html';
                    else if (data.user.role === 'trainer') window.location.href = 'trainer-dashboard.html';
                    else window.location.href = 'dashboard.html';
                } else {
                    messageDiv.innerText = data.message || `Login failed (${response.status})`;
                    messageDiv.className = 'form-message error';

                    // Show verification UI if email not verified
                    if (data.message && data.message.toLowerCase().includes('verify')) {
                        if (verificationContainer) {
                            verificationContainer.style.display = 'block';
                            btn.style.display = 'none'; // Hide sign in button to focus on verification
                        }
                    }
                }
            } catch (err) {
                console.error('Login error:', err);
                messageDiv.innerText = 'Connection error. Is the server running?';
                messageDiv.className = 'form-message error';
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });

        // OTP Verification Logic
        const verifyOtpBtn = document.getElementById('verifyOtpBtn');
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', async () => {
                const email = document.getElementById('email').value;
                const otp = document.getElementById('otp').value;
                const messageDiv = document.getElementById('formMessage');

                if (!otp || otp.length < 6) {
                    messageDiv.innerText = 'Please enter a valid 6-digit OTP';
                    messageDiv.className = 'form-message error';
                    return;
                }

                verifyOtpBtn.innerText = 'Verifying...';
                verifyOtpBtn.disabled = true;

                try {
                    const response = await fetch('/api/otp/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, otp })
                    });

                    if (response.ok) {
                        messageDiv.innerText = 'Email verified! You can now Sign In.';
                        messageDiv.className = 'form-message success';
                        document.getElementById('verificationContainer').style.display = 'none';
                        document.getElementById('signInBtn').style.display = 'block';
                    } else {
                        const contentType = response.headers.get("content-type");
                        let errorMsg = 'Verification failed';
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const data = await response.json();
                            errorMsg = data.message || errorMsg;
                        } else {
                            errorMsg = await response.text();
                        }
                        messageDiv.innerText = errorMsg;
                        messageDiv.className = 'form-message error';
                    }
                } catch (err) {
                    console.error('Verification error:', err);
                    messageDiv.innerText = 'Connection error';
                    messageDiv.className = 'form-message error';
                } finally {
                    verifyOtpBtn.innerText = 'Verify & Login';
                    verifyOtpBtn.disabled = false;
                }
            });
        }

        // Resend OTP Logic
        const resendOtpBtn = document.getElementById('resendOtpBtn');
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const messageDiv = document.getElementById('formMessage');

                resendOtpBtn.innerText = 'Sending...';
                resendOtpBtn.style.pointerEvents = 'none';

                try {
                    const response = await fetch('/api/otp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });

                    if (response.ok) {
                        messageDiv.innerText = 'New OTP sent to your email!';
                        messageDiv.className = 'form-message success';
                    } else {
                        messageDiv.innerText = 'Failed to resend OTP';
                        messageDiv.className = 'form-message error';
                    }
                } catch (err) {
                    console.error('Resend error:', err);
                    messageDiv.innerText = 'Connection error';
                    messageDiv.className = 'form-message error';
                } finally {
                    setTimeout(() => {
                        resendOtpBtn.innerText = 'Didn\'t receive code? Resend OTP';
                        resendOtpBtn.style.pointerEvents = 'auto';
                    }, 5000); // Prevent spamming
                }
            });
        }
    }

    // Registration Form Submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        initGoogleSignIn();
        const messageDiv = document.getElementById('formMessage');

        // ✅ REGISTER PAGE ROLE-BASED UI TOGGLE
        const roleSelect = document.getElementById('role');
        const specializationContainer = document.getElementById('specializationContainer');

        if (roleSelect) {
            const toggleRegisterFields = () => {
                const role = roleSelect.value;

                // Hide all first
                if (specializationContainer) specializationContainer.style.display = 'none';

                // Show based on role
                if (role === 'trainer') {
                    specializationContainer.style.display = 'block';
                }
            };

            // Run once on page load
            toggleRegisterFields();

            // Run on role change
            roleSelect.addEventListener('change', toggleRegisterFields);
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullname = document.getElementById('fullname').value;
            const email = document.getElementById('email').value;
            const role = document.getElementById('role').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            const specialization =
                role === 'trainer'
                    ? document.getElementById('specialization')?.value
                    : null;

            if (password !== confirmPassword) {
                messageDiv.innerText = 'Passwords do not match';
                messageDiv.className = 'form-message error';
                return;
            }

            if (role === 'trainer' && !specialization) {
                messageDiv.innerText = 'Please select your specialization';
                messageDiv.className = 'form-message error';
                return;
            }

            const btn = registerForm.querySelector('button[type="submit"]');
            btn.innerText = 'Creating Account...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullname,
                        email,
                        password,
                        role,
                        specialization
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    window.location.href = 'login.html?registered=true';
                } else {
                    messageDiv.innerText = data.message || 'Registration failed';
                    messageDiv.className = 'form-message error';
                }
            } catch (err) {
                messageDiv.innerText = 'Connection error';
                messageDiv.className = 'form-message error';
            } finally {
                btn.innerText = 'Register';
                btn.disabled = false;
            }
        });
    }
    const dashboardPage = document.querySelector('.dashboard-page');

    // ---------- Dashboard Logic ----------
    if (dashboardPage) {
        const token = localStorage.getItem('token');
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        if (!token || !currentUser.role) {
            window.location.href = 'login.html';
            return;
        }


        // Execution moved to bottom of block (see below)
    }

    const renderDashboardData = async (profile, date = null) => {
        try {
            let url = '/api/member/dashboard';
            if (date) url += `?date=${date}`;

            const response = await fetchWithAuth(url);
            if (!response) return;
            const data = await response.json();

            // Update Stats
            console.log('Dashboard Data Today:', data.today);
            const todayCalories = document.getElementById('todayCalories');
            if (todayCalories) {
                // Use combined calories from API
                const totalCal = Math.round(data.today.calories || 0);
                todayCalories.innerText = totalCal;
                console.log(`Setting todayCalories to: ${totalCal} (Workout: ${data.today.workoutCalories}, Meal: ${data.today.mealCalories})`);
            }

            const todayWater = document.getElementById('todayWater');
            if (todayWater) todayWater.innerText = data.today.water.toFixed(1);

            const todaySleep = document.getElementById('todaySleep');
            if (todaySleep) todaySleep.innerText = data.today.sleep.toFixed(1);

            const streakEl = document.getElementById('sidebarStreak');
            if (streakEl) {
                streakEl.innerText = `${data.currentStreak || 0} Days`;
                console.log(`Setting sidebarStreak to: ${data.currentStreak}`);
            }



            // Render Assigned Trainer
            const trainerSection = document.getElementById('assignedTrainerSection');
            if (trainerSection) {
                if (data.assignedTrainer) {
                    // Load Notifications & Upcoming Sessions
                    renderNotifications(data.assignedTrainer);
                } else {
                    // Fetch available trainers
                    try {
                        const trainersRes = await fetchWithAuth('/api/member/trainers');
                        if (trainersRes && trainersRes.ok) {
                            const trainers = await trainersRes.json();

                            if (trainers.length === 0) {
                                trainerSection.innerHTML = `
                        <div class="vertical-card" style="text-align: center; padding: 40px;">
                                            <h3>No Trainers Available</h3>
                                            <p style="margin-bottom: 20px; color: #666;">Check back later for new trainers.</p>
                                        </div>
        `;
                            } else {
                                let trainersHtml = `
        <div class="vertical-card">
                                            <h3>Select Your Personal Trainer</h3>
                                            <p style="margin-bottom: 20px; color: #666;">Choose a trainer to help you achieve your goals.</p>
                                            <div style="display: flex; overflow-x: auto; gap: 20px; padding-bottom: 10px; scrollbar-width: thin;">
                                    `;

                                trainers.forEach(t => {
                                    trainersHtml += `
                                            <div style="min-width: 280px; background: #f8f9fa; padding: 20px; border-radius: 10px; border: 1px solid #eee; display: flex; flex-direction: column; align-items: center; text-align: center;">
                                                <div style="width: 60px; height: 60px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; color: var(--dark); margin-bottom: 15px;">
                                                    ${t.fullname.charAt(0)}
                                                </div>
                                                <h4 style="margin-bottom: 5px;">${t.fullname}</h4>
                                                <p style="color: var(--primary); font-size: 0.9rem; font-weight: 600; margin-bottom: 10px;">${t.specialization || 'Fitness Coach'}</p>
                                                <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${t.bio || 'Experienced fitness trainer ready to help you.'}</p>
                                                <button class="btn btn-outline btn-sm assign-trainer-btn" data-id="${t.id}" style="width: 100%; margin-top: auto;">Select Trainer</button>
                                            </div>
                                        `;
                                });

                                trainersHtml += `</div></div>`;
                                trainerSection.innerHTML = trainersHtml;

                                // Add event listeners to buttons
                                document.querySelectorAll('.assign-trainer-btn').forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        const trainerId = e.target.dataset.id;
                                        const confirmAssign = confirm("Are you sure you want to select this trainer?");
                                        if (!confirmAssign) return;

                                        e.target.innerText = "Assigning...";
                                        e.target.disabled = true;


                                        try {
                                            const assignRes = await fetchWithAuth('/api/member/assign-trainer', {
                                                method: 'POST',
                                                body: JSON.stringify({ trainerId })
                                            });

                                            if (assignRes) {
                                                const data = await assignRes.json();
                                                if (assignRes.ok) {
                                                    if (data.status === 'PENDING') {
                                                        alert("Request Sent! \n\nSince you already have a trainer, your request to change has been sent to the Admin for approval. You will be notified once it is accepted.");
                                                        e.target.innerText = "Request Pending";
                                                    } else {
                                                        alert("Success! \n\n" + (data.message || "Trainer assigned successfully!"));
                                                        // Redirect to dashboard to see changes
                                                        window.location.reload();
                                                    }
                                                } else {
                                                    alert(data.message || "Failed to assign trainer.");
                                                    e.target.innerText = "Select Trainer";
                                                    e.target.disabled = false;
                                                }
                                            } else {
                                                alert("Network error.");
                                                e.target.innerText = "Select Trainer";
                                                e.target.disabled = false;
                                            }
                                        } catch (err) {
                                            console.error("Assignment error:", err);
                                            alert("An error occurred.");
                                            e.target.innerText = "Select Trainer";
                                            e.target.disabled = false;
                                        }

                                    });
                                });
                            }
                        } else {
                            trainerSection.innerHTML = '<p>Failed to load trainers.</p>';
                        }
                    } catch (err) {
                        console.error("Error fetching trainers:", err);
                        trainerSection.innerHTML = '<p>Error loading trainers.</p>';
                    }
                }
            }

            // Render Chart
            const chartCanvas = document.getElementById('mainProgressChart');
            if (chartCanvas && data.weeklyProgress) {
                const ctx = chartCanvas.getContext('2d');
                if (weeklyChartInstance) weeklyChartInstance.destroy();
                weeklyChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.weeklyProgress.map(d => d.day),
                        datasets: [{
                            label: 'Overall Progress (%)',
                            data: data.weeklyProgress.map(d => Number(d.overallPct ?? 0)),
                            borderColor: '#e8ff00',
                            backgroundColor: 'rgba(232, 255, 0, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
                });
            }
        } catch (err) {
            console.error('Error rendering dashboard data:', err);
        }
    };

    // --- Activity Tracker Logic ---
    const initActivityTracker = (profile) => {

        const picker = document.getElementById('activityDatePicker');
        const filterTabs = document.querySelectorAll('.filter-tab');
        const openBtn = document.getElementById('openActivityModalBtn');
        const closeBtn = document.getElementById('closeActivityModal');
        const modal = document.getElementById('activityModal');
        const form = document.getElementById('activityForm');

        if (!picker) return;

        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        picker.value = today;

        picker.addEventListener('change', () => {
            fetchActivityStats();
            renderDashboardData(profile, picker.value);
        });

        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentActivityFilter = tab.dataset.filter;
                updateTrackerUI();
                // renderDashboardData is completely separate and heavy, do NOT call here
            });
        });



        fetchActivityStats();
    };

    const updateTrackerUI = () => {
        const calL = document.getElementById('calLabel');
        const waterL = document.getElementById('waterLabel');
        const sleepL = document.getElementById('sleepLabel');

        if (currentActivityFilter === 'daily') {
            calL.innerText = 'Calories Today';
            waterL.innerText = 'Liters Today';
            sleepL.innerText = 'Hours Today';
        } else {
            const period = currentActivityFilter === 'weekly' ? 'Weekly' : 'Monthly';
            calL.innerText = `Total Calories (${period})`;
            waterL.innerText = `Total Liters (${period})`;
            sleepL.innerText = `Avg Sleep (${period})`;
        }
        fetchActivityStats();
    };

    const fetchActivityStats = async () => {
        const picker = document.getElementById('activityDatePicker');
        if (!picker) return;
        const date = picker.value || new Date().toISOString().split('T')[0];

        // Update Label
        const miniLabel = document.getElementById('miniChartLabel');
        if (miniLabel) miniLabel.innerText = `Loading ${currentActivityFilter} view...`;

        // PHASE 1: Quick Load (Always fetch Daily for the selected date first)
        // This ensures summary cards and the first bar of the mini-chart update instantly
        try {
            const dailyRes = await fetchWithAuth(`/api/activity/stats?date=${date}&filter=daily`);
            if (dailyRes?.ok) {
                const dailyData = await dailyRes.json();
                updateDashboardCards(dailyData);
                // For daily filter, we are done with Phase 1
                if (currentActivityFilter === 'daily') {
                    renderMiniChart([dailyData.data], 'daily', dailyData.dailyTargets);
                    if (miniLabel) miniLabel.innerText = "Daily Progress Overview";
                }
            }
        } catch (err) {
            console.error("Phase 1 Load Error:", err);
        }

        // PHASE 2: Background Load (Fetch aggregated stats if filter is not daily)
        if (currentActivityFilter !== 'daily') {
            try {
                const aggRes = await fetchWithAuth(`/api/activity/stats?date=${date}&filter=${currentActivityFilter}`);
                if (aggRes?.ok) {
                    const aggData = await aggRes.json();

                    // Update Summary Cards with Totals/Averages
                    updateDashboardCards(aggData);

                    // Render full history in Mini-Chart
                    if (aggData.history) {
                        renderMiniChart(aggData.history, currentActivityFilter, aggData.dailyTargets);
                    }

                    // Update Main Chart

                    if (miniLabel) miniLabel.innerText = `${currentActivityFilter.charAt(0).toUpperCase() + currentActivityFilter.slice(1)} Progress Overview`;
                }
            } catch (err) {
                console.error("Phase 2 Load Error:", err);
            }
        }
    };

    const updateMiniRing = (id, current, target) => {
        const ring = document.getElementById(id);
        if (!ring) return;

        const circum = 282.7; // r=45
        const pct = target > 0 ? (current / target) * 100 : 0;
        const val = Math.max(0, Math.min(100, pct));
        const offset = circum - (val / 100) * circum;

        ring.style.strokeDasharray = circum;
        ring.style.strokeDashoffset = offset;
    };

    const updateDashboardCards = (data) => {
        const calE = document.getElementById('todayCalories');
        const waterE = document.getElementById('todayWater');
        const sleepE = document.getElementById('todaySleep');
        const calT = document.getElementById('calTarget');
        const waterT = document.getElementById('waterTarget');
        const sleepT = document.getElementById('sleepTarget');

        const targets = data.dailyTargets;

        if (data.type === 'daily') {
            const act = data.data;
            const calories = Math.round(act?.caloriesBurned || 0);
            const water = act?.waterLiters || 0;
            const sleep = act?.sleepHours || 0;

            calE.innerText = calories;
            waterE.innerText = water.toFixed(1);
            sleepE.innerText = sleep.toFixed(1);

            calT.innerText = `Target: ${Math.round(targets.calories)}`;
            waterT.innerText = `Target: ${targets.water.toFixed(1)}L`;
            sleepT.innerText = `Target: ${targets.sleep.toFixed(1)}h`;

            // Update Rings
            updateMiniRing('calRing', calories, targets.calories);
            updateMiniRing('waterRing', water, targets.water);
            updateMiniRing('sleepRing', sleep, targets.sleep);
        } else {
            const s = data.stats;
            let multiplier = 1;
            if (data.range) {
                const start = new Date(data.range.start);
                const end = new Date(data.range.end);
                multiplier = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }

            const totalCalories = Math.round(s.totalCalories);
            const totalWater = s.totalWater;
            const avgSleep = s.averageSleep;

            calE.innerText = totalCalories;
            waterE.innerText = totalWater.toFixed(1);
            sleepE.innerText = avgSleep.toFixed(1);

            const targetCals = targets.calories * multiplier;
            const targetWater = targets.water * multiplier;
            const targetSleep = targets.sleep;

            calT.innerText = `Total Target: ${Math.round(targetCals)}`;
            waterT.innerText = `Total Target: ${targetWater.toFixed(1)}L`;
            sleepT.innerText = `Avg Target: ${targetSleep.toFixed(1)}h`;

            // Update Rings
            updateMiniRing('calRing', totalCalories, targetCals);
            updateMiniRing('waterRing', totalWater, targetWater);
            updateMiniRing('sleepRing', avgSleep, targetSleep);
        }
    };

    const renderMiniChart = (history, type, targets) => {
        const canvas = document.getElementById('activityQuickChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (quickChartInstance) {
            quickChartInstance.destroy();
        }

        // --- Data Preparation ---
        const labels = history.map(day => {
            const date = new Date(day.date);
            if (type === 'daily') return 'Today';
            if (type === 'weekly') return date.toLocaleDateString('en-US', { weekday: 'short' });
            return date.getDate();
        });

        // Scaling Function: (actual / goal) * 100
        const getPct = (val, goal) => (val / (goal || 1)) * 100;

        // Visual Data (Capped at 100%)
        const calCapped = history.map(day => Math.min(getPct(day.caloriesBurned || 0, targets.calories), 100));
        const waterCapped = history.map(day => Math.min(getPct(day.waterLiters || 0, targets.water), 100));
        const sleepCapped = history.map(day => Math.min(getPct(day.sleepHours || 0, targets.sleep), 100));

        // Theme Colors
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#FFCC00';

        quickChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Calories',
                        data: calCapped,
                        backgroundColor: '#FFCC00', // Yellow
                        borderRadius: 4,
                        barPercentage: type === 'daily' ? 0.7 : 0.9,
                        categoryPercentage: type === 'daily' ? 0.4 : 0.8,
                        maxBarThickness: type === 'daily' ? 60 : 30
                    },
                    {
                        label: 'Water',
                        data: waterCapped,
                        backgroundColor: '#000000', // Black
                        borderRadius: 4,
                        barPercentage: type === 'daily' ? 0.7 : 0.9,
                        categoryPercentage: type === 'daily' ? 0.4 : 0.8,
                        maxBarThickness: type === 'daily' ? 60 : 30
                    },
                    {
                        label: 'Sleep',
                        data: sleepCapped,
                        backgroundColor: '#808080', // Grey
                        borderRadius: 4,
                        barPercentage: type === 'daily' ? 0.7 : 0.9,
                        categoryPercentage: type === 'daily' ? 0.4 : 0.8,
                        maxBarThickness: type === 'daily' ? 60 : 30
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true, // Show legend always
                        position: 'top',
                        labels: {
                            color: '#666',
                            font: { weight: '600', size: 10, family: "'Montserrat', sans-serif" },
                            boxWidth: 8,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const index = context.dataIndex;
                                const dsIndex = context.datasetIndex;
                                const day = history[index];
                                let label = context.dataset.label || '';
                                if (label) label += ': ';

                                // Calculate real percentage for tooltip text
                                if (dsIndex === 0) {
                                    const pct = getPct(day.caloriesBurned || 0, targets.calories).toFixed(1);
                                    label += `${Math.round(day.caloriesBurned || 0)} / ${Math.round(targets.calories)} kcal (${pct}%)`;
                                } else if (dsIndex === 1) {
                                    const pct = getPct(day.waterLiters || 0, targets.water).toFixed(1);
                                    label += `${(day.waterLiters || 0).toFixed(1)} / ${targets.water.toFixed(1)} L (${pct}%)`;
                                } else {
                                    const pct = getPct(day.sleepHours || 0, targets.sleep).toFixed(1);
                                    label += `${(day.sleepHours || 0).toFixed(1)} / ${targets.sleep.toFixed(1)} h (${pct}%)`;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#999',
                            font: { family: "'Montserrat', sans-serif", size: 10 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100, // Visual cap at 100%
                        ticks: {
                            color: '#999',
                            font: { family: "'Montserrat', sans-serif", size: 10 },
                            stepSize: 25,
                            callback: (value) => value + '%'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.03)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    };




    // Workout
    const handleWorkoutSubmit = async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('user'));
        const data = {
            exerciseName: document.getElementById('exerciseName').value,
            exerciseType: document.getElementById('exerciseType').value,
            sets: document.getElementById('sets').value,
            reps: document.getElementById('reps').value,
            weight: document.getElementById('weight').value,
            durationMinutes: document.getElementById('duration').value,
            caloriesBurned: document.getElementById('calories').value,
            workoutDate: document.getElementById('workoutDate').value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/workouts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Workout logged successfully!', 'success');

                if (result.completedGoals && result.completedGoals.length > 0) {
                    result.completedGoals.forEach(goal => {
                        setTimeout(() => {
                            showToast(`Goal Completed: ${goal}`, 'success');
                        }, 500);
                    });
                    initGoalsChecklist(user);
                    initGoalProgressTracking(user);
                }

                closeModal('workoutModal');
                // Refresh data...
            } else {
                showToast('Failed to log workout.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred.', 'error');
        }
    };

    // Meal
    const handleMealSubmit = async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('user'));
        const data = {
            foodName: document.getElementById('foodName').value,
            portion: document.getElementById('portion').value,
            mealType: document.getElementById('mealType').value,
            calories: document.getElementById('calories').value,
            protein: document.getElementById('protein').value,
            carbs: document.getElementById('carbs').value,
            fats: document.getElementById('fats').value,
            mealDate: document.getElementById('mealDate').value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Meal logged successfully!', 'success');

                if (result.completedGoals && result.completedGoals.length > 0) {
                    result.completedGoals.forEach(goal => {
                        setTimeout(() => {
                            showToast(`Goal Completed: ${goal}`, 'success');
                        }, 500);
                    });
                    initGoalsChecklist(user);
                    initGoalProgressTracking(user);
                }

                closeModal('mealModal');
            } else {
                showToast('Failed to log meal.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred.', 'error');
        }
    };

    // Water
    const handleWaterSubmit = async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('user'));
        const data = {
            waterIntake: document.getElementById('waterAmount').value,
            logDate: document.getElementById('waterDate').value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/water', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Water logged successfully!', 'success');

                if (result.completedGoals && result.completedGoals.length > 0) {
                    result.completedGoals.forEach(goal => {
                        setTimeout(() => {
                            showToast(`Goal Completed: ${goal}`, 'success');
                        }, 500);
                    });
                    initGoalsChecklist(user);
                    initGoalProgressTracking(user);
                }

                closeModal('waterModal');
                if (typeof initWaterChart === 'function') initWaterChart(user);
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred.', 'error');
        }
    };

    // Sleep
    const handleSleepSubmit = async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('user'));
        const data = {
            sleepHours: document.getElementById('sleepHours').value,
            sleepDate: document.getElementById('sleepDate').value
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/sleep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Sleep logged successfully!', 'success');

                if (result.completedGoals && result.completedGoals.length > 0) {
                    result.completedGoals.forEach(goal => {
                        setTimeout(() => {
                            showToast(`Goal Completed: ${goal}`, 'success');
                        }, 500);
                    });
                    initGoalsChecklist(user);
                    initGoalProgressTracking(user);
                }

                closeModal('sleepModal');
                if (typeof initSleepChart === 'function') initSleepChart(user);
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred.', 'error');
        }
    };

    // Attach Event Listeners safely
    const workoutForm = document.getElementById('workoutForm');
    if (workoutForm) workoutForm.addEventListener('submit', handleWorkoutSubmit);

    const mealForm = document.getElementById('mealForm');
    if (mealForm) mealForm.addEventListener('submit', handleMealSubmit);

    const waterForm = document.getElementById('waterForm');
    if (waterForm) waterForm.addEventListener('submit', handleWaterSubmit);

    const sleepForm = document.getElementById('sleepForm');
    if (sleepForm) sleepForm.addEventListener('submit', handleSleepSubmit);




    const renderNotifications = async (trainer) => {
        const trainerSection = document.getElementById('assignedTrainerSection');
        const upcomingSection = document.querySelector('.upcoming-classes');

        try {
            const res = await fetchWithAuth('/api/member/notifications');
            if (!res) return;
            const data = await res.json();

            // 1. Update Trainer Card (Exact Match to Reference Image)
            trainerSection.innerHTML = `
                <div class="trainer-card-image-style" style="background: #2a2a2a; border-radius: 12px; padding: 25px; display: flex; align-items: center; justify-content: space-between; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <!-- Avatar Box -->
                        <div style="width: 70px; height: 70px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 900; color: var(--dark); box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            ${trainer.fullname.charAt(0).toUpperCase()}
                        </div>
                        
                        <!-- Trainer Info -->
                        <div>
                            <h3 style="margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: 0.5px; color: white; text-transform: uppercase;">${trainer.fullname.toUpperCase()}</h3>
                            <p style="margin: 2px 0 8px 0; font-size: 0.8rem; color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${trainer.specialization || 'CARDIO TRAINING'}</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: #aaa;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-envelope" style="font-size: 0.75rem;"></i>
                                    <span>${trainer.email}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="color: var(--primary); font-size: 1.2rem; line-height: 1;">•</span>
                                    <span>ISSA Certified</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display: flex; flex-direction: column; gap: 10px; min-width: 140px;">
                        <button id="openUpdatesBtn" class="btn btn-outline btn-sm" style="border-radius: 6px; font-size: 0.75rem; padding: 8px; justify-content: center; display: flex; align-items: center; gap: 8px; width: 100%;">
                            <i class="fas fa-sync"></i> UPDATES
                        </button>
                        <button id="openRatingBtn" class="btn btn-primary btn-sm" style="border-radius: 6px; font-size: 0.75rem; padding: 8px; justify-content: center; display: flex; align-items: center; gap: 8px; width: 100%;">
                            <i class="fas fa-star"></i> RATING
                        </button>
                    </div>
                </div>

            `;

            // Re-inject Logic
            initRatingOverlay(trainer);
            document.getElementById('openUpdatesBtn').onclick = () => renderUpdatesOverlay(trainer, data);

            // 2. Update Upcoming Classes
            if (upcomingSection) {
                const liveSessions = data.sessions || [];
                upcomingSection.innerHTML = `<h2>Upcoming Classes</h2>`;

                if (liveSessions.length === 0) {
                    upcomingSection.innerHTML += `<p class="text-muted" style="padding: 20px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 12px;">No sessions scheduled currently.</p>`;
                } else {
                    liveSessions.forEach(s => {
                        const isOnline = s.type === 'ONLINE';
                        upcomingSection.innerHTML += `
                            <div class="class-card">
                                <div class="class-info">
                                    <h3>${s.notes || (isOnline ? 'Online Session' : 'Gym Session')}</h3>
                                    <p>${new Date(s.startTime).toLocaleDateString()}, ${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with ${trainer.fullname.split(' ')[0]}</p>
                                </div>
                                ${isOnline && s.meetingLink ?
                                `<a href="${s.meetingLink}" target="_blank" class="btn btn-primary btn-sm">Join Now</a>` :
                                `<button class="btn btn-outline btn-sm" disabled>Scheduled</button>`
                            }
                            </div>
                        `;
                    });
                }
            }

            // Mark as read after 3 seconds if there are unread messages
            if (data.messages.some(m => !m.isRead)) {
                setTimeout(() => {
                    fetchWithAuth('/api/member/messages/mark-read', { method: 'PUT' });
                }, 3000);
            }

        } catch (err) {
            console.error('Error loading notifications:', err);
        }
    };

    const initRatingOverlay = (trainer) => {
        const openBtn = document.getElementById('openRatingBtn');
        if (!openBtn) return;

        const oldOverlay = document.getElementById('ratingOverlay');
        if (oldOverlay) oldOverlay.remove();

        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'rating-overlay-premium';
        overlayDiv.id = 'ratingOverlay';
        overlayDiv.innerHTML = `
            <div class="rating-premium-card">
                <button class="close-premium-overlay" id="closeRatingBtn">
                    <i class="fas fa-times"></i>
                </button>
                <div style="margin-bottom: 30px;">
                    <h2 style="margin: 0; font-size: 1.8rem; color: white;">Review Session</h2>
                    <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: rgba(255,255,255,0.5);">Your feedback helps ${trainer.fullname.split(' ')[0]} improve!</p>
                </div>
                <div class="rating-stars-premium" id="premiumStars">
                    <i class="fas fa-star" data-value="5"></i>
                    <i class="fas fa-star" data-value="4"></i>
                    <i class="fas fa-star" data-value="3"></i>
                    <i class="fas fa-star" data-value="2"></i>
                    <i class="fas fa-star" data-value="1"></i>
                </div>
                <textarea id="premiumComment" class="rating-comment-premium" placeholder="Leave a message for your trainer..."></textarea>
                <button id="submitPremiumRating" class="submit-btn-premium">Submit Review</button>
            </div>
        `;
        document.body.appendChild(overlayDiv);

        const overlay = document.getElementById('ratingOverlay');
        const closeBtn = document.getElementById('closeRatingBtn');
        const stars = document.querySelectorAll('#premiumStars i');
        const submitBtn = document.getElementById('submitPremiumRating');
        const commentArea = document.getElementById('premiumComment');
        const mainContent = document.querySelector('.dashboard-container');
        let selectedRating = 0;

        const toggleOverlay = (show) => {
            if (show) {
                overlay.style.display = 'flex';
                setTimeout(() => overlay.classList.add('active'), 10);
                mainContent.classList.add('dashboard-blur-active');
            } else {
                overlay.classList.remove('active');
                mainContent.classList.remove('dashboard-blur-active');
                setTimeout(() => overlay.style.display = 'none', 500);
            }
        };

        openBtn.onclick = () => toggleOverlay(true);
        closeBtn.onclick = () => toggleOverlay(false);

        stars.forEach(star => {
            star.onclick = () => {
                selectedRating = parseInt(star.dataset.value);
                stars.forEach(s => s.classList.remove('selected'));
                star.classList.add('selected');
                submitBtn.classList.add('visible');
            };
        });

        submitBtn.onclick = async () => {
            if (selectedRating === 0) return;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Posting...';

            try {
                const res = await fetchWithAuth('/api/member/trainer-feedback', {
                    method: 'POST',
                    body: JSON.stringify({
                        rating: selectedRating,
                        comment: commentArea.value
                    })
                });

                if (res) {
                    overlay.querySelector('.rating-premium-card').innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="width: 80px; height: 80px; background: rgba(255, 204, 0, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px;">
                                <i class="fas fa-check" style="font-size: 2.5rem; color: var(--primary);"></i>
                            </div>
                            <h2 style="color: white; margin-bottom: 10px;">Review Posted!</h2>
                            <p style="color: rgba(255,255,255,0.5);">Thank you for helping us grow.</p>
                        </div>
                    `;
                    setTimeout(() => {
                        toggleOverlay(false);
                        openBtn.innerHTML = '<i class="fas fa-check" style="margin-right: 8px;"></i> Rated';
                        openBtn.disabled = true;
                    }, 2500);
                }
            } catch (err) {
                console.error('Rating Error:', err);
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Review';
            }
        };
    };

    // --- Step Tracker Logic ---
    async function initStepTracker() {
        if (!document.getElementById('stepProgressRing')) return;

        try {
            const response = await fetchWithAuth('/api/steps/today');
            if (response && response.ok) {
                const data = await response.json();
                const steps = data.steps || 0;
                updateStepUI(steps);
            }
        } catch (e) {
            console.error("Error loading steps:", e);
        }
    }

    function updateStepUI(steps) {
        const display = document.getElementById('stepCountDisplay');
        const input = document.getElementById('stepInput');
        const circle = document.getElementById('stepProgressRing');
        const message = document.getElementById('stepMessage');
        const target = 10000; // Default target

        if (display) display.innerText = steps.toLocaleString();
        if (input) input.value = steps > 0 ? steps : '';

        // Update Ring
        if (circle) {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            const offset = circumference - (Math.min(steps, target) / target) * circumference;
            circle.style.strokeDashoffset = offset;

            // Show success message
            if (steps >= target && message) {
                message.style.display = 'block';
                circle.style.stroke = 'var(--green)';
            } else if (message) {
                message.style.display = 'none';
                circle.style.stroke = 'var(--primary)';
            }
        }
    }

    window.updateSteps = async () => {
        const input = document.getElementById('stepInput');
        const steps = parseInt(input.value);

        if (isNaN(steps) || steps < 0) {
            alert("Please enter a valid step count");
            return;
        }

        try {
            const response = await fetchWithAuth('/api/steps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps })
            });

            if (response && response.ok) {
                const data = await response.json();
                updateStepUI(data.steps);

                // Show completion toast if applicable
                if (data.completedGoals && data.completedGoals.length > 0) {
                    data.completedGoals.forEach(goal => {
                        // Use window.showToast if accessible, otherwise fallback
                        if (typeof showToast === 'function') {
                            showToast(`Great job! You completed: ${goal}`, 'success');
                        } else {
                            alert(`Great job! You completed: ${goal}`);
                        }
                    });
                    // Refresh goals list to show checkmark
                    const user = JSON.parse(localStorage.getItem('user'));
                    if (user) initGoalsChecklist(user.fullname);
                } else {
                    if (typeof showToast === 'function') {
                        showToast("Steps updated successfully!", 'success');
                    }
                }
            }
        } catch (e) {
            console.error("Error updating steps:", e);
            alert("Failed to update steps");
        }
    };
    // --- End Step Tracker Logic ---

    // Health Features (Health Tip & BMI)
    const initHealthFeatures = async (user) => {
        initStepTracker(); // Initialize steps here
        // 1. Fetch Daily Health Tip (Personalized)
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/health-tip', {
                headers: { 'Authorization': `Bearer ${token} ` }
            });
            if (response.ok) {
                const data = await response.json();
                // data: { tip: "...", category: "...", icon: "..." }

                const tipTextEl = document.getElementById('dailyTipText');
                const categoryEl = document.getElementById('dailyTipCategory');

                if (tipTextEl) tipTextEl.innerText = data.tip;
                if (categoryEl) categoryEl.innerText = data.category || 'Daily Insight';
            }
        } catch (err) {
            console.error("Error fetching health tip:", err);
        }

        // 2. Calculate and Display BMI
        if (user.weight && user.height) {
            const heightInMeters = user.height / 100;
            const bmi = (user.weight / (heightInMeters * heightInMeters)).toFixed(1);

            const bmiValueEl = document.getElementById('bmiValue');
            const bmiStatusEl = document.getElementById('bmiStatus');
            const bmiGuideEl = document.getElementById('bmiGuide');

            if (bmiValueEl) bmiValueEl.innerText = bmi;

            let category = "";
            let statusClass = "";
            let guide = "";

            if (bmi < 18.5) {
                category = "Underweight";
                statusClass = "status-underweight";
                guide = "Focus on nutrient-dense foods and strength training to build healthy mass.";
            } else if (bmi >= 18.5 && bmi < 25) {
                category = "Normal";
                statusClass = "status-normal";
                guide = "Great job! Maintain your current balanced lifestyle of exercise and nutrition.";
            } else if (bmi >= 25 && bmi < 30) {
                category = "Overweight";
                statusClass = "status-overweight";
                guide = "Consider a slight calorie deficit and increasing your aerobic activity levels.";
            } else if (bmi >= 30) {
                category = "Obese";
                statusClass = "status-obese";
                guide = "We recommend consulting a professional to create a safe and effective weight loss plan.";
            }

            if (bmiStatusEl) {
                bmiStatusEl.innerText = category;
                bmiStatusEl.className = `status - badge ${statusClass} `;
            }
            if (bmiGuideEl) bmiGuideEl.innerText = guide;
        }
    };

    // --- Toast Notification Logic ---
    const showToast = (message, type = 'info') => {
        // Create toast container if not exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '100000';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.minWidth = '250px';
        toast.style.padding = '15px';
        toast.style.marginBottom = '10px';
        toast.style.borderRadius = '8px';
        toast.style.color = '#fff';
        toast.style.fontSize = '14px';
        toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease-in-out';
        toast.style.backgroundColor = type === 'success' ? 'var(--success)' : 'var(--primary)';

        // Add icon
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        toast.innerHTML = `<i class="fas ${icon}" style="margin-right: 8px;"></i> ${message}`;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Remove after 3s
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };
    // Expose showToast globally for inline scripts (e.g., sleep-tracker.html)
    window.showToast = showToast;



    // --- Dynamic Goals & Checklist Logic (API-Driven) ---

    const initGoalProgressTracking = async (user, planDates, dateStr = null) => {
        if (dateStr) globalCurrentDateStr = dateStr;
        if (planDates) globalPlanDates = planDates;

        const planDatesEl = document.getElementById('planDatesRange');
        if (planDatesEl && globalPlanDates) {
            // Replace incorrectly encoded dash if present from previous state with a standard em-dash or hyphen
            const safeDates = globalPlanDates.replace(/â€”/g, '—');
            planDatesEl.innerText = `Plan Duration: ${safeDates}`;
        }

        try {
            let url = '/api/goals/progress-summary';
            if (globalCurrentDateStr) url += `?date=${globalCurrentDateStr}`;

            const response = await fetchWithAuth(url);
            if (response && response.ok) {
                const data = await response.json();

                // 1. Update SVG Rings & Legend & Status
                updateRingUI(data);

                // 4. Update Day Counter
                await updateTimelineVisualization(globalCurrentDateStr);
            }
        } catch (err) {
            console.error("Error in initGoalProgressTracking:", err);
        }
    };


    // Refactored: Reusable Ring UI Updater
    const updateRingUI = (data) => {
        // Circumferences: Outer (r=45): 282.7, Middle (r=35): 219.9, Inner (r=25): 157.1
        updateRing('ringOuter', data.weightProgress, 282.7);
        updateRing('ringMiddle', data.exerciseAdherence, 219.9);
        updateRing('ringInner', data.habitScore, 157.1);

        // Update Legend Pct
        const outerText = document.getElementById('outerPctText');
        const middleText = document.getElementById('middlePctText');
        const innerText = document.getElementById('innerPctText');
        if (outerText) outerText.innerText = `${Math.round(data.weightProgress)}%`;
        if (middleText) middleText.innerText = `${Math.round(data.exerciseAdherence)}%`;
        if (innerText) innerText.innerText = `${Math.round(data.habitScore)}%`;

        // Smart Status & Overall %
        const overall = Math.round((data.weightProgress + data.exerciseAdherence + data.habitScore) / 3);
        const mainLabel = document.getElementById('mainProgressLabel');
        if (mainLabel) mainLabel.innerText = `${overall}%`;

        const smartStatus = document.getElementById('smartStatusLabel');
        if (smartStatus) {
            const status = getSmartStatus(overall);
            smartStatus.innerText = status.text;
            smartStatus.style.borderColor = status.color;
            smartStatus.style.color = '#fff';
            smartStatus.style.boxShadow = `0 0 15px ${status.color}33`; // 20% alpha
        }
    };


    const updateRing = (id, pct, circum) => {
        const el = document.getElementById(id);
        if (el) {
            const val = Math.max(0, Math.min(100, pct || 0));
            const offset = circum - (val / 100) * circum;
            el.style.strokeDasharray = circum;
            el.style.strokeDashoffset = offset;
        }
    };

    const getSmartStatus = (pct) => {
        if (pct >= 90) return { text: "🏆 Elite Performance", color: "var(--success)" };
        if (pct >= 70) return { text: "🔥 On Track", color: "#00d2ff" };
        if (pct >= 50) return { text: "⚠️ Improving", color: "#ffcc00" };
        return { text: "📉 Needs Focus", color: "#ff5555" };
    };

    // Expose helpers globally for Trainer Dashboard
    window.updateRingUI = updateRingUI;
    window.getSmartStatus = getSmartStatus;

    const updateTimelineVisualization = async (targetDateStr) => {
        const timelineEl = document.getElementById('planTimeline');
        const counterEl = document.getElementById('dayCounterLabel');
        if (!timelineEl) return;

        try {
            const res = await fetchWithAuth('/api/member/goal-completion-calendar');
            if (res && res.ok) {
                const data = await res.json();
                if (!data.hasActivePlan) return;

                const startDate = new Date(data.startDate);
                const endDate = new Date(data.endDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const targetDate = targetDateStr ? new Date(targetDateStr) : today;
                targetDate.setHours(0, 0, 0, 0);

                const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                const currentDay = Math.round((targetDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                if (counterEl) {
                    counterEl.innerText = `Day ${Math.max(1, currentDay)} of ${totalDays}`;
                }

                // Render Dots
                let dotsHtml = '';
                for (let i = 0; i < totalDays; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const isCompleted = data.completions[dateStr] || false;
                    const isToday = date.getTime() === targetDate.getTime();
                    const isPast = date < targetDate;

                    let classes = 'timeline-dot';
                    if (isToday) classes += ' today';
                    else if (isCompleted) classes += ' completed';
                    else if (isPast) classes += ' missed';

                    dotsHtml += `<div class="${classes}" title="${dateStr}"></div>`;
                }
                timelineEl.innerHTML = dotsHtml;

                // Scroll to today center
                setTimeout(() => {
                    const todayDot = timelineEl.querySelector('.today');
                    if (todayDot) {
                        todayDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }, 500);
            }
        } catch (err) {
            console.error("Timeline error:", err);
        }
    };

    const initGoalsChecklist = async (username) => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const todayStr = new Date().toISOString().split('T')[0];

        try {
            // Fetch goals from API
            const goalsResponse = await fetchWithAuth('/api/member/goals');
            if (!goalsResponse || !goalsResponse.ok) {
                console.error('Failed to fetch goals');
                return;
            }

            const goalsByCategory = await goalsResponse.json();
            console.log('Fetched Goals:', goalsByCategory); // DEBUG LOG

            // --- Fetch Completed Goals for Today ---
            let completedGoalIds = [];
            try {
                const progressRes = await fetchWithAuth(`/api/member/goals/progress?date=${todayStr}`);
                if (progressRes && progressRes.ok) {
                    const progressData = await progressRes.json();
                    completedGoalIds = progressData.completedGoalIds || [];
                }
            } catch (pErr) {
                console.error("Error fetching completed goals:", pErr);
            }

            // Debug: Check if container exists
            const goalsContainer = document.getElementById('dailyGoalsGrid');
            console.log('Goals Container:', goalsContainer);


            // --- Capture Active Plan Date Range ---
            let planDates = null;
            for (const cat in goalsByCategory) {
                if (goalsByCategory[cat].length > 0) {
                    const firstGoal = goalsByCategory[cat][0];
                    if (firstGoal.startDate && firstGoal.endDate) {
                        const start = new Date(firstGoal.startDate);
                        const end = new Date(firstGoal.endDate);
                        planDates = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                        globalPlanDates = planDates;
                        break;
                    }
                }
            }

            // Check if there are any goals at all
            const hasGoals = Object.values(goalsByCategory).some(goals => goals.length > 0);
            const gridEl = document.getElementById('dailyGoalsGrid');
            const emptyEl = document.getElementById('emptyGoalsState');

            if (!hasGoals) {
                if (gridEl) gridEl.style.display = 'none';
                if (emptyEl) emptyEl.style.display = 'block';
            } else {
                if (gridEl) gridEl.style.display = 'grid';
                if (emptyEl) emptyEl.style.display = 'none';
            }


            const trackerHeader = document.querySelector('.goals-tracker .dashboard-header p');
            if (trackerHeader) {
                if (planDates) {
                    trackerHeader.innerHTML = `Track your daily progress. <span style="display:inline-block; background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:10px;"><i class="fas fa-calendar-alt"></i> ${planDates}</span>`;
                }
            }

            // Render goals in Dashboard Grid
            const goalsGrid = document.getElementById('dailyGoalsGrid');
            if (goalsGrid && Object.keys(goalsByCategory).length > 0) {
                // Clear existing content
                goalsGrid.innerHTML = '';

                // Define icons for categories
                const boxIcons = {
                    'Workout': 'fa-running',
                    'Meal': 'fa-apple-alt',
                    'Nutrition': 'fa-leaf',
                    'Hydration': 'fa-tint',
                    'Sleep': 'fa-bed',
                    'Habit': 'fa-heart'
                };

                const todayStrDate = new Date().toISOString().split('T')[0];
                const isToday = !globalCurrentDateStr || globalCurrentDateStr === todayStrDate;

                let goalsHtml = '';
                for (const [category, goals] of Object.entries(goalsByCategory)) {
                    goalsHtml += goals.map(goal => `
                <div class="goal-card" id="goal-card-${goal.id}" style="border-left: 4px solid var(--primary); background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 40px; height: 40px; background: rgba(0,0,0,0.03); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${boxIcons[category] || 'fa-check'}"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0; font-size: 0.95rem; color: #333;">${goal.taskDescription}</h4>
                            <span style="font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">${category}</span>
                        </div>
                    </div>
                    <div>
                        <input type="checkbox" 
                               data-goal-id="${goal.id}"
                               data-desc="${goal.taskDescription}" 
                               class="goal-checkbox" 
                               ${completedGoalIds.includes(goal.id) ? 'checked' : ''}
                               ${!isToday ? 'disabled' : ''}
                               style="transform: scale(1.3); ${!isToday ? 'cursor: not-allowed; opacity: 0.5;' : 'cursor: pointer;'} accent-color: var(--primary);">
                    </div>
                </div>
            `).join('');
                }
                goalsGrid.innerHTML = goalsHtml;

                // Add change listener for manual toggling
                document.querySelectorAll('.goal-checkbox').forEach(cb => {
                    cb.addEventListener('change', async (e) => {
                        const goalId = e.target.dataset.goalId;
                        if (e.target.checked) {
                            try {
                                const dateParam = globalCurrentDateStr ? `?date=${globalCurrentDateStr}` : '';
                                const res = await fetchWithAuth(`/api/member/goals/${goalId}/complete${dateParam}`, { method: 'POST' });
                                if (res && res.ok) {
                                    showToast('Goal completed!', 'success');
                                    syncGoalCheckboxes(goalId, true);
                                    await initGoalProgressTracking(null, globalPlanDates, null);
                                } else {
                                    e.target.checked = false;
                                    showToast('Failed to update goal', 'error');
                                }
                            } catch (err) {
                                console.error(err);
                                e.target.checked = false;
                            }
                        } else {
                            try {
                                const dateParam = globalCurrentDateStr ? `?date=${globalCurrentDateStr}` : '';
                                const res = await fetchWithAuth(`/api/member/goals/${goalId}/incomplete${dateParam}`, { method: 'POST' });
                                if (res && res.ok) {
                                    showToast('Goal marked as incomplete.', 'info');
                                    syncGoalCheckboxes(goalId, false);
                                    await initGoalProgressTracking(null, globalPlanDates, null);
                                } else {
                                    e.target.checked = true;
                                    showToast('Failed to update goal', 'error');
                                }
                            } catch (err) {
                                console.error(err);
                                e.target.checked = true;
                            }
                        }
                    });
                });
            }

            // Render goals in modal
            const modalContent = document.querySelector('.checklist-modal-content .checklist-grid');
            if (modalContent && Object.keys(goalsByCategory).length > 0) {
                const modalIcons = {
                    'Workout': 'fa-dumbbell',
                    'Meal': 'fa-utensils',
                    'Nutrition': 'fa-bowl-food',
                    'Hydration': 'fa-droplet',
                    'Sleep': 'fa-moon',
                    'Habit': 'fa-heart'
                };

                const todayStrDate = new Date().toISOString().split('T')[0];
                const isToday = !globalCurrentDateStr || globalCurrentDateStr === todayStrDate;

                modalContent.innerHTML = Object.entries(goalsByCategory).map(([category, goals]) => `
                <div class="checklist-col">
                    <div class="col-header"><i class="fas ${modalIcons[category] || 'fa-check-circle'}"></i> <h3>${category}</h3></div>
                    <div class="instruction-list">
                        ${goals.map(goal => `
                            <label class="inst-item">
                                <input type="checkbox"
                                       data-goal-id="${goal.id}"
                                       data-category="${category}"
                                       data-task="${goal.taskDescription}"
                                       class="goal-checkbox-modal"
                                       ${completedGoalIds.includes(goal.id) ? 'checked' : ''}
                                       ${!isToday ? 'disabled' : ''}>
                                <span>${goal.taskDescription}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');

                // Add listeners to modal checkboxes
                modalContent.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', async (e) => {
                        try {
                            const goalId = e.target.dataset.goalId;
                            const dateParam = globalCurrentDateStr ? `?date=${globalCurrentDateStr}` : '';
                            if (e.target.checked) {
                                await fetchWithAuth(`/api/member/goals/${goalId}/complete${dateParam}`, { method: 'POST' });
                                showToast('Goal marked as complete!', 'success');
                                syncGoalCheckboxes(goalId, true);
                            } else {
                                await fetchWithAuth(`/api/member/goals/${goalId}/incomplete${dateParam}`, { method: 'POST' });
                                showToast('Goal marked as incomplete.', 'info');
                                syncGoalCheckboxes(goalId, false);
                            }

                            // Update calendar
                            if (typeof updateCalendarCompletion === 'function') {
                                await updateCalendarCompletion();
                            }

                            // Sync Progress
                            await initGoalProgressTracking(null, globalPlanDates, null);

                        } catch (err) {
                            console.error(err);
                            e.target.checked = !e.target.checked; // Revert
                        }
                    });
                });
            }
        } catch (err) {
            console.error('Error in initGoalsChecklist:', err);
        }

        // Initialize Premium Goal Progress Tracker
        await initGoalProgressTracking(user, globalPlanDates, todayStr);
    };

    // Initialize Weight Check-in Widget
    const initWeightCheckIn = async () => {
        const weightInput = document.getElementById('weightValue');
        const weightDateInput = document.getElementById('weightDate');
        const saveBtn = document.getElementById('saveWeightBtn');
        const statusDiv = document.getElementById('weightStatus');
        const weightEntryForm = document.getElementById('weightEntryFormNative');
        const weightSummaryDisplay = document.getElementById('weightSummaryDisplay');
        const displayWeightValue = document.getElementById('displayWeightValue');
        const editWeightBtn = document.getElementById('editWeightBtn');

        if (!weightInput || !saveBtn || !weightDateInput) return;

        // Sync with dashboard global date initially
        let currentWeightDateStr = globalCurrentDateStr || new Date().toISOString().split('T')[0];
        weightDateInput.value = currentWeightDateStr;

        // Load weight for selected date
        const loadWeight = async (date) => {
            try {
                const res = await fetchWithAuth(`/api/member/weight-log?date=${date}`);
                if (res && res.ok) {
                    const data = await res.json();

                    const todayStr = new Date().toISOString().split('T')[0];
                    const isToday = (date === todayStr);

                    if (data.weight) {
                        weightInput.value = data.weight;
                        if (displayWeightValue) displayWeightValue.textContent = data.weight;

                        // Hide form, show summary
                        if (weightEntryForm) weightEntryForm.style.display = 'none';
                        if (weightSummaryDisplay) weightSummaryDisplay.style.display = 'flex';
                        if (statusDiv) statusDiv.style.display = 'none';

                        // Only allow edit if it's today
                        if (editWeightBtn) {
                            editWeightBtn.style.display = isToday ? 'inline-block' : 'none';
                        }

                    } else {
                        weightInput.value = '';

                        if (isToday) {
                            // Show entry form for today
                            if (weightEntryForm) weightEntryForm.style.display = 'block';
                            if (weightSummaryDisplay) weightSummaryDisplay.style.display = 'none';
                            if (statusDiv) statusDiv.style.display = 'none';
                        } else {
                            // No weight logged for a past date, don't allow entry
                            if (weightEntryForm) weightEntryForm.style.display = 'none';
                            if (weightSummaryDisplay) weightSummaryDisplay.style.display = 'none';
                            if (statusDiv) {
                                statusDiv.style.display = 'flex';
                                statusDiv.innerHTML = `<span style="color: var(--text-muted); padding: 10px 0;"><i class="fas fa-info-circle"></i> No weight logged on this date.</span>`;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading weight:', err);
            }
        };

        // Load initial weight
        await loadWeight(currentWeightDateStr);

        // React to date picker changes
        weightDateInput.addEventListener('change', async (e) => {
            const newDate = e.target.value;
            if (newDate) {
                currentWeightDateStr = newDate;
                globalCurrentDateStr = newDate; // sync dashboard
                await loadWeight(newDate);
                // Optionally update the rest of the dashboard
                if (typeof window.selectCalendarDate === 'function') {
                    // This simulates clicking the calendar to keep everything in sync
                    const planDatesRes = await fetchWithAuth('/api/member/goals');
                    if (planDatesRes && planDatesRes.ok) window.selectCalendarDate(newDate, true);
                }
            }
        });

        // Edit button handler
        if (editWeightBtn) {
            editWeightBtn.addEventListener('click', () => {
                if (weightEntryForm) weightEntryForm.style.display = 'block';
                if (weightSummaryDisplay) weightSummaryDisplay.style.display = 'none';
                if (weightInput) weightInput.focus();
            });
        }

        // Save weight handler (now uses form submit for HTML5 native validation fallback)
        const weightForm = document.getElementById('weightEntryFormNative');
        if (weightForm) {
            weightForm.addEventListener('submit', async (e) => {
                e.preventDefault(); // allow html5 validation but handle ajax manually

                const date = weightDateInput.value;
                const weight = parseFloat(weightInput.value);

                if (!weight || weight < 20 || weight > 300) {
                    showToast('Please enter a valid weight (20kg - 300kg)', 'error');
                    return;
                }

                try {
                    const res = await fetchWithAuth('/api/member/weight-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date, weight })
                    });

                    if (res && res.ok) {
                        showToast('Weight saved successfully!', 'success');

                        // Refresh localized widget instantly
                        await loadWeight(date);

                        // Refresh Goal Progress Tracker
                        await initGoalProgressTracking(null, globalPlanDates, date);

                    } else {
                        try {
                            let errData = await res.json();
                            showToast(errData.message || 'Failed to save weight', 'error');
                        } catch (e) {
                            showToast('Failed to save weight', 'error');
                        }
                    }
                } catch (err) {
                    console.error('Error saving weight:', err);
                    showToast('Error saving weight', 'error');
                }
            });
        }

        // Modal Logic
        const progressBtn = document.getElementById('viewWeightProgressBtn');
        const progressModal = document.getElementById('weightProgressModal');
        const closeProgressBtn = document.getElementById('closeWeightProgress');

        if (progressBtn && progressModal) {
            progressBtn.addEventListener('click', () => {
                progressModal.classList.add('active');
                initPlanEffectiveness();
            });
        }

        if (closeProgressBtn && progressModal) {
            closeProgressBtn.addEventListener('click', () => {
                progressModal.classList.remove('active');
            });

            progressModal.addEventListener('click', (e) => {
                if (e.target === progressModal) {
                    progressModal.classList.remove('active');
                }
            });
        }
    };

    // Initialize Plan Effectiveness Analysis
    const initPlanEffectiveness = async () => {
        const contentDiv = document.getElementById('effectivenessContent');
        if (!contentDiv) return;

        try {
            const res = await fetchWithAuth('/api/member/goal-effectiveness');
            if (res && res.ok) {
                const data = await res.json();

                // Determine color based on effectiveness
                let color = 'var(--text-muted)';
                if (data.effectiveness && data.effectiveness.toLowerCase().includes('working')) {
                    color = 'var(--success)';
                } else if (data.effectiveness && (data.effectiveness.toLowerCase().includes('increase') || data.effectiveness.toLowerCase().includes('surplus') || data.effectiveness.toLowerCase().includes('insufficient'))) {
                    color = 'var(--warning)';
                }

                contentDiv.innerHTML = `
                    <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%); border-radius: 16px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 0 20px rgba(0,0,0,0.2);">
                        <h3 style="color: ${color}; margin-bottom: 12px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px;">
                            <i class="fas fa-${data.trend === 'increase' ? 'arrow-up' : data.trend === 'decrease' ? 'arrow-down' : 'minus'}"></i>
                            ${data.effectiveness || 'No data'}
                        </h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: ${data.insight ? '15px' : '25px'}; font-size: 1rem; line-height: 1.5;">${data.message || ''}</p>
                        ${data.insight ? `<div style="background: rgba(200, 245, 96, 0.1); border-left: 4px solid var(--primary); padding: 12px 15px; margin-bottom: 25px; border-radius: 4px; text-align: left;"><p style="color: #fff; font-size: 0.9rem; margin: 0; line-height: 1.4;">${data.insight}</p></div>` : ''}
                        ${data.currentAvg ? `
                            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 10px;">
                                <div style="flex: 1; background: rgba(0,0,0,0.3); padding: 18px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                                    <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Current Avg</p>
                                    <p style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${data.currentAvg} <span style="font-size: 0.85rem; color: rgba(255,255,255,0.4); font-weight: 500;">kg</span></p>
                                </div>
                                <div style="flex: 1; background: rgba(0,0,0,0.3); padding: 18px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                                    <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Previous Avg</p>
                                    <p style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${data.previousAvg} <span style="font-size: 0.85rem; color: rgba(255,255,255,0.4); font-weight: 500;">kg</span></p>
                                </div>
                                <div style="flex: 1; background: rgba(0,0,0,0.3); padding: 18px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                                    <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Change</p>
                                    <p style="font-size: 1.5rem; font-weight: 800; color: ${data.change > 0 ? 'var(--warning)' : data.change < 0 ? 'var(--success)' : 'rgba(255,255,255,0.7)'};">
                                        ${data.change > 0 ? '+' : ''}${data.change} <span style="font-size: 0.85rem; font-weight: 500;">kg</span>
                                    </p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;

                // Render Chart if history data exists
                if (data.history && data.history.length > 0) {
                    const ctx = document.getElementById('weightProgressChart');
                    if (ctx) {
                        // Destroy existing chart instance to prevent overlay bugs
                        if (window.weightProgressChartInstance) {
                            window.weightProgressChartInstance.destroy();
                        }

                        const labels = data.history.map(pt => pt.date.substring(5)); // Show MM-DD
                        const weights = data.history.map(pt => pt.weight);

                        const chartOptions = {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#1e2024',
                                    titleColor: '#c8f560',
                                    bodyColor: '#fff',
                                    padding: 10,
                                    displayColors: false,
                                    callbacks: {
                                        label: function (context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            if (context.parsed.y !== null) {
                                                label += context.parsed.y + ' kg';
                                            }
                                            return label;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: false,
                                    grid: { color: 'rgba(0,0,0,0.05)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        };

                        const datasets = [{
                            label: 'Weight',
                            data: weights,
                            borderColor: '#c8f560', // var(--primary)
                            backgroundColor: 'rgba(200, 245, 96, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#1e2024',
                            pointBorderColor: '#c8f560',
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }];

                        // Add starting weight reference line if available
                        if (data.startingWeight) {
                            datasets.push({
                                label: 'Starting Weight',
                                data: Array(labels.length).fill(data.startingWeight),
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                fill: false,
                                pointRadius: 0, // No dots on reference line
                                pointHoverRadius: 0
                            });
                        }

                        window.weightProgressChartInstance = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: labels,
                                datasets: datasets
                            },
                            options: chartOptions
                        });
                    }
                }
            } else {
                contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Unable to load effectiveness analysis</p>';
            }
        } catch (err) {
            console.error('Error loading plan effectiveness:', err);
            contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Error loading analysis</p>';
        }
    };

    // Goal Calendar Functions
    let calendarData = null;
    let currentSelectedDate = null;

    const initGoalCalendar = async () => {
        const calendarContainer = document.getElementById('goalCalendar');
        if (!calendarContainer) return;

        try {
            const response = await fetchWithAuth('/api/member/goal-completion-calendar');
            calendarData = await response.json();

            if (!calendarData.hasActivePlan) {
                calendarContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No active goal plan</p>';
                return;
            }

            // Set plan boundaries for date navigator
            planStartDate = calendarData.startDate;
            planEndDate = calendarData.endDate;

            renderCalendar(new Date());

            // Initialize date navigator
            initDateNavigator();
        } catch (err) {
            console.error('Error loading calendar:', err);
            calendarContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Error loading calendar</p>';
        }
    };

    const renderCalendar = (displayDate) => {
        const calendarContainer = document.getElementById('goalCalendar');
        if (!calendarContainer || !calendarData) return;

        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        let html = `
            <div class="calendar-header">
                <div class="calendar-month">${monthNames[month]} ${year}</div>
                <div class="calendar-nav">
                    <button onclick="changeMonth(-1)"><i class="fas fa-chevron-left"></i></button>
                    <button onclick="changeMonth(1)"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="calendar-days">
                <div class="calendar-day-name">Sun</div>
                <div class="calendar-day-name">Mon</div>
                <div class="calendar-day-name">Tue</div>
                <div class="calendar-day-name">Wed</div>
                <div class="calendar-day-name">Thu</div>
                <div class="calendar-day-name">Fri</div>
                <div class="calendar-day-name">Sat</div>
            </div>
            <div class="calendar-grid">
        `;

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            html += '<div class="calendar-date empty"></div>';
        }

        // Add date cells
        const planStart = new Date(calendarData.startDate);
        const planEnd = new Date(calendarData.endDate);

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateStr = currentDate.toISOString().split('T')[0];
            const isWithinPlan = currentDate >= planStart && currentDate <= planEnd;
            const isToday = currentDate.getTime() === today.getTime();
            const isCompleted = calendarData.completions[dateStr] || false;
            const isSelected = currentSelectedDate === dateStr;

            let classes = 'calendar-date';
            if (!isWithinPlan) classes += ' disabled';
            if (isToday) classes += ' today';
            if (isCompleted) classes += ' completed';
            if (isSelected) classes += ' selected';

            html += `<div class="${classes}" data-date="${dateStr}" onclick="selectCalendarDate('${dateStr}', ${isWithinPlan})">${day}</div>`;
        }

        html += '</div>';
        calendarContainer.innerHTML = html;
    };

    window.changeMonth = (direction) => {
        const calendarContainer = document.getElementById('goalCalendar');
        if (!calendarContainer) return;

        const currentMonth = calendarContainer.querySelector('.calendar-month').textContent;
        const [monthName, yearStr] = currentMonth.split(' ');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.indexOf(monthName);
        const year = parseInt(yearStr);

        const newDate = new Date(year, monthIndex + direction, 1);
        renderCalendar(newDate);
    };

    window.selectCalendarDate = async (dateStr, isWithinPlan) => {
        if (!isWithinPlan) return;

        currentSelectedDate = dateStr;
        renderCalendar(new Date(dateStr));

        // Sync weight log check-in date UI
        const weightDateInput = document.getElementById('weightDate');
        if (weightDateInput && weightDateInput.value !== dateStr) {
            weightDateInput.value = dateStr;
            // manually trigger the change event to fetch current log for newly synced date
            weightDateInput.dispatchEvent(new Event('change'));
        }

        // Load goals for selected date
        await navigateToDate(dateStr);
    };


    window.updateCalendarCompletion = async () => {
        // Refresh calendar data after goal completion/incompletion
        try {
            const response = await fetchWithAuth('/api/member/goal-completion-calendar');
            calendarData = await response.json();
            if (calendarData.hasActivePlan) {
                const currentMonth = document.querySelector('.calendar-month');
                if (currentMonth) {
                    const [monthName, yearStr] = currentMonth.textContent.split(' ');
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthIndex = monthNames.indexOf(monthName);
                    const year = parseInt(yearStr);
                    renderCalendar(new Date(year, monthIndex, 1));
                }
            }
        } catch (err) {
            console.error('Error updating calendar:', err);
        }
    };

    // Date Navigator Functions
    let currentViewDate = null;
    let planStartDate = null;
    let planEndDate = null;

    const initDateNavigator = () => {
        const prevBtn = document.getElementById('prevDayBtn');
        const nextBtn = document.getElementById('nextDayBtn');
        const calendarToggleBtn = document.getElementById('calendarToggleBtn');
        const calendarContainer = document.getElementById('goalCalendar');

        if (!prevBtn || !nextBtn || !calendarToggleBtn) return;

        // Initialize with today's date
        const today = new Date().toISOString().split('T')[0];
        currentViewDate = today;
        updateDateDisplay();

        // Set up button handlers
        prevBtn.addEventListener('click', () => navigateDay(-1));
        nextBtn.addEventListener('click', () => navigateDay(1));

        // Calendar Toggle is now handled by CSS hover on .calendar-dropdown-wrapper
    };

    const navigateDay = (direction) => {
        if (!currentViewDate) return;

        const current = new Date(currentViewDate);
        current.setDate(current.getDate() + direction);
        const newDateStr = current.toISOString().split('T')[0];

        // Check boundaries
        if (planStartDate && newDateStr < planStartDate) return;
        if (planEndDate && newDateStr > planEndDate) return;

        navigateToDate(newDateStr);
    };

    const navigateToDate = async (dateStr) => {
        currentViewDate = dateStr;
        currentSelectedDate = dateStr;

        // Update UI
        updateDateDisplay();
        updateNavigationButtons();

        // Update calendar selection
        if (calendarData && calendarData.hasActivePlan) {
            const displayDate = new Date(dateStr);
            renderCalendar(displayDate);
        }

        // Load goals for selected date
        await loadGoalsForSelectedDate(dateStr);

        // Update progress visualization
        await initGoalProgressTracking(null, globalPlanDates, dateStr);
    };

    const updateDateDisplay = () => {
        const dateLabel = document.getElementById('currentDateLabel');
        if (!dateLabel || !currentViewDate) return;

        const today = new Date().toISOString().split('T')[0];
        const viewDate = new Date(currentViewDate);

        if (currentViewDate === today) {
            dateLabel.textContent = 'Today';
        } else {
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            dateLabel.textContent = viewDate.toLocaleDateString('en-US', options);
        }
    };

    const updateNavigationButtons = () => {
        const prevBtn = document.getElementById('prevDayBtn');
        const nextBtn = document.getElementById('nextDayBtn');

        if (!prevBtn || !nextBtn || !currentViewDate) return;

        // Disable previous button if at start date
        if (planStartDate && currentViewDate <= planStartDate) {
            prevBtn.disabled = true;
        } else {
            prevBtn.disabled = false;
        }

        // Disable next button if at end date
        if (planEndDate && currentViewDate >= planEndDate) {
            nextBtn.disabled = true;
        } else {
            nextBtn.disabled = false;
        }
    };

    const loadGoalsForSelectedDate = async (dateStr) => {
        try {
            // Fetch goals for the selected date
            const response = await fetchWithAuth(`/api/member/goals?date=${dateStr}`);
            const goalsData = await response.json();

            // Render goals grid
            renderGoalsForDate(goalsData, dateStr);

        } catch (err) {
            console.error('Error loading goals for date:', err);
            showToast('Error loading goals', 'error');
        }
    };

    window.renderGoalsForDate = (goalsData, dateStr, containerId = 'dailyGoalsGrid', readOnly = false) => {
        const goalsGrid = document.getElementById(containerId);
        // Only try to find emptyState if we are using the default grid, otherwise we might not have one or need to handle it differently
        const emptyState = containerId === 'dailyGoalsGrid' ? document.getElementById('emptyGoalsState') : null;

        if (!goalsGrid) return;

        if (!goalsData || goalsData.length === 0) {
            goalsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            else goalsGrid.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">No goals for this date.</p>';
            return;
        }

        // Group goals by category
        const goalsByCategory = {};
        goalsData.forEach(goal => {
            const category = goal.category || 'Other';
            if (!goalsByCategory[category]) {
                goalsByCategory[category] = [];
            }
            goalsByCategory[category].push(goal);
        });

        // Define icons for categories
        const boxIcons = {
            'Workout': 'fa-running',
            'Meal': 'fa-apple-alt',
            'Nutrition': 'fa-leaf',
            'Hydration': 'fa-tint',
            'Sleep': 'fa-bed',
            'Habit': 'fa-heart'
        };

        const todayStrDate = new Date().toISOString().split('T')[0];
        const isToday = dateStr === todayStrDate;

        // Render goals grid (Ungrouped card style)
        let html = '';
        Object.entries(goalsByCategory).forEach(([category, goals]) => {
            html += goals.map(goal => `
                <div class="goal-card" id="goal-card-${goal.id}">
                    <div class="goal-content-wrapper">
                        <div class="goal-icon-circle">
                            <i class="fas ${boxIcons[category] || 'fa-check'}"></i>
                        </div>
                        <div class="goal-text-wrapper">
                            <h4 class="goal-title">${goal.taskDescription}</h4>
                            <span class="goal-category-label">${category}</span>
                        </div>
                    </div>
                    <div class="goal-checkbox-wrapper">
                        <input type="checkbox" 
                                class="goal-checkbox-nav" 
                                data-goal-id="${goal.id}"
                                data-date="${dateStr}"
                                ${goal.completed ? 'checked' : ''}
                                ${(!isToday || readOnly) ? 'disabled' : ''}>
                    </div>
                </div>
            `).join('');
        });

        goalsGrid.innerHTML = html;
        goalsGrid.style.display = 'grid'; // Ensure this matches the CSS grid definition if needed, or 'block'
        if (emptyState) emptyState.style.display = 'none';

        // Add event listeners ONLY if not readOnly
        if (!readOnly) {
            const checkboxes = goalsGrid.querySelectorAll('.goal-checkbox-nav');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', async (e) => {
                    const goalId = e.target.dataset.goalId;
                    const date = e.target.dataset.date;
                    const isChecked = e.target.checked;

                    try {
                        if (isChecked) {
                            await fetchWithAuth(`/api/member/goals/${goalId}/complete?date=${date}`, { method: 'POST' });
                            showToast('Goal completed!', 'success');
                            syncGoalCheckboxes(goalId, true);
                        } else {
                            await fetchWithAuth(`/api/member/goals/${goalId}/incomplete?date=${date}`, { method: 'POST' });
                            showToast('Goal marked incomplete', 'info');
                            syncGoalCheckboxes(goalId, false);
                        }

                        // Update calendar
                        if (typeof updateCalendarCompletion === 'function') {
                            await updateCalendarCompletion();
                        }

                        // Update progress rings
                        await initGoalProgressTracking(null, globalPlanDates, dateStr);

                    } catch (err) {
                        console.error('Error updating goal:', err);
                        e.target.checked = !isChecked; // Revert checkbox
                        showToast('Error updating goal', 'error');
                    }
                });
            });
        }
    };

    // Expose function to update goal status from other pages (like meal-tracker)
    window.updateGoalStatus = (goalDesc, isCompleted) => {
        // This function tries to find the goal checkbox by description and update it.
        // NOTE: This only works if the goal list is PRESENT on the current page.
        // For cross-page updates, we rely on the backend data being fresh on reload.
        // But if the goal list IS on the page (e.g. Dashboard or if we added it to tracker), this updates it.

        // Checkboxes have data-desc attribute
        const checkboxes = document.querySelectorAll(`.goal-checkbox[data-desc="${goalDesc}"]`);
        checkboxes.forEach(cb => {
            cb.checked = isCompleted;
            cb.disabled = isCompleted; // Disable if completed, enable if not? usually we disable active goals.
            // If un-completing, we might want to enabling it back.
            if (!isCompleted) {
                cb.disabled = false;
            }
        });

        // Also update modal checkboxes if present
        const modalCheckboxes = document.querySelectorAll(`.goal-checkbox-modal[data-task="${goalDesc}"]`);
        modalCheckboxes.forEach(cb => {
            cb.checked = isCompleted;
        });
    };

    // Report generation
    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            let uName = 'User';
            try {
                const uStr = localStorage.getItem('user');
                if (uStr) {
                    uName = JSON.parse(uStr).fullname || JSON.parse(uStr).username || 'User';
                }
            } catch (e) { console.error('Error parsing user data', e); }
            generateReport(uName);
        });
    }


    const updateGoalProgressFromChecklists = (mealData = null) => {
        const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
        if (checkboxes.length === 0) return;

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const targetCalories = user.targetMealCalories || 2000;

        // Categories to track
        const categories = {
            Workout: { total: 0, completed: 0, bar: 'exerciseProgressBar', text: 'exercisePctText' },
            Meal: { total: 0, completed: 0 },
            Nutrition: { total: 0, completed: 0 },
            Hydration: { total: 0, completed: 0 },
            Sleep: { total: 0, completed: 0 },
            Habit: { total: 0, completed: 0 },
            Goal: { total: 0, completed: 0, bar: 'weightProgressBar', text: 'weightPctText' }
        };

        // Track which categories actually have goals assigned
        const activeCategories = new Set();

        checkboxes.forEach(cb => {
            const cat = cb.dataset.category;
            if (categories[cat]) {
                categories[cat].total++;
                if (cb.checked) categories[cat].completed++;
                activeCategories.add(cat);
            }
        });

        // Calculate specific progress bars
        // 1. Daily Tasks (Workout Category)
        const workoutPct = categories.Workout.total > 0 ? (categories.Workout.completed / categories.Workout.total) * 100 : 0;

        // 2. Active Plan Focus (Goal Category)
        const goalPct = categories.Goal.total > 0 ? (categories.Goal.completed / categories.Goal.total) * 100 : 0;

        // 3. Overall Wellness (Average of all ACTIVE goal categories + real nutrition data)
        let totalPctSum = 0;
        let activeGoalsCount = 0;

        ['Workout', 'Goal', 'Meal', 'Nutrition', 'Hydration', 'Sleep', 'Habit'].forEach(cat => {
            if (activeCategories.has(cat)) {
                totalPctSum += (categories[cat].completed / categories[cat].total) * 100;
                activeGoalsCount++;
            }
        });

        // Real nutrition percentage from calories
        let realNutritionPct = 0;
        if (mealData) {
            const totalCals = mealData.reduce((sum, m) => sum + (m.calories || 0), 0);
            realNutritionPct = Math.min(Math.round((totalCals / targetCalories) * 100), 100);
            sessionStorage.setItem('last_nutrition_pct', realNutritionPct);
        } else {
            realNutritionPct = Number(sessionStorage.getItem('last_nutrition_pct') || 0);
        }

        // Add real nutrition to the average
        totalPctSum += realNutritionPct;
        activeGoalsCount++;

        const habitPct = activeGoalsCount > 0 ? Math.round(totalPctSum / activeGoalsCount) : 0;


        // --- Update Goals Tracker Header Status ---
        const totalGoals = Array.from(checkboxes).length;
        const totalCompleted = Array.from(checkboxes).filter(cb => cb.checked).length;
        const totalPct = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0;

        const goalsHeader = document.querySelector('.goals-tracker .dashboard-header h2');
        if (goalsHeader) {
            let statusBadge = goalsHeader.querySelector('.completion-badge');
            if (!statusBadge) {
                statusBadge = document.createElement('span');
                statusBadge.className = 'completion-badge';
                statusBadge.style.cssText = 'font-size: 0.8rem; background: var(--primary); color: #000; padding: 4px 10px; border-radius: 6px; margin-left: 15px; vertical-align: middle;';
                goalsHeader.appendChild(statusBadge);
            }
            statusBadge.innerText = `${totalPct}% COMPLETE`;
        }
    };

    const generateReport = async (username) => {
        const overlay = document.getElementById('reportOverlay');
        const content = document.getElementById('reportContent');
        const dateEl = document.getElementById('reportDate');
        const userEl = document.getElementById('reportUser');
        const token = localStorage.getItem('token');

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        dateEl.innerText = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        userEl.innerText = `Member: ${username} `;

        // Capture Chart as Image
        let chartImageNode = '';
        const chartCanvas = document.getElementById('activityQuickChart');
        if (chartCanvas) {
            try {
                const imgData = chartCanvas.toDataURL('image/png', 1.0);
                const filterTab = document.querySelector('.filter-tab.active');
                const filterText = filterTab ? filterTab.innerText : 'Daily';

                chartImageNode = `
                    <div style="margin-top: 20px; background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                        <h4 style="color: #333; margin-bottom: 15px; font-size: 1.1rem;">📊 Activity Quick View (${filterText})</h4>
                        <img src="${imgData}" style="width: 100%; max-height: 250px; object-fit: contain;" alt="Activity Chart" />
                    </div>
                `;
            } catch (e) { console.error("Could not capture chart image", e); }
        }

        // Capture Rings SVG
        let ringsNode = '';
        const ringsElement = document.querySelector('.rings-svg');
        if (ringsElement) {
            // Need to wrap it properly to render in PDF
            ringsNode = `
                <div style="display: flex; justify-content: center; align-items: center; background: #111; padding: 20px; border-radius: 50%; width: 150px; height: 150px; margin: 0 auto 15px auto;">
                    ${ringsElement.outerHTML}
                </div>
            `;
        }

        // Show loading state
        overlay.style.display = 'flex';
        content.innerHTML = '<p style="text-align:center;padding:50px;">Loading your daily data...</p>';

        try {
            // Fetch all tracking data for today
            const [workoutsRes, mealsRes, waterRes, sleepRes, goalsRes] = await Promise.all([
                fetch(`/api/workouts?date=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/meals?date=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/water?date=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/sleep?date=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/goals/progress-summary?date=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const workouts = workoutsRes.ok ? await workoutsRes.json() : [];
            const meals = mealsRes.ok ? await mealsRes.json() : [];
            const water = waterRes.ok ? await waterRes.json() : [];
            const sleep = sleepRes.ok ? await sleepRes.json() : [];
            const goalData = goalsRes.ok ? await goalsRes.json() : { weightProgress: 0, exerciseAdherence: 0, habitScore: 0 };

            // Calculate totals
            const totalCaloriesBurned = workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
            const totalCaloriesConsumed = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
            const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
            const totalFats = meals.reduce((sum, m) => sum + (m.fats || 0), 0);
            const totalWater = water.reduce((sum, w) => sum + (w.waterIntake || w.amount || 0), 0);
            const totalSleepHours = sleep.reduce((sum, s) => sum + (s.sleepHours || s.hours || 0), 0);

            // Goal metrics
            const overallGoalPct = Math.round((goalData.weightProgress + goalData.exerciseAdherence + goalData.habitScore) / 3) || 0;
            const smartStatus = getSmartStatus(overallGoalPct);

            // Generate HTML for report
            let html = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
                            <h4 style="color: #4CAF50; margin-bottom: 10px;">🏋️ Workout Summary</h4>
                            <p style="font-size: 1.5rem; font-weight: 700; color: #333;">${workouts.length} Exercises</p>
                            <p style="color: #666;">Calories Burned: ${totalCaloriesBurned} kcal</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #FF9800;">
                            <h4 style="color: #FF9800; margin-bottom: 10px;">🍽️ Nutrition Summary</h4>
                            <p style="font-size: 1.5rem; font-weight: 700; color: #333;">${totalCaloriesConsumed} kcal</p>
                            <p style="color: #666;">P: ${totalProtein}g | C: ${totalCarbs}g | F: ${totalFats}g</p>
                        </div>
                        <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #FFCC00;">
                            <h4 style="color: #000000; margin-bottom: 10px;">💧 Hydration</h4>
                            <p style="font-size: 1.5rem; color: #000000;">${totalWater} ml</p>
                            <p style="color: #666;">${Math.round(totalWater / 250)} glasses of water</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #9C27B0;">
                            <h4 style="color: #9C27B0; margin-bottom: 10px;">😴 Sleep</h4>
                            <p style="font-size: 1.5rem; font-weight: 700; color: #333;">${totalSleepHours} hours</p>
                            <p style="color: #666;">${totalSleepHours >= 7 ? 'Well rested!' : 'Consider getting more sleep'}</p>
                        </div>
                    </div>

                    <div style="margin-top: 20px; background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; border-left: 5px solid ${smartStatus.color};">
                        <h4 style="color: #333; margin-bottom: 15px; font-size: 1.1rem;">🎯 Goal Progress Tracker</h4>
                        ${ringsNode}
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <span style="font-size: 1.2rem; font-weight: 700;">Overall Progress: ${overallGoalPct}%</span>
                            <span style="background: ${smartStatus.color}; color: #fff; padding: 5px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">${smartStatus.text}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                            <div style="text-align: center; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                                <div style="color: #2196F3; font-weight: bold; margin-bottom: 5px;">Active Plan Focus</div>
                                <div style="font-size: 1.3rem; font-weight: 800;">${Math.round(goalData.weightProgress)}%</div>
                            </div>
                            <div style="text-align: center; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                                <div style="color: #9C27B0; font-weight: bold; margin-bottom: 5px;">Plan Adherence</div>
                                <div style="font-size: 1.3rem; font-weight: 800;">${Math.round(goalData.exerciseAdherence)}%</div>
                            </div>
                            <div style="text-align: center; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                                <div style="color: #FFC107; font-weight: bold; margin-bottom: 5px;">Overall Wellness</div>
                                <div style="font-size: 1.3rem; font-weight: 800;">${Math.round(goalData.habitScore)}%</div>
                            </div>
                        </div>
                    </div>

                    ${chartImageNode}

                    <div style="margin-top: 20px;">
                        <h4 style="border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px;">📝 Workout Details</h4>
                        ${workouts.length > 0 ? workouts.map(w => `
                            <div style="background: #fff; border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 5px;">
                                <strong>${w.exerciseName || w.name || 'Exercise'}</strong> (${w.exerciseType || w.type || 'N/A'})<br>
                                <span style="color: #666; font-size: 0.9rem;">${w.sets || 0} sets × ${w.reps || 0} reps @ ${w.weight || 0}kg | ${w.durationMinutes || 0} min</span>
                            </div>
                        `).join('') : '<p style="color: #888;">No workouts logged today</p>'}
                    </div>

                    <div style="margin-top: 20px;">
                        <h4 style="border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px;">🍽️ Meal Details</h4>
                        ${meals.length > 0 ? meals.map(m => `
                            <div style="background: #fff; border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 5px;">
                                <strong>${m.foodName || m.name || 'Meal'}</strong> (${m.mealType || 'N/A'})<br>
                                <span style="color: #666; font-size: 0.9rem;">${m.calories || 0} kcal | P: ${m.protein || 0}g C: ${m.carbs || 0}g F: ${m.fats || 0}g</span>
                            </div>
                        `).join('') : '<p style="color: #888;">No meals logged today</p>'}
                    </div>

                    <div style="margin-top: 20px;">
                        <h4 style="border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px;">✅ Daily Checklist</h4>
                `;

            // Add checklist items
            const categories = {};
            document.querySelectorAll('.checklist-item input').forEach(cb => {
                const cat = cb.dataset.category;
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push({
                    task: cb.dataset.task,
                    completed: cb.checked
                });
            });

            for (const [cat, tasks] of Object.entries(categories)) {
                const completed = tasks.filter(t => t.completed).length;
                html += `
                        <div style="margin-bottom: 10px;">
                            <strong>${cat}</strong>: ${completed}/${tasks.length} completed
                            <div style="background: #e9ecef; border-radius: 4px; height: 8px; margin-top: 5px;">
                                <div style="background: #4CAF50; height: 100%; border-radius: 4px; width: ${(completed / tasks.length) * 100}%;"></div>
                            </div>
                        </div>
                    `;
            }

            html += '</div>';
            content.innerHTML = html;

        } catch (err) {
            console.error('Error fetching report data:', err);
            content.innerHTML = '<p style="text-align:center;padding:50px;color:#f44336;">Failed to load data. Please try again.</p>';
        }

        const element = document.getElementById('reportPreview');
        const opt = {
            margin: 0.5,
            filename: `Fitness_Square_Report_${username}_${todayStr}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Generate PDF
        html2pdf().set(opt).from(element).save().then(() => {
            overlay.style.display = 'none';
        });
    };

    // Run initialization
    // Initialization Logic Moved Inside dashboardPage Block
    // to prevent ReferenceError and duplicate calls.

    // Checklist Modal Logic
    const checklistBtn = document.getElementById('checklistBtn');
    const checklistModal = document.getElementById('checklistModal');
    const closeChecklist = document.getElementById('closeChecklist');

    if (checklistBtn && checklistModal) {
        checklistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            checklistModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scroll
        });

        const closeModal = (modalId) => {
            if (modalId && typeof modalId === 'string') {
                const m = document.getElementById(modalId);
                if (m) m.style.display = 'none';
            } else {
                // Fallback for checklist modal if applicable or default behavior
                const m = document.getElementById('checklistModal');
                if (m) m.style.display = 'none';
            }
            document.body.style.overflow = 'auto';
        };

        closeChecklist.addEventListener('click', closeModal);

        checklistModal.addEventListener('click', (e) => {
            if (e.target === checklistModal) closeModal();
        });

        // Handle persistence within the modal
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const username = user.fullname || 'Guest';
        const checklistKey = `daily_checklist_${username}_${new Date().toISOString().split('T')[0]}`;

        const modalCheckboxes = checklistModal.querySelectorAll('input[type="checkbox"]');
        const savedChecklist = JSON.parse(localStorage.getItem(checklistKey) || '{}');

        modalCheckboxes.forEach(cb => {
            const key = `${cb.dataset.cat}-${cb.dataset.task}`;
            if (savedChecklist[key]) {
                cb.checked = true;
            }

            cb.addEventListener('change', () => {
                const currentStates = JSON.parse(localStorage.getItem(checklistKey) || '{}');
                currentStates[key] = cb.checked;
                localStorage.setItem(checklistKey, JSON.stringify(currentStates));
            });
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }


    // --- Member Profile Logic ---
    if (document.querySelector('.profile-page')) {

        const initMemberProfile = async () => {

            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }

            try {
                console.log('Fetching member profile...');
                const res = await fetch('/api/member/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    console.error('Profile fetch failed with status:', res.status);
                    throw new Error('Profile fetch failed');
                }

                const profile = await res.json();
                console.log('Member profile loaded:', profile);

                // ✅ ALWAYS SET NAME & EMAIL
                const fullnameElem = document.getElementById('fullname');
                const emailElem = document.getElementById('email');

                if (fullnameElem) {
                    let existingName = profile.fullname || JSON.parse(localStorage.getItem('user'))?.fullname;

                    if (!existingName || existingName.trim() === '' || existingName === 'N/A') {
                        // 🔓 Unlock if name is missing
                        fullnameElem.value = '';
                        fullnameElem.removeAttribute('readonly');
                        fullnameElem.placeholder = "REQUIRED: Please enter your full name";
                        fullnameElem.style.border = "2px solid #e8ff00"; // Highlight
                        console.log('Fullname missing. Field unlocked for editing.');
                    } else {
                        // 🔒 Lock if name exists
                        fullnameElem.value = existingName;
                        fullnameElem.setAttribute('readonly', 'true');
                        fullnameElem.style.border = ""; // Reset style
                    }
                }
                if (emailElem) {
                    emailElem.value = profile.email || JSON.parse(localStorage.getItem('user'))?.email || 'N/A';
                    console.log('Set email to:', emailElem.value);
                }

                // ✅ LOAD SAVED DATA
                const ageElem = document.getElementById('age');
                if (ageElem) ageElem.value = profile.age ?? '';
                const genderElem = document.getElementById('gender');
                if (genderElem) genderElem.value = profile.gender ?? '';
                document.getElementById('weight').value = profile.weight ?? '';
                document.getElementById('height').value = profile.height ?? '';
                document.getElementById('fitnessGoals').value =
                    (Array.isArray(profile.fitnessGoals) ? profile.fitnessGoals.join(', ') : profile.fitnessGoals) || '';

                document.getElementById('medicalReports').value =
                    profile.medicalReports?.join(', ') || '';

                document.getElementById('targetCalories').value = profile.targetCaloriesBurned ?? '';
                document.getElementById('targetWater').value = profile.targetWaterLiters ?? '';
                document.getElementById('targetSleep').value = profile.targetSleepHours ?? '';

                if (profile.medicalReportUrl) {
                    document.getElementById('currentPdf').style.display = 'block';
                    document.getElementById('pdfLink').href = profile.medicalReportUrl;
                }

            } catch (err) {
                console.error('Profile load error:', err);
            }

            // SAVE (NO NAME / EMAIL)
            document.getElementById('profileForm').addEventListener('submit', async (e) => {
                e.preventDefault();

                const fileInput = document.getElementById('medicalPdf');
                const pdfStatus = document.getElementById('pdfStatus');

                // 1. Handle PDF Upload if file selected
                if (fileInput && fileInput.files.length > 0) {
                    pdfStatus.innerText = 'Uploading report...';
                    pdfStatus.style.color = 'var(--primary)';

                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);

                    try {
                        const uploadRes = await fetch('/api/member/upload-report', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            body: formData
                        });

                        if (!uploadRes.ok) {
                            const errorText = await uploadRes.text();
                            throw new Error(errorText || 'Upload failed');
                        }

                        const uploadData = await uploadRes.json();
                        if (uploadData.url) {
                            document.getElementById('currentPdf').style.display = 'block';
                            document.getElementById('pdfLink').href = uploadData.url;
                        }

                        // ✅ Clear file input as requested
                        fileInput.value = '';
                        pdfStatus.innerText = 'Report uploaded successfully!';
                    } catch (err) {
                        pdfStatus.innerText = 'Upload failed: ' + err.message;
                        pdfStatus.style.color = '#ff4444';
                        return;
                    }
                }

                const payload = {
                    fullname: document.getElementById('fullname').value, // ✅ Added fullname
                    age: Number(document.getElementById('age').value),
                    gender: document.getElementById('gender').value,
                    weight: Number(document.getElementById('weight').value),
                    height: Number(document.getElementById('height').value),
                    fitnessGoals: document.getElementById('fitnessGoals').value
                        ? document.getElementById('fitnessGoals').value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
                        : [], // Convert to List<String> for backend
                    medicalReports: document.getElementById('medicalReports').value
                        ? document.getElementById('medicalReports').value.split(',').map(s => s.trim()).filter(Boolean)
                        : [],
                    targetCaloriesBurned: Number(document.getElementById('targetCalories').value) || null,
                    targetWaterLiters: Number(document.getElementById('targetWater').value) || null,
                    targetSleepHours: Number(document.getElementById('targetSleep').value) || null
                };

                const res = await fetch('/api/member/profile', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const msg = document.getElementById('profileMessage');
                if (res.ok) {
                    msg.innerText = 'Profile updated successfully!';
                    // ✅ Sync local storage so other pages/sidebars refresh correctly
                    const updatedProfile = await res.json();
                    localStorage.setItem('user', JSON.stringify(updatedProfile));
                } else {
                    msg.innerText = 'Update failed';
                }
                msg.className = `form-message ${res.ok ? 'success' : 'error'}`;
                msg.style.display = 'block';
            });
        };

        initMemberProfile();
    }


    // --- Trainer Profile Logic ---
    if (document.querySelector('.profile-trainer-page')) {
        const initTrainerProfile = async () => {
            const fetchWithAuth = async (url, options = {}) => {
                const token = localStorage.getItem('token');
                if (!token) return null;
                const response = await fetch(url, { ...options, headers: { 'Authorization': `Bearer ${token}`, ...options.headers } });
                return response.ok ? response : null;
            };

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            console.log("Initializing Trainer Profile for:", user.email);

            // ✅ PRE-POPULATE from LocalStorage immediately
            if (user.email) document.getElementById('email').value = user.email;
            if (user.fullname) document.getElementById('fullname').value = user.fullname;

            // Enforce Read-Only
            document.getElementById('email').readOnly = true;
            document.getElementById('fullname').readOnly = true;

            // Load Trainer Profile
            try {
                const response = await fetchWithAuth('/api/trainer/profile');
                if (response) {
                    const profile = await response.json();
                    console.log("Trainer Profile Loaded:", profile);

                    document.getElementById('fullname').value = profile.fullname || user.fullname || '';
                    if (profile.email) document.getElementById('email').value = profile.email;

                    document.getElementById('specialization').value = profile.specialization || '';
                    document.getElementById('experience').value = profile.experience || '';
                    document.getElementById('bio').value = profile.bio || '';
                    document.getElementById('certificates').value = profile.certificates ? profile.certificates.join(', ') : '';
                }
            } catch (err) { console.error("Error loading trainer profile:", err); }

            // Update Trainer Profile
            document.getElementById('profileForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                btn.innerText = 'Saving...';

                const profileData = {
                    // Fullname is read-only, do not send
                    specialization: document.getElementById('specialization').value,
                    experience: document.getElementById('experience').value,
                    bio: document.getElementById('bio').value,
                    certificates: document.getElementById('certificates').value.split(',').map(s => s.trim()).filter(Boolean)
                };

                try {
                    const res = await fetchWithAuth('/api/trainer/profile', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(profileData)
                    });
                    const messageDiv = document.getElementById('profileMessage');
                    if (res) {
                        messageDiv.innerText = 'Profile updated successfully!';
                        messageDiv.className = 'form-message success';
                        messageDiv.style.display = 'block';
                    } else {
                        messageDiv.innerText = 'Update failed.';
                        messageDiv.className = 'form-message error';
                        messageDiv.style.display = 'block';
                    }
                } catch (err) { console.error(err); }
                btn.innerText = 'Save Changes';
            });
        };
        initTrainerProfile();
    }

    // Trainers Page Logic
    const trainersPage = document.querySelector('.trainers-page');
    if (trainersPage) {
        let allTrainers = [];

        const initTrainersPage = async () => {
            const trainersGrid = document.getElementById('trainersGrid') || document.getElementById('trainersList');
            const filterSelect = document.getElementById('specializationFilter');
            const countDisplay = document.getElementById('trainerCount');

            if (!trainersGrid) return;

            // Fetch Trainers
            const trainers = await fetchWithAuth('/api/member/trainers');
            if (trainers) {
                allTrainers = await trainers.json();
            }

            if (!allTrainers || allTrainers.length === 0) {
                trainersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;"><h3>No trainers available at the moment.</h3><p>Please check back later.</p></div>';
                if (countDisplay) countDisplay.innerText = "No trainers found";
                return;
            }

            // Initial Render
            renderTrainers(allTrainers);

            // Filter Event
            if (filterSelect) {
                filterSelect.addEventListener('change', (e) => {
                    const val = e.target.value;
                    const filtered = val === 'all'
                        ? allTrainers
                        : allTrainers.filter(t => {
                            const tSpec = (t.specialization || "").trim().toLowerCase();
                            const fVal = val.trim().toLowerCase();
                            if (!tSpec) return false;
                            return tSpec.includes(fVal) || fVal.includes(tSpec);
                        });
                    renderTrainers(filtered);
                });
            }
        };

        const renderTrainers = (trainers) => {
            const trainersGrid = document.getElementById('trainersGrid') || document.getElementById('trainersList');
            const countDisplay = document.getElementById('trainerCount');

            if (countDisplay) {
                countDisplay.innerText = trainers.length === allTrainers.length
                    ? `Showing all ${trainers.length} trainers`
                    : `Found ${trainers.length} trainer${trainers.length !== 1 ? 's' : ''}`;
            }

            if (trainers.length === 0) {
                trainersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;"><h3>No trainers match this specialization.</h3><p>Try a different filter.</p></div>';
                return;
            }

            trainersGrid.innerHTML = trainers.map(trainer => `
                <div class="trainer-card">
                    <div class="trainer-header"><div class="trainer-avatar">${trainer.fullname.charAt(0)}</div></div>
                    <div class="trainer-body">
                        <h3>${trainer.fullname}</h3>
                        <p class="specialization">${trainer.specialization || 'Fitness Coach'}</p>
                        <p class="trainer-bio">${trainer.bio || 'Dedicated to helping you achieve your fitness goals.'}</p>
                        <button class="btn btn-primary btn-block select-trainer-btn" data-id="${trainer.id}" data-name="${trainer.fullname}">Select Trainer</button>
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('.select-trainer-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.currentTarget; // Use currentTarget to ensure we get the button, not child elements
                    console.log('Select Trainer clicked. ID:', target.dataset.id, 'Name:', target.dataset.name);
                    openTrainerModal(target.dataset.id, target.dataset.name);
                });
            });
        };

        const openTrainerModal = (id, name) => {
            const modal = document.getElementById('selectionModal');
            if (!modal) return;
            document.getElementById('selectionTrainerName').innerText = name;
            modal.style.display = 'flex';
            document.getElementById('confirmSelectionBtn').onclick = async () => {
                const btn = document.getElementById('confirmSelectionBtn');
                btn.innerText = "Processing...";
                btn.disabled = true;

                try {
                    console.log('Sending assignment request for Trainer ID:', id);
                    const res = await fetchWithAuth('/api/member/assign-trainer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ trainerId: id })
                    });

                    console.log('Assignment response status:', res ? res.status : 'No response');

                    if (res) {
                        const data = await res.json();
                        console.log('Assignment response data:', data);

                        modal.style.display = 'none';

                        if (res.ok) {
                            if (data.status === 'PENDING') {
                                alert("Request Sent! \n\nSince you already have a trainer, your request to change has been sent to the Admin for approval. You will be notified once it is accepted.");
                            } else {
                                alert("Success! \n\n" + (data.message || "Trainer assigned successfully!"));
                                window.location.href = 'dashboard.html';
                            }
                        } else {
                            console.error('Assignment failed:', data.message);
                            alert(data.message || 'Failed to assign trainer');
                        }
                    } else {
                        console.error('No response from fetchWithAuth');
                        alert('Network error. Please try again.');
                    }
                } catch (err) {
                    console.error("Assignment execution error:", err);
                    alert("An error occurred: " + err.message);
                } finally {
                    btn.innerText = "CONFIRM SELECTION";
                    btn.disabled = false;
                }
            };
            document.getElementById('closeSelectionModal').onclick = () => modal.style.display = 'none';
        };

        initTrainersPage();
    }

    // Google Sign-In Logic
    function initGoogleSignIn() {
        if (typeof google === 'undefined') { setTimeout(initGoogleSignIn, 100); return; }
        google.accounts.id.initialize({
            client_id: "781049438972-aoa194va3hg5trisrnphgg6or4i92f4d.apps.googleusercontent.com",
            callback: handleGoogleSignIn
        });
        const googleBtn = document.getElementById('googleBtn');
        if (googleBtn) google.accounts.id.renderButton(googleBtn, { theme: "outline", size: "large", width: "100%" });
    };

    async function handleGoogleSignIn(response) {
        try {
            const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: response.credential })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            }
        } catch (err) { console.error(err); }
    };

    // --- Dashboard Initializers --- (Must be at the end to avoid TDZ for sub-functions)
    const renderUpdatesOverlay = (trainer, data) => {
        // Prevent duplicate overlays
        const existing = document.getElementById('updatesOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'rating-overlay-premium';
        overlay.id = 'updatesOverlay';

        const sessions = data.sessions || [];
        const now = new Date();

        // Categorize sessions
        const upcoming = sessions.filter(s => new Date(s.startTime) > now);
        const live = sessions.filter(s => new Date(s.startTime) <= now && new Date(s.endTime) >= now);
        const past = sessions.filter(s => new Date(s.endTime) < now);

        overlay.innerHTML = `
            <div class="rating-premium-card" style="max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; background: rgba(15, 15, 15, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1);">
                <button class="close-premium-overlay" onclick="const ov = this.closest('.rating-overlay-premium'); ov.classList.remove('active'); setTimeout(() => ov.remove(), 500)">
                    <i class="fas fa-times"></i>
                </button>
                
                <h2 style="margin: 0 0 10px 0; font-size: 2rem; color: #fff;">Trainer Updates</h2>
                <p style="color: var(--primary); font-weight: 800; margin-bottom: 30px; letter-spacing: 2px; text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);">TRAINER: ${trainer.fullname.toUpperCase()}</p>

                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; text-align: left;">
                    <!-- Left: Schedules & History -->
                    <div style="display: flex; flex-direction: column; gap: 30px;">
                        <!-- Current & Upcoming Sessions -->
                        <section>
                            <h3 style="font-size: 0.95rem; color: #fff; text-transform: uppercase; letter-spacing: 2.5px; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 20px; opacity: 0.9;">Live & Scheduled</h3>
                            <div style="display: flex; flex-direction: column; gap: 15px;">
                                ${live.length === 0 && upcoming.length === 0 ? '<p style="color: #666; font-size: 0.9rem; font-style: italic;">No sessions scheduled at this moment.</p>' : ''}
                                
                                ${live.map(s => {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const hasJoined = s.status === 'COMPLETED' || (s.joinedMemberIds && s.joinedMemberIds.includes(currentUser.id));
            return `
                                    <div style="background: rgba(255, 204, 0, 0.08); border: 1.5px solid var(--primary); padding: 18px; border-radius: 14px; box-shadow: 0 0 15px rgba(255, 204, 0, 0.1);">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                            <div>
                                                <span style="background: var(--primary); color: #000; font-size: 0.7rem; font-weight: 900; padding: 3px 10px; border-radius: 4px; vertical-align: middle; margin-right: 10px; letter-spacing: 0.5px;">LIVE NOW</span>
                                                <h4 style="margin: 0; color: #fff; display: inline-block; font-size: 1.1rem;">${s.notes || 'Training Session'}</h4>
                                            </div>
                                            ${hasJoined ?
                    `<span style="color: var(--primary); font-weight: 900; font-size: 0.8rem;"><i class="fas fa-check-circle"></i> JOINED</span>` :
                    `<button onclick="handleJoinSession(this, '${s.id}', '${s.meetingLink}')" class="btn btn-primary btn-sm" style="background: var(--primary); color: #000; font-weight: 900; border-radius: 8px; padding: 6px 15px;">JOIN NOW</button>`
                }
                                        </div>
                                        <p style="margin: 0; font-size: 0.85rem; color: #fff; font-weight: 500; opacity: 0.8;">${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                `;
        }).join('')}

                                ${upcoming.map(s => `
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 18px; border-radius: 14px;">
                                        <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 1.05rem;">${s.notes || 'Upcoming Training'}</h4>
                                        <p style="margin: 0; font-size: 0.85rem; color: #ddd;">${new Date(s.startTime).toLocaleDateString()}, ${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <button class="btn btn-outline btn-sm" disabled style="margin-top: 12px; font-size: 0.75rem; border-color: #444; color: #666; font-weight: 700;">JOIN LATER</button>
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- Session History -->
                        <section>
                            <h3 style="font-size: 0.95rem; color: #fff; text-transform: uppercase; letter-spacing: 2.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 20px; opacity: 0.9;">Session History</h3>
                            <div style="display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto; padding-right: 15px;">
                                ${past.length === 0 ? '<p style="color: #666; font-size: 0.9rem; font-style: italic;">Your session history will appear here.</p>' : ''}
                                ${past.map(s => {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const isJoined = s.status === 'COMPLETED' || (s.joinedMemberIds && s.joinedMemberIds.includes(currentUser.id));
            return `
                                        <div style="background: rgba(255,255,255,0.02); padding: 12px 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.02);">
                                            <div>
                                                <p style="margin: 0; font-size: 0.9rem; color: #fff; font-weight: 500;">${s.notes || 'Past Session'}</p>
                                                <small style="color: #888; font-weight: 600;">${new Date(s.startTime).toLocaleDateString()}</small>
                                            </div>
                                            <span style="font-size: 0.75rem; font-weight: 900; color: ${isJoined ? 'var(--primary)' : '#ff5555'}; text-transform: uppercase; letter-spacing: 1px;">
                                                <i class="fas ${isJoined ? 'fa-check-circle' : 'fa-times-circle'}" style="margin-right: 5px;"></i> ${isJoined ? 'Joined' : 'Missed'}
                                            </span>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </section>
                    </div>

                    <!-- Right: Direct Messages -->
                    <div style="background: rgba(255, 255, 255, 0.02); border-radius: 20px; padding: 25px; border: 1px solid rgba(255, 255, 255, 0.03);">
                        <h3 style="font-size: 0.95rem; color: #fff; text-transform: uppercase; letter-spacing: 2.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 25px; opacity: 0.9;"><i class="fas fa-comments" style="color: var(--primary); margin-right: 10px;"></i> Messages</h3>
                        <div style="display: flex; flex-direction: column; gap: 15px; max-height: 550px; overflow-y: auto; padding-right: 12px;">
                            ${data.messages.length === 0 ? `
                                <div style="text-align: center; padding: 60px 0;">
                                    <i class="fas fa-comment-slash" style="font-size: 2.5rem; color: #333; margin-bottom: 15px;"></i>
                                    <p style="color: #555; font-size: 0.95rem;">No messages from your trainer yet.</p>
                                </div>
                            ` : ''}
                            ${data.messages.map(m => `
                                <div style="background: rgba(255, 204, 0, 0.03); border: 1px solid rgba(255, 204, 0, 0.1); padding: 18px; border-radius: 15px; border-left: 4px solid var(--primary); box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                                    <p style="margin: 0; font-size: 1rem; line-height: 1.6; color: #fff; font-weight: 400;">${m.content}</p>
                                    <small style="color: #999; font-size: 0.75rem; margin-top: 12px; display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${new Date(m.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        // Trigger animation
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
    };

    window.handleJoinSession = async (btn, sessionId, link) => {
        const originalText = btn.innerText;
        btn.innerText = 'JOINING...';
        btn.disabled = true;

        try {
            const res = await fetchWithAuth(`/api/member/sessions/${sessionId}/join`, {
                method: 'POST'
            });

            if (res.ok) {
                window.open(link, '_blank');
                // Refresh data to show "Joined" in history
                location.reload();
            } else {
                const err = await res.text();
                alert(err || 'Could not join session. It might have ended or not started yet.');
                btn.innerText = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            console.error('Join error:', err);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };

    if (document.querySelector('.dashboard-page')) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'trainer') {
            // Already handled by trainer-dashboard.html's own script
            console.log('Trainer dashboard initialization handled by local script');
        } else {
            // Member Dashboard
            const initDashboard = async () => {
                const res = await fetchWithAuth('/api/member/profile');
                if (!res) return;
                const profile = await res.json();

                localStorage.setItem('user', JSON.stringify(profile));
                const welcomeMsg = document.getElementById('welcomeMessage');
                if (welcomeMsg) {
                    welcomeMsg.innerText = `Welcome Back, ${profile.fullname}!`;
                }

                // Populate Sidebar Profile
                const sidebarUser = document.getElementById('sidebarUsername');
                if (sidebarUser) sidebarUser.innerText = profile.fullname || '--';

                const sidebarEmail = document.getElementById('sidebarEmail');
                if (sidebarEmail) sidebarEmail.innerText = profile.email || '--';

                const sidebarAge = document.getElementById('sidebarAge');
                if (sidebarAge) sidebarAge.innerText = profile.age ? profile.age : '--';

                const sidebarGoal = document.getElementById('sidebarGoal');
                if (sidebarGoal) {
                    const goalsMap = {
                        'WEIGHT_LOSS': 'Weight Loss',
                        'MUSCLE_GAIN': 'Muscle Gain',
                        'MAINTENANCE': 'Maintenance',
                        'GENERAL_FITNESS': 'General Fitness'
                    };

                    let goalsList = [];
                    if (profile.fitnessGoals && Array.isArray(profile.fitnessGoals)) {
                        goalsList = profile.fitnessGoals.map(g => goalsMap[g] || g);
                    } else if (profile.primaryGoal) {
                        goalsList = [goalsMap[profile.primaryGoal] || profile.primaryGoal];
                    }

                    sidebarGoal.innerText = goalsList.length > 0 ? goalsList.join(', ') : '--';
                }

                initGoalsChecklist(profile.fullname);
                initHealthFeatures(profile);
                await renderDashboardData(profile);
                initActivityTracker();
                initWeightCheckIn(); // Initialize weight check-in widget
                initPlanEffectiveness();
                initGoalHistory(); // Initialize goal history
            };
            initDashboard();
        }
    }

    // --- Goal History & Reviews ---
    let currentGoalToReview = null;
    let selectedRating = 0;

    window.switchMemberGoalTab = (tab, btn) => {
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        const activeContent = document.getElementById('activeGoalTabContent');
        const historyContent = document.getElementById('historyGoalTabContent');

        if (activeContent) activeContent.style.display = tab === 'current' ? 'block' : 'none';
        if (historyContent) historyContent.style.display = tab === 'history' ? 'block' : 'none';

        if (tab === 'history') {
            initGoalHistory();
        }
    };

    const initGoalHistory = async () => {
        const historyList = document.getElementById('goalHistoryList');
        if (!historyList) return;

        try {
            const res = await fetchWithAuth('/api/member/goals/history');
            if (!res) return;
            const history = await res.json();

            if (!history || history.length === 0) {
                historyList.innerHTML = `
                    <div class="history-empty-state-lux">
                        <i class="fas fa-award"></i>
                        <h3>Your Legacy Starts Here</h3>
                        <p>Complete your first training plan to see your achievement history and earn your first review badge!</p>
                    </div>`;
                return;
            }

            // Group by startDate and endDate to represent a single "Plan"
            const groupedPlans = history.reduce((acc, goal) => {
                const key = `${goal.startDate}_${goal.endDate}`;
                if (!acc[key]) {
                    acc[key] = {
                        id: goal.id, // Using first goal ID as the primary reference for review
                        startDate: goal.startDate,
                        endDate: goal.endDate,
                        tasks: [],
                        planRating: goal.planRating,
                        planReview: goal.planReview,
                        allGoalIds: []
                    };
                }
                acc[key].tasks.push(goal.taskDescription);
                acc[key].allGoalIds.push(goal.id);
                // If any goal in the group has a rating, use it (handles partial updates)
                if (goal.planRating && !acc[key].planRating) acc[key].planRating = goal.planRating;
                if (goal.planReview && !acc[key].planReview) acc[key].planReview = goal.planReview;
                return acc;
            }, {});

            renderGoalHistory(Object.values(groupedPlans));
        } catch (err) {
            console.error('Error loading goal history:', err);
            historyList.innerHTML = '<p class="text-muted">Error loading history.</p>';
        }
    };

    const renderGoalHistory = (plans) => {
        const historyList = document.getElementById('goalHistoryList');
        if (!historyList) return;

        historyList.innerHTML = plans.map(plan => {
            let dateRangeText = "Custom Training Plan";
            if (plan.startDate && plan.endDate) {
                const start = new Date(plan.startDate).toLocaleDateString();
                const end = new Date(plan.endDate).toLocaleDateString();
                dateRangeText = `${start} - ${end}`;
            }
            const ratingHtml = plan.planRating ?
                `<div class="goal-rating" style="color: #f39c12; font-size: 1.2rem; filter: drop-shadow(0 0 5px rgba(243, 156, 18, 0.2));">
                    ${'★'.repeat(plan.planRating)}${'☆'.repeat(5 - plan.planRating)}
                </div>` :
                `<button class="btn btn-primary btn-sm" onclick="openReviewModal('${plan.id}')" style="padding: 8px 20px; font-size: 0.85rem; border-radius: 50px;">Review Plan</button>`;

            const taskListHtml = plan.tasks.map(t => `
                <div class="task-item-lux">
                    <i class="fas fa-check-double"></i>
                    <span style="color: #000; font-size: 1.1rem; font-weight: 500;">${t}</span>
                </div>`).join('');

            return `
                <div class="premium-history-card">
                    <button class="delete-plan-btn" onclick="deleteHistoryPlan('${plan.allGoalIds.join(',')}')" title="Delete from History">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 15px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <h4 style="margin: 0; font-size: 1.5rem; color: #000;">Training Plan Success</h4>
                                <div class="plan-success-badge">
                                    <i class="fas fa-trophy"></i> Success
                                </div>
                            </div>
                            <p style="margin: 8px 0 0; font-size: 1rem; font-weight: 600; color: #000;">
                                <i class="far fa-calendar-alt" style="margin-right: 5px;"></i> ${dateRangeText}
                            </p>
                        </div>
                        <div style="text-align: right; padding-right: 45px;">
                             ${ratingHtml}
                        </div>
                    </div>
                    
                    <div style="margin: 20px 0;">
                        <p style="font-size: 0.9rem; text-transform: uppercase; color: #000; letter-spacing: 1.5px; margin-bottom: 15px; font-weight: 800; opacity: 1;">Included Modules</p>
                        <div class="task-grid-lux">
                            ${taskListHtml}
                        </div>
                    </div>

                    ${plan.planReview ? `
                        <div class="review-quote-block">
                            <p style="font-size: 0.9rem; color: #000; text-transform: uppercase; margin-bottom: 8px; font-weight: 800; opacity: 1; letter-spacing: 1px;">Member Feedback</p>
                            <p style="color: #000; font-size: 1.1rem; font-style: italic;">"${plan.planReview}"</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    };

    window.openReviewModal = (goalId) => {
        currentGoalToReview = goalId;
        selectedRating = 0;
        const reviewTextEl = document.getElementById('planReviewText');
        if (reviewTextEl) reviewTextEl.value = '';
        updateStars(0);
        const modal = document.getElementById('reviewModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeReviewModal = () => {
        const modal = document.getElementById('reviewModal');
        if (modal) modal.style.display = 'none';
        currentGoalToReview = null;
    };

    const updateStars = (rating) => {
        const stars = document.querySelectorAll('.star-btn');
        stars.forEach(star => {
            const r = parseInt(star.dataset.rating);
            if (r <= rating) {
                star.classList.replace('far', 'fas');
            } else {
                star.classList.replace('fas', 'far');
            }
        });
    };

    // Add star click listeners
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = parseInt(btn.dataset.rating);
            updateStars(selectedRating);
        });
    });

    document.getElementById('submitReviewBtn')?.addEventListener('click', async () => {
        const review = document.getElementById('planReviewText').value;
        if (selectedRating === 0) {
            showToast('Please select a rating', 'warning');
            return;
        }

        try {
            const res = await fetchWithAuth(`/api/member/goals/${currentGoalToReview}/review`, {
                method: 'POST',
                body: JSON.stringify({ rating: selectedRating, review: review })
            });

            if (res && res.ok) {
                showToast('Review submitted! Thank you.', 'success');
                closeReviewModal();
                initGoalHistory(); // Refresh list
            } else {
                showToast('Failed to submit review', 'error');
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            showToast('Error submitting review', 'error');
        }
    });

    // Expose functions to window for access from HTML inline scripts
    window.initGoalCalendar = initGoalCalendar;
    window.initGoalProgressTracking = initGoalProgressTracking;
    window.initGoalsChecklist = initGoalsChecklist;
    window.initWeightCheckIn = initWeightCheckIn;
    window.initPlanEffectiveness = initPlanEffectiveness;
    window.initGoalHistory = initGoalHistory;
    window.fetchWithAuth = fetchWithAuth;

    window.openReviewModal = openReviewModal;
    window.closeReviewModal = closeReviewModal;

    const syncGoalCheckboxes = (goalId, isChecked) => {
        const allCheckboxes = document.querySelectorAll(`input[data-goal-id="${goalId}"]`);
        allCheckboxes.forEach(cb => {
            cb.checked = isChecked;
        });
    };
    window.syncGoalCheckboxes = syncGoalCheckboxes;

    window.deleteHistoryPlan = async (goalIdsString) => {
        if (!confirm('Are you sure you want to delete this plan and all associated records from your history? This action cannot be undone.')) {
            return;
        }

        const goalIds = goalIdsString.split(',');
        try {
            const res = await fetch(`${API_BASE_URL}/api/goals/bulk-delete`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(goalIds)
            });

            if (res.ok) {
                showToast('Plan deleted from history successfully', 'success');
                initGoalHistory(); // Refresh the list
            } else {
                showToast('Failed to delete plan', 'error');
            }
        } catch (err) {
            console.error('Error deleting plan:', err);
            showToast('An error occurred during deletion', 'error');
        }
    };
});

