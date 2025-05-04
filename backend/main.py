from backend.Number_Extract import process_inventory
from backend.Text_Extract import process_text_inventory
import json 
import os
import logging

# Get logger for this module
logger = logging.getLogger(__name__)

def merge_and_calculate(image_paths, debug_mode=False):
    """
    Merge quantity data from Number_Extract with item data from Text_Extract
    and calculate the total value for each item across multiple images.
    """
    # Log only filenames instead of full paths
    image_names = [os.path.basename(path) for path in image_paths]
    logger.debug(f"merge_and_calculate called with images: {image_names}")
    
    # Initialize results dictionary
    results = []  # List to store results from each image
    total = 0
    global_box_count = 0  # Global counter for continuous box numbering
    
    # Process each image
    for image_idx, image_path in enumerate(image_paths):
        image_name = os.path.basename(image_path)
        logger.debug(f"Processing image {image_idx+1}/{len(image_paths)}: {image_name}")
        
        # Process the image for quantities
        combined_box_texts = process_inventory(image_path, debug=debug_mode)
        # Process the image for item identification
        final_matches = process_text_inventory(image_path, debug=debug_mode)
        
        # Create results for this image
        image_results = []
        image_total = 0
        
        # Merge data and calculate values for this image
        for box_number, quantity_str in combined_box_texts.items():
            quantity = int(quantity_str)
            
            if box_number in final_matches:
                item_data = final_matches[box_number]
                item_name = item_data['name']
                item_value = item_data['value']
                total_value = round(quantity * item_value, 3)
                global_box_count += 1
                
                image_results.append({
                    'box_number': global_box_count,
                    'image_name': image_name,
                    'item_name': item_name,
                    'quantity': quantity,
                    'unit_value': item_value,
                    'total_value': total_value
                })
                
                image_total += total_value
                        
        results.extend(image_results)
        total += image_total
    
    results.sort(key=lambda x: x['box_number'])
    
    # Clean up results
    for item in results:
        item.pop('box_number', None)
        item.pop('image_name', None)

    # Save debug output if enabled
    if debug_mode:
        output = {
            'items': results,
            'total': total
        }
        try:
            with open('inventory_results.json', 'w') as f:
                json.dump(output, f, indent=4)
            logger.debug("Debug results saved to inventory_results.json")
        except Exception as e:
            logger.error(f"Failed to save debug results: {str(e)}")
    
    return results, total