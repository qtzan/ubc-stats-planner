// This helper function hides all course details and resets node/edge colours
function resetGraph() {
    const allCourseDetails = document.querySelectorAll('.course-details');
    allCourseDetails.forEach(detail => {
        detail.style.display = 'none';
    });

    const allNodes = document.querySelectorAll('.node');
    allNodes.forEach(node => {
        node.querySelector('ellipse').setAttribute('fill', '#f2f2f2');
    });

    const allEdges = document.querySelectorAll('.edge');
    allEdges.forEach(edge => {
        const edgePath = edge.querySelector('path');
        const edgePolygon = edge.querySelector('polygon');

        edgePath.setAttribute('stroke', '#f2f2f2');
        edgePolygon.setAttribute('stroke', '#f2f2f2');
        edgePolygon.setAttribute('fill', '#f2f2f2');
    });
}

// Colour a node and walk every prereq/coreq edge feeding into it, recursively,
// all the way down to courses with no further prereqs. `collector`, if given,
// accumulates every course code touched along the way.
function highlightChain(courseCode, colour, visited, collector) {
    if (visited.has(courseCode)) return;
    visited.add(courseCode);
    if (collector) collector.add(courseCode);

    document.querySelectorAll('.node').forEach(node => {
        const titleElement = node.querySelector('title');
        if (titleElement.textContent.replace(/\s+/g, '') === courseCode) {
            node.querySelector('ellipse').setAttribute('fill', colour);
        }
    });

    document.querySelectorAll('.edge').forEach(edge => {
        const edgeTitle = edge.querySelector('title');
        const edgeText = edgeTitle.textContent.replace(/\s+/g, '');
        const [src, dst] = edgeText.split("->");

        if (dst === courseCode) {
            const edgePath = edge.querySelector('path');
            const edgePolygon = edge.querySelector('polygon');
            edgePath.setAttribute('stroke', 'black');
            edgePolygon.setAttribute('stroke', 'black');
            edgePolygon.setAttribute('fill', 'black');

            highlightChain(src, colour, visited, collector);
        }
    });
}

// This function highlights a given node and its full prerequisite/corequisite chain
function highlightPrerequisites(node, colour, collector) {
    const titleElement = node.querySelector('title');
    const courseCode = titleElement.textContent.replace(/\s+/g, '');
    highlightChain(courseCode, colour, new Set(), collector);
}

function setActiveNode(node) {
    resetGraph();
    applySelectionHighlight();

    // Get the course code from the node's title element
    const titleElement = node.querySelector('title');
    const courseCode = titleElement.textContent.replace(/\s+/g, '');

    // Show the clicked course's details
    const courseDetail = document.getElementById(courseCode);
    courseDetail.style.display = 'block';

    // Highlight the node and its full prerequisite/corequisite chain
    highlightPrerequisites(node, 'lightgreen');
}

const MAX_SELECTED_COURSES = 3;
const selectedCourses = new Set();

function formatCode(code) {
    const match = code.match(/^([A-Za-z]+)(\d+)$/);
    return match ? `${match[1]} ${match[2]}` : code;
}

// Show/update the "courses you'll need" summary for the current selection
function updateSummary(requiredCourses) {
    const summaryContainer = document.getElementById('course-summary');
    const summaryList = document.getElementById('course-summary-list');
    if (!summaryContainer || !summaryList) return;

    if (selectedCourses.size === 0) {
        summaryContainer.classList.add('hidden');
        return;
    }

    summaryContainer.classList.remove('hidden');
    summaryList.innerHTML = '';
    Array.from(requiredCourses)
        .filter(code => !selectedCourses.has(code))
        .sort()
        .forEach(code => {
            const li = document.createElement('li');
            li.textContent = formatCode(code);
            summaryList.appendChild(li);
        });
}

// Re-draw the graph so every selected course and its full prereq/coreq chain is
// highlighted, and refresh the summary list of every course that chain requires
function applySelectionHighlight() {
    const requiredCourses = new Set();

    document.querySelectorAll('.node').forEach(node => {
        const titleElement = node.querySelector('title');
        const courseCode = titleElement.textContent.replace(/\s+/g, '');

        if (selectedCourses.has(courseCode)) {
            highlightPrerequisites(node, '#bfdbfe', requiredCourses);
        }
    });

    updateSummary(requiredCourses);
}

document.querySelectorAll(".concentration-button").forEach(btn => {
    btn.addEventListener("click", () => {
        const code = btn.dataset.code;

        if (selectedCourses.has(code)) {
            selectedCourses.delete(code);
            btn.classList.remove('bg-blue-800', 'text-white');
            btn.classList.add('hover:bg-blue-300', 'bg-blue-200', 'text-gray-900');
        } else {
            if (selectedCourses.size >= MAX_SELECTED_COURSES) {
                return;
            }
            selectedCourses.add(code);
            btn.classList.remove('hover:bg-blue-300', 'bg-blue-200', 'text-gray-900');
            btn.classList.add('bg-blue-800', 'text-white');
        }

        resetGraph();
        applySelectionHighlight();
    });
});

document.getElementById('save-path-btn')?.addEventListener('click', async () => {
    if (!window.IS_LOGGED_IN) {
        openAuthModal('Please log in or sign up to save this path.');
        return;
    }

    const slug = document.getElementById('concentration-buttons').dataset.slug;
    const statusEl = document.getElementById('save-path-status');
    statusEl.classList.add('hidden');

    const response = await fetch(`/api/concentrations/${slug}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: Array.from(selectedCourses) })
    });
    const data = await response.json();

    if (!response.ok) {
        alert(data.error || 'Something went wrong.');
        return;
    }

    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 3000);
});

document.addEventListener('DOMContentLoaded', function() {

    // Get all node elements in the SVG
    const nodes = document.querySelectorAll('.node');

    // Set default styles on each node
    nodes.forEach(node => {
        node.addEventListener('click', () => setActiveNode(node));
        node.style.cursor = 'pointer';

        const ellipse = node.querySelector('ellipse');
        ellipse.setAttribute('stroke', '#111827');
        ellipse.setAttribute('stroke-width', '0.75');

        const textElements = node.querySelectorAll('text');
        textElements.forEach(text => {
            text.setAttribute('font-size', '13.00');
        })
    });

});
