import cv2
import numpy as np
import pytesseract
import json
from fuzzywuzzy import fuzz

def load_items():
    """Load items from JSON file."""
    try:
        with open('ftf_items.json', 'r') as f:
            data = json.load(f)
            return {item['name']: item['value'] for item in data['items']}
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print("Error: ftf_items.json could not be loaded")
        return {}  # Return an empty dictionary or handle as needed

def resize_image(image, target_width, target_height):
    """Resize an image to a specific width and height."""
    return cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LINEAR)

def enhance_image(image):
    """Enhance contrast and sharpness of the image."""
    upscale_factor = 2
    image = cv2.resize(image, (0, 0), fx=upscale_factor, fy=upscale_factor, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(binary, -1, kernel)

def match_items(lines, items, threshold=68, debug=False):
    """Match extracted lines against item names using perfect and fuzzy matching."""
    found_items = []
    matched_items = set()  # Track already matched items to avoid duplicates

    for line in lines:
        line = line.strip().lower()
        remaining_line = line  # Keep track of the remaining unmatched part of the line

        # Perfect matching
        for item_name in items:
            if item_name.lower() in remaining_line and item_name not in matched_items:
                found_items.append({'name': item_name, 'value': items[item_name]})
                matched_items.add(item_name)
                remaining_line = remaining_line.replace(item_name.lower(), '', 1).strip()

        # Fuzzy matching for unmatched parts
        if remaining_line:
            best_match = None
            highest_similarity = 0
            for item_name in items:
                if item_name not in matched_items:
                    similarity = fuzz.ratio(remaining_line, item_name.lower())
                    if debug:
                        print(f"Fuzzy match score for '{remaining_line}' and '{item_name}': {similarity}")  # Log similarity score
                    if similarity > highest_similarity and similarity >= threshold:
                        best_match = item_name
                        highest_similarity = similarity

            if best_match:
                found_items.append({'name': best_match, 'value': items[best_match]})
                matched_items.add(best_match)
    return found_items

def resolve_tie(line, tied_items):
    """Resolve ties by comparing characters of the extracted text and tied items."""
    best_match = tied_items[0]
    for item in tied_items:
        for i in range(min(len(line), len(item))):
            if line[i] != item[i]:
                # Select the item that is lexicographically closer to the line
                if abs(ord(line[i]) - ord(item[i])) < abs(ord(line[i]) - ord(best_match[i])):
                    best_match = item
                break
        else:
            # If all compared characters are the same, choose the shorter item
            if len(item) < len(best_match):
                best_match = item
    return best_match

def process_text_inventory(image_path, row_percentage=33.33, col_percentages=None, debug=False):
    """Process inventory image and extract items."""
    items = load_items()
    if debug:
        print(f"Loaded items from JSON: {items}")
    # Attempt to load the image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not open or find the image '{image_path}'. Please check the file path.")
        return []
    
    target_width, target_height = 1537, 850
    resized_image = resize_image(image, target_width, target_height)
    
    # Check if the resized image is valid
    if resized_image is None or resized_image.size == 0:
        print("Error: Resized image is invalid or empty.")
        return []

    # Calculate grid positions
    height, width, _ = resized_image.shape
    
    # Calculate row positions based on row percentage
    row_step = int(height * (row_percentage / 100))
    row_positions = [i * row_step for i in range(1, 3)]  # 2 row lines for 3 rows
    
    # Calculate column positions based on specific percentages
    if col_percentages is None:
        col_percentages = [20, 20, 19.3, 19.5]  # Default: 4 columns (3 internal vertical lines)
    col_positions = [int(sum(col_percentages[:i]) / 100 * width) for i in range(1, len(col_percentages) + 1)]
    
    # Add image boundaries as the first and last positions
    col_positions = [0] + col_positions + [width]
    row_positions = [0] + row_positions + [height]
    
    # Generate boxes
    boxes = []
    box_number = 1
    for i in range(len(row_positions) - 1):  # Iterate over rows
        for j in range(len(col_positions) - 1):  # Iterate over columns
            top_left = (col_positions[j], row_positions[i])
            bottom_right = (col_positions[j + 1], row_positions[i + 1])
            boxes.append({"box_number": box_number, "top_left": top_left, "bottom_right": bottom_right})
            box_number += 1
    
    total_boxes = box_number - 1  # Store the actual number of boxes
    
    # Draw grid lines if debug is enabled
    if debug:
        grid_image = resized_image.copy()
        
        # Draw and label boxes
        for box in boxes:
            top_left = box["top_left"]
            bottom_right = box["bottom_right"]
            
            # Draw the rectangle
            cv2.rectangle(grid_image, top_left, bottom_right, (255, 0, 0), 2)
            
            # Label the box with its number
            label_position = (top_left[0] + 10, top_left[1] + 30)
            cv2.putText(grid_image, str(box["box_number"]), label_position, cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        # Save the grid image for visualization
        grid_output_path = "grid_with_boxes.png"
        cv2.imwrite(grid_output_path, grid_image)
        print(f"\nGrid with boxes saved at {grid_output_path}")
    
    # Perform OCR on the enhanced image
    try:
        hsv = cv2.cvtColor(resized_image, cv2.COLOR_BGR2HSV)
        yellow_lower = np.array([30, 140, 140])
        yellow_upper = np.array([40, 255, 255])
        yellow_mask = cv2.inRange(hsv, yellow_lower, yellow_upper)
        
        # Enhance yellow color by increasing saturation and brightness
        yellow_regions = cv2.bitwise_and(hsv, hsv, mask=yellow_mask)
        h, s, v = cv2.split(yellow_regions)
        s = cv2.add(s, 50)  # Increase saturation
        v = cv2.add(v, 50)  # Increase brightness
        enhanced_yellow = cv2.merge([h, s, v])
        
        # Convert back to BGR for further processing
        enhanced_text_image_bgr = cv2.cvtColor(enhanced_yellow, cv2.COLOR_HSV2BGR)
        enhanced_text_image = cv2.bitwise_and(enhanced_text_image_bgr, enhanced_text_image_bgr, mask=yellow_mask)
        
        custom_config = r'--oem 3 --psm 6'
        ocr_data = pytesseract.image_to_data(enhanced_text_image, config=custom_config, output_type=pytesseract.Output.DICT)
        
        # Save the processed image if debug is enabled
        if debug:
            processed_image_path = "processed_image.png"
            cv2.imwrite(processed_image_path, enhanced_text_image)
            print(f"\nProcessed image saved at {processed_image_path}")
            
    except Exception as e:
        print("Error during OCR processing:", str(e))
        return []

    # Match text to boxes
    box_texts = {box["box_number"]: [] for box in boxes}  # Initialize box text storage
    for i in range(len(ocr_data["text"])):
        text = ocr_data["text"][i].strip()
        if text:  # Ignore empty text
            x, y, w, h = ocr_data["left"][i], ocr_data["top"][i], ocr_data["width"][i], ocr_data["height"][i]
            text_center = (x + w // 2, y + h // 2)
            
            # Find the box that contains the text
            for box in boxes:
                top_left = box["top_left"]
                bottom_right = box["bottom_right"]
                if top_left[0] <= text_center[0] <= bottom_right[0] and top_left[1] <= text_center[1] <= bottom_right[1]:
                    box_texts[box["box_number"]].append(text)
                    break
    
    # Combine all text from each box into a single string
    combined_box_texts = {box_number: " ".join(texts) for box_number, texts in box_texts.items()}
    
    # First pass: Get all potential matches for each box
    all_matches = {}  # Store all initial matches with scores
    best_matches_per_box = {}  # Store best match for each box
    items_to_boxes = {}  # Track which boxes have each item as their best match
    
    if debug:
        debug_log = []
        debug_log.append("=== Debug Log for Item Matching Process ===\n")

    # First pass: Collect ALL matches and identify best matches
    for box_number in range(1, len(boxes) + 1):
        combined_text = combined_box_texts.get(box_number, "").strip()
        
        if debug:
            debug_log.append(f"\n=== Initial Matching: Box {box_number} ===")
            debug_log.append(f"Raw detected text: '{combined_text}'")
        
        if not combined_text:
            print(f"Box {box_number} - Empty (No text detected)")
            if debug:
                debug_log.append("Result: No text detected in box")
            continue

        # Get matches for this box
        matched_items = match_items([combined_text], items)
        if matched_items:
            all_matches[box_number] = {
                'text': combined_text,
                'matches': []
            }
            
            if debug:
                debug_log.append("\nPotential matches:")
            
            # Store all matches with their scores
            for item in matched_items:
                similarity = fuzz.ratio(combined_text.lower(), item['name'].lower())
                match_info = {
                    'name': item['name'],
                    'value': item['value'],
                    'score': similarity
                }
                all_matches[box_number]['matches'].append(match_info)
                
                if debug:
                    debug_log.append(f"  - {item['name']}: Score {similarity}, Value {item['value']}")

            # Identify best match for this box
            best_match = max(all_matches[box_number]['matches'], key=lambda x: x['score'])
            best_matches_per_box[box_number] = best_match
            
            # Track which boxes have this item as their best match
            if best_match['name'] not in items_to_boxes:
                items_to_boxes[best_match['name']] = []
            items_to_boxes[best_match['name']].append({
                'box': box_number,
                'score': best_match['score']
            })

    # Identify duplicates (items that are best match for multiple boxes)
    duplicate_items = {item: boxes for item, boxes in items_to_boxes.items() if len(boxes) > 1}
    
    if debug and duplicate_items:
        debug_log.append("\n=== Duplicate Items Found ===")
        for item, boxes in duplicate_items.items():
            debug_log.append(f"\n{item} is best match for boxes: {[b['box'] for b in boxes]}")
            debug_log.append(f"Scores: {[b['score'] for b in boxes]}")

    # Initialize final matches
    final_matches = {}
    used_items = set()

    # First, assign non-duplicate best matches
    for box_number, best_match in best_matches_per_box.items():
        if best_match['name'] not in duplicate_items:
            final_matches[box_number] = best_match
            used_items.add(best_match['name'])
            if debug:
                debug_log.append(f"\nBox {box_number}: Assigned non-duplicate {best_match['name']} (Score: {best_match['score']})")

    # Handle duplicates
    for item_name, box_matches in duplicate_items.items():
        if debug:
            debug_log.append(f"\n=== Resolving duplicate: {item_name} ===")
        
        # Sort boxes by score for this item
        box_matches.sort(key=lambda x: x['score'], reverse=True)
        
        # Assign item to highest scoring box
        best_box = box_matches[0]['box']
        best_score = box_matches[0]['score']
        final_matches[best_box] = best_matches_per_box[best_box]
        used_items.add(item_name)
        
        if debug:
            debug_log.append(f"Assigned {item_name} to Box {best_box} (Score: {best_score})")

        # Rematch other boxes that had this as best match
        for box_info in box_matches[1:]:
            box_number = box_info['box']
            original_text = all_matches[box_number]['text']
            
            if debug:
                debug_log.append(f"\nRematching Box {box_number}")
                debug_log.append(f"Original text: '{original_text}'")
                debug_log.append("Excluding matched items: " + ", ".join(used_items))

            # Create dictionary of available items (excluding ALL used items)
            available_items = {k: v for k, v in items.items() if k not in used_items}
            
            # Try to match with remaining items
            new_matches = match_items([original_text], available_items)
            
            if new_matches:
                new_match = new_matches[0]
                new_score = fuzz.ratio(original_text.lower(), new_match['name'].lower())
                final_matches[box_number] = {
                    'name': new_match['name'],
                    'value': new_match['value'],
                    'score': new_score
                }
                used_items.add(new_match['name'])
                
                if debug:
                    debug_log.append(f"Found new match: {new_match['name']} (Score: {new_score})")
            else:
                if debug:
                    debug_log.append(f"No alternative match found for Box {box_number}")
                print(f"Box {box_number} - No alternative match found. Raw text: '{original_text}'")

    # Print final results
    if debug:
        print("\nFinal Results:")
        for box_number in sorted(final_matches.keys()):
            match = final_matches[box_number]
            match['value'] = round(match['value'], 3)  # Round to 3 decimal places
            print(f"Box {box_number} - {match['name']}: {match['value']}")
            debug_log.append(f"\nFinal: Box {box_number}: {match['name']} (Score: {match['score']}, Value: {match['value']})")
        

    if debug:# Print summary
        print(f"\nTotal Boxes: {total_boxes}")
        print(f"Total Extracted Items: {len(final_matches)}")
        print(f"Total Value: {round(sum(item['value'] for item in final_matches.values()), 2)}")
    
    if debug:
        with open("matching_debug.txt", "w", encoding='utf-8') as f:
            f.write("\n".join(debug_log))
        print("\nDebug log saved to 'matching_debug.txt'")
    
    return final_matches
