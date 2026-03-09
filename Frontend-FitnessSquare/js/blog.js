const API_BASE_URL = 'http://localhost:5000/api';
let userSavedPostIds = []; // Track saved posts for UI
let currentLoadedPosts = []; // Track currently loaded posts for tag filtering

async function fetchUserSavedPosts() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE_URL}/blog/saved`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const savedPosts = await response.json();
            userSavedPostIds = savedPosts.map(p => p.id);
        }
    } catch (e) {
        console.error("Failed to load saved posts list", e);
    }
}

// --- Blog Feed Logic ---

async function fetchPublishedPosts() {
    const container = document.getElementById('blogGrid');
    if (!container) return; // Probably not on blog.html

    if (userSavedPostIds.length === 0) {
        await fetchUserSavedPosts();
    }
    try {
        const response = await fetch(`${API_BASE_URL}/blog/published`);
        if (!response.ok) throw new Error('Failed to fetch posts');

        const posts = await response.json();
        currentLoadedPosts = posts;
        renderPosts(posts, container);
    } catch (error) {
        container.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
    }
}

async function fetchMyPosts() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE_URL}/blog/my-posts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch your posts');

        const posts = await response.json();
        currentLoadedPosts = posts;
        renderPosts(posts, grid);
    } catch (error) {
        grid.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
    }
}

function renderPosts(posts, container) {
    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No posts found.</p>';
        return;
    }

    // Get current user ID to check if they liked a post
    const userStr = localStorage.getItem('user');
    let currentUserId = null;
    if (userStr) {
        try {
            currentUserId = JSON.parse(userStr).id;
        } catch (e) {
            console.error("Error parsing user data");
        }
    }

    container.innerHTML = posts.map(post => {
        const hasLiked = currentUserId && post.likes && post.likes.includes(currentUserId);
        const heartClass = hasLiked ? 'fas fa-heart liked-heart' : 'far fa-heart';
        const likeCount = post.likes ? post.likes.length : 0;

        const isSaved = userSavedPostIds.includes(post.id);
        const saveClass = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';

        return `
        <div class="blog-card" data-post-id="${post.id}">
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}" class="blog-image">` : ''}
            <div class="blog-content">
                <div class="blog-meta">
                    <span class="author-role ${post.authorRole ? post.authorRole.toLowerCase() : ''}">${post.authorName}</span>
                    <span>${new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 class="blog-card-title"><a href="post-details.html?id=${post.id}" style="color: inherit; text-decoration: none;">${post.title}</a></h3>
                <p class="blog-snippet" style="white-space: pre-wrap;">${post.content.length > 150 ? post.content.substring(0, 150) + `... <a href="post-details.html?id=${post.id}" style="color: var(--blog-secondary); font-weight: bold; text-decoration: none;">Read more</a>` : post.content}</p>
                
                <div class="instagram-action-bar" style="display: flex; gap: 20px; font-size: 1.5rem; margin-bottom: 10px; align-items: center; position: relative;">
                    <i class="${heartClass} like-icon" onclick="handleFeedLike('${post.id}', this)" style="cursor: pointer; transition: transform 0.2s;" title="Like"></i>
                    <a href="post-details.html?id=${post.id}&view=comments" style="color: var(--text-color);" title="View Comments"><i class="far fa-comment"></i></a>
                    <i class="${saveClass}" onclick="toggleSavePost('${post.id}', this)" style="cursor: pointer; color: var(--text-color); transition: color 0.2s;" title="Save Post"></i>
                    
                    <div style="margin-left: auto; position: relative;" class="post-options-menu">
                        <i class="fas fa-ellipsis-v" onclick="toggleOptionsMenu(event, '${post.id}')" style="cursor: pointer; color: #ccc; padding: 5px;"></i>
                        <div id="optionsDropdown-${post.id}" style="display: none; position: absolute; right: 0; bottom: 30px; background: #222; border: 1px solid #444; border-radius: 8px; z-index: 10; font-size: 1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5); min-width: 150px; overflow: hidden; text-align: left;">
                            <div onclick="downloadPost('${post.id}')" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-download" style="margin-right: 10px; width: 16px; text-align: center;"></i> Download</div>
                            ${currentUserId === post.authorId ?
                `<div onclick="toggleArchivePost('${post.id}', ${!post.archived})" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-archive" style="margin-right: 10px; width: 16px; text-align: center;"></i> ${post.archived ? 'Unarchive' : 'Archive'}</div>
                 <div onclick="handleDeletePost('${post.id}')" style="padding: 12px 15px; cursor: pointer; color: #ff4d4d; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-trash-alt" style="margin-right: 10px; width: 16px; text-align: center;"></i> Delete</div>`
                :
                `<div onclick="openReportModal(event, '${post.id}', 'POST')" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-flag" style="margin-right: 10px; color: #ffa502; width: 16px; text-align: center;"></i> Report</div>`
            }
                        </div>
                    </div>
                </div>
                <div style="font-weight: 700; margin-bottom: 10px;" class="like-count-display">${likeCount} likes</div>
            </div>
        </div>
        `;
    }).join('');
}

function toggleOptionsMenu(event, postId) {
    event.stopPropagation();
    event.preventDefault();
    const dropdown = document.getElementById(`optionsDropdown-${postId}`);
    const isVisible = dropdown.style.display === 'block';

    // Hide all other dropdowns
    document.querySelectorAll('[id^="optionsDropdown-"]').forEach(el => {
        el.style.display = 'none';
    });

    if (!isVisible) {
        dropdown.style.display = 'block';
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="optionsDropdown-"]').forEach(el => {
        el.style.display = 'none';
    });
});

// Temporary like handler for feed to mimic Instagram
async function handleFeedLike(postId, iconElement) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to like posts');

    // Optimistic UI update
    const isLiked = iconElement.classList.contains('fas');
    const likeCountDisplay = iconElement.closest('.blog-content').querySelector('.like-count-display');
    let currentCount = parseInt(likeCountDisplay.textContent.split(' ')[0]) || 0;

    iconElement.style.transform = 'scale(1.2)';
    setTimeout(() => iconElement.style.transform = 'scale(1)', 200);

    if (isLiked) {
        iconElement.className = 'far fa-heart like-icon';
        iconElement.style.color = '';
        currentCount = Math.max(0, currentCount - 1);
    } else {
        iconElement.className = 'fas fa-heart like-icon liked-heart';
        currentCount += 1;
    }
    likeCountDisplay.textContent = `${currentCount} likes`;

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/like`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to update like status');

        // Ensure accurate count from server
        const updatedPost = await response.json();
        likeCountDisplay.textContent = `${updatedPost.likes.length} likes`;
    } catch (e) {
        console.error(e);
        alert('Action failed, reverting.');
        // If fail, we should ideally revert the optimistic update, but keep simple for now
    }
}

async function toggleSavePost(postId, iconElement) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to save posts');

    const isSaved = iconElement.classList.contains('fas');
    iconElement.style.transform = 'scale(1.2)';
    setTimeout(() => iconElement.style.transform = 'scale(1)', 200);

    if (isSaved) {
        iconElement.className = 'far fa-bookmark';
        userSavedPostIds = userSavedPostIds.filter(id => id !== postId);
    } else {
        iconElement.className = 'fas fa-bookmark';
        userSavedPostIds.push(postId);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/save`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to toggle save');
    } catch (e) {
        console.error(e);
        alert('Action failed.');
    }
}

async function toggleArchivePost(postId, archiveStatus) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to archive posts');

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/archive`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ archive: archiveStatus })
        });
        if (response.ok) {
            alert(`Post successfully ${archiveStatus ? 'archived' : 'unarchived'}`);
            // Re-render feed depending on active tab
            const tabMyPosts = document.getElementById('tabMyPosts');
            const activityFilter = document.getElementById('activityFilter');
            if (tabMyPosts && tabMyPosts.classList.contains('active')) {
                if (activityFilter.value === 'archived') {
                    fetchFilteredPosts('archived');
                } else {
                    fetchMyPosts();
                }
            } else {
                fetchPublishedPosts();
            }
        } else {
            const err = await response.text();
            alert(err || 'Failed to archive post');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred.');
    }
}

async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Post deleted successfully');
            const postElement = document.querySelector(`.blog-card[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
            } else {
                window.location.href = 'blog.html';
            }
        } else {
            const err = await response.text();
            alert(err || 'Failed to delete post');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred while deleting the post');
    }
}

// --- Create Post Logic ---

async function handleCreatePost(e) {
    e.preventDefault();

    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const tagsInput = document.getElementById('postTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

    // File Handling
    const imageInput = document.getElementById('postImage');
    const imageFile = imageInput.files[0];

    const token = localStorage.getItem('token');
    const statusMsg = document.getElementById('submissionStatus');
    statusMsg.style.display = 'block';
    statusMsg.textContent = 'Submitting...';
    statusMsg.style.color = '#ccc';

    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        // formData can handle arrays, but Spring might expect comma-separated string or multiple params
        // Let's send as multiple params
        tags.forEach(tag => formData.append('tags', tag));

        if (imageFile) {
            formData.append('image', imageFile);
        }

        const response = await fetch(`${API_BASE_URL}/blog/create`, {
            method: 'POST',
            headers: {
                // 'Content-Type': 'multipart/form-data', // Do NOT set this manually, browser sets it with boundary
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Failed to create post');
        }

        const result = await response.json();

        statusMsg.textContent = 'Post submitted successfully! Waiting for moderation.';
        statusMsg.style.color = '#2dfe54';

        setTimeout(() => {
            window.location.href = 'blog.html';
        }, 2000);

    } catch (error) {
        statusMsg.textContent = 'Error: ' + error.message;
        statusMsg.style.color = '#ff4757';
    }
}

// Global download post function
async function downloadPost(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}`);
        if (!response.ok) throw new Error('Fetching post for download failed');
        const post = await response.json();

        if (!post.imageUrl) {
            alert('This post does not contain any image to download.');
            return;
        }

        // Fetch the image specifically
        const imgResponse = await fetch(post.imageUrl);
        if (!imgResponse.ok) throw new Error('Failed to fetch image data');

        const blob = await imgResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Try to extract extension or default to jpg
        const ext = post.imageUrl.split('.').pop() || 'jpg';
        a.download = `FitnessSquare_Image_${post.id}.${ext}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert('Could not download image.');
    }
}

// --- Post Details Logic ---

async function loadPostDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (!postId) return;

    if (userSavedPostIds.length === 0) {
        await fetchUserSavedPosts();
    }

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}`);
        if (!response.ok) throw new Error('Post not found');

        const post = await response.json();
        renderPostDetail(post);
        loadComments(postId); // Load comments separately
    } catch (error) {
        document.body.innerHTML = `<h1 style="color:white; text-align:center; margin-top:50px;">${error.message}</h1>`;
    }
}

function renderPostDetail(post) {
    const urlParams = new URLSearchParams(window.location.search);
    const viewOnlyComments = urlParams.get('view') === 'comments';

    document.getElementById('postDetailTitle').textContent = post.title;
    document.getElementById('postAuthor').textContent = post.authorName;
    document.getElementById('postDate').textContent = new Date(post.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (viewOnlyComments) {
        document.getElementById('postBody').style.display = 'none';
        const img = document.getElementById('postDetailImage');
        if (img) img.style.display = 'none';
    } else {
        document.getElementById('postBody').style.display = 'block';
        document.getElementById('postBody').innerText = post.content;
        if (post.imageUrl) {
            const img = document.getElementById('postDetailImage');
            img.src = post.imageUrl;
            img.style.display = 'block';
        }
    }

    // Instagram Like Button Logic
    const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;
    const hasLiked = currentUserId && post.likes && post.likes.includes(currentUserId);

    const likeIcon = document.getElementById('detailLikeIcon');
    const likeCountDisplay = document.getElementById('detailLikeCountDisplay');

    if (likeIcon) {
        likeIcon.className = hasLiked ? 'fas fa-heart like-icon liked-heart' : 'far fa-heart like-icon';
        likeIcon.onclick = () => handleDetailLike(post.id, likeIcon, likeCountDisplay);
    }

    if (likeCountDisplay) {
        likeCountDisplay.textContent = `${post.likes ? post.likes.length : 0} likes`;
    }

    // Save Button Logic
    const saveIcon = document.getElementById('detailSaveIcon');
    if (saveIcon) {
        // Quick check if saved (we should ideally ensure userSavedPostIds is loaded here too, or just check)
        const isSaved = userSavedPostIds.includes(post.id);
        saveIcon.className = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
        saveIcon.onclick = () => toggleSavePost(post.id, saveIcon);
    }

    // Update options menu
    const optionsContainer = document.getElementById('detailOptionsMenuContainer');
    if (optionsContainer) {
        optionsContainer.innerHTML = `
            <div class="post-options-menu">
                <i class="fas fa-ellipsis-v" onclick="toggleOptionsMenu(event, 'detail-${post.id}')" style="cursor: pointer; color: #ccc; padding: 5px; font-size: 1.5rem;"></i>
                <div id="optionsDropdown-detail-${post.id}" style="display: none; position: absolute; right: 0; bottom: 30px; background: #222; border: 1px solid #444; border-radius: 8px; z-index: 10; font-size: 1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5); min-width: 150px; overflow: hidden; text-align: left;">
                    <div onclick="downloadPost('${post.id}')" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-download" style="margin-right: 10px; width: 16px; text-align: center;"></i> Download</div>
                    ${currentUserId === post.authorId ?
                `<div onclick="toggleArchivePost('${post.id}', ${!post.archived})" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-archive" style="margin-right: 10px; width: 16px; text-align: center;"></i> ${post.archived ? 'Unarchive' : 'Archive'}</div>
                 <div onclick="handleDeletePost('${post.id}')" style="padding: 12px 15px; cursor: pointer; color: #ff4d4d; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-trash-alt" style="margin-right: 10px; width: 16px; text-align: center;"></i> Delete</div>`
                :
                `<div onclick="openReportModal(event, '${post.id}', 'POST')" style="padding: 12px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-flag" style="margin-right: 10px; color: #ffa502; width: 16px; text-align: center;"></i> Report</div>`
            }
                </div>
            </div>
        `;
    }
}

async function handleDetailLike(postId, iconElement, countDisplay) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to like posts');

    // Optimistic UI update
    const isLiked = iconElement.classList.contains('fas');
    let currentCount = parseInt(countDisplay.textContent.split(' ')[0]) || 0;

    iconElement.style.transform = 'scale(1.2)';
    setTimeout(() => iconElement.style.transform = 'scale(1)', 200);

    if (isLiked) {
        iconElement.className = 'far fa-heart like-icon';
        currentCount = Math.max(0, currentCount - 1);
    } else {
        iconElement.className = 'fas fa-heart like-icon liked-heart';
        currentCount += 1;
    }
    countDisplay.textContent = `${currentCount} likes`;

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/like`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const updatedPost = await response.json();
            countDisplay.textContent = `${updatedPost.likes.length} likes`;
        }
    } catch (e) { console.error(e); }
}

// --- Comments Logic ---

async function loadComments(postId) {
    const list = document.getElementById('commentsList');
    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/comments`);
        const comments = await response.json();

        if (comments.length === 0) {
            list.innerHTML = '<p style="color:#888;">No comments yet.</p>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="comment-item" style="display: flex; gap: 10px; padding: 10px 0; border: none; align-items: flex-start; justify-content: space-between;">
                <div style="display: flex; gap: 10px; flex-grow: 1;">
                    <div class="comment-avatar" style="width: 32px; height: 32px; background: #555; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: bold; flex-shrink: 0;">
                        ${c.userName.charAt(0).toUpperCase()}
                    </div>
                    <div class="comment-content" style="flex-grow: 1;">
                        <div style="font-size: 0.95rem; line-height: 1.4;">
                            <span class="comment-author" style="font-weight: 700; color: var(--text-color); margin-right: 5px;">${c.userName}</span>
                            <span class="comment-text" style="color: #ddd;">${c.content}</span>
                        </div>
                        <div class="comment-date" style="font-size: 0.75rem; color: #888; margin-top: 4px;">${new Date(c.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </div>
                
                <div class="comment-actions" style="display: flex; align-items: center; position: relative;" class="post-options-menu">
                    <i class="fas fa-ellipsis-v" onclick="toggleOptionsMenu(event, 'comment-${c.id}')" style="cursor: pointer; color: #ccc; padding: 5px;"></i>
                    <div id="optionsDropdown-comment-${c.id}" style="display: none; position: absolute; right: 0; top: 20px; background: #222; border: 1px solid #444; border-radius: 8px; z-index: 10; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5); min-width: 120px; overflow: hidden; text-align: left;">
                        ${(JSON.parse(localStorage.getItem('user'))?.id === c.userId || JSON.parse(localStorage.getItem('user'))?.role === 'admin') ?
                `<div onclick="handleDeleteComment('${c.id}', '${postId}')" style="padding: 10px 15px; cursor: pointer; color: #ff4d4d; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-trash-alt" style="margin-right: 10px; width: 16px; text-align: center;"></i> Delete</div>`
                : ''
            }
                        ${(JSON.parse(localStorage.getItem('user'))?.id !== c.userId) ?
                `<div onclick="openReportModal('${c.id}', 'COMMENT')" style="padding: 10px 15px; cursor: pointer; color: #fff; transition: background 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'"><i class="fas fa-flag" style="margin-right: 10px; color: #ffa502; width: 16px; text-align: center;"></i> Report</div>`
                : ''
            }
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function handleDeleteComment(commentId, postId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/blog/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadComments(postId);
        } else {
            const err = await response.text();
            alert(err || 'Failed to delete comment');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred while deleting comment.');
    }
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    const content = document.getElementById('commentInput').value;
    const token = localStorage.getItem('token');

    if (!content.trim()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/blog/${postId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            document.getElementById('commentInput').value = '';
            loadComments(postId);
        }
    } catch (e) { alert('Failed to post comment'); }
}


// --- Report Logic ---

function openReportModal(event, targetId = null, targetType = 'POST') {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const modal = document.getElementById('reportModal');
    if (modal) {
        document.getElementById('reportTargetId').value = targetId || new URLSearchParams(window.location.search).get('id');
        document.getElementById('reportTargetType').value = targetType;
        modal.style.display = 'flex';
    }
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.style.display = 'none';
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const targetId = document.getElementById('reportTargetId').value;
    const targetType = document.getElementById('reportTargetType').value;
    const reason = document.getElementById('reportReason').value;
    const token = localStorage.getItem('token');

    // We still need postId for the comment report API URL
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!token) return alert('Please login to report content');

    let endpoint = `${API_BASE_URL}/blog/${targetId}/report`; // Default for POST
    if (targetType === 'COMMENT') {
        endpoint = `${API_BASE_URL}/blog/${postId}/comments/${targetId}/report`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            alert('Post has been reported to moderators.');
            closeReportModal();
        } else {
            // It could be a text error like "You have already reported this post"
            const errText = await response.text();
            alert(errText || 'Error reporting post');
            closeReportModal();
        }
    } catch (e) {
        console.error(e);
        alert('Failed to report post.');
    }
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('blogGrid')) {
        fetchPublishedPosts();

        // Tab Setup
        const tabCommunity = document.getElementById('tabCommunity');
        const tabMyPosts = document.getElementById('tabMyPosts');
        const grid = document.getElementById('blogGrid');
        const activityFilter = document.getElementById('activityFilter');
        const optArchived = document.getElementById('optArchived');
        const tagSearchInput = document.getElementById('tagSearchInput');

        if (tabCommunity && tabMyPosts) {
            tabCommunity.addEventListener('click', () => {
                tabCommunity.classList.add('active');
                tabMyPosts.classList.remove('active');
                grid.innerHTML = '<div class="loading-spinner">Loading...</div>';
                // Removed logic hiding archived filtering
                if (activityFilter) activityFilter.value = 'none';
                if (tagSearchInput) tagSearchInput.value = '';
                fetchPublishedPosts();
            });

            tabMyPosts.addEventListener('click', () => {
                tabMyPosts.classList.add('active');
                tabCommunity.classList.remove('active');
                grid.innerHTML = '<div class="loading-spinner">Loading...</div>';
                // Removed logic hiding archived filtering
                if (activityFilter) activityFilter.value = 'none';
                if (tagSearchInput) tagSearchInput.value = '';
                fetchMyPosts();
            });
        }

        if (activityFilter) {
            activityFilter.addEventListener('change', (e) => {
                const filterType = e.target.value;
                if (filterType === 'none') {
                    // Reset to active tab
                    if (tabCommunity.classList.contains('active')) fetchPublishedPosts();
                    if (tabMyPosts.classList.contains('active')) fetchMyPosts();
                    return;
                }
                fetchFilteredPosts(filterType);
            });
        }

        if (tagSearchInput) {
            tagSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                if (!searchTerm) {
                    renderPosts(currentLoadedPosts, grid);
                } else {
                    const filtered = currentLoadedPosts.filter(p => {
                        if (!p.tags) return false;
                        return p.tags.some(tag => tag.toLowerCase().includes(searchTerm));
                    });
                    renderPosts(filtered, grid);
                }
            });
        }
    }

    if (document.getElementById('postDetailTitle')) loadPostDetails();

    const commentForm = document.getElementById('commentForm');
    if (commentForm) commentForm.addEventListener('submit', handleCommentSubmit);
});

async function fetchFilteredPosts(filterType) {
    const container = document.getElementById('blogGrid');
    if (!container) return;
    const token = localStorage.getItem('token');

    if (userSavedPostIds.length === 0 && filterType === 'saved') {
        await fetchUserSavedPosts();
    }

    try {
        container.innerHTML = '<div class="loading-spinner">Loading...</div>';

        if (filterType === 'reported') {
            await fetchMyReports();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/blog/${filterType}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch posts');
        const posts = await response.json();
        if (posts.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-color); margin-top: 50px; width: 100%;">No ${filterType} posts found.</div>`;
            return;
        }
        currentLoadedPosts = posts;
        renderPosts(posts, container);
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div style="text-align: center; color: red;">Failed to load posts.</div>';
    }
}

async function fetchMyReports() {
    const grid = document.getElementById('blogGrid');
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/blog/reports/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch report history');
        const reports = await response.json();
        renderReportsList(reports, grid);
    } catch (e) {
        grid.innerHTML = `<p style="color: red; text-align: center;">Error: ${e.message}</p>`;
    }
}

function renderReportsList(reports, container) {
    if (reports.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">You have not reported any content yet.</p>';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    const isMod = user && (user.role === 'admin' || user.role === 'trainer');

    container.innerHTML = reports.map(report => `
        <div class="blog-card" style="border: 1px solid #444; padding: 20px; background: rgba(255,255,255,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <span style="background: ${report.targetType === 'POST' ? '#3498db' : '#9b59b6'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                    ${report.targetType}
                </span>
                <span style="color: #aaa; font-size: 0.8rem;">${new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-weight: 600; color: var(--primary); margin-bottom: 5px;">Reason: ${report.reason}</div>
                <div style="font-style: italic; color: #ddd; font-size: 0.9rem; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    "${report.targetContentSnippet || 'Content preview unavailable'}"
                </div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">Author: ${report.targetAuthorName || 'Unknown'}</div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: auto;">
                <button onclick="withdrawReport('${report.targetId}', '${report.targetType}')" 
                    style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #888; background: transparent; color: white; cursor: pointer; font-size: 0.85rem;">
                    Withdraw
                </button>
                ${isMod ? `
                    <button onclick="deleteReportedContent('${report.targetId}', '${report.targetType}')"
                        style="flex: 1; padding: 8px; border-radius: 6px; border: none; background: #e74c3c; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
                        Delete Content
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function withdrawReport(targetId, targetType) {
    if (!confirm('Are you sure you want to withdraw this report?')) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/blog/reports/withdraw/${targetId}/${targetType}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert('Report withdrawn successfully');
            fetchMyReports();
        }
    } catch (e) { alert('Failed to withdraw report'); }
}

async function deleteReportedContent(targetId, targetType) {
    if (!confirm(`Are you sure you want to permanently delete this ${targetType.toLowerCase()}?`)) return;
    const token = localStorage.getItem('token');

    let endpoint = `${API_BASE_URL}/blog/${targetId}`;
    if (targetType === 'COMMENT') {
        endpoint = `${API_BASE_URL}/blog/comments/${targetId}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert(`${targetType} deleted successfully`);
            fetchMyReports();
        } else {
            const err = await response.text();
            alert('Delete failed: ' + err);
        }
    } catch (e) { alert('Action failed'); }
}
