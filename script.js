/*
 * PixArt - Image to Pixel Art Converter
 * Copyright (c) 2025 Virtron
 * MIT License (see LICENSE file for details)
 */

let palette = [];
let originalImage = null; // Store the original image
let lastPickedColor = null; // Store the last picked color
let worker = null;
let canvas, ctx; // Declare canvas and ctx at a higher scope

// Try to create a worker if browser supports it
try {
    worker = new Worker('pixart-worker.js');

    // ONE permanent listener for all worker communication
    worker.addEventListener('message', (event) => {
        const { type, data, palette: workerPalette } = event.data;
        const paletteSpinner = document.getElementById('paletteSpinner');

        switch (type) {
            case 'quantized':
                // Handle image processing result
                ctx.putImageData(data, 0, 0);
                break;

            case 'generatedPalette':
                // Handle auto-palette result
                palette = workerPalette;
                updatePaletteDisplay();
                updateColorCount();

                // Hide spinner when palette is generated
                if (paletteSpinner) {
                    paletteSpinner.style.display = 'none';
                    paletteSpinner.classList.remove('active');
                }
                break;

            case 'error':
                console.error("Worker error:", data);
                // Hide spinner on error
                if (paletteSpinner) {
                    paletteSpinner.style.display = 'none';
                    paletteSpinner.classList.remove('active');
                }
                break;

            default:
                console.warn("Unknown message type from worker:", type);
        }
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

// Helper function to check if two arrays are equal
function arraysEqual(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

// Convert RGB to Hex
function rgbToHex([r, g, b]) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Convert Hex to RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

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

// Function to create a temporary canvas for downscaling
function createCanvas(width, height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    return tempCanvas;
}

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

// Update color count
function updateColorCount() {
    const colorCount = document.getElementById('colorCount');
    colorCount.textContent = palette.length;
}

// Update clear palette button visibility
function updateClearPaletteButton() {
    const clearPaletteButton = document.getElementById('clearPalette');
    if (palette.length > 0) {
        clearPaletteButton.classList.remove('hidden');
    } else {
        clearPaletteButton.classList.add('hidden');
    }
}

// Display the palette
function updatePaletteDisplay() {
    const paletteDiv = document.getElementById('palette');
    paletteDiv.innerHTML = '';
    palette.forEach((color, index) => {
        const colorContainer = document.createElement('div');
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
            updatePaletteDisplay();
        });

        // Add Remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = '×';
        removeButton.className = 'bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1';
        removeButton.addEventListener('click', () => {
            palette.splice(index, 1);
            updatePaletteDisplay();
            updateColorCount();
        });

        // Append color picker and remove button to container
        colorContainer.appendChild(colorPicker);
        colorContainer.appendChild(removeButton);

        // Append container to palette
        paletteDiv.appendChild(colorContainer);
    });

    // Update clear palette button visibility
    updateClearPaletteButton();
}

// Capture color from the canvas on click and add to the palette
function handleCanvasClick(event) {
    if (!canvas) return;

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
}

// Function to update performance metrics display
function updatePerformanceMetrics(operation, duration) {
    const metricsElement = document.getElementById('performanceMetrics');
    metricsElement.textContent = `${operation} in ${Math.round(duration)}ms`;
    metricsElement.classList.remove('hidden');

    // Hide the metrics after 5 seconds
    setTimeout(() => {
        metricsElement.classList.add('hidden');
    }, 5000);
}

// Toggle sidebar functions
function toggleLeftSidebar() {
    const leftSidebar = document.getElementById('leftSidebar');
    const overlay = document.getElementById('overlay');

    leftSidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function toggleRightSidebar() {
    const rightSidebar = document.getElementById('rightSidebar');
    const overlay = document.getElementById('overlay');

    rightSidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Close sidebars when clicking on overlay
function closeSidebars() {
    const leftSidebar = document.getElementById('leftSidebar');
    const rightSidebar = document.getElementById('rightSidebar');
    const overlay = document.getElementById('overlay');

    leftSidebar.classList.remove('open');
    rightSidebar.classList.remove('open');
    overlay.classList.remove('active');
}

// Initialize everything after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const paletteDiv = document.getElementById('palette');
    const addColorButton = document.getElementById('addColor');
    const applyQuantizationButton = document.getElementById('applyQuantization');
    const applyPixelationButton = document.getElementById('applyPixelation');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageDimensions = document.getElementById('imageDimensions');

    // Initialize palette display
    updatePaletteDisplay();
    updatePaletteDropdown();
    updateColorCount();
    updateClearPaletteButton();

    // Add event listener for the upload button
    uploadImageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    // Add event listeners for sidebar toggles
    const leftSidebarToggle = document.getElementById('leftSidebarToggle');
    const rightSidebarToggle = document.getElementById('rightSidebarToggle');
    const overlay = document.getElementById('overlay');

    if (leftSidebarToggle) {
        leftSidebarToggle.addEventListener('click', toggleLeftSidebar);
    }

    if (rightSidebarToggle) {
        rightSidebarToggle.addEventListener('click', toggleRightSidebar);
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebars);
    }

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

    // Add canvas click event listener
    canvas.addEventListener('click', handleCanvasClick);

    // Add a new color to the palette
    addColorButton.addEventListener('click', () => {
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
            const startTime = performance.now();
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            worker.postMessage({ type: 'quantize', imageData, palette, startTime });

            // Add a one-time listener for the response to calculate duration
            const handleQuantizeResponse = (event) => {
                if (event.data.type === 'quantized') {
                    const endTime = performance.now();
                    const duration = endTime - event.data.startTime;
                    updatePerformanceMetrics('Quantized', duration);
                    worker.removeEventListener('message', handleQuantizeResponse);
                }
            };
            worker.addEventListener('message', handleQuantizeResponse);
        } else {
            alert('Color quantization requires the worker script (pixart-worker.js). Functionality is limited without it.');
        }
    });

    // Auto-generate palette using k-Means clustering
    const autoGeneratePaletteButton = document.getElementById('autoGeneratePalette');

    // Create spinner element if it doesn't exist
    let paletteSpinner = document.getElementById('paletteSpinner');
    if (!paletteSpinner) {
        const paletteDiv = document.getElementById('palette');
        if (paletteDiv) {
            paletteSpinner = document.createElement('div');
            paletteSpinner.id = 'paletteSpinner';
            paletteSpinner.className = 'spinner';
            paletteSpinner.innerHTML = `
                <div class="spinner-animation"></div>
                <div class="spinner-text">Generating palette...</div>
            `;
            paletteDiv.appendChild(paletteSpinner);
        }
    }

    // Make sure spinner is hidden initially
    if (paletteSpinner) {
        paletteSpinner.classList.remove('active');
        paletteSpinner.style.display = 'none';
    }

    autoGeneratePaletteButton.addEventListener('click', () => {
        // 1. Guard Clause: Check if image exists before doing anything else
        if (!originalImage || !canvas.width || !canvas.height) {
            alert('Please upload an image first.');
            return;
        }

        if (!worker) {
            alert('Auto-generating palette requires the worker script (pixart-worker.js).');
            return;
        }

        // Ask for number of colors (default to 8)
        const colorCount = prompt('Enter number of colors to generate (4-16):', '8');
        const numColors = parseInt(colorCount);

        if (isNaN(numColors) || numColors < 4 || numColors > 16) {
            alert('Please enter a number between 4 and 16.');
            return;
        }

        // Show spinner
        if (paletteSpinner) {
            paletteSpinner.style.display = 'flex';
            paletteSpinner.classList.add('active');
        }

        const startTime = performance.now();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Send message to worker
        worker.postMessage({
            type: 'generatePalette',
            imageData: imageData,
            clusterCount: numColors,
            startTime: startTime
        });
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

    // Save a palette with a user-given name
    document.getElementById('savePalette').addEventListener('click', () => {
        const paletteName = document.getElementById('paletteName').value.trim();
        if (!paletteName) {
            alert('Please enter a name for your palette.');
            return;
        }

        if (palette.length === 0) {
            alert('Your palette is empty. Add colors to your palette before saving.');
            return;
        }

        try {
            let savedPalettes = getSavedPalettes();
            savedPalettes[paletteName] = palette;
            localStorage.setItem('savedPalettes', JSON.stringify(savedPalettes));

            updatePaletteDropdown();
            document.getElementById('paletteName').value = ''; // Clear the input field
            alert(`Palette "${paletteName}" saved successfully!`);
        } catch (e) {
            console.error('Error saving palette:', e);
            alert('Failed to save palette. Please check your browser settings and try again.');
        }
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

    // Add event listener for the Clear Palette button
    document.getElementById('clearPalette').addEventListener('click', () => {
        palette = [];
        updatePaletteDisplay();
        updateColorCount();
    });

    // Add event listener for the Clear Workspace button
    document.getElementById('clearWorkspace').addEventListener('click', () => {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;

        // Reset the original image
        originalImage = null;

        // Clear the palette
        palette = [];
        updatePaletteDisplay();
        updateColorCount();

        // Reset image dimensions display
        document.getElementById('imageDimensions').textContent = '-';
    });

    // Add a test function to manually toggle the spinner for debugging
    window.toggleSpinner = function() {
        const spinner = document.getElementById('paletteSpinner');
        if (spinner) {
            if (spinner.style.display === 'flex') {
                spinner.style.display = 'none';
                spinner.classList.remove('active');
            } else {
                spinner.style.display = 'flex';
                spinner.classList.add('active');
            }
        }
    };
});
