from flask import Flask, render_template, request, jsonify, send_from_directory
import logging
import tempfile
import os
import sys
from backend.main import merge_and_calculate

# Remove all existing handlers
root_logger = logging.getLogger()
if root_logger.handlers:
    for handler in root_logger.handlers:
        root_logger.removeHandler(handler)

class TesseractFilter(logging.Filter):
    def filter(self, record):
        return 'tesseract' not in record.getMessage().lower()

# Create and configure a single handler
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', '%H:%M:%S'))
handler.addFilter(TesseractFilter())  # Add filter to handler

# Configure root logger
root_logger.setLevel(logging.INFO)
root_logger.addHandler(handler)

# Get logger for this module
logger = logging.getLogger(__name__)

# Disable Flask's default access logs
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.disabled = True

app = Flask(__name__, static_folder='frontend')

# Serve the frontend (index.html) page
@app.route('/')
def serve_frontend():
    return send_from_directory('frontend', 'index.html')

# Serve static files (CSS, JS) from the frontend folder
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('frontend', path)

# Route to handle image upload and processing
@app.route('/process', methods=['POST'])
def process_inventory_route():
    try:
        logger.info("Received request to process images.")
        
        # Get the list of images from the request
        images = request.files.getlist('image')  # Handle multiple files
        if not images:
            logger.warning("No images uploaded.")
            return jsonify({'error': 'No images uploaded'}), 400

        device = request.form.get('device', 'unknown')
        logger.info(f"Device: {device}")

        # Save images temporarily and process them
        image_paths = []
        temp_dir = tempfile.gettempdir()
        for image in images:
            temp_filename = next(tempfile._get_candidate_names()) + ".png"
            temp_path = os.path.join(temp_dir, temp_filename)
            try:
                image.save(temp_path)
                image_paths.append(temp_path)
                logger.debug(f"Saved image: {os.path.basename(temp_path)}")
            except Exception as e:
                logger.error(f"Failed to save image: {str(e)}")
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise

        # Process the images using merge_and_calculate
        logger.info("Calling merge_and_calculate...")
        results, total = merge_and_calculate(image_paths, debug_mode=DEBUG_MODE)
        logger.info(f"Processing complete. Total: {total:.2f}")


        # Clean up temporary files
        for path in image_paths:
            os.unlink(path)
            logger.debug(f"Deleted temporary file: {os.path.basename(path)}")

        return jsonify({
            'results': results,
            'total': total
        })

    except Exception as e:
        logger.error("Error occurred while processing images:", exc_info=True)
        return jsonify({'error': 'Failed to process images'}), 500

#TODO Debug configuration
DEBUG_MODE = False

if __name__ == '__main__':
    # Disable Flask's default startup messages
    os.environ['FLASK_ENV'] = 'production'
    cli = sys.modules['flask.cli']
    cli.show_server_banner = lambda *x: None
    
    logger.info("Starting Flask server at http://127.0.0.1:5000")
    app.run(debug=DEBUG_MODE)


