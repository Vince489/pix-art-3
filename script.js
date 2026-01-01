const imageInput = document.getElementById('imageInput');
const paletteDiv = document.getElementById('palette');
const addColorButton = document.getElementById('addColor');
const applyQuantizationButton = document.getElementById('applyQuantization');
const applyPixelationButton = document.getElementById('applyPixelation');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const zoomInButton = document.getElementById('zoomIn');
const zoomOutButton = document.getElementById('zoomOut');
const resetZoomButton = document.getElementById('resetZoom');

// Elements for image information
const imageDimensions = document.getElementById('imageDimensions');
const colorCount = document.getElementById('colorCount');
const colorR = document.getElementById('colorR');
const colorG = document.getElementById('colorG');
const colorB = document.getElementById('colorB');
const colorHex = document.getElementById('colorHex');

// Zoom variables
let zoomLevel = 1.0;
let zoomPosition = { x: 0, y: 0 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

let palette = [];
let originalImage = null; // Store the original image
let lastPickedColor = null; // Store the last picked color

// Try to create a worker if browser supports it
let worker = null;
try {
    worker = new Worker('o.js');
    
    // Handle worker response
    worker.addEventListener('message', (event) => {
        const quantizedImageData = event.data;
        ctx.putImageData(quantizedImageData, 0, 0);
    });
} catch (e) {
    console.error("Worker initialization failed:", e);
    // Continue without the worker functionality
}

// Load saved palettes from localStorage
function getSavedPalettes() {
    const palettes = JSON.parse(localStorage.getItem('savedPalettes')) || {};
    return palettes;
}

// This click event listener was removed to prevent duplicate color picking
// The zoomed version below handles both regular and zoomed views

// Helper function to check if two arrays are equal
function arraysEqual(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

// Update color information display
function updateColorInfo(color) {
    if (color) {
        colorR.textContent = color[0];
        colorG.textContent = color[1];
        colorB.textContent = color[2];
        colorHex.textContent = rgbToHex(color);
    } else {
        colorR.textContent = '-';
        colorG.textContent = '-';
        colorB.textContent = '-';
        colorHex.textContent = '-';
    }
}

// Update color count
function updateColorCount() {
    colorCount.textContent = palette.length;
}

// Save a palette with a user-given name
document.getElementById('savePalette').addEventListener('click', () => {
    const paletteName = document.getElementById('paletteName').value.trim();
    if (!paletteName) {
        alert('Please enter a name for your palette.');
        return;
    }

    let savedPalettes = getSavedPalettes();
    savedPalettes[paletteName] = palette;
    localStorage.setItem('savedPalettes', JSON.stringify(savedPalettes));

    updatePaletteDropdown();
    alert(`Palette "${paletteName}" saved!`);
});

// Load a selected palette
document.getElementById('loadPalette').addEventListener('change', () => {
    const selectedPalette = document.getElementById('loadPalette').value;
    if (selectedPalette) {
        palette = getSavedPalettes()[selectedPalette];
        updatePaletteDisplay();
        updateColorCount();
    }
});

// Clear current palette


// Delete a selected palette
document.getElementById('deletePalette').addEventListener('click', () => {
    const selectedPalette = document.getElementById('loadPalette').value;
    if (selectedPalette) {
        let savedPalettes = getSavedPalettes();
        delete savedPalettes[selectedPalette];
        localStorage.setItem('savedPalettes', JSON.stringify(savedPalettes));
        updatePaletteDropdown();
        alert(`Palette "${selectedPalette}" deleted!`);
    }
});

// Display the palette
function updatePaletteDisplay() {
paletteDiv.innerHTML = '';
palette.forEach((color, index) => {
const colorContainer = document.createElement('div');
// Remove mb-2 mr-2 classes which were causing layout issues
colorContainer.className = 'flex flex-col items-center';

const colorPicker = document.createElement('input');
colorPicker.type = 'color';
colorPicker.value = rgbToHex(color);
colorPicker.className = 'color-picker rounded';
colorPicker.dataset.index = index;

// Add event listener to update color on change
colorPicker.addEventListener('input', (event) => {
    const color = hexToRgb(event.target.value);
    palette[event.target.dataset.index] = color;
});

// Add Remove button
const removeButton = document.createElement('button');
removeButton.textContent = '×';
removeButton.className = 'bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1';
removeButton.addEventListener('click', () => {
    palette.splice(index, 1);  // Remove the color from palette
    updatePaletteDisplay();    // Re-render the palette
    updateColorCount();
});

// Append color picker and remove button to container
colorContainer.appendChild(colorPicker);
colorContainer.appendChild(removeButton);

// Append container to palette
paletteDiv.appendChild(colorContainer);
});
}
function rgbToHex([r, g, b]) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Add a new color to the palette
document.getElementById('addColor').addEventListener('click', () => {
    if (lastPickedColor) {
        palette.push(lastPickedColor);
        updatePaletteDisplay();
        updateColorCount();
    } else if (palette.length > 0) {
        // Use the last color in the palette
        const lastColor = palette[palette.length - 1];
        palette.push(lastColor);
        updatePaletteDisplay();
        updateColorCount();
    } else {
        alert('Please click on the canvas to pick a color first.');
    }
});

// Apply quantization
applyQuantizationButton.addEventListener('click', () => {
    if (!canvas.width || !canvas.height) {
        alert('Please upload an image first.');
        return;
    }
    
    if (worker) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage({ imageData, palette });
    } else {
        alert('Color quantization requires the worker script (o.js). Functionality is limited without it.');
    }
});

// Handle file upload
imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        originalImage = img; // Store original image for later processing
        canvas.width = img.width;
        canvas.height = img.height;

        // Reset zoom when new image is loaded
        zoomLevel = 1.0;
        zoomPosition = { x: 0, y: 0 };

        // Draw the image using our redraw function
        redrawCanvas();

        // Update image dimensions
        imageDimensions.textContent = `${img.width} × ${img.height}`;
    };
    img.src = URL.createObjectURL(file);
});

// Apply pixelation
applyPixelationButton.addEventListener('click', () => {
    if (!originalImage) {
        alert('Please upload an image first.');
        return;
    }

    const scale = document.getElementById('pixelScale').value;
    pixelateImage(originalImage, canvas, scale);
});

// Pixelate the image (downscale and upscale)
function pixelateImage(img, canvas, scale) {
    const downscaleWidth = Math.max(1, Math.floor(img.width / scale));
    const downscaleHeight = Math.max(1, Math.floor(img.height / scale));

    // Step 1: Downscale
    const downCanvas = createCanvas(downscaleWidth, downscaleHeight);
    const downCtx = downCanvas.getContext('2d');
    downCtx.imageSmoothingEnabled = false; // Preserve hard edges
    downCtx.drawImage(img, 0, 0, downscaleWidth, downscaleHeight);

    // Step 2: Upscale back to original size
    canvas.width = img.width;
    canvas.height = img.height;
    const upCtx = canvas.getContext('2d');
    upCtx.imageSmoothingEnabled = false; // Keep pixelated effect
    upCtx.drawImage(downCanvas, 0, 0, img.width, img.height);
}

// Function to create a temporary canvas for downscaling
function createCanvas(width, height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    return tempCanvas;
}

// Update the palette dropdown
function updatePaletteDropdown() {
    const savedPalettes = getSavedPalettes();
    const dropdown = document.getElementById('loadPalette');
    dropdown.innerHTML = '<option value="">-- Select a Palette --</option>';
    for (const paletteName in savedPalettes) {
        const option = document.createElement('option');
        option.value = paletteName;
        option.textContent = paletteName;
        dropdown.appendChild(option);
    }
}

// Initialize palette display
updatePaletteDisplay();
updatePaletteDropdown();
updateColorCount();

// Add event listener for the Download button
document.getElementById('downloadImage').addEventListener('click', () => {
    if (!canvas.width || !canvas.height) {
        alert('Please upload and edit an image first.');
        return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'pixelated-image.png';
    a.click();
});

// Zoom functionality
function zoomIn() {
    // Apply zoom
    zoomLevel = Math.min(zoomLevel * 1.2, 5.0); // Max zoom level of 5x
    redrawCanvas();
}

function zoomOut() {
    // Apply zoom
    zoomLevel = Math.max(zoomLevel / 1.2, 0.2); // Min zoom level of 0.2x
    redrawCanvas();
}

function resetZoom() {
    zoomLevel = 1.0;
    zoomPosition = { x: 0, y: 0 };
    redrawCanvas();
}

// Redraw canvas with current zoom level and position
function redrawCanvas() {
    if (!originalImage) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate the visible portion of the image based on zoom
    const visibleWidth = canvas.width / zoomLevel;
    const visibleHeight = canvas.height / zoomLevel;

    // Calculate bounds for panning
    const maxX = Math.max(0, originalImage.width - visibleWidth);
    const maxY = Math.max(0, originalImage.height - visibleHeight);

    // Ensure zoom position is within bounds
    zoomPosition.x = Math.max(0, Math.min(maxX, zoomPosition.x));
    zoomPosition.y = Math.max(0, Math.min(maxY, zoomPosition.y));

    // Draw the zoomed portion of the image
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    ctx.drawImage(originalImage,
                  zoomPosition.x, zoomPosition.y,
                  visibleWidth, visibleHeight,
                  0, 0,
                  visibleWidth, visibleHeight);
    ctx.restore();
}

// Track if space key is pressed for panning
let spacePressed = false;

// Handle mouse down for dragging
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && spacePressed) { // Left mouse button and space pressed
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
    }
});

// Handle mouse move for dragging
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !originalImage) return;

    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    // Calculate new zoom position
    const newX = zoomPosition.x - (dx / zoomLevel);
    const newY = zoomPosition.y - (dy / zoomLevel);

    // Calculate bounds for panning
    const maxX = Math.max(0, originalImage.width - (canvas.width / zoomLevel));
    const maxY = Math.max(0, originalImage.height - (canvas.height / zoomLevel));

    // Apply new position with bounds checking
    zoomPosition.x = Math.max(0, Math.min(maxX, newX));
    zoomPosition.y = Math.max(0, Math.min(maxY, newY));

    lastMousePos = { x: e.clientX, y: e.clientY };
    redrawCanvas();
});

// Handle mouse up for dragging
canvas.addEventListener('mouseup', () => {
    isDragging = false;
    updateCanvasCursor();
});

// Handle mouse leave for dragging
canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    updateCanvasCursor();
});

// Update canvas cursor based on state
function updateCanvasCursor() {
    if (spacePressed) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'crosshair';
    }
}

// Handle space key for panning mode
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        spacePressed = true;
        updateCanvasCursor();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spacePressed = false;
        isDragging = false;
        updateCanvasCursor();
    }
});

// Handle mouse wheel for zooming
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Apply zoom
    if (e.deltaY < 0) {
        zoomLevel = Math.min(zoomLevel * 1.1, 5.0); // Zoom in
    } else {
        zoomLevel = Math.max(zoomLevel / 1.1, 0.2); // Zoom out
    }

    // Simply redraw with the new zoom level - the image will stay centered
    redrawCanvas();
});

// Update click event handler to account for zoom
canvas.addEventListener('click', (event) => {
    // Don't pick colors when in panning mode
    if (spacePressed || isDragging) return;

    if (!originalImage) return;

    const rect = canvas.getBoundingClientRect();

    // Calculate the exact position on the canvas
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Calculate the position in the original image coordinates
    const imgX = Math.round((canvasX / zoomLevel) + zoomPosition.x);
    const imgY = Math.round((canvasY / zoomLevel) + zoomPosition.y);

    // Ensure coordinates are within the bounds of the original image
    if (imgX < 0 || imgX >= originalImage.width || imgY < 0 || imgY >= originalImage.height) {
        return; // Don't process clicks outside the image bounds
    }

    // Create a temporary canvas at the exact size of the original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the original image at 1:1 scale
    tempCtx.drawImage(originalImage, 0, 0, originalImage.width, originalImage.height);

    // Get the pixel data at the exact calculated position
    const pixelData = tempCtx.getImageData(imgX, imgY, 1, 1).data;
    const color = [pixelData[0], pixelData[1], pixelData[2]]; // RGB values
    lastPickedColor = color;

    // Update color info display
    updateColorInfo(color);

    // Add color to palette if it doesn't already exist
    if (!palette.some(existingColor => arraysEqual(existingColor, color))) {
        palette.push(color);
        updatePaletteDisplay();
        updateColorCount();
    }
});

// Add event listeners for zoom buttons
zoomInButton.addEventListener('click', zoomIn);
zoomOutButton.addEventListener('click', zoomOut);
resetZoomButton.addEventListener('click', resetZoom);

// Pixelate the image (downscale and upscale)
function pixelateImage(img, canvas, scale) {
    const downscaleWidth = Math.max(1, Math.floor(img.width / scale));
    const downscaleHeight = Math.max(1, Math.floor(img.height / scale));

    // Step 1: Downscale
    const downCanvas = createCanvas(downscaleWidth, downscaleHeight);
    const downCtx = downCanvas.getContext('2d');
    downCtx.imageSmoothingEnabled = false; // Preserve hard edges
    downCtx.drawImage(img, 0, 0, downscaleWidth, downscaleHeight);

    // Step 2: Upscale back to original size
    canvas.width = img.width;
    canvas.height = img.height;
    const upCtx = canvas.getContext('2d');
    upCtx.imageSmoothingEnabled = false; // Keep pixelated effect
    upCtx.drawImage(downCanvas, 0, 0, img.width, img.height);

    // Reset zoom after pixelation
    zoomLevel = 1.0;
    zoomPosition = { x: 0, y: 0 };

    // Create a new Image object from the pixelated canvas
    const pixelatedImage = new Image();
    pixelatedImage.src = canvas.toDataURL();
    pixelatedImage.onload = function() {
        originalImage = pixelatedImage;
        redrawCanvas();
    };
}

// Modify the image upload handler to use redrawCanvas
imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        originalImage = img; // Store original image for later processing
        canvas.width = img.width;
        canvas.height = img.height;

        // Reset zoom when new image is loaded
        zoomLevel = 1.0;
        zoomPosition = { x: 0, y: 0 };

        redrawCanvas();

        // Update image dimensions
        imageDimensions.textContent = `${img.width} × ${img.height}`;
    };
    img.src = URL.createObjectURL(file);
});

// Modify applyPixelationButton to use redrawCanvas
applyPixelationButton.addEventListener('click', () => {
    if (!originalImage) {
        alert('Please upload an image first.');
        return;
    }

    const scale = document.getElementById('pixelScale').value;
    pixelateImage(originalImage, canvas, scale);
});

// Modify applyQuantizationButton to use redrawCanvas
applyQuantizationButton.addEventListener('click', () => {
    if (!canvas.width || !canvas.height) {
        alert('Please upload an image first.');
        return;
    }

    if (worker) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage({ imageData, palette });
        // Worker will update the canvas data, so we need to redraw
        worker.addEventListener('message', (event) => {
            const quantizedImageData = event.data;
            ctx.putImageData(quantizedImageData, 0, 0);
            redrawCanvas();
        }, { once: true });
    } else {
        alert('Color quantization requires the worker script (o.js). Functionality is limited without it.');
    }
});
