document.addEventListener('DOMContentLoaded', () => {
    const yourGrid = document.getElementById('your-offer-grid');
    const theirGrid = document.getElementById('their-offer-grid');
    const modal = document.getElementById('item-modal');
    const itemList = document.getElementById('item-list');
    const closeModalBtn = document.querySelector('.close-modal');
    const searchInput = document.getElementById('item-search');
    const resetBtn = document.getElementById('reset-trade-btn');
    const raritySidebar = document.querySelector('.rarity-sidebar');

    let allItems = [];
    let activeSlot = null;
    let currentRarity = 'all';
    let currentSHG = null; // Track the active SHG button

    // Add SHG buttons to rarity sidebar
    const shgButtons = document.createElement('div');
    shgButtons.className = 'shg-buttons';
    shgButtons.innerHTML = `
        <div class="shg-btn" data-shg="s">S</div>
        <div class="shg-btn" data-shg="h">H</div>
        <div class="shg-btn" data-shg="g">G</div>
    `;
    raritySidebar.appendChild(shgButtons);

    // Add event listener for SHG buttons
    shgButtons.addEventListener('click', handleSHGChange);

    // Fetch item data
    async function fetchItems() {
        try {
            const response = await fetch('/ftf_items.json');
            const data = await response.json();
            allItems = data.items;
            updateDisplayedItems();
        } catch (error) {
            console.error("Failed to load item list:", error);
            itemList.innerHTML = '<p style="color: red;">Could not load items.</p>';
        }
    }

    // Populate the modal with items
    function populateItemList(items) {
        itemList.innerHTML = '';
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('modal-item');
            
            // Create image container
            const imgContainer = document.createElement('div');
            imgContainer.className = 'modal-item-img';
            
            // Create and set up image with corrected path
            const img = document.createElement('img');
            img.src = `/items/${item.name.toLowerCase().replace(/\s+/g, ' ')}.png`;
            img.alt = item.name;
            // Fallback if image fails to load
            img.onerror = () => {
                img.src = '/items/default.png';
            };
            
            // Create name element
            const nameEl = document.createElement('div');
            nameEl.className = 'modal-item-name';
            nameEl.textContent = item.name;
            
            // Assemble elements
            imgContainer.appendChild(img);
            itemEl.appendChild(imgContainer);
            itemEl.appendChild(nameEl);
            
            itemEl.dataset.name = item.name;
            itemEl.dataset.value = item.value;
            itemList.appendChild(itemEl);
        });
    }

    // Update the displayed items based on current filters
    function updateDisplayedItems() {
        const searchQuery = searchInput.value.toLowerCase();
        
        let filteredItems = allItems;

        // Filter by rarity
        if (currentRarity !== 'all') {
            filteredItems = filteredItems.filter(item => item.rarity.toLowerCase() === currentRarity);
        }

        // Filter by search query
        if (searchQuery) {
            filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(searchQuery));
        }

        populateItemList(filteredItems);
    }

    // Create the 9 slots for a grid
    function createGridSlots(gridElement) {
        gridElement.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.classList.add('item-slot');
            slot.dataset.value = 0;
            slot.dataset.index = i;
            gridElement.appendChild(slot);
        }
    }

    // Open the modal to select an item
    function openModal(slot) {
        // Check if there are any empty slots before this one
        const grid = slot.parentElement;
        const slots = Array.from(grid.children);
        const currentIndex = parseInt(slot.dataset.index);
        
        // Find the first empty slot
        const firstEmptyIndex = slots.findIndex(s => !s.classList.contains('filled'));
        
        // If trying to fill a later slot when earlier ones are empty
        if (firstEmptyIndex !== -1 && currentIndex > firstEmptyIndex) {
            slot = slots[firstEmptyIndex]; // Target the first empty slot instead
        }
        
        activeSlot = slot;
        modal.style.display = 'flex';
    }

    // Close the modal
    function closeModal() {
        modal.style.display = 'none';
        searchInput.value = '';
        currentRarity = 'all'; // Reset rarity on close
        document.querySelector('.rarity-filter-btn.active').classList.remove('active');
        document.querySelector('.rarity-filter-btn[data-rarity="all"]').classList.add('active');
        updateDisplayedItems(); // Reset filter
    }

    // Handle item selection from the modal
    function selectItem(e) {
        const modalItem = e.target.closest('.modal-item');
        if (modalItem && activeSlot) {
            const name = modalItem.dataset.name;
            const value = modalItem.dataset.value;
            const imgSrc = modalItem.querySelector('img').src;

            activeSlot.innerHTML = `
                <div class="item-slot-content">
                    <div class="item-slot-img">
                        <img src="${imgSrc}" alt="${name}">
                    </div>
                    <div class="item-slot-name single-line">${name}</div>
                </div>
            `;
            activeSlot.dataset.value = value;
            activeSlot.classList.add('filled');
            
            // Adjust font size if text overflows
            const nameEl = activeSlot.querySelector('.item-slot-name');
            adjustTextSize(nameEl);
            
            closeModal();
            calculateAll();
        }
    }

    // Add this new function
    function adjustTextSize(element) {
        const maxWidth = element.offsetWidth;
        const text = element.textContent;
        let fontSize = 0.7; // Start with default size (in rem)
        
        element.style.fontSize = `${fontSize}rem`;
        while (element.scrollWidth > maxWidth && fontSize > 0.4) {
            fontSize -= 0.05;
            element.style.fontSize = `${fontSize}rem`;
        }
    }

    // Calculate total value for a grid and update display
    function calculateTotal(gridElement, totalElement) {
        const slots = gridElement.querySelectorAll('.item-slot');
        let total = 0;
        slots.forEach(slot => {
            total += Number(slot.dataset.value) || 0;
        });
        totalElement.textContent = `${total}`;
        return total;
    }

    // Determine and display WFL result
    function calculateWFL(yourValue, theirValue) {
        const resultEl = document.getElementById('wfl-result');
        const fillBar = document.getElementById('wfl-bar-fill');
        const difference = theirValue - yourValue;
        
        // Clear all possible classes first
        resultEl.classList.remove('wfl-result-win', 'wfl-result-fair', 'wfl-result-lose');

        if (yourValue === 0 && theirValue === 0) {
            resultEl.textContent = '--';
            resultEl.classList.add('wfl-result-fair');
            fillBar.style.width = '50%';
            fillBar.classList.remove('active');
            return;
        }

        fillBar.classList.add('active');

        const totalTradeValue = yourValue + theirValue;
        const ratio = totalTradeValue > 0 ? yourValue / totalTradeValue : 0; // Changed to use yourValue directly
        const clampedRatio = Math.max(0, Math.min(1, ratio)); // Changed range to 0-1
        const fillPercentage = clampedRatio * 100; // Simplified percentage calculation
        fillBar.style.width = `${fillPercentage}%`;

        // Set data-difference attribute for CSS targeting
        resultEl.setAttribute('data-difference', difference);

        if (difference === 0) {
            resultEl.textContent = 'Fair';
            resultEl.classList.add('wfl-result-fair');
        } else if (difference > 0) {
            resultEl.textContent = theirValue-yourValue + ' Win';
            resultEl.classList.add('wfl-result-win');
        } else {
            resultEl.textContent = yourValue - theirValue + ' Loss';
            resultEl.classList.add('wfl-result-lose');
        }
    }
    
    function calculateAll() {
        const yourTotal = calculateTotal(yourGrid, document.getElementById('your-total'));
        const theirTotal = calculateTotal(theirGrid, document.getElementById('their-total'));
        calculateWFL(yourTotal, theirTotal);
    }

    // Handle rarity filter clicks
    function handleRarityChange(e) {
        if (!e.target.matches('.rarity-filter-btn')) return;

        // Update active button style
        raritySidebar.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');

        // Update state and filter items
        currentRarity = e.target.dataset.rarity;
        updateDisplayedItems();
    }
    
    // Reset the entire trade calculator
    function resetTrade() {
        createGridSlots(yourGrid);
        createGridSlots(theirGrid);
        calculateAll();
    }

    // Handle clicks on filled slots to remove items
    function handleSlotClick(e) {
        const slot = e.target.closest('.item-slot');
        if (!slot) return;

        if (slot.classList.contains('filled')) {
            // Remove the item
            removeItemFromSlot(slot);
        } else {
            // Open modal for empty slot
            openModal(slot);
        }
    }

    // Remove item and reorder remaining items
    function removeItemFromSlot(slot) {
        const grid = slot.parentElement;
        const slots = Array.from(grid.children);
        const removedIndex = parseInt(slot.dataset.index);
        
        // Clear the slot
        slot.innerHTML = '';
        slot.classList.remove('filled');
        slot.dataset.value = '0';

        // Get all filled slots after the removed one
        const filledSlots = slots.slice(removedIndex + 1)
            .filter(s => s.classList.contains('filled'));

        // Move each subsequent item forward
        filledSlots.forEach((filledSlot, i) => {
            const targetSlot = slots[removedIndex + i];
            
            // Move the content
            targetSlot.innerHTML = filledSlot.innerHTML;
            targetSlot.dataset.value = filledSlot.dataset.value;
            targetSlot.classList.add('filled');
            
            // Clear the original slot
            filledSlot.innerHTML = '';
            filledSlot.classList.remove('filled');
            filledSlot.dataset.value = '0';
        });

        calculateAll();
    }

    // Handle SHG button clicks
    function handleSHGChange(e) {
        const shgBtn = e.target.closest('.shg-btn');
        if (!shgBtn) return;

        const shgValue = shgBtn.dataset.shg;

        // Deactivate the previously active button
        if (currentSHG) {
            shgButtons.querySelector(`.shg-btn[data-shg="${currentSHG}"]`).classList.remove('active');
        }

        // Activate the clicked button
        if (currentSHG !== shgValue) {
            shgBtn.classList.add('active');
            currentSHG = shgValue;
        } else {
            currentSHG = null;
        }

        updateDisplayedItems();
    }

    // Event Listeners
    yourGrid.addEventListener('click', handleSlotClick);
    theirGrid.addEventListener('click', handleSlotClick);
    
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });
    
    itemList.addEventListener('click', selectItem);
    searchInput.addEventListener('input', updateDisplayedItems);
    raritySidebar.addEventListener('click', handleRarityChange);
    resetBtn.addEventListener('click', resetTrade);

    // Initial setup
    createGridSlots(yourGrid);
    createGridSlots(theirGrid);
    fetchItems();
    calculateAll();
});
    // Initial setup
    createGridSlots(yourGrid);
    createGridSlots(theirGrid);
    fetchItems();
    calculateAll();
