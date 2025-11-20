from flask import Flask, request, jsonify, session, render_template
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from bson.errors import InvalidId
import re

app = Flask(__name__)
app.config.from_object('config.Config')
CORS(app)

# Connessione MongoDB
client = MongoClient(app.config['MONGO_URI'])
db = client.torrent_sharing_db

# Definisci esplicitamente le collections
COLLECTIONS = {
    'users': db.users,
    'torrents': db.torrents, 
    'comments': db.comments,
    'categories': db.categories
}

# Route principale
@app.route('/')
def index():
    return render_template('index.html')

# API per verificare lo stato dell'utente
@app.route('/api/user/status')
def user_status():
    if 'user_id' in session and 'username' in session and 'role' in session:
        return jsonify({
            'logged_in': True,
            'username': session['username'],
            'role': session['role'],
            'user_id': session['user_id']
        })
    return jsonify({'logged_in': False})

# API per logout
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# Registrazione utente (normale o admin con codice speciale)
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Verifica campi obbligatori
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Determina il ruolo
        role = 'user'
        admin_code = data.get('admin_code', '')
        if admin_code == 'ADMIN123':  # Codice segreto per diventare admin
            role = 'admin'

        # Verifica se l'utente esiste già
        existing_user = COLLECTIONS['users'].find_one({
            '$or': [
                {'username': data['username']},
                {'email': data['email']}
            ]
        })
        
        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 400

        user = {
            'username': data['username'],
            'email': data['email'],
            'password': data['password'],  # In produzione, usa bcrypt!
            'role': role,
            'registration_date': datetime.now(),
            'is_banned': False
        }

        result = COLLECTIONS['users'].insert_one(user)
        
        # Imposta la sessione
        session['user_id'] = str(result.inserted_id)
        session['username'] = data['username']
        session['role'] = role

        return jsonify({
            'success': True, 
            'username': data['username'],
            'role': role
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Login
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user = COLLECTIONS['users'].find_one({
            '$or': [
                {'username': data.get('username')},
                {'email': data.get('username')}
            ],
            'password': data.get('password')
        })

        if user and not user.get('is_banned', False):
            session['user_id'] = str(user['_id'])
            session['username'] = user['username']
            session['role'] = user['role']
            
            return jsonify({
                'success': True,
                'username': user['username'],
                'role': user['role']
            })

        return jsonify({'error': 'Invalid credentials or user banned'}), 401

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ricerca torrent
@app.route('/api/search', methods=['POST'])
def search_torrents():
    try:
        data = request.json or {}
        query = {}
        
        # Filtri di ricerca
        if data.get('title'):
            query['title'] = {'$regex': data['title'], '$options': 'i'}
        
        if data.get('description'):
            query['description'] = {'$regex': data['description'], '$options': 'i'}
        
        if data.get('categories'):
            query['categories'] = {'$in': data['categories']}
        
        if data.get('date_from'):
            try:
                query['upload_date'] = {'$gte': datetime.fromisoformat(data['date_from'].replace('Z', '+00:00'))}
            except ValueError:
                return jsonify({'error': 'Invalid date_from format'}), 400
        
        if data.get('date_to'):
            try:
                date_to = datetime.fromisoformat(data['date_to'].replace('Z', '+00:00'))
                if 'upload_date' in query:
                    query['upload_date']['$lte'] = date_to
                else:
                    query['upload_date'] = {'$lte': date_to}
            except ValueError:
                return jsonify({'error': 'Invalid date_to format'}), 400

        # Ordinamento
        sort_field = 'upload_date'
        if data.get('sort_by') == 'size':
            sort_field = 'size'
        
        sort_order = -1 if data.get('order') == 'desc' else 1
        
        torrents = list(COLLECTIONS['torrents'].find(query).sort(sort_field, sort_order).limit(50))
        
        # Convert ObjectId to string
        for torrent in torrents:
            torrent['_id'] = str(torrent['_id'])
            if 'uploader_id' in torrent:
                torrent['uploader_id'] = str(torrent['uploader_id'])
        
        return jsonify(torrents)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Dettaglio torrent
@app.route('/api/torrent/<torrent_id>')
def get_torrent(torrent_id):
    try:
        torrent = COLLECTIONS['torrents'].find_one({'_id': ObjectId(torrent_id)})
        
        if torrent:
            torrent['_id'] = str(torrent['_id'])
            torrent['uploader_id'] = str(torrent['uploader_id'])
            
            # Recupera commenti
            comments = list(COLLECTIONS['comments'].find({'torrent_id': ObjectId(torrent_id)}))
            for comment in comments:
                comment['_id'] = str(comment['_id'])
                comment['user_id'] = str(comment['user_id'])
                comment['torrent_id'] = str(comment['torrent_id'])
            
            torrent['comments'] = comments
        
        return jsonify(torrent if torrent else {})
    except InvalidId:
        return jsonify({'error': 'Invalid torrent ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Upload torrent
@app.route('/api/torrent', methods=['POST'])
def upload_torrent():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        torrent = {
            'title': data.get('title', '').strip(),
            'description': data.get('description', '').strip(),
            'size': float(data.get('size', 0)),
            'categories': data.get('categories', []),
            'images': data.get('images', []),
            'uploader_id': ObjectId(session['user_id']),
            'upload_date': datetime.now(),
            'download_count': 0,
            'average_rating': 0
        }
        
        # Validazione
        if not torrent['title'] or not torrent['description']:
            return jsonify({'error': 'Title and description are required'}), 400
        
        if len(torrent['description']) > 160:
            return jsonify({'error': 'Description must be 160 characters or less'}), 400
        
        result = COLLECTIONS['torrents'].insert_one(torrent)
        return jsonify({'success': True, 'torrent_id': str(result.inserted_id)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Aggiungi commento
@app.route('/api/comment', methods=['POST'])
def add_comment():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        comment = {
            'torrent_id': ObjectId(data.get('torrent_id')),
            'user_id': ObjectId(session['user_id']),
            'text': data.get('text', '').strip(),
            'rating': int(data.get('rating', 0)),
            'date': datetime.now()
        }
        
        # Validazione
        if not comment['text']:
            return jsonify({'error': 'Comment text is required'}), 400
        
        if len(comment['text']) > 160:
            return jsonify({'error': 'Comment must be 160 characters or less'}), 400
            
        if comment['rating'] < 1 or comment['rating'] > 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        
        result = COLLECTIONS['comments'].insert_one(comment)
        update_torrent_rating(data.get('torrent_id'))
        
        return jsonify({'success': True})
        
    except InvalidId:
        return jsonify({'error': 'Invalid ID format'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Download torrent (solo utenti registrati)
@app.route('/api/torrent/<torrent_id>/download')
def download_torrent(torrent_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Incrementa il contatore download
        COLLECTIONS['torrents'].update_one(
            {'_id': ObjectId(torrent_id)},
            {'$inc': {'download_count': 1}}
        )
        
        # Qui restituiresti il file .torrent vero
        return jsonify({'success': True, 'message': 'Download started'})
        
    except InvalidId:
        return jsonify({'error': 'Invalid torrent ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Funzioni ADMIN (solo per amministratori)

# Cerca utenti per username
@app.route('/api/admin/search-users', methods=['POST'])
def search_users():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.json
        username = data.get('username', '').strip()
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Cerca utenti per username (case insensitive)
        users = list(COLLECTIONS['users'].find({
            'username': {'$regex': username, '$options': 'i'}
        }).limit(10))
        
        # Converti ObjectId e rimuovi password
        for user in users:
            user['_id'] = str(user['_id'])
            user.pop('password', None)
        
        return jsonify(users)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ban utente
@app.route('/api/admin/ban-user', methods=['POST'])
def ban_user():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        result = COLLECTIONS['users'].update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'is_banned': True}}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({'success': True})
        
    except InvalidId:
        return jsonify({'error': 'Invalid user ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Elimina torrent
@app.route('/api/admin/delete-torrent', methods=['POST'])
def delete_torrent():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.json
        torrent_id = data.get('torrent_id')
        
        if not torrent_id:
            return jsonify({'error': 'Torrent ID required'}), 400
        
        # Elimina il torrent e i relativi commenti
        COLLECTIONS['torrents'].delete_one({'_id': ObjectId(torrent_id)})
        COLLECTIONS['comments'].delete_many({'torrent_id': ObjectId(torrent_id)})
            
        return jsonify({'success': True})
        
    except InvalidId:
        return jsonify({'error': 'Invalid torrent ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Elimina commento
@app.route('/api/admin/delete-comment', methods=['POST'])
def delete_comment():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.json
        comment_id = data.get('comment_id')
        
        if not comment_id:
            return jsonify({'error': 'Comment ID required'}), 400
        
        COLLECTIONS['comments'].delete_one({'_id': ObjectId(comment_id)})
            
        return jsonify({'success': True})
        
    except InvalidId:
        return jsonify({'error': 'Invalid comment ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Statistiche avanzate (solo admin)
# Statistiche (solo admin)
@app.route('/api/admin/stats')
def admin_stats():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        # Data di una settimana fa
        one_week_ago = datetime.now() - timedelta(days=7)
        
        # 1. Torrent più popolari per download
        popular_by_downloads = list(COLLECTIONS['torrents'].find().sort('download_count', -1).limit(10))
        
        # 2. Torrent con miglior rating
        popular_by_rating = list(COLLECTIONS['torrents'].find({
            'average_rating': {'$gte': 0}
        }).sort('average_rating', -1).limit(10))
        
        # 3. Nuovi torrent per categoria nell'ultima settimana
        pipeline_weekly = [
            {'$match': {'upload_date': {'$gte': one_week_ago}}},
            {'$unwind': '$categories'},
            {'$group': {
                '_id': '$categories',
                'new_torrents_count': {'$sum': 1},
                'total_downloads': {'$sum': '$download_count'},
                'avg_rating': {'$avg': '$average_rating'}
            }},
            {'$sort': {'new_torrents_count': -1}}
        ]
        
        weekly_stats = list(COLLECTIONS['torrents'].aggregate(pipeline_weekly))
        
        # 4. Categorie più popolari in assoluto
        pipeline_categories = [
            {'$unwind': '$categories'},
            {'$group': {
                '_id': '$categories',
                'total_torrents': {'$sum': 1},
                'total_downloads': {'$sum': '$download_count'},
                'avg_rating': {'$avg': '$average_rating'},
                'avg_size': {'$avg': '$size'}
            }},
            {'$sort': {'total_downloads': -1}}
        ]
        
        category_stats = list(COLLECTIONS['torrents'].aggregate(pipeline_categories))
        
        # 5. Statistiche generali
        total_torrents = COLLECTIONS['torrents'].count_documents({})
        total_users = COLLECTIONS['users'].count_documents({})
        total_comments = COLLECTIONS['comments'].count_documents({})
        total_downloads = COLLECTIONS['torrents'].aggregate([
            {'$group': {'_id': None, 'total': {'$sum': '$download_count'}}}
        ])
        total_downloads_result = list(total_downloads)
        total_downloads_count = total_downloads_result[0]['total'] if total_downloads_result else 0
        
        # 6. Torrent caricati nell'ultima settimana
        new_torrents_week = COLLECTIONS['torrents'].count_documents({
            'upload_date': {'$gte': one_week_ago}
        })
        
        # Converti tutti gli ObjectId in stringhe
        for torrent in popular_by_downloads:
            torrent['_id'] = str(torrent['_id'])
            torrent['uploader_id'] = str(torrent.get('uploader_id', ''))
        
        for torrent in popular_by_rating:
            torrent['_id'] = str(torrent['_id'])
            torrent['uploader_id'] = str(torrent.get('uploader_id', ''))
        
        # Converti i risultati delle aggregazioni
        def convert_aggregation_results(results):
            converted = []
            for item in results:
                # Crea una copia dell'item senza i campi ObjectId
                converted_item = {}
                for key, value in item.items():
                    if isinstance(value, ObjectId):
                        converted_item[key] = str(value)
                    else:
                        converted_item[key] = value
                converted.append(converted_item)
            return converted
        
        weekly_stats_converted = convert_aggregation_results(weekly_stats)
        category_stats_converted = convert_aggregation_results(category_stats)
        
        return jsonify({
            'general_stats': {
                'total_torrents': total_torrents,
                'total_users': total_users,
                'total_comments': total_comments,
                'total_downloads': total_downloads_count,
                'new_torrents_week': new_torrents_week
            },
            'by_downloads': popular_by_downloads,
            'by_rating': popular_by_rating,
            'weekly_by_category': weekly_stats_converted,
            'categories_overall': category_stats_converted
        })
        
    except Exception as e:
        print(f"Error in admin stats: {e}")  # Debug
        return jsonify({'error': str(e)}), 500

# Statistiche per periodo personalizzato
@app.route('/api/admin/stats/period', methods=['POST'])
def stats_by_period():
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.json
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        
        if not date_from or not date_to:
            return jsonify({'error': 'Date range required'}), 400
        
        try:
            start_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400
        
        # Statistiche per categoria nel periodo specificato
        pipeline_period = [
            {'$match': {
                'upload_date': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }},
            {'$unwind': '$categories'},
            {'$group': {
                '_id': '$categories',
                'torrents_count': {'$sum': 1},
                'total_downloads': {'$sum': '$download_count'},
                'avg_rating': {'$avg': '$average_rating'}
            }},
            {'$sort': {'total_downloads': -1}}
        ]
        
        period_stats = list(COLLECTIONS['torrents'].aggregate(pipeline_period))
        
        # Torrent più popolari nel periodo
        popular_in_period = list(COLLECTIONS['torrents'].find({
            'upload_date': {
                '$gte': start_date,
                '$lte': end_date
            }
        }).sort('download_count', -1).limit(10))
        
        # Converti tutti gli ObjectId in stringhe
        for torrent in popular_in_period:
            torrent['_id'] = str(torrent['_id'])
            torrent['uploader_id'] = str(torrent.get('uploader_id', ''))
        
        # Funzione helper per convertire risultati aggregazione
        def convert_aggregation_results(results):
            converted = []
            for item in results:
                converted_item = {}
                for key, value in item.items():
                    if isinstance(value, ObjectId):
                        converted_item[key] = str(value)
                    else:
                        converted_item[key] = value
                converted.append(converted_item)
            return converted
        
        period_stats_converted = convert_aggregation_results(period_stats)
        
        return jsonify({
            'period': {
                'from': start_date.isoformat(),
                'to': end_date.isoformat()
            },
            'categories_in_period': period_stats_converted,
            'popular_in_period': popular_in_period
        })
        
    except Exception as e:
        print(f"Error in period stats: {e}")  # Debug
        return jsonify({'error': str(e)}), 500
        
# Funzione helper per aggiornare il rating
def update_torrent_rating(torrent_id):
    try:
        pipeline = [
            {'$match': {'torrent_id': ObjectId(torrent_id)}},
            {'$group': {
                '_id': '$torrent_id',
                'average_rating': {'$avg': '$rating'}
            }}
        ]
        
        result = list(COLLECTIONS['comments'].aggregate(pipeline))
        if result:
            COLLECTIONS['torrents'].update_one(
                {'_id': ObjectId(torrent_id)},
                {'$set': {'average_rating': round(result[0]['average_rating'], 2)}}
            )
    except Exception as e:
        print(f"Error updating rating: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)