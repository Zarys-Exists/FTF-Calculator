// Track if files are selected
let filesSelected = false;
let promptAccepted = false;

// Enhanced container size adjustment function
function adjustContainerSize(container, callback = null) {
    // Store the current height before any changes
    const startHeight = container.offsetHeight;
    
    // Set transition for smooth height change
    container.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Temporarily remove transition to measure new height
    requestAnimationFrame(() => {
        container.style.height = 'auto';
        const targetHeight = container.scrollHeight;
        
        // Reset to start height
        container.style.height = `${startHeight}px`;
        
        // Force browser reflow
        container.offsetHeight;
        
        // Animate to new height
        requestAnimationFrame(() => {
            container.style.height = `${targetHeight}px`;
            
            // Execute callback after transition if provided
            if (callback) {
                container.addEventListener('transitionend', () => {
                    callback();
                }, { once: true });
            }
        });
    });
}

// Update file selection status when files are chosen
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const fileCountDisplay = document.getElementById('fileCount');
    const files = Array.from(this.files);
    
    filesSelected = files.length > 0;
    
    if (!filesSelected) {
        fileCountDisplay.textContent = 'No files chosen';
        fileCountDisplay.style.color = '#fffcfcee';
    } else {
        fileCountDisplay.textContent = `Selected ${files.length} file(s)`;
        fileCountDisplay.style.color = '#00e787';
    }

    // Only hide results and prompt if they are currently shown
    const resultsDiv = document.getElementById('results');
    const promptDiv = document.getElementById('itemListPrompt');
    const container = document.querySelector('.container');
    
    if (resultsDiv.classList.contains('show')) {
        // Fade out results first
        resultsDiv.style.transition = 'opacity 0.3s ease';
        resultsDiv.style.opacity = '0';
        promptDiv.style.transition = 'opacity 0.3s ease';
        promptDiv.style.opacity = '0';
        
        setTimeout(() => {
            resultsDiv.classList.remove('show');
            resultsDiv.innerHTML = '';
            promptDiv.style.display = 'none';
            
            // Adjust container size after content is hidden
            adjustContainerSize(container);
        }, 300);
    }

    // Check if second container exists (means prompt was accepted)
    const secondContainer = document.querySelector('.second-container');
    if (secondContainer) {
        // Gracefully fade out second container and reset main container
        secondContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // First move containers
        secondContainer.style.opacity = '0';
        secondContainer.style.transform = 'translateX(100%)';
        container.classList.remove('slide-left');
        
        // After animation completes, clean up
        setTimeout(() => {
            const wrapper = document.querySelector('.container-wrapper');
            if (wrapper) {
                // Maintain container position during DOM movement
                const rect = container.getBoundingClientRect();
                document.body.appendChild(container);
                container.style.position = 'fixed';
                container.style.top = rect.top + 'px';
                container.style.left = rect.left + 'px';
                wrapper.remove();
                
                // Reset container position gracefully
                requestAnimationFrame(() => {
                    container.style.position = '';
                    container.style.top = '';
                    container.style.left = '';
                });
            }
            secondContainer.remove();
        }, 500);
    }
});

// Process button click handler
document.getElementById('processButton').addEventListener('click', async () => {
    if (!filesSelected) {
        alert("Please upload at least one inventory screenshot.");
        return;
    }

    const container = document.querySelector('.container');
    const resultsDiv = document.getElementById('results');
    const errorMessage = document.getElementById('errorMessage');
    const promptDiv = document.getElementById('itemListPrompt'); // Reference to the prompt

    // Clear previous results and error messages
    resultsDiv.innerHTML = ''; // Clear previous results
    resultsDiv.classList.remove('show'); // Hide results container
    errorMessage.style.opacity = '0'; // Hide error message
    promptDiv.style.display = 'none'; // Hide the prompt initially

    const formData = new FormData();
    const files = document.getElementById('imageUpload').files;
    Array.from(files).forEach(file => formData.append('image', file)); // Add new files to FormData

    try {
        // Send images to the backend
        const response = await fetch('/process', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to process the images.');
        }

        const data = await response.json();
        console.log("Backend response:", data); // Debugging

        // Store results globally for use in the second container
        window.backendResults = data.results || [];

        // Ensure the total value exists in the response
        if (!data.total) {
            throw new Error('No total value returned from the backend.');
        }

        // Display the grand total in the results container
        resultsDiv.innerHTML = `
            <h3><p>Grand Total: <strong>${data.total.toFixed(2)} hunters</strong></p></h3>
        `;
        console.log("Updated resultsDiv content:", resultsDiv.innerHTML); // Debugging

        // Ensure the resultsDiv is visible
        resultsDiv.style.opacity = '1'; // Make sure it's visible
        resultsDiv.classList.add('show'); // Add the 'show' class to make it visible

        // Show the prompt
        promptDiv.style.display = 'block'; // Make the prompt visible
        promptDiv.style.opacity = '1'; // Fade in the prompt

        // Adjust container size to fit the results and prompt
        adjustContainerSize(container);
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'An error occurred while processing the images. Please try again.';
        errorMessage.style.opacity = '1'; // Show error message
    }
});

// Handle yes/no buttons
document.querySelector('.no-btn').addEventListener('click', () => {
    const prompt = document.getElementById('itemListPrompt');
    const container = document.querySelector('.container');
    
    prompt.style.opacity = '0';
    
    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.opacity = '1';
        adjustContainerSize(container);
    }, 300);
});

function updateCalculateButtonState() {
    const calculateButton = document.getElementById('processButton');

    if (!filesSelected || promptAccepted) {
        calculateButton.disabled = true;
        calculateButton.style.opacity = '0.5';
        calculateButton.style.cursor = 'not-allowed';
    } else {
        calculateButton.disabled = false;
        calculateButton.style.opacity = '1';
        calculateButton.style.cursor = 'pointer';
    }
}

// Modify the yes button click handler
document.querySelector('.yes-btn').addEventListener('click', () => {
    const prompt = document.getElementById('itemListPrompt');
    const container = document.querySelector('.container');

    prompt.style.opacity = '0';

    setTimeout(() => {
        prompt.style.display = 'none';
        prompt.style.opacity = '1';

        // Create containers and adjust sizes first
        if (!document.querySelector('.container-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'container-wrapper';
            container.parentNode.insertBefore(wrapper, container);
            wrapper.appendChild(container);
        }

        const secondContainer = document.createElement('div');
        secondContainer.className = 'second-container';
        document.querySelector('.container-wrapper').appendChild(secondContainer);

        // Generate and append the table to the second container
        const table = generateResultsTable();
        secondContainer.appendChild(table);

        // Adjust sizes before animation
        adjustContainerSize(container, () => {
            secondContainer.style.height = `${container.offsetHeight}px`;

            // Trigger animations after next frame
            requestAnimationFrame(() => {
                container.classList.add('slide-left');
                secondContainer.classList.add('show');
            });
        });
    }, 300);

    promptAccepted = true;
    updateCalculateButtonState();
});

// Modify the file input change handler
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const fileCountDisplay = document.getElementById('fileCount');
    const files = Array.from(this.files);
    
    filesSelected = files.length > 0;
    
    if (!filesSelected) {
        fileCountDisplay.textContent = 'No files chosen';
        fileCountDisplay.style.color = '#fffcfcee';
    } else {
        fileCountDisplay.textContent = `Selected ${files.length} file(s)`;
        fileCountDisplay.style.color = '#00e787';
    }

    // Only hide results and prompt if they are currently shown
    const resultsDiv = document.getElementById('results');
    const promptDiv = document.getElementById('itemListPrompt');
    const container = document.querySelector('.container');
    
    if (resultsDiv.classList.contains('show')) {
        // Fade out results first
        resultsDiv.style.transition = 'opacity 0.3s ease';
        resultsDiv.style.opacity = '0';
        promptDiv.style.transition = 'opacity 0.3s ease';
        promptDiv.style.opacity = '0';
        
        setTimeout(() => {
            resultsDiv.classList.remove('show');
            resultsDiv.innerHTML = '';
            promptDiv.style.display = 'none';
            
            // Adjust container size after content is hidden
            adjustContainerSize(container);
        }, 300);
    }

    // Check if second container exists (means prompt was accepted)
    const secondContainer = document.querySelector('.second-container');
    if (secondContainer) {
        // Gracefully fade out second container and reset main container
        secondContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // First move containers
        secondContainer.style.opacity = '0';
        secondContainer.style.transform = 'translateX(100%)';
        container.classList.remove('slide-left');
        
        // After animation completes, clean up
        setTimeout(() => {
            const wrapper = document.querySelector('.container-wrapper');
            if (wrapper) {
                // Maintain container position during DOM movement
                const rect = container.getBoundingClientRect();
                document.body.appendChild(container);
                container.style.position = 'fixed';
                container.style.top = rect.top + 'px';
                container.style.left = rect.left + 'px';
                wrapper.remove();
                
                // Reset container position gracefully
                requestAnimationFrame(() => {
                    container.style.position = '';
                    container.style.top = '';
                    container.style.left = '';
                });
            }
            secondContainer.remove();
        }, 500);
    }
    promptAccepted = false;
    updateCalculateButtonState();
});

// Initial button state
updateCalculateButtonState();

function generateResultsTable() {
    // Get the results from the backend response (assume it's stored globally or passed here)
    const results = window.backendResults || []; // Replace with actual results if needed

    // Create the table element
    const table = document.createElement('table');
    table.className = 'results-table';

    // Create the table header
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>No.</th>
        <th>Item Name</th>
        <th>Qty</th>
        <th>Item Value</th>
        <th>Total Value</th>
    `;
    table.appendChild(headerRow);

    // Populate the table rows with data
    results.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td> <!-- Serial number -->
            <td>${item.item_name}</td>
            <td>${item.quantity}</td>
            <td>${item.unit_value.toFixed(2)}</td>
            <td>${(item.quantity * item.unit_value).toFixed(2)}</td>
        `;
        table.appendChild(row);
    });

    return table;
}

