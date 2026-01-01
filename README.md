# PixArt - Image to Pixel Art Converter

PixArt is a web-based tool that converts images into pixel art using color quantization and pixelation techniques.

## Features

- **Color Quantization**: Reduces the number of colors in an image using k-means clustering in the CIELAB color space for better perceptual accuracy
- **Pixelation**: Applies a pixel art effect by downscaling and then upscaling the image
- **Custom Palettes**: Create, save, and load custom color palettes
- **Web Worker**: Uses a separate thread for computationally intensive operations to keep the UI responsive

## Technical Details

### Web Worker (`pixart-worker.js`)

The Web Worker handles the most computationally intensive operations:

1. **Color Space Conversion**:
   - RGB to XYZ to CIELAB color space conversion
   - Uses D65 standard illuminant for accurate color representation
   - Implements gamma correction and linear transformations

2. **k-Means Clustering**:
   - Implements k-means++ for better initial cluster selection
   - Uses squared distance in LAB color space for more perceptually accurate color matching
   - Optimized with caching for repeated RGB values

3. **Color Quantization**:
   - Precomputes palette colors in LAB space for efficient distance calculations
   - Uses a Map with integer keys for fast lookups of previously processed colors

### Main Script (`script.js`)

The main script handles UI interactions and image processing:

1. **Image Processing**:
   - Pixelation through downscale/upscale technique
   - Color extraction from images
   - Color palette management

2. **UI Features**:
   - Interactive canvas for color picking
   - Palette management (add, remove, edit colors)
   - Saved palettes with localStorage persistence
   - Image upload and download functionality

3. **Color Management**:
   - RGB to Hex conversion utilities
   - Palette generation from images
   - Color distance calculations

## Usage

1. Upload an image using the file input
2. Adjust the pixelation scale using the slider
3. Click "Apply Pixelation" to create a pixelated version
4. Use the color picker to select colors from the image
5. Create a custom palette or use the auto-generate feature
6. Apply color quantization to reduce the image to your palette
7. Download your pixel art creation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
