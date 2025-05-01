import cv2
import numpy as np
import pytesseract

def resize_image(image, target_width, target_height):
    """Resize an image to a specific width and height."""
    return cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LINEAR)

def enhance_image(image):
    """
    Basic image preprocessing that converts to grayscale and applies thresholding.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Apply threshold to get clear black and white image
    _, binary = cv2.threshold(gray, 195, 255, cv2.THRESH_BINARY)  # Original threshold for grayscale

    # Convert to HSV color space to isolate red
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)            
    
    # Define the range for red color in HSV
    lower_red = np.array([0, 100, 100])  # Adjust these values as needed
    upper_red = np.array([10, 255, 255])  # Adjust these values as needed
    lower_red2 = np.array([160, 100, 100])  # Second range for red
    upper_red2 = np.array([180, 255, 255])  # Second range for red

    # Create masks for red colors
    red_mask1 = cv2.inRange(hsv, lower_red, upper_red)
    red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)

    # Set red pixels to white in the binary image
    binary[red_mask > 0] = 255  # Set pixels in the binary image to white where red mask is applied

    return binary

def create_corner_mask(image, boxes, corner_percentage):
    """
    Create a mask that only shows the corner regions of each box.
    """
    # Create a black mask of the same size as the image
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    
    # For each box, fill in its corner region with white
    for box in boxes:
        corner_tl, corner_br = get_corner_region(box, corner_percentage)
        cv2.rectangle(mask, corner_tl, corner_br, 255, -1)  # -1 means fill
    
    return mask

def multi_preprocess_and_extract(enhanced_image, boxes, corner_percentage, debug=False):
    """
    Extract OCR results from the enhanced image and assign to boxes.
    Save OCR output in the debug file if debug is enabled.
    """
    # Initialize box_texts dictionary
    box_texts = {box["box_number"]: [] for box in boxes}
    
    try:
        # Use tesseract with digit-focused config
        config = '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789x'
        ocr_data = pytesseract.image_to_data(enhanced_image, config=config, 
                                          output_type=pytesseract.Output.DICT)
        
        # Process OCR results and assign to boxes
        for i in range(len(ocr_data["text"])):
            text = ocr_data["text"][i].strip()
            if text:  # Ignore empty text
                x = ocr_data["left"][i]
                y = ocr_data["top"][i]
                w = ocr_data["width"][i]
                h = ocr_data["height"][i]
                text_center = (x + w // 2, y + h // 2)
                
                # Find the box that contains this text
                for box in boxes:
                    corner_tl, corner_br = get_corner_region(box, corner_percentage)
                    # Check if text center is within the corner region
                    if (corner_tl[0] <= text_center[0] <= corner_br[0] and 
                        corner_tl[1] <= text_center[1] <= corner_br[1]):
                        box_texts[box["box_number"]].append(text)
                        break

        # Combine texts for each box, remove 'x' characters and handle empty boxes
        combined_box_texts = {}
        for box_number, texts in box_texts.items():
            combined_text = "".join(texts)
            # Remove 'x' characters and keep only digits
            cleaned_text = ''.join(char for char in combined_text if char.isdigit())
            # If box is empty or has no digits, set to '1'
            combined_box_texts[box_number] = cleaned_text if cleaned_text else '1'
            
        # Save OCR results if debug is enabled
        if debug:
            with open("ocr_results.txt", "w", encoding='utf-8') as f:
                f.write("=== OCR Results ===\n")
                f.write(str(box_texts))
            
                
                f.write("\n=== Numbers Only Results ===\n")
                for box_number in sorted(combined_box_texts.keys()):
                    text = combined_box_texts[box_number]
                    if text:  # Only write if there are numbers
                        numbers_only = extract_numbers_only(text)
                        if numbers_only:  # Only write if there are numbers
                            f.write(f"Box {box_number}: {numbers_only}\n")
                print("OCR results saved to 'ocr_results.txt'")
        
        return combined_box_texts
            
    except Exception as e:
        print(f"OCR error: {str(e)}")
        return {}

def extract_numbers_only(text):
    """Extract only numbers from text."""
    # Keep only numbers, remove everything else
    numbers_only = ''.join(char for char in text if char.isdigit())
    return numbers_only

def generate_grid(image, row_percentage=33.33, col_percentages=None):
    """Generate grid positions based on the image dimensions."""
    height, width, _ = image.shape
    
    # Calculate row positions based on row percentage
    row_step = int(height * (row_percentage / 100))
    row_positions = [i * row_step for i in range(1, 3)]  # 2 row lines for 3 rows
    
    # Calculate column positions based on specific percentages
    if col_percentages is None:
        col_percentages = [20, 20, 19.6, 19.0]  # Default: 4 columns (3 internal vertical lines)
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
            
    return boxes

def get_corner_region(box, corner_percentage):
    """
    Get the coordinates of the top-right corner region of a box.
    corner_percentage: how much of the box's width/height the corner square should occupy
    """
    top_left = box["top_left"]
    bottom_right = box["bottom_right"]
    
    box_width = bottom_right[0] - top_left[0]
    box_height = bottom_right[1] - top_left[1]
    
    square_size = min(box_width, box_height) * (corner_percentage / 100)
    
    # Calculate corner square coordinates (top-right corner)
    corner_left = bottom_right[0] - square_size
    corner_top = top_left[1]
    corner_right = bottom_right[0]
    corner_bottom = top_left[1] + square_size
    
    return (int(corner_left), int(corner_top)), (int(corner_right), int(corner_bottom))

def process_inventory(image_path, row_percentage=33.33, col_percentages=None, corner_percentage=20, debug=False):
    """Process inventory image and extract items."""
    
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

    # Generate grid
    boxes = generate_grid(resized_image, row_percentage=row_percentage, col_percentages=col_percentages)
    
    # Create mask for corner regions
    corner_mask = create_corner_mask(resized_image, boxes, corner_percentage)
    
    # Apply corner mask to the image
    masked_image = cv2.bitwise_and(resized_image, resized_image, mask=corner_mask)
    
    # Enhance the masked image
    enhanced_image = enhance_image(masked_image)

    if debug:
        cv2.imwrite("enhanced_image.png", enhanced_image)

    # Perform OCR on the enhanced image and assign text to boxes
    box_texts = multi_preprocess_and_extract(enhanced_image, boxes, corner_percentage, debug=False)

    return box_texts

if __name__ == "__main__":
    # Hardcoded values for row and column percentages
    row_percentage = 33.33  # Set your desired row percentage
    col_percentages = [20, 20, 20, 20]  # Set your desired column percentages
    corner_percentage = 26  # Size of corner square as percentage of box size (adjust this value as needed)
    debug = False # Set to True to enable debug mode
    
    # Load and process an image
    image_path = ""  # Example image path
    process_inventory(image_path, 
                     row_percentage=row_percentage, 
                     col_percentages=col_percentages, 
                     corner_percentage=corner_percentage,
                     debug=debug)