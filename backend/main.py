from backend.Number_Extract import process_inventory
from backend.Text_Extract import process_text_inventory
import json 
import os
def merge_and_calculate(image_paths, debug=False):
    """
    Merge quantity data from Number_Extract with item data from Text_Extract
    and calculate the total value for each item across multiple images.
    """
    if debug:
        print(f"merge_and_calculate called with image_paths: {image_paths}", flush=True)
    # Initialize results dictionary
    results = []  # List to store results from each image
    total = 0
    global_box_count = 0  # Global counter for continuous box numbering
    
    # Process each image
    for image_idx, image_path in enumerate(image_paths):
        image_name = os.path.basename(image_path)
        if debug:
            print(f"\nProcessing image {image_idx+1}/{len(image_paths)}: {image_name}")
        
        # Process the image for quantities
        combined_box_texts = process_inventory(image_path, debug=debug)
        # Process the image for item identification
        final_matches = process_text_inventory(image_path, debug=debug)
        
        # Create results for this image
        image_results = []
        image_total = 0
        
        # Merge data and calculate values for this image
        for box_number, quantity_str in combined_box_texts.items():
            # Convert quantity string to integer
            quantity = int(quantity_str)
            
            # Get corresponding item data if it exists
            if box_number in final_matches:
                item_data = final_matches[box_number]
                item_name = item_data['name']
                item_value = item_data['value'] 
                
                # Calculate total value for this item
                total_value = round(quantity * item_value,3)  # Round to 3 decimal places
                
                # Increment global box counter
                global_box_count += 1
                
                # Store result for this item
                image_results.append({
                    'box_number': global_box_count,  # Use continuous numbering
                    'image_name': image_name,
                    'item_name': item_name,
                    'quantity': quantity,
                    'unit_value': item_value,
                    'total_value': total_value
                })
                
                # Add to image total
                image_total += total_value
        
        # Add image results to all results
        results.extend(image_results)
        total += image_total
        
        if debug:
            # Print image summary
            print(f"Image {image_name} - Items: {len(image_results)}, Total Value: {image_total:.2f}")
    
    # Print final combined results
    print("\nInventory Results:")
    print("-" * 60)
    print(f"{'Item':^5} | {'Item':^25} | {'Qty':^5} | {'Unit Val':^8} | {'Total':^10}")
    print("-" * 60)
    
    # Sort by box number
    results.sort(key=lambda x: x['box_number'])
    
    for item in results:
        print(f"{item['item_name']:<25} | {item['quantity']:^5} | "
              f"{item['unit_value']:>7.2f} | {item['total_value']:>9.2f}")
    
    print("-" * 60)
    print(f"Total: {total:.2f}")
    
        # Remove 'box_number' and 'image_name' directly from each item in the results list
    for item in results:
            item.pop('box_number', None)
            item.pop('image_name', None)

    # Save results to JSON if debug is enabled

    if debug:
        output = {
            'items': results,  # Use the modified results list
            'total': total
        }

        with open('inventory_results.json', 'w') as f:
            json.dump(output, f, indent=4)
        print("\nDetailed results saved to 'inventory_results.json'")
    
    return results, total