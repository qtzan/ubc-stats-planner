from flask import Flask, render_template, request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
import subprocess
import sqlite3
import json
import re
import os


app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')

DB_PATH = 'course_map.db'


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            year_level TEXT NOT NULL,
            major TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            course_code TEXT NOT NULL,
            difficulty INTEGER NOT NULL,
            enjoyment INTEGER NOT NULL,
            UNIQUE(user_id, course_code)
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            course_code TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS saved_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            concentration_slug TEXT NOT NULL,
            concentration_title TEXT NOT NULL,
            selected_courses TEXT NOT NULL,
            required_courses TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    ''')
    conn.commit()
    conn.close()


init_db()


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return user


@app.context_processor
def inject_current_user():
    return {'current_user': get_current_user()}


# Build the rating summary, comment list, and the current user's own rating (if any) for a course
def get_course_reviews(conn, code, user):
    ratings = conn.execute(
        'SELECT AVG(difficulty) AS avg_difficulty, AVG(enjoyment) AS avg_enjoyment, COUNT(*) AS rating_count '
        'FROM ratings WHERE course_code = ?', (code,)
    ).fetchone()

    comments = conn.execute(
        'SELECT comments.body, comments.created_at, users.name, ratings.difficulty, ratings.enjoyment '
        'FROM comments '
        'JOIN users ON users.id = comments.user_id '
        'LEFT JOIN ratings ON ratings.user_id = comments.user_id AND ratings.course_code = comments.course_code '
        'WHERE comments.course_code = ? ORDER BY comments.created_at DESC', (code,)
    ).fetchall()

    user_rating = None
    if user:
        user_rating = conn.execute(
            'SELECT difficulty, enjoyment FROM ratings WHERE user_id = ? AND course_code = ?',
            (user['id'], code)
        ).fetchone()

    return {
        'avg_difficulty': round(ratings['avg_difficulty'], 1) if ratings['rating_count'] else None,
        'avg_enjoyment': round(ratings['avg_enjoyment'], 1) if ratings['rating_count'] else None,
        'rating_count': ratings['rating_count'],
        'comments': [dict(c) for c in comments],
        'user_rating': dict(user_rating) if user_rating else None,
    }


@app.route('/signup', methods=['POST'])
def signup():
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    name = request.form.get('name', '').strip()
    year_level = request.form.get('year_level', '').strip()
    major = request.form.get('major', '').strip()

    if not all([email, password, name, year_level, major]):
        return jsonify({'error': 'All fields are required.'}), 400

    conn = get_db()
    if conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
        conn.close()
        return jsonify({'error': 'An account with that email already exists.'}), 400

    cur = conn.execute(
        'INSERT INTO users (email, password_hash, name, year_level, major) VALUES (?, ?, ?, ?, ?)',
        (email, generate_password_hash(password), name, year_level, major)
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    session['user_id'] = user_id
    return jsonify({'name': name})


@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Incorrect email or password.'}), 401

    session['user_id'] = user['id']
    return jsonify({'name': user['name']})


@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'ok': True})


@app.route('/api/courses/<code>/review', methods=['POST'])
def review_course(code):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'You must be logged in to rate and review a course.'}), 401

    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'Please leave a comment along with your rating.'}), 400

    try:
        difficulty = int(data.get('difficulty'))
        enjoyment = int(data.get('enjoyment'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Please select a difficulty and enjoyment rating.'}), 400

    if not (1 <= difficulty <= 5 and 1 <= enjoyment <= 5):
        return jsonify({'error': 'Ratings must be between 1 and 5 stars.'}), 400

    conn = get_db()
    conn.execute(
        'INSERT INTO ratings (user_id, course_code, difficulty, enjoyment) VALUES (?, ?, ?, ?) '
        'ON CONFLICT(user_id, course_code) DO UPDATE SET difficulty = excluded.difficulty, enjoyment = excluded.enjoyment',
        (user['id'], code, difficulty, enjoyment)
    )
    conn.execute(
        'INSERT INTO comments (user_id, course_code, body, created_at) VALUES (?, ?, ?, ?)',
        (user['id'], code, body, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    reviews = get_course_reviews(conn, code, user)
    conn.close()
    return jsonify(reviews)


# Check if a course code is a STAT course
def is_stat(code):
    return isinstance(code, str) and code.startswith('STAT')


# Split a course code into its subject and number, e.g. "AI322" -> ("AI", "322"),
# keeping any trailing section letter attached to the number, e.g. "PSYC305A" -> ("PSYC", "305A")
def split_code(code):
    match = re.match(r'([A-Za-z]+)(\d+[A-Za-z]*)', code)
    return match.group(1), match.group(2)


# Recursively extract any course codes from a prereq/coreq node
def extract_codes(node, code_type, code_filter, out=None):
    if out is None:
        out = set()

    if isinstance(node, list):
        for n in node:
            extract_codes(n, code_type, code_filter, out)
        return out

    if isinstance(node, dict):
        if 'code' in node and code_filter(node['code']):
            out.add((node['code'], code_type))

        # Recurse into logical keys if present
        for k in ['any', 'all']:
            if k in node:
                extract_codes(node[k], code_type, code_filter, out)

    return out


# Recursively collect a flat, sorted list of every code referenced in a prereq/coreq node
def flatten_codes(node):
    if not node:
        return []
    codes = {code for code, _ in extract_codes(node, 'any', lambda c: True)}
    return sorted(codes)


# Walk every prereq/coreq chain starting from a set of course codes, all the way
# down to courses with no further prereqs (mirrors the graph's highlight logic)
def full_closure(course_by_code, start_codes):
    visited = set()
    stack = list(start_codes)
    while stack:
        code = stack.pop()
        if code in visited:
            continue
        visited.add(code)
        course = course_by_code.get(code)
        if not course:
            continue
        for dep in course.get('prereq_codes', []) + course.get('coreq_codes', []):
            if dep not in visited:
                stack.append(dep)
    return visited


# Format a list of raw course codes ("CPSC302") as readable "SUBJ NUM" strings
def format_codes(codes):
    return sorted(' '.join(split_code(code)) for code in codes)


# Build links between courses based on prerequisites and corequisites
def build_links(courses, code_filter=is_stat):

    # Map of course codes to dependencies (prerequisites and corequisites)
    dependencies = {}
    for course in courses:
        deps = set()
        if 'prereqs' in course:
            deps = extract_codes(course['prereqs'], 'prereq', code_filter, deps)
        if 'coreqs' in course:
            deps = extract_codes(course['coreqs'], 'coreq', code_filter, deps)
        dependencies[course['code']] = deps

    # Build links: for each dependency create a dictionary
    links = []
    for code, deps in dependencies.items():
        for dep_code, dep_type in deps:
            links.append({
                'source': code,
                'target': dep_code,
                'type': dep_type
            })

    return links


def generateGraph(courseData, code_filter=is_stat):
    links = build_links(courseData, code_filter)

    # Convert links to DOT format
    dot_links = []
    for link in links:
        source_subject, source_number = split_code(link['source'])
        target_subject, target_number = split_code(link['target'])
        source = f"{source_subject}\n{source_number}"
        target = f"{target_subject}\n{target_number}"
        if link['type'] == 'coreq':
            dot_links.append(f'"{target}" -> "{source}" [style=dashed color="gray95"]; ')
        else:
            dot_links.append(f'"{target}" -> "{source}" [color="gray95"]; ')

    # Explicitly declare every course as a node so ones with no prereqs and that
    # aren't a prereq for anything else (e.g. standalone electives) still appear
    node_declarations = []
    for course in courseData:
        if code_filter(course['code']):
            subject, number = split_code(course['code'])
            node_declarations.append(f'"{subject}\n{number}";')

    body = '\n'.join(dot_links + node_declarations)

    return f"""digraph {{
        outputorder="edgesfirst";
        rankdir="BT";
        splines="line";
        node [style=filled fillcolor="#f2f2f2"];
        edge [penwidth=1];
        {body}
    }}
    """


# Replace the fixed pt width/height that dot emits with 100% so the SVG
# scales down to fit its container instead of overflowing and scrolling
def make_svg_responsive(svg):
    return re.sub(r'<svg width="\d+pt" height="\d+pt"', '<svg width="100%" height="100%"', svg, count=1)


def loadData(filename):
    with open(f'data/{filename}') as f:
        courses = json.load(f)

    for course in courses:
        num = course["code"][4:]
        course ["grades_url"] = f"https://ubcgrades.com/statistics-by-course#UBCV-STAT-{num}"
           
        
    return courses

def loadPrograms(filename):
    with open(f'data/{filename}') as f:
        programs = json.load(f)

    return programs


# Load a thematic concentration's course list (allowed concentration courses plus
# their prereq/coreq chain), annotating each with its subject/number and a flat
# list of direct prereq/coreq codes for display
def loadConcentrationData(filename):
    with open(f'data/{filename}') as f:
        courses = json.load(f)

    for course in courses:
        subject, number = split_code(course['code'])
        course['subject'] = subject
        course['number'] = number
        course['prereq_codes'] = flatten_codes(course.get('prereqs'))
        course['coreq_codes'] = flatten_codes(course.get('coreqs'))

    return courses


@app.route('/')
def index():
    courseData = loadData("courses.json")
    courseGraph = generateGraph(courseData)
    courseMap = make_svg_responsive(subprocess.check_output(['dot', '-Tsvg'], input=courseGraph.encode()).decode('utf-8'))
    programs = loadPrograms('programs.json')

    user = get_current_user()
    conn = get_db()
    for course in courseData:
        course.update(get_course_reviews(conn, course['code'], user))
    conn.close()

    return render_template("index.html", courseMap=courseMap, courseData=courseData, programs=programs)

@app.route('/thematic-concentration')
def thematic_concentration():
    user = get_current_user()
    saved_paths = []
    if user:
        conn = get_db()
        rows = conn.execute(
            'SELECT id, concentration_title, selected_courses, required_courses, created_at '
            'FROM saved_paths WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)
        ).fetchall()
        conn.close()
        saved_paths = [
            {
                'id': row['id'],
                'title': row['concentration_title'],
                'selected': format_codes(json.loads(row['selected_courses'])),
                'required': format_codes(json.loads(row['required_courses'])),
            }
            for row in rows
        ]
    return render_template("thematic_concentration.html", saved_paths=saved_paths)

# Maps each thematic concentration's URL slug to its course data file and page title
CONCENTRATIONS = {
    'computer-science': ('cpsc_concentration.json', 'Computer Science Concentration'),
    'economics': ('econ_concentration.json', 'Economics Concentration'),
    'psychology': ('psych_concentration.json', 'Psychology Concentration'),
    'commerce': ('commerce_concentration.json', 'Commerce Concentration'),
    'life-sciences': ('life_sciences_concentration.json', 'Life Sciences Concentration'),
    'environmental-science': ('eosc_concentration.json', 'Environmental Science Concentration'),
    'philosophy': ('phil_concentration.json', 'Philosophy Concentration'),
}

@app.route('/thematic-concentration/<field>')
def concentration_field(field):
    if field not in CONCENTRATIONS:
        name = field.replace('-', ' ').title()
        return render_template("concentration_field.html", field=name)

    filename, title = CONCENTRATIONS[field]
    courseData = loadConcentrationData(filename)
    courseGraph = generateGraph(courseData, code_filter=lambda c: True)
    courseMap = make_svg_responsive(subprocess.check_output(['dot', '-Tsvg'], input=courseGraph.encode()).decode('utf-8'))
    allowedCourses = [course for course in courseData if course.get('allowed')]
    return render_template("concentration_graph.html", title=title, slug=field, courseMap=courseMap, courseData=courseData, allowedCourses=allowedCourses)


@app.route('/api/concentrations/<slug>/save', methods=['POST'])
def save_concentration_path(slug):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'You must be logged in to save a path.'}), 401

    if slug not in CONCENTRATIONS:
        return jsonify({'error': 'Unknown concentration.'}), 404

    data = request.get_json(silent=True) or {}
    selected = data.get('selected')
    if not isinstance(selected, list) or not selected:
        return jsonify({'error': 'Select at least one course to save.'}), 400

    filename, title = CONCENTRATIONS[slug]
    courseData = loadConcentrationData(filename)
    course_by_code = {course['code']: course for course in courseData}
    valid_codes = {course['code'] for course in courseData if course.get('allowed')}

    selected = sorted({code for code in selected if code in valid_codes})
    if not selected:
        return jsonify({'error': 'Select at least one valid course to save.'}), 400

    required = sorted(full_closure(course_by_code, selected) - set(selected))

    conn = get_db()
    conn.execute(
        'INSERT INTO saved_paths (user_id, concentration_slug, concentration_title, selected_courses, required_courses, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        (user['id'], slug, title, json.dumps(selected), json.dumps(required), datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/saved-paths/<int:path_id>/delete', methods=['POST'])
def delete_saved_path(path_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'You must be logged in.'}), 401

    conn = get_db()
    conn.execute('DELETE FROM saved_paths WHERE id = ? AND user_id = ?', (path_id, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True)
