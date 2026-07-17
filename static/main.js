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

// ---------------------------------------------------------------------------
// Course ratings and comments (submitted independently of each other)
// ---------------------------------------------------------------------------

// Reflect a course's latest reviews (rating summary + comment list) in the DOM
function updateCourseReviews(code, reviews) {
    const summary = document.querySelector(`.rating-summary[data-course="${code}"]`);
    if (summary) {
        summary.innerHTML = reviews.rating_count
            ? `<div class="grid grid-cols-2 gap-2">
                <div class="rounded-lg bg-blue-50 border border-blue-200 p-2 text-center">
                    <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Difficulty</p>
                    <p class="text-2xl font-bold text-gray-900">${reviews.avg_difficulty}<span class="text-sm font-normal text-gray-500">/5</span></p>
                </div>
                <div class="rounded-lg bg-blue-50 border border-blue-200 p-2 text-center">
                    <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Enjoyment</p>
                    <p class="text-2xl font-bold text-gray-900">${reviews.avg_enjoyment}<span class="text-sm font-normal text-gray-500">/5</span></p>
                </div>
               </div>
               <p class="text-xs text-gray-500 mt-1 text-center">Based on ${reviews.rating_count} rating${reviews.rating_count !== 1 ? 's' : ''}</p>`
            : '<p class="text-sm text-gray-600">No ratings yet.</p>';
    }

    const commentList = document.querySelector(`.comment-list[data-course="${code}"]`);
    if (commentList) {
        commentList.innerHTML = '';
        reviews.comments.forEach(comment => {
            const li = document.createElement('li');
            li.className = 'text-sm text-gray-900';

            const strong = document.createElement('strong');
            strong.textContent = `${comment.name}: `;
            li.appendChild(strong);

            if (comment.difficulty && comment.enjoyment) {
                const ratingSpan = document.createElement('span');
                ratingSpan.className = 'text-xs text-gray-500';
                ratingSpan.textContent = `(Difficulty: ${comment.difficulty}/5, Enjoyment: ${comment.enjoyment}/5) `;
                li.appendChild(ratingSpan);
            }

            li.appendChild(document.createTextNode(comment.body));
            commentList.appendChild(li);
        });
    }
}

function fillStars(container, value) {
    container.dataset.value = value;
    container.querySelectorAll('.star').forEach(star => {
        const starValue = Number(star.dataset.value);
        star.classList.toggle('text-yellow-400', starValue <= value);
        star.classList.toggle('text-gray-300', starValue > value);
    });
}

document.querySelectorAll('.star-rating').forEach(container => {
    container.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', () => {
            if (!window.IS_LOGGED_IN) {
                openAuthModal('Please log in or sign up to rate this course.');
                return;
            }
            fillStars(container, Number(star.dataset.value));
        });
    });
});

document.querySelectorAll('.save-rating-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const code = btn.dataset.course;

        if (!window.IS_LOGGED_IN) {
            openAuthModal('Please log in or sign up to rate this course.');
            return;
        }

        const difficulty = Number(document.querySelector(`.star-rating[data-course="${code}"][data-type="difficulty"]`).dataset.value);
        const enjoyment = Number(document.querySelector(`.star-rating[data-course="${code}"][data-type="enjoyment"]`).dataset.value);

        if (!difficulty || !enjoyment) {
            alert('Please select both a difficulty and enjoyment rating.');
            return;
        }

        const response = await fetch(`/api/courses/${code}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty, enjoyment })
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Something went wrong.');
            return;
        }

        updateCourseReviews(code, data);
    });
});

document.querySelectorAll('.anon-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const isAnonymous = btn.dataset.anonymous === 'true';
        btn.dataset.anonymous = (!isAnonymous).toString();
        btn.textContent = !isAnonymous ? 'Commenting anonymously' : `Commenting as: ${btn.dataset.name}`;
    });
});

document.querySelectorAll('.post-comment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const code = btn.dataset.course;

        if (!window.IS_LOGGED_IN) {
            openAuthModal('Please log in or sign up to leave a comment.');
            return;
        }

        const textarea = document.querySelector(`.comment-input[data-course="${code}"]`);
        const body = textarea.value.trim();
        if (!body) return;

        const anonymous = document.querySelector(`.anon-toggle-btn[data-course="${code}"]`).dataset.anonymous === 'true';

        const response = await fetch(`/api/courses/${code}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, anonymous })
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Something went wrong.');
            return;
        }

        textarea.value = '';
        updateCourseReviews(code, data);
    });
});
