// This helper function hides all course details and resets node/edge colours 
function resetGraph() {
    const allProgramButtons = document.querySelectorAll('.program-button');
    allProgramButtons.forEach(btn => {
        btn.classList.remove('bg-blue-800', 'text-white');
        btn.classList.add('hover:bg-blue-300', 'bg-blue-200', 'text-gray-900');
    });

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

// This function highlights a given node and all incoming edges
function highlightPrerequisites(node, colour) {
    const titleElement = node.querySelector('title');
    const courseCode = titleElement.textContent.replace(/\s+/g, '');

    // Update the node's fill colour
    node.querySelector('ellipse').setAttribute('fill', colour);

    // Highlight incoming edges (arrows pointing TO this node)
    const edges = document.querySelectorAll('.edge');
    edges.forEach(edge => {
        const edgeTitle = edge.querySelector('title');
        const edgeText = edgeTitle.textContent.replace(/\s+/g, '');
                
        const edgePath = edge.querySelector('path');
        const edgePolygon = edge.querySelector('polygon'); 
        const parts = edgeText.split("->");
        const dst = parts[1];  

        // Get edges that point TO our selected node AND are a prerequisite
        if (dst === courseCode) {
            edgePath.setAttribute('stroke', 'black');
            edgePolygon.setAttribute('stroke', 'black');
            edgePolygon.setAttribute('fill', 'black');
        }     
    });

}

function setActiveNode(node) {
    resetGraph();

    // Get the course code from the node's title element
    const titleElement = node.querySelector('title');
    const courseCode = titleElement.textContent.replace(/\s+/g, '');

    // Show the clicked course's details
    const courseDetail = document.getElementById(courseCode);
    courseDetail.style.display = 'block';

    // Highlight the node and the its incoming edges
    highlightPrerequisites(node, 'lightgreen');
}

document.querySelectorAll(".program-button").forEach(btn => {
    btn.addEventListener("click", () => {
        resetGraph();

        // Highlight the active program button
        btn.classList.remove('hover:bg-blue-300', 'bg-blue-200', 'text-gray-900');
        btn.classList.add('bg-blue-800', 'text-white');

        const programName = btn.dataset.program;
        const nodes = document.querySelectorAll('.node');

        const programButtons = document.getElementById("program-buttons");
        const data = JSON.parse(programButtons.dataset.programs);

        const selected = data.find(p => p.program === programName);
        const statsRequirements = selected.stats_requirements;
        const codeSet = new Set(statsRequirements.map(item => item.code));

        nodes.forEach(node => {
            const titleElement = node.querySelector('title');
            const courseCode = titleElement.textContent.replace(/\s+/g, '');

            if (codeSet.has(courseCode)) {
                highlightPrerequisites(node, '#bfdbfe');
            }
        });
    });
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
