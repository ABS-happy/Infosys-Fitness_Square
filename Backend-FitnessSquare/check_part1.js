document.addEventListener('DOMContentLoaded', () => {
    // Check for file:// protocol
    if (window.location.protocol === 'file:') {
        console.error(">>> CRITICAL: Application is running on file:// protocol.");
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:white;text-align:center;padding:10px;z-index:9999;font-weight:bold;';
        warningDiv.innerHTML = 'âš ï¸ ERROR: You opened the HTML file directly. Please visit <a href="http://localhost:5000" style="color:yellow;">http://localhost:5000</a> instead!';
        document.body.prepend(warningDiv);
    }


    const API_BASE_URL = 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const header = document.getElementById('header');
    let quickChartInstance = null;
    let currentActivityFilter = 'daily';

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
            // Return response object even if status is not 200, so caller can handle errors
            return res;
        } catch (err) {
            console.error("Fetch error:", err);
            return null; // Network error
        }
    };

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
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
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

        // âœ… REGISTER PAGE ROLE-BASED UI TOGGLE
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


        const fetchProfile = async () => {
            // Use correct endpoint implemented in MemberController
            const res = await fetchWithAuth('/api/member/profile');
            return res ? res.json() : null;
        };

        // Defined below
        const initDashboard = async () => {
            const profile = await fetchProfile();
            if (!profile) return;

            localStorage.setItem('user', JSON.stringify(profile));
            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) {
                welcomeMsg.innerText = `Welcome Back, ${profile.fullname}!`;
            }

            initGoalsChecklist(profile.fullname);
            initHealthFeatures(profile);
            initGoalsChecklist(profile.fullname);
            initHealthFeatures(profile);
            // initGoalProgressTracking(profile); // Removed, now called inside initGoalsChecklist to share planDates
            await renderDashboardData(profile);
            initActivityTracker(profile);
        };

        const initTrainerDashboard = async () => {
            // Stats loaded via HTML script or renderDashboardData equivalent
            console.log('Trainer dashboard detected');
        };

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

            const currentStreak = document.getElementById('currentStreak');
            if (currentStreak) {
                currentStreak.innerText = data.currentStreak || 0;
                console.log(`Setting currentStreak to: ${data.currentStreak}`);
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
                renderDashboardData(profile, picker.value);
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
            calE.innerText = Math.round(act?.caloriesBurned || 0);
            waterE.innerText = (act?.waterLiters || 0).toFixed(1);
            sleepE.innerText = (act?.sleepHours || 0).toFixed(1);

            calT.innerText = `Target: ${Math.round(targets.calories)}`;
            waterT.innerText = `Target: ${targets.water.toFixed(1)}L`;
            sleepT.innerText = `Target: ${targets.sleep.toFixed(1)}h`;
        } else {
            const s = data.stats;
            let multiplier = 1;
            if (data.range) {
                const start = new Date(data.range.start);
                const end = new Date(data.range.end);
                multiplier = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }

            calE.innerText = Math.round(s.totalCalories);
            waterE.innerText = s.totalWater.toFixed(1);
            sleepE.innerText = s.averageSleep.toFixed(1);

            calT.innerText = `Total Target: ${Math.round(targets.calories * multiplier)}`;
            waterT.innerText = `Total Target: ${(targets.water * multiplier).toFixed(1)}L`;
            sleepT.innerText = `Avg Target: ${targets.sleep.toFixed(1)}h`;
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
                        backgroundColor: primaryColor,
                        borderRadius: 4,
                        barPercentage: type === 'daily' ? 0.7 : 0.9,
                        categoryPercentage: type === 'daily' ? 0.4 : 0.8,
                        maxBarThickness: type === 'daily' ? 60 : 30
                    },
                    {
                        label: 'Water',
                        data: waterCapped,
                        backgroundColor: primaryColor,
                        borderRadius: 4,
                        barPercentage: type === 'daily' ? 0.7 : 0.9,
                        categoryPercentage: type === 'daily' ? 0.4 : 0.8,
                        maxBarThickness: type === 'daily' ? 60 : 30
                    },
                    {
                        label: 'Sleep',
                        data: sleepCapped,
                        backgroundColor: primaryColor,
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
                        display: type !== 'daily', // Show legend in multi-day views
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
                                    <span style="color: var(--primary); font-size: 1.2rem; line-height: 1;">â€¢</span>
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

        // Health Features (Health Tip & BMI)
        const initHealthFeatures = async (user) => {
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
                container.style.zIndex = '9999';
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



        // --- Dynamic Goals & Checklist Logic (API-Driven) ---
        const initGoalProgressTracking = async (user, planDates) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/goals/progress-summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    // data = { weightProgress: 0.0, exerciseAdherence: 0.0, habitScore: 0.0, exerciseText: "..." }

                    updateProgressBar('weightProgressBar', 'weightPctText', data.weightProgress);
                    updateProgressBar('exerciseProgressBar', 'exercisePctText', data.exerciseAdherence);
                    updateProgressBar('habitProgressBar', 'habitPctText', data.habitScore);

                    const exText = document.getElementById('exerciseCountText');
                    if (exText && data.exerciseText) exText.innerText = data.exerciseText;

                    // Update Plan Dates if passed
                    const planDatesEl = document.getElementById('planDatesText');
                    if (planDatesEl && planDates) {
                        planDatesEl.innerText = planDates;
                    } else if (planDatesEl) {
                        planDatesEl.innerText = 'No active plan';
                    }
                }
            } catch (err) {
                console.error("Error fetching goal progress:", err);
            }
        };

});
