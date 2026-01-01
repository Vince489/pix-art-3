const imageInput = document.getElementById('imageInput');
const paletteDiv = document.getElementById('palette');
const addColorButton = document.getElementById('addColor');
const applyQuantizationButton = document.getElementById('applyQuantization');
const applyPixelationButton = document.getElementById('applyPixelation');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Elements for image information
const imageDimensions = document.getElementById('imageDimensions');
const colorCount = document.getElementById('colorCount');

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

// Capture color from the canvas on click and add to the palette
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((event.clientY - rect.top) * (canvas.height / rect.height));

    // Get the pixel data at the clicked position
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    const color = [pixelData[0], pixelData[1], pixelData[2]]; // RGB values
    lastPickedColor = color;


    // Add color to palette if it doesn't already exist
    if (!palette.some(existingColor => arraysEqual(existingColor, color))) {
        palette.push(color);
        updatePaletteDisplay();
        updateColorCount();
    }
});

// Helper function to check if two arrays are equal
function arraysEqual(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
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

// Generate a palette from the image
document.getElementById('generatePalette').addEventListener('click', () => {
    if (!canvas.width || !canvas.height) {
        alert('Please upload an image first.');
        return;
    }

    // Extract colors from the image
    const colors = extractProminentColors(canvas, ctx, 8);
    palette = colors;
    updatePaletteDisplay();
    updateColorCount();
});

// Function to extract prominent colors from the image
function extractProminentColors(canvas, ctx, colorCount) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Use a Map to count color occurrences
    const colorMap = new Map();

    // Sample pixels at regular intervals to reduce computation
    const step = Math.max(1, Math.floor(Math.sqrt(data.length / 4) / 100));

    for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];

        // Skip transparent pixels
        if (alpha === 0) continue;

        // Create a key for the color
        const colorKey = `${r},${g},${b}`;

        // Update the color count
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
    }

    // Convert the map to an array of colors with their counts
    const colorCounts = Array.from(colorMap.entries()).map(([colorKey, count]) => {
        const [r, g, b] = colorKey.split(',').map(Number);
        return { r, g, b, count };
    });

    // Sort by count in descending order
    colorCounts.sort((a, b) => b.count - a.count);

    // Extract the top colors
    const topColors = colorCounts.slice(0, colorCount).map(color => [color.r, color.g, color.b]);

    return topColors;
}

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
        ctx.drawImage(img, 0, 0);
        
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
