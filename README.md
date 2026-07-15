# Course Map Design

## Development

First, you will need to install Python, Git, and [Graphviz](https://graphviz.org/download/).

To run the app locally, execute the following commands in a terminal:

```bash
python -m venv .venv
source .venv/bin/activate # or source .venv\Scripts\activate in Powershell
pip install -r requirements.txt
python app.py
```

Then, go to https://localhost:5000 to preview the application.

## Contributing

This repository has protections on the master branch.

Therefore, you will need to make any modifications on a branch and then put up a PR for review:

```bash
# To create a branch:
git checkout -b $BRANCH_NAME
```

You can create a pull request from the [Github Repository](https://github.com/rileywheadon/uss-course-map). 
For an example, see [uss-course-map #1](https://github.com/rileywheadon/uss-course-map/pull/1)
After you create a PR, ping the #tech-team chat on Discord and someone will review.

## Tasks

### MVP (Minimum Viable Product)

- Must work properly on mobile and desktop
- Highlight courses when clicked (desktop only)
- Add license (CC NonCommerical-ShareAlike4.0)

 Suggestions from other USS teammates:

- Highlight the entire path required to take the course
- Add an indicator for old courses (STAT307, STAT308, STAT445)
	
### Additional Goals

Add links to UBCGrades:

- Add an additional field to the `courses.json` file
- Include the link in the course popup

Include prerequisite courses from other departments:

- Extend `courses.json` to include all prerequisites of the statistics courses
- Add a toggle to the course map to show non-STAT prerequisites

Display required/optional courses for all statistics programs:

- Create a new `programs.json` file that lists the requirements for [all programs](https://vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-science/bachelor-science/statistics)
- Add a menu to the course map that allows user to highlight program requirements
- See the [UBC Mathematics Course Map](https://ubcmath.github.io/coursemap/) for inspiration

## Architecture

- Web server: Flask
- Graph drawing: https://en.wikipedia.org/wiki/Layered_graph_drawing
- Graphviz documentation: https://graphviz.org/docs/layouts/dot/

General idea:

- User loads home page, sends HTTP request to Flask web server
- `/` endpoint makes the following calls: 
  - `generateGraph` which generates a graphviz dot file using `buildLinks`
  - `buildLinks`, which generates a list of links (source, target, type)
  - `getDependencies` is used by `buildLinks` to get dependencies from `courses.json`
  - Then, it executes `dot -Tsvg` and injects the resulting SVG into the response
- We have a Javascript file `main.js` that does the following:
  - On click, highlights the selected node and all prerequisite edges/nodes
  - Also fades out all other nodes to make it easier to focus
  - Unhides the sidebar and unhides the details for the selected course
  - When the user clicks off the course, it goes back to the default view
- We also have a CSS file `styles.css`: 
  - For basic hover effects in the SVG
  - For styling the sidebar containing course details

