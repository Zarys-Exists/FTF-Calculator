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

    // Remove edit button if it exists
    const editButton = document.querySelector('.edit-button');
    if (editButton) {
        editButton.remove();
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

        // Create edit button but don't show it yet
        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.textContent = 'Edit';
        document.querySelector('.container-wrapper').appendChild(editButton);
        
        // Add click handler to edit button
        editButton.addEventListener('click', function() {
            toggleEditMode(this);
        });

        // Adjust sizes before animation
        adjustContainerSize(container, () => {
            secondContainer.style.height = `${container.offsetHeight}px`;

            // Trigger animations after next frame
            requestAnimationFrame(() => {
                container.classList.add('slide-left');
                secondContainer.classList.add('show');
                
                // Add delay for edit button appearance
                setTimeout(() => {
                    editButton.classList.add('show');
                }, 300); // Show button after second container animation (300ms)
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

    // Remove edit button if it exists
    const editButton = document.querySelector('.edit-button');
    if (editButton) {
        editButton.remove();
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
    // Create wrapper div for the content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'table-content-wrapper';

    // Create the table element
    const table = document.createElement('table');
    table.className = 'results-table';    // Create the table header
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>No.</th>
        <th>Item Name</th>
        <th>Qty</th>
        <th>Item Value</th>
        <th>Total Value</th>
        <th class="delete-column">Delete</th>
    `;
    table.appendChild(headerRow);    // Populate the table rows with data
    const results = window.backendResults || [];    results.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td data-original="${item.item_name}">${item.item_name}</td>
            <td data-original="${item.quantity}">${item.quantity}</td>
            <td data-original="${item.unit_value.toFixed(2)}">${item.unit_value.toFixed(2)}</td>
            <td>${(item.quantity * item.unit_value).toFixed(2)}</td>            <td class="delete-column">
                <button class="delete-btn">✕</button>
            </td>
        `;
        table.appendChild(row);
    });

    contentWrapper.appendChild(table);

    return contentWrapper;
}

// Add these functions at the end of the file

function toggleEditMode(editButton) {
    const table = document.querySelector('.results-table');
    const isEditing = table.classList.toggle('edit-mode');
    const wrapper = document.querySelector('.container-wrapper');
    
    // Toggle visibility of delete column
    const deleteColumns = table.querySelectorAll('.delete-column');
    deleteColumns.forEach(col => {
        col.style.display = isEditing ? '' : 'none';
    });
    
    if (isEditing) {
        // Create save and add item buttons if they don't exist
        if (!document.querySelector('.save-button')) {
            const addItemButton = document.createElement('button');
            addItemButton.className = 'add-item-button';
            addItemButton.textContent = 'Add Item';
            wrapper.appendChild(addItemButton);

            const saveButton = document.createElement('button');
            saveButton.className = 'save-button';
            saveButton.textContent = 'Save';
            wrapper.appendChild(saveButton);

            // Add click handler for add item button
            addItemButton.addEventListener('click', () => {
                addNewRow(table);
            });

            // Add click handler for save button
            saveButton.addEventListener('click', () => {
                saveChanges();
                editButton.removeAttribute('data-mode');  // Reset to purple
                toggleEditMode(editButton);
                saveButton.classList.remove('show');
                addItemButton.classList.remove('show');
                setTimeout(() => {
                    saveButton.remove();
                    addItemButton.remove();
                }, 300);
            });
            
            // Show the buttons with animation
            setTimeout(() => {
                addItemButton.classList.add('show');
                saveButton.classList.add('show');
            }, 10);
        }

        // Show the add item button
        const addItemButton = document.querySelector('.add-item-button');
        if (addItemButton) {
            setTimeout(() => addItemButton.classList.add('show'), 10);
        }
        
    // Add delete button handlers and make cells editable
        table.querySelectorAll('tr:not(:first-child)').forEach(row => {
            const qtyCell = row.cells[2];
            const nameCell = row.cells[1];
            const valueCell = row.cells[3];
            const deleteBtn = row.querySelector('.delete-btn');
            
            // Add delete functionality
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    row.style.opacity = '0';
                    row.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        row.remove();
                        updateRowNumbers(table);
                    }, 300);
                });
            }
            
            qtyCell.contentEditable = "true";
            nameCell.contentEditable = "true";
            
            // Store original values for both name and value
            nameCell.dataset.original = nameCell.textContent;
            valueCell.dataset.original = valueCell.textContent;
            qtyCell.dataset.original = qtyCell.textContent;
            
            // Add input validation and auto-calculation
            qtyCell.addEventListener('input', function(e) {
                validateNumberInput(e);
                recalculateRow(e);
            });
            nameCell.addEventListener('input', validateItemName);
            
            // Prevent enter key from creating new lines
            [qtyCell, nameCell].forEach(cell => {
                cell.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        cell.blur();
                        return false;
                    }
                });
                
                // Prevent pasting of content with newlines
                cell.addEventListener('paste', function(e) {
                    e.preventDefault();
                    let text = (e.originalEvent || e).clipboardData.getData('text/plain');
                    text = text.replace(/[\r\n]/g, ''); // Remove newlines
                    if (cell === nameCell) {
                        text = text.replace(/\s+/g, ' '); // Convert multiple spaces to single space
                        text = text.replace(/[^a-zA-Z0-9 ]/g, ''); // Only allow letters, numbers and spaces
                        if (text.length > 25) text = text.slice(0, 25);
                    }
                    document.execCommand('insertText', false, text);
                });
            });
        });
          editButton.textContent = 'Cancel';
        editButton.setAttribute('data-mode', 'cancel');  // Add red styling
    } else {        // Revert to view mode
        const existingSaveButton = document.querySelector('.save-button');
        const existingAddButton = document.querySelector('.add-item-button');

        // Hide and remove buttons with animation
        if (existingSaveButton) {
            existingSaveButton.classList.remove('show');
            setTimeout(() => existingSaveButton.remove(), 300);
        }
        if (existingAddButton) {
            existingAddButton.classList.remove('show');
            setTimeout(() => existingAddButton.remove(), 300);
        }
        
        // If canceling, restore all original values
        if (editButton.textContent === 'Cancel') {
            table.querySelectorAll('tr:not(:first-child)').forEach(row => {
                const nameCell = row.cells[1];
                const qtyCell = row.cells[2];
                const valueCell = row.cells[3];
                const totalCell = row.cells[4];
                
                nameCell.textContent = nameCell.dataset.original;
                qtyCell.textContent = qtyCell.dataset.original;
                valueCell.textContent = valueCell.dataset.original;
                totalCell.textContent = (parseFloat(valueCell.dataset.original) * parseInt(qtyCell.dataset.original)).toFixed(2);
            });
        }
        
        // Remove editability
        table.querySelectorAll('[contenteditable]').forEach(cell => {
            cell.contentEditable = "false";
        });
          // Recalculate all totals
        recalculateAllTotals();
        editButton.textContent = 'Edit';
        editButton.removeAttribute('data-mode');  // Reset to purple
    }
}

function validateNumberInput(event) {
    const cell = event.target;
    
    // Get cursor position before making changes
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const cursorPosition = range.startOffset;
    const oldLength = cell.textContent.length;
    
    // Only allow digits and strip leading zeros (except single zero)
    let value = cell.textContent.replace(/[^\d]/g, '');
    if (value.length > 1 && value[0] === '0') {
        value = value.slice(1);
    }
    
    // Handle empty case
    if (!value) {
        value = '0';
    }
    
    // Limit to range 0-20
    let numValue = parseInt(value, 10);
    if (numValue > 20) {
        value = '20';
    }
    
    // Only update if content changed
    if (value !== cell.textContent) {
        // Calculate new cursor position based on what changed
        let newPosition;
        if (value.length > oldLength) {
            // If adding characters, keep cursor after the new character
            newPosition = cursorPosition + (value.length - oldLength);
        } else {
            // If removing characters, keep cursor at the removal point
            newPosition = cursorPosition - (oldLength - value.length);
        }
        // Ensure cursor position is within bounds
        newPosition = Math.max(0, Math.min(newPosition, value.length));
        
        // Update content
        cell.textContent = value;
        
        // Restore cursor position
        const newRange = document.createRange();
        newRange.setStart(cell.firstChild || cell, newPosition);
        newRange.setEnd(cell.firstChild || cell, newPosition);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

function recalculateRow(event) {
    const row = event.target.closest('tr');
    const qty = parseFloat(row.cells[2].textContent) || 0;
    const unitValue = parseFloat(row.cells[3].textContent) || 0;
    const totalValue = (qty * unitValue).toFixed(2);
    row.cells[4].textContent = totalValue;
}

function recalculateAllTotals() {
    const table = document.querySelector('.results-table');
    let grandTotal = 0;
    
    table.querySelectorAll('tr:not(:first-child)').forEach(row => {
        const qty = parseFloat(row.cells[2].textContent) || 0;
        const unitValue = parseFloat(row.cells[3].textContent) || 0;
        const totalValue = qty * unitValue;
        row.cells[4].textContent = totalValue.toFixed(2);
        grandTotal += totalValue;
    });
    
    // Update the grand total in the first container
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <h3><p>Grand Total: <strong>${grandTotal.toFixed(2)} hunters</strong></p></h3>
    `;
}

function saveChanges() {
    const table = document.querySelector('.results-table');
    const changedRows = [];
    const rowsToDelete = [];
    
    // First pass: identify rows with changes and invalid rows
    table.querySelectorAll('tr:not(:first-child)').forEach(row => {
        const nameCell = row.cells[1];
        const qtyCell = row.cells[2];
        const valueCell = row.cells[3];
        const totalCell = row.cells[4];
        const currentName = nameCell.textContent.trim();
        const currentQty = parseInt(qtyCell.textContent) || 0;
        const isNewRow = nameCell.dataset.original === '';
        
        // Always mark rows for deletion if they have no name or no quantity
        if (currentName === '' || currentQty === 0) {
            rowsToDelete.push(row);
            return;
        }

        const hasNameChange = currentName !== nameCell.dataset.original;
        const hasQtyChange = currentQty !== parseInt(qtyCell.dataset.original);
        
        if (hasNameChange || hasQtyChange || isNewRow) {
            changedRows.push({
                row,
                cells: { nameCell, qtyCell, valueCell, totalCell },
                changes: {
                    hasNameChange,
                    hasQtyChange,
                    currentName,
                    currentQty,
                    originalName: nameCell.dataset.original,
                    originalQty: parseInt(qtyCell.dataset.original),
                    originalValue: parseFloat(valueCell.dataset.original),
                    isNewRow
                }
            });
        }
    });      // Always process deletions first
      if (rowsToDelete.length > 0) {
          rowsToDelete.forEach(row => {
              row.style.opacity = '0';
              row.style.transition = 'opacity 0.3s ease';
              setTimeout(() => {
                  row.remove();
                  updateRowNumbers(table);
              }, 300);
          });
          
          // Update backend data and recalculate totals after deletions
          setTimeout(() => {
              updateBackendResults(table);
              recalculateAllTotals();
          }, 350);
      }

      if (changedRows.length > 0) {
          const processChanges = async () => {
              try {
                  // Only fetch item list if we have name changes
                  const hasNameChanges = changedRows.some(r => r.changes.hasNameChange);
                  let itemList = null;
                  
                  if (hasNameChanges) {
                      const response = await fetch('/ftf_items.json');
                      itemList = await response.json();
                  }                  // Process each changed row
                changedRows.forEach(({ row, cells, changes }) => {
                    const { nameCell, qtyCell, valueCell, totalCell } = cells;
                    
                    // For new rows or name changes, validate against item list
                    if ((changes.isNewRow || changes.hasNameChange) && itemList) {
                        const matchedItem = itemList.items.find(item => 
                            item.name.toLowerCase() === changes.currentName.toLowerCase());
                        
                        if (matchedItem) {
                            nameCell.textContent = matchedItem.name;
                            nameCell.dataset.original = matchedItem.name;
                            valueCell.textContent = matchedItem.value.toFixed(2);
                            valueCell.dataset.original = matchedItem.value.toFixed(2);
                        } else if (changes.isNewRow) {
                            rowsToDelete.push(row);
                            return;
                        } else {
                            nameCell.textContent = changes.originalName;
                            valueCell.textContent = changes.originalValue.toFixed(2);
                        }
                    }
                              // Always update quantity if it changed
                    if (changes.hasQtyChange) {
                        qtyCell.textContent = changes.currentQty.toString();
                        qtyCell.dataset.original = changes.currentQty.toString();
                    }

                    // Update total for this row
                    const currentQty = changes.hasQtyChange ? changes.currentQty : (parseInt(qtyCell.textContent) || 0);
                    const currentValue = parseFloat(valueCell.textContent) || 0;
                    totalCell.textContent = (currentQty * currentValue).toFixed(2);                });

                // Update backend data and recalculate totals after processing changes
                setTimeout(() => {
                    updateBackendResults(table);
                    recalculateAllTotals();
                }, 350);
                
            } catch (error) {
                console.error('Error processing changes:', error);                // On error, revert name changes but keep quantity changes
                changedRows.forEach(({ cells, changes }) => {
                    if (changes.hasNameChange) {
                        cells.nameCell.textContent = changes.originalName;
                        cells.valueCell.textContent = changes.originalValue.toFixed(2);
                    }
                    // Preserve quantity changes even on error
                    if (changes.hasQtyChange) {
                        cells.qtyCell.textContent = changes.currentQty.toString();
                        cells.qtyCell.dataset.original = changes.currentQty.toString();
                        // Update total
                        const currentValue = parseFloat(cells.valueCell.textContent) || 0;
                        cells.totalCell.textContent = (changes.currentQty * currentValue).toFixed(2);
                    }
                });
            }
        };

        processChanges();
    }
    // No need for else block as recalculateAllTotals is already called in the success path
}

function updateBackendResults(table) {
    window.backendResults = [];
    let grandTotal = 0;
    
    table.querySelectorAll('tr:not(:first-child)').forEach(row => {
        const quantity = parseInt(row.cells[2].textContent) || 0;
        const unitValue = parseFloat(row.cells[3].textContent) || 0;
        grandTotal += quantity * unitValue;
        
        window.backendResults.push({
            item_name: row.cells[1].textContent,
            quantity: quantity,
            unit_value: unitValue
        });
    });
    
    // Update the grand total display
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <h3><p>Grand Total: <strong>${grandTotal.toFixed(2)} hunters</strong></p></h3>
    `;
}

function validateItemName(event) {
    const cell = event.target;
    const prevContent = cell.dataset.prevContent || cell.textContent;
    
    // Get cursor position before making changes
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const cursorPosition = range.startOffset;

    // Only allow letters, numbers and spaces
    let value = cell.textContent.replace(/[^a-zA-Z0-9 ]/g, '');
    
    // If we're already at max length and trying to add more characters, block the addition
    if (prevContent.length === 25 && value.length > prevContent.length) {
        // Block any additions when at the limit
        value = prevContent;
    }
    // If we're under the limit but would go over, truncate
    else if (value.length > 25) {
        value = value.slice(0, 25);
    }
    
    // Store current content for next comparison
    cell.dataset.prevContent = value;
    
    // Only update if content changed
    if (value !== cell.textContent) {
        // Calculate new cursor position based on what changed
        let newPosition;
        if (prevContent.length === 25 && value === prevContent) {
            // If we blocked new characters, keep cursor where it was
            newPosition = cursorPosition;
        } else if (value.length > cell.textContent.length) {
            // If adding characters (within limit), keep cursor after the new character
            newPosition = cursorPosition + (value.length - cell.textContent.length);
        } else {
            // If removing characters, keep cursor at the removal point
            newPosition = cursorPosition - (cell.textContent.length - value.length);
        }
        
        // Ensure cursor position is within bounds
        newPosition = Math.max(0, Math.min(newPosition, value.length));
        
        // Update content
        cell.textContent = value;
        
        // Restore cursor position
        const newRange = document.createRange();
        newRange.setStart(cell.firstChild || cell, newPosition);
        newRange.setEnd(cell.firstChild || cell, newPosition);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

function updateRowNumbers(table) {
    table.querySelectorAll('tr:not(:first-child)').forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });
}

function addNewRow(table) {
    // Get the next row number
    const nextRowNumber = table.querySelectorAll('tr').length;
    const row = document.createElement('tr');

    // Create new row with empty item name and quantity defaulted to 1
    row.innerHTML = `
        <td>${nextRowNumber}</td>
        <td data-original="" contenteditable="true"></td>
        <td data-original="1" contenteditable="true">1</td>
        <td data-original="0.00">0.00</td>
        <td>0.00</td>
        <td class="delete-column">
            <button class="delete-btn">✕</button>
        </td>
    `;

    // Add the row to the table
    table.appendChild(row);

    // Get cells that need event listeners
    const nameCell = row.cells[1];
    const qtyCell = row.cells[2];
    const deleteBtn = row.querySelector('.delete-btn');

    // Add delete functionality
    deleteBtn.addEventListener('click', function() {
        row.style.opacity = '0';
        row.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            row.remove();
            updateRowNumbers(table);
        }, 300);
    });

    // Add input validation
    nameCell.addEventListener('input', validateItemName);
    qtyCell.addEventListener('input', function(e) {
        validateNumberInput(e);
        recalculateRow(e);
    });

    // Prevent enter key from creating new lines
    [qtyCell, nameCell].forEach(cell => {
        cell.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                cell.blur();
                return false;
            }
        });
        
        // Prevent pasting of content with newlines
        cell.addEventListener('paste', function(e) {
            e.preventDefault();
            let text = (e.originalEvent || e).clipboardData.getData('text/plain');
            text = text.replace(/[\r\n]/g, '');
            if (cell === nameCell) {
                text = text.replace(/\s+/g, ' ');
                text = text.replace(/[^a-zA-Z0-9 ]/g, '');
                if (text.length > 25) text = text.slice(0, 25);
            }
            document.execCommand('insertText', false, text);
        });
    });

    // Focus on the name cell for immediate editing
    nameCell.focus();
}

