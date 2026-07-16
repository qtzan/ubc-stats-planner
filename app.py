from flask import Flask, render_template
import subprocess
import json
import re


app = Flask(__name__)


# Check if a course code is a STAT course
def is_stat(code):
    return isinstance(code, str) and code.startswith('STAT')


# Split a course code into its subject and number, e.g. "AI322" -> ("AI", "322")
def split_code(code):
    match = re.match(r'([A-Za-z]+)(\d+)', code)
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

    links_str = '\n'.join(dot_links)

    return f"""digraph {{
        outputorder="edgesfirst";
        rankdir="BT";
        splines="line";
        node [style=filled fillcolor="#f2f2f2"];
        edge [penwidth=1];
        {links_str}
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
    return render_template("index.html", courseMap=courseMap, courseData=courseData, programs=programs)

@app.route('/thematic-concentration')
def thematic_concentration():
    return render_template("thematic_concentration.html")

@app.route('/thematic-concentration/computer-science')
def cpsc_concentration():
    courseData = loadConcentrationData('cpsc_concentration.json')
    courseGraph = generateGraph(courseData, code_filter=lambda c: True)
    courseMap = make_svg_responsive(subprocess.check_output(['dot', '-Tsvg'], input=courseGraph.encode()).decode('utf-8'))
    allowedCourses = [course for course in courseData if course.get('allowed')]
    return render_template("cpsc_concentration.html", courseMap=courseMap, courseData=courseData, allowedCourses=allowedCourses)

@app.route('/thematic-concentration/<field>')
def concentration_field(field):
    name = field.replace('-', ' ').title()
    return render_template("concentration_field.html", field=name)

if __name__ == '__main__':
    app.run(debug=True)
