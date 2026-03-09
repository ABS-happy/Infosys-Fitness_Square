const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:5000';
const MOD_API = `${BASE_URL}/api`;

document.addEventListener('DOMContentLoaded', () => {
    fetchPendingPosts();
});

async function fetchPendingPosts() {
    const tbody = document.getElementById('pendingPostsTable');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${MOD_API}/blog/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const posts = await response.json();
        renderTable(posts, tbody);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error loading posts: ${error.message}</td></tr>`;
    }
}

function renderTable(posts, tbody) {
    if (posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No pending posts.</td></tr>';
        return;
    }

    tbody.innerHTML = posts.map(post => {
        let statusHtml = '';
        if (post.status === 'FLAGGED_AUTO') {
            statusHtml = `<span class="status-badge" style="background: rgba(244, 67, 54, 0.15); color: #C62828;"><i class="fas fa-robot"></i> AUTO-FLAGGED</span>`;
        } else {
            statusHtml = `<span class="status-badge status-pending">${post.status}</span>`;
        }

        return `
            <tr>
                <td>${post.title}</td>
                <td>${post.authorName} <span class="author-role ${post.authorRole ? post.authorRole.toLowerCase() : ''}" style="font-size:0.7em;">${post.authorRole}</span></td>
                <td>${new Date(post.createdAt).toLocaleDateString()}</td>
                <td>${statusHtml}</td>
                <td style="text-align:center; font-weight:bold; color: ${post.reportCount > 0 ? '#ff9800' : 'inherit'}">${post.reportCount || 0}</td>
                <td>
                    <button class="action-btn btn-view" onclick="previewPost('${post.id}')">View</button>
                    <button class="action-btn btn-approve" onclick="updateStatus('${post.id}', 'PUBLISHED')">Approve</button>
                    <button class="action-btn btn-reject" onclick="updateStatus('${post.id}', 'REJECTED')">Reject</button>
                    <button class="action-btn" style="background: #d32f2f; color: white;" onclick="deletePost('${post.id}')"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    // Store posts for preview
    window.pendingPosts = posts;
}

async function deletePost(id, isFromReports = false) {
    if (!isFromReports && !confirm('Are you absolutely sure you want to permanently delete this post? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${MOD_API}/blog/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            if (isFromReports) fetchReports();
            else fetchPendingPosts(); // Refresh list
        } else {
            const err = await response.text();
            alert('Delete failed: ' + err);
        }
    } catch (e) {
        alert('Action failed');
    }
}

function previewPost(id) {
    const post = window.pendingPosts.find(p => p.id === id);
    if (!post) return;

    document.getElementById('previewTitle').innerText = post.title;
    document.getElementById('previewAuthor').innerText = `By ${post.authorName}`;
    document.getElementById('previewContent').innerText = post.content;

    const img = document.getElementById('previewImage');
    if (post.imageUrl) {
        img.src = post.imageUrl;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }

    document.getElementById('previewModal').style.display = 'flex';
}

async function updateStatus(id, status) {
    if (!confirm(`Are you sure you want to mark this post as ${status}?`)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${MOD_API}/blog/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            fetchPendingPosts(); // Refresh
            document.getElementById('previewModal').style.display = 'none';
        }
    } catch (e) {
        alert('Action failed');
    }
}

// --- Tabs and Reports Logic ---

function switchModTab(tabName) {
    document.getElementById('tabPending').classList.remove('active');
    document.getElementById('tabReports').classList.remove('active');
    if (document.getElementById('tabHistory')) document.getElementById('tabHistory').classList.remove('active');

    document.getElementById('tabPending').style.borderBottom = "none";
    document.getElementById('tabPending').style.color = "grey";
    document.getElementById('tabReports').style.borderBottom = "none";
    document.getElementById('tabReports').style.color = "grey";
    if (document.getElementById('tabHistory')) {
        document.getElementById('tabHistory').style.borderBottom = "none";
        document.getElementById('tabHistory').style.color = "grey";
    }

    document.getElementById('pendingPostsContainer').style.display = 'none';
    document.getElementById('reportedContentContainer').style.display = 'none';
    if (document.getElementById('historyContainer')) {
        document.getElementById('historyContainer').style.display = 'none';
    }

    if (tabName === 'pending') {
        document.getElementById('tabPending').classList.add('active');
        document.getElementById('tabPending').style.borderBottom = "3px solid var(--blog-secondary)";
        document.getElementById('tabPending').style.color = "white";
        document.getElementById('pendingPostsContainer').style.display = 'block';
        fetchPendingPosts();
    } else if (tabName === 'reports') {
        document.getElementById('tabReports').classList.add('active');
        document.getElementById('tabReports').style.borderBottom = "3px solid var(--blog-secondary)";
        document.getElementById('tabReports').style.color = "white";
        document.getElementById('reportedContentContainer').style.display = 'block';
        fetchReports();
    } else if (tabName === 'history') {
        document.getElementById('tabHistory').classList.add('active');
        document.getElementById('tabHistory').style.borderBottom = "3px solid var(--blog-secondary)";
        document.getElementById('tabHistory').style.color = "white";
        document.getElementById('historyContainer').style.display = 'block';
        fetchHistory();
    }
}

async function fetchReports() {
    const tbody = document.getElementById('reportsTable');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${MOD_API}/blog/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const reports = await response.json();
        renderReportsTable(reports, tbody);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Error loading reports: ${error.message}</td></tr>`;
    }
}

function renderReportsTable(reports, tbody) {
    if (reports.length === 0) {
        // Now there are 5 columns
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No reports currently.</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(report => {
        const isPost = report.targetType === 'POST';
        const typeBadge = isPost
            ? '<span class="status-badge" style="background: rgba(33, 150, 243, 0.15); color: #1976D2;">POST</span>'
            : '<span class="status-badge" style="background: rgba(156, 39, 176, 0.15); color: #7B1FA2;">COMMENT</span>';

        // Link to the post details page using either the targetId directly (if it's a post) 
        // or assuming we might need a way to link to comment later. For now, post-details.html takes a post ID.
        // If it's a comment report, we sadly don't know the exact post ID from this object alone unless we load it,
        // but we can at least show the comment ID.

        return `
        <tr>
            <td>
                <div style="font-weight: 600; color: #fff;">${typeBadge} ${report.targetAuthorName || 'Unknown Author'}</div>
                <div style="font-size: 0.85rem; color: #aaa; margin-top: 5px; font-style: italic;">
                    "${report.targetContentSnippet ? report.targetContentSnippet : 'Content unavailable'}"
                </div>
                <div style="font-family: monospace; color: #555; font-size: 0.75rem; margin-top: 5px;">ID: ${report.targetId}</div>
            </td>
            <td style="font-weight: 600; color: #ff5252;">${report.reason}</td>
            <td>
                <div>${report.reporterName || 'Unknown User'}</div>
                <div style="font-size: 0.8rem; color: #888;">${report.reporterEmail || ''}</div>
            </td>
            <td>${new Date(report.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
            <td>
                ${isPost ? `<a href="post-details.html?id=${report.targetId}" target="_blank" class="action-btn btn-view" style="text-decoration: none; padding: 5px 10px; font-size: 0.9rem;">View Post</a>` : '<span style="color:#888; font-size: 0.8rem;">(Comment View NYI)</span>'}
                <button class="action-btn" style="background: #d32f2f; color: white; padding: 5px 10px; font-size: 0.9rem; margin-left: 5px;" onclick="deleteReportedItem('${report.targetId}', '${report.targetType}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `}).join('');
}

async function deleteReportedItem(targetId, targetType) {
    const typeLabel = targetType === 'POST' ? 'post' : 'comment';
    if (!confirm(`Are you absolutely sure you want to permanently delete this ${typeLabel}? This action cannot be undone and will also clear all related reports.`)) return;

    if (targetType === 'POST') {
        await deletePost(targetId, true); // Pass true to indicate it's from reports tab
    } else {
        await deleteComment(targetId);
    }
}

async function deleteComment(id) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${MOD_API}/blog/comments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            fetchReports(); // Refresh reports list
        } else {
            const err = await response.text();
            alert('Delete failed: ' + err);
        }
    } catch (e) {
        alert('Action failed');
    }
}

async function fetchHistory() {
    const tbody = document.getElementById('historyTable');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${MOD_API}/blog/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const history = await response.json();
        renderHistoryTable(history, tbody);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error loading history: ${error.message}</td></tr>`;
    }
}

function renderHistoryTable(history, tbody) {
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No moderation history available.</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(item => {
        let actionColor = '#9e9e9e'; // default grey
        let actionIcon = 'fas fa-info-circle';
        if (item.actionType.includes('APPROVED') || item.actionType.includes('PUBLISHED')) {
            actionColor = '#4caf50';
            actionIcon = 'fas fa-check-circle';
        } else if (item.actionType.includes('REJECTED')) {
            actionColor = '#f44336';
            actionIcon = 'fas fa-times-circle';
        } else if (item.actionType.includes('DELETED')) {
            actionColor = '#d32f2f';
            actionIcon = 'fas fa-trash-alt';
        }

        const actionBadge = `<span class="status-badge" style="background: ${actionColor}20; color: ${actionColor}; border: 1px solid ${actionColor}50;">
            <i class="${actionIcon}"></i> ${item.actionType.replace('POST_', '').replace('COMMENT_', '').replace('_', ' ')}
        </span>`;

        const typeBadge = item.targetType === 'POST' ?
            '<span class="status-badge" style="background: rgba(33, 150, 243, 0.15); color: #1976D2;">POST</span>' :
            '<span class="status-badge" style="background: rgba(156, 39, 176, 0.15); color: #7B1FA2;">COMMENT</span>';

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: #fff;">${item.moderatorName || 'Unknown'}</div>
                    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">${item.moderatorRole || ''}</div>
                </td>
                <td>${actionBadge}</td>
                <td style="white-space: nowrap;">${new Date(item.timestamp).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                    <div style="font-weight: 600; margin-bottom: 4px;">${typeBadge} <span style="font-family: monospace; color: #888; font-size: 0.75rem; font-weight: normal; margin-left: 5px;">ID: ${item.targetId || 'N/A'}</span></div>
                    <div style="font-size: 0.85rem; color: #ccc; font-style: italic; line-height: 1.4; word-break: break-word; white-space: normal; background-color: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
                        ${item.targetSnippet || 'No details available'}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
