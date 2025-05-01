from flask import Flask, render_template, request, jsonify, send_from_directory
import tempfile
import os
from backend.main import merge_and_calculate

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
        print("Received request to process images.")
        
        # Get the list of images from the request
        images = request.files.getlist('image')  # Handle multiple files
        if not images:
            print("No images uploaded.")
            return jsonify({'error': 'No images uploaded'}), 400

        device = request.form.get('device', 'unknown')
        print(f"Device: {device}")

        # Save images temporarily and process them
        image_paths = []
        for image in images:
            temp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            try:
                image.save(temp.name)  # Save the uploaded image to the temporary file
                image_paths.append(temp.name)
                print(f"Saved image to temporary file: {temp.name}")
            finally:
                temp.close()  # Ensure the file is closed to avoid locking issues

        # Process the images using merge_and_calculate
        print("Calling merge_and_calculate...")
        results, total = merge_and_calculate(image_paths, debug=False)
        print(f"Processing complete. Total: {total}, Results: {results}")

        # Clean up temporary files
        for path in image_paths:
            os.unlink(path)
            print(f"Deleted temporary file: {path}")

        # Return results and total as JSON
        return jsonify({
            'results': results,
            'total': total  # Use 'total' here
        })

    except Exception as e:
        print("Error occurred while processing images:", e)
        return jsonify({'error': 'Failed to process images'}), 500

if __name__ == '__main__':
    app.run(debug=False)


