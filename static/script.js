// Gestione stato applicazione
let currentUser = null;
let currentTorrent = null;

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkAuthStatus();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('home-link').addEventListener('click', showHome);
    document.getElementById('upload-link').addEventListener('click', showUpload);
    document.getElementById('admin-panel-link').addEventListener('click', showAdminPanel);
    document.getElementById('login-link').addEventListener('click', showLogin);
    document.getElementById('register-link').addEventListener('click', showRegister);
    document.getElementById('logout-link').addEventListener('click', logout);

    // Forms
    document.getElementById('search-form').addEventListener('submit', handleSearch);
    document.getElementById('upload-form').addEventListener('submit', handleUpload);
    document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    document.getElementById('register-form-element').addEventListener('submit', handleRegister);

    // Contatore caratteri per la descrizione
    document.getElementById('upload-description').addEventListener('input', updateCharCount);

    // Auth form toggles
    document.getElementById('show-register').addEventListener('click', showRegister);
    document.getElementById('show-login').addEventListener('click', showLogin);
}

// Contatore caratteri
function updateCharCount() {
    const textarea = document.getElementById('upload-description');
    const charCount = document.getElementById('char-count');
    const remaining = 160 - textarea.value.length;
    charCount.textContent = remaining;
    charCount.style.color = remaining < 20 ? 'red' : 'inherit';
}

// API Calls
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        console.error('API call failed:', error);
        return { success: false, error: error.message };
    }
}

// Gestione autenticazione
async function checkAuthStatus() {
    const result = await apiCall('/api/user/status');
    if (result.success && result.data.logged_in) {
        currentUser = {
            username: result.data.username,
            role: result.data.role,
            user_id: result.data.user_id
        };
        updateUIForAuth();
    }
}

function updateUIForAuth() {
    if (currentUser) {
        document.getElementById('login-link').style.display = 'none';
        document.getElementById('register-link').style.display = 'none';
        document.getElementById('logout-link').style.display = 'block';
        document.getElementById('upload-link').style.display = 'block';
        document.getElementById('user-info').style.display = 'block';
        document.getElementById('user-info').textContent = `Benvenuto, ${currentUser.username} (${currentUser.role})`;
        
        // Mostra Admin Panel solo per admin
        if (currentUser.role === 'admin') {
            document.getElementById('admin-panel-link').style.display = 'block';
        } else {
            document.getElementById('admin-panel-link').style.display = 'none';
        }
    } else {
        document.getElementById('login-link').style.display = 'block';
        document.getElementById('register-link').style.display = 'block';
        document.getElementById('logout-link').style.display = 'none';
        document.getElementById('upload-link').style.display = 'none';
        document.getElementById('admin-panel-link').style.display = 'none';
        document.getElementById('user-info').style.display = 'none';
    }
}

// Navigation functions
function showHome() {
    hideAllPages();
    document.getElementById('home-page').style.display = 'block';
}

function showUpload() {
    if (!currentUser) {
        showLogin();
        return;
    }
    hideAllPages();
    document.getElementById('upload-page').style.display = 'block';
}

function showAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') {
        showHome();
        return;
    }
    hideAllPages();
    document.getElementById('admin-page').style.display = 'block';
}

function showTorrentDetailsPage() {
    hideAllPages();
    document.getElementById('torrent-details-page').style.display = 'block';
}

function showLogin() {
    hideAllPages();
    document.getElementById('auth-page').style.display = 'block';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
    hideAllPages();
    document.getElementById('auth-page').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function hideAllPages() {
    const pages = ['home-page', 'upload-page', 'admin-page', 'auth-page', 'torrent-details-page'];
    pages.forEach(page => {
        document.getElementById(page).style.display = 'none';
    });
}

// Gestione form
async function handleSearch(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const searchParams = Object.fromEntries(formData.entries());
    
    const result = await apiCall('/api/search', {
        method: 'POST',
        body: JSON.stringify(searchParams)
    });
    
    if (result.success) {
        displaySearchResults(result.data);
    } else {
        alert('Errore nella ricerca: ' + result.data.error);
    }
}

async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const formData = new FormData(e.target);
    const uploadData = {
        title: formData.get('title'),
        description: formData.get('description'),
        size: parseFloat(formData.get('size')),
        categories: Array.from(formData.getAll('categories')),
        images: formData.get('images') ? formData.get('images').split(',').map(url => url.trim()) : []
    };
    
    const result = await apiCall('/api/torrent', {
        method: 'POST',
        body: JSON.stringify(uploadData)
    });
    
    if (result.success) {
        alert('Torrent caricato con successo!');
        e.target.reset();
        updateCharCount();
        showHome();
    } else {
        alert('Errore nel caricamento: ' + result.data.error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loginData = Object.fromEntries(formData.entries());
    
    const result = await apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
    });
    
    if (result.success) {
        currentUser = { 
            username: result.data.username,
            role: result.data.role
        };
        await checkAuthStatus();
        showHome();
    } else {
        alert('Login fallito: ' + (result.data.error || 'Credenziali non valide'));
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const registerData = Object.fromEntries(formData.entries());
    
    const result = await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify(registerData)
    });
    
    if (result.success) {
        currentUser = { 
            username: result.data.username,
            role: result.data.role
        };
        await checkAuthStatus();
        showHome();
    } else {
        alert('Registrazione fallita: ' + (result.data.error || 'Errore sconosciuto'));
    }
}

async function logout() {
    const result = await apiCall('/api/logout', { method: 'POST' });
    if (result.success) {
        currentUser = null;
        updateUIForAuth();
        showHome();
    }
}

// Visualizzazione risultati ricerca
function displaySearchResults(torrents) {
    const container = document.getElementById('search-results');
    
    if (torrents.length === 0) {
        container.innerHTML = '<p style="text-align: center; width: 100%;">Nessun torrent trovato.</p>';
        return;
    }
    
    container.innerHTML = torrents.map(torrent => `
        <div class="torrent-card">
            ${torrent.images && torrent.images.length > 0 ? 
                `<img src="${torrent.images[0]}" alt="${torrent.title}" class="torrent-image" onclick="viewTorrentDetails('${torrent._id}')">` : 
                '<div class="torrent-image" onclick="viewTorrentDetails(\'' + torrent._id + '\')" style="background: #eee; display: flex; align-items: center; justify-content: center; cursor: pointer;">Nessuna immagine</div>'
            }
            <div class="torrent-info">
                <h3 class="torrent-title">${torrent.title}</h3>
                <p class="torrent-description">${torrent.description}</p>
                <div class="torrent-meta">
                    <span>${(torrent.size / 1024).toFixed(2)} GB</span>
                    <span>${new Date(torrent.upload_date).toLocaleDateString()}</span>
                </div>
                <div class="torrent-meta">
                    <span>${torrent.categories.join(', ')}</span>
                    <span class="rating">★ ${torrent.average_rating?.toFixed(1) || 'N/A'}</span>
                </div>
            </div>
            <div class="torrent-actions">
                <button class="btn-view" onclick="viewTorrentDetails('${torrent._id}')">Visualizza</button>
                ${currentUser && currentUser.role === 'admin' ? 
                    `<button class="btn-delete" onclick="deleteTorrentAdmin('${torrent._id}')">Elimina</button>` : 
                    ''
                }
            </div>
        </div>
    `).join('');
}

// Visualizza dettagli torrent
async function viewTorrentDetails(torrentId) {
    const result = await apiCall(`/api/torrent/${torrentId}`);
    
    if (result.success) {
        currentTorrent = result.data;
        showTorrentDetailsPage();
        displayTorrentDetails(currentTorrent);
    } else {
        alert('Errore nel caricamento dei dettagli: ' + result.data.error);
    }
}

// Mostra dettagli torrent nella pagina dedicata
function displayTorrentDetails(torrent) {
    const container = document.getElementById('torrent-details-content');
    
    container.innerHTML = `
        <div class="torrent-detail-header">
            <h2>${torrent.title}</h2>
            ${currentUser && currentUser.role === 'admin' ? 
                `<button class="btn-delete" onclick="deleteTorrentAdmin('${torrent._id}')" style="margin-left: auto;">Elimina Torrent</button>` : 
                ''
            }
        </div>
        
        <div class="torrent-detail-content">
            <div class="torrent-images">
                ${torrent.images && torrent.images.length > 0 ? 
                    torrent.images.map(img => `<img src="${img}" alt="${torrent.title}" class="detail-image">`).join('') : 
                    '<div class="no-image">Nessuna immagine disponibile</div>'
                }
            </div>
            
            <div class="torrent-info-detail">
                <p><strong>Descrizione:</strong> ${torrent.description}</p>
                <p><strong>Dimensione:</strong> ${(torrent.size / 1024).toFixed(2)} GB</p>
                <p><strong>Categorie:</strong> ${torrent.categories.join(', ')}</p>
                <p><strong>Data caricamento:</strong> ${new Date(torrent.upload_date).toLocaleDateString()}</p>
                <p><strong>Download:</strong> ${torrent.download_count}</p>
                <p><strong>Rating medio:</strong> ${torrent.average_rating?.toFixed(1) || 'N/A'}</p>
                
                ${currentUser ? 
                    `<button class="btn-download" onclick="downloadTorrent('${torrent._id}')">Scarica Torrent</button>` : 
                    '<p><a href="#" onclick="showLogin()">Accedi per scaricare il torrent</a></p>'
                }
            </div>
        </div>
        
        <div class="comments-section">
            <h3>Commenti (${torrent.comments?.length || 0})</h3>
            
            ${torrent.comments && torrent.comments.length > 0 ? 
                torrent.comments.map(comment => `
                    <div class="comment">
                        <div class="comment-header">
                            <strong>${comment.user_id}</strong>
                            <span>${new Date(comment.date).toLocaleDateString()}</span>
                            <span class="rating">${'★'.repeat(comment.rating)}${'☆'.repeat(5-comment.rating)}</span>
                        </div>
                        <p class="comment-text">${comment.text}</p>
                        ${currentUser && currentUser.role === 'admin' ? 
                            `<button class="btn-delete-small" onclick="deleteCommentAdmin('${comment._id}')">Elimina</button>` : 
                            ''
                        }
                    </div>
                `).join('') : 
                '<p>Nessun commento</p>'
            }
            
            ${currentUser ? `
                <div class="add-comment">
                    <h4>Aggiungi Commento</h4>
                    <form onsubmit="addComment(event, '${torrent._id}')">
                        <div class="form-group">
                            <label>Valutazione:</label>
                            <select name="rating" required>
                                <option value="1">★ (1 Stella)</option>
                                <option value="2">★★ (2 Stelle)</option>
                                <option value="3">★★★ (3 Stelle)</option>
                                <option value="4">★★★★ (4 Stelle)</option>
                                <option value="5">★★★★★ (5 Stelle)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <textarea name="text" placeholder="Il tuo commento (max 160 caratteri)" maxlength="160" required></textarea>
                            <small>Caratteri rimanenti: <span class="comment-char-count">160</span></small>
                        </div>
                        <button type="submit" class="btn-submit">Invia Commento</button>
                    </form>
                </div>
            ` : '<p><a href="#" onclick="showLogin()">Accedi per commentare</a></p>'}
        </div>
    `;
    
    // Aggiungi listener per il contatore caratteri commenti
    const commentTextarea = container.querySelector('textarea[name="text"]');
    const commentCharCount = container.querySelector('.comment-char-count');
    if (commentTextarea) {
        commentTextarea.addEventListener('input', function() {
            const remaining = 160 - this.value.length;
            commentCharCount.textContent = remaining;
            commentCharCount.style.color = remaining < 20 ? 'red' : 'inherit';
        });
    }
}

// Aggiungi commento
async function addComment(e, torrentId) {
    e.preventDefault();
    if (!currentUser) return;
    
    const formData = new FormData(e.target);
    const commentData = {
        torrent_id: torrentId,
        text: formData.get('text'),
        rating: parseInt(formData.get('rating'))
    };
    
    const result = await apiCall('/api/comment', {
        method: 'POST',
        body: JSON.stringify(commentData)
    });
    
    if (result.success) {
        alert('Commento aggiunto!');
        // Ricarica i dettagli del torrent
        viewTorrentDetails(torrentId);
    } else {
        alert('Errore nell\'aggiunta del commento: ' + result.data.error);
    }
}

// Download torrent
async function downloadTorrent(torrentId) {
    if (!currentUser) {
        showLogin();
        return;
    }
    
    const result = await apiCall(`/api/torrent/${torrentId}/download`);
    if (result.success) {
        alert('Download iniziato!');
    } else {
        alert('Errore nel download: ' + result.data.error);
    }
}

// Funzioni Admin
async function loadAdminStats() {
    const result = await apiCall('/api/admin/stats');
    if (result.success) {
        const stats = result.data;
        let html = '';
        
        // Statistiche generali
        html += `
            <div class="stats-general">
                <h4>📊 Statistiche Generali</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Totale Torrent</h5>
                        <span class="stat-number">${stats.general_stats.total_torrents}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Totale Utenti</h5>
                        <span class="stat-number">${stats.general_stats.total_users}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Totale Commenti</h5>
                        <span class="stat-number">${stats.general_stats.total_comments}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Download Totali</h5>
                        <span class="stat-number">${stats.general_stats.total_downloads}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Nuovi Torrent (7gg)</h5>
                        <span class="stat-number">${stats.general_stats.new_torrents_week}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Torrent più scaricati
        html += '<h4>🔥 Torrent Più Scaricati</h4>';
        if (stats.by_downloads.length > 0) {
            stats.by_downloads.forEach((torrent, index) => {
                html += `
                    <div class="stat-item">
                        <span class="rank">${index + 1}.</span>
                        <span class="torrent-name">${torrent.title}</span>
                        <span class="stat-value">${torrent.download_count} download</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessun torrent trovato</p>';
        }
        
        // Torrent meglio valutati
        html += '<h4>⭐ Torrent Meglio Valutati</h4>';
        if (stats.by_rating.length > 0) {
            stats.by_rating.forEach((torrent, index) => {
                html += `
                    <div class="stat-item">
                        <span class="rank">${index + 1}.</span>
                        <span class="torrent-name">${torrent.title}</span>
                        <span class="stat-value">★ ${torrent.average_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessun torrent trovato</p>';
        }
        
        // Nuovi torrent per categoria (ultima settimana)
        html += '<h4>📈 Nuovi Torrent per Categoria (Ultima Settimana)</h4>';
        if (stats.weekly_by_category.length > 0) {
            stats.weekly_by_category.forEach(cat => {
                html += `
                    <div class="stat-item">
                        <span class="category-name">${cat._id}</span>
                        <span class="stat-value">${cat.new_torrents_count} nuovi</span>
                        <span class="stat-subvalue">${cat.total_downloads} download</span>
                        <span class="stat-subvalue">★ ${cat.avg_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessun nuovo torrent nell\'ultima settimana</p>';
        }
        
        // Categorie più popolari
        html += '<h4>🏆 Categorie Più Popolari</h4>';
        if (stats.categories_overall.length > 0) {
            stats.categories_overall.forEach((cat, index) => {
                html += `
                    <div class="stat-item">
                        <span class="rank">${index + 1}.</span>
                        <span class="category-name">${cat._id}</span>
                        <span class="stat-value">${cat.total_torrents} torrent</span>
                        <span class="stat-subvalue">${cat.total_downloads} download</span>
                        <span class="stat-subvalue">★ ${cat.avg_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessuna statistica per categoria</p>';
        }
        
        // Form per statistiche personalizzate
        html += `
            <div class="custom-stats">
                <h4>📅 Statistiche per Periodo Personalizzato</h4>
                <div class="form-group">
                    <label for="custom-date-from">Data da:</label>
                    <input type="date" id="custom-date-from">
                </div>
                <div class="form-group">
                    <label for="custom-date-to">Data a:</label>
                    <input type="date" id="custom-date-to">
                </div>
                <button onclick="loadCustomStats()">Carica Statistiche Personalizzate</button>
                <div id="custom-stats-results" style="margin-top: 1rem;"></div>
            </div>
        `;
        
        document.getElementById('admin-stats-content').innerHTML = html;
    } else {
        alert('Errore nel caricamento delle statistiche: ' + result.data.error);
    }
}

// Carica statistiche personalizzate
async function loadCustomStats() {
    const dateFrom = document.getElementById('custom-date-from').value;
    const dateTo = document.getElementById('custom-date-to').value;
    
    if (!dateFrom || !dateTo) {
        alert('Seleziona entrambe le date');
        return;
    }
    
    const result = await apiCall('/api/admin/stats/period', {
        method: 'POST',
        body: JSON.stringify({
            date_from: dateFrom,
            date_to: dateTo
        })
    });
    
    if (result.success) {
        const stats = result.data;
        const container = document.getElementById('custom-stats-results');
        let html = '';
        
        html += `<h5>Periodo: ${new Date(stats.period.from).toLocaleDateString()} - ${new Date(stats.period.to).toLocaleDateString()}</h5>`;
        
        // Categorie nel periodo
        html += '<h6>Categorie nel Periodo</h6>';
        if (stats.categories_in_period.length > 0) {
            stats.categories_in_period.forEach(cat => {
                html += `
                    <div class="stat-item">
                        <span class="category-name">${cat._id}</span>
                        <span class="stat-value">${cat.torrents_count} torrent</span>
                        <span class="stat-subvalue">${cat.total_downloads} download</span>
                        <span class="stat-subvalue">★ ${cat.avg_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessun torrent in questo periodo</p>';
        }
        
        // Torrent popolari nel periodo
        html += '<h6>Torrent Più Scaricati nel Periodo</h6>';
        if (stats.popular_in_period.length > 0) {
            stats.popular_in_period.forEach((torrent, index) => {
                html += `
                    <div class="stat-item">
                        <span class="rank">${index + 1}.</span>
                        <span class="torrent-name">${torrent.title}</span>
                        <span class="stat-value">${torrent.download_count} download</span>
                    </div>
                `;
            });
        } else {
            html += '<p>Nessun torrent in questo periodo</p>';
        }
        
        container.innerHTML = html;
    } else {
        alert('Errore nel caricamento delle statistiche personalizzate: ' + result.data.error);
    }
}

// Cerca utenti
async function searchUsers() {
    const username = document.getElementById('search-username').value;
    if (!username) {
        alert('Inserisci un username da cercare');
        return;
    }
    
    const result = await apiCall('/api/admin/search-users', {
        method: 'POST',
        body: JSON.stringify({ username: username })
    });
    
    if (result.success) {
        const users = result.data;
        const container = document.getElementById('users-results');
        
        if (users.length === 0) {
            container.innerHTML = '<p>Nessun utente trovato</p>';
            return;
        }
        
        let html = '<h4>Risultati della ricerca:</h4>';
        users.forEach(user => {
            html += `
                <div class="user-result">
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Ruolo:</strong> ${user.role}</p>
                    <p><strong>Registrato:</strong> ${new Date(user.registration_date).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> ${user.is_banned ? '❌ Bannato' : '✅ Attivo'}</p>
                    ${!user.is_banned ? 
                        `<button class="btn-delete" onclick="banUser('${user._id}', '${user.username}')">Banna Utente</button>` : 
                        `<p style="color: #dc3545;">Utente già bannato</p>`
                    }
                </div>
            `;
        });
        
        container.innerHTML = html;
    } else {
        alert('Errore nella ricerca: ' + result.data.error);
    }
}

// Banna utente
async function banUser(userId, username) {
    if (!confirm(`Sei sicuro di voler bannare l'utente "${username}"?`)) {
        return;
    }
    
    const result = await apiCall('/api/admin/ban-user', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
    });
    
    if (result.success) {
        alert(`Utente "${username}" bannato con successo`);
        // Ricarica i risultati
        searchUsers();
    } else {
        alert('Errore: ' + result.data.error);
    }
}

// Elimina torrent (admin)
async function deleteTorrentAdmin(torrentId) {
    if (!confirm('Sei sicuro di voler eliminare questo torrent?')) {
        return;
    }
    
    const result = await apiCall('/api/admin/delete-torrent', {
        method: 'POST',
        body: JSON.stringify({ torrent_id: torrentId })
    });
    
    if (result.success) {
        alert('Torrent eliminato con successo');
        if (document.getElementById('torrent-details-page').style.display !== 'none') {
            showHome();
        } else {
            // Ricarica i risultati della ricerca
            document.getElementById('search-form').dispatchEvent(new Event('submit'));
        }
    } else {
        alert('Errore: ' + result.data.error);
    }
}

// Elimina commento (admin)
async function deleteCommentAdmin(commentId) {
    if (!confirm('Sei sicuro di voler eliminare questo commento?')) {
        return;
    }
    
    const result = await apiCall('/api/admin/delete-comment', {
        method: 'POST',
        body: JSON.stringify({ comment_id: commentId })
    });
    
    if (result.success) {
        alert('Commento eliminato con successo');
        // Ricarica i dettagli del torrent
        viewTorrentDetails(currentTorrent._id);
    } else {
        alert('Errore: ' + result.data.error);
    }
}