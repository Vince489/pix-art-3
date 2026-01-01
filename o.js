// CIELAB Color Space Constants
// Reference: CIE D65 standard illuminant (daylight)
const D65_REFERENCE_X = 95.047;
const D65_REFERENCE_Y = 100.000;
const D65_REFERENCE_Z = 108.883;

// RGB to XYZ Conversion Constants
const RGB_GAMMA_THRESHOLD = 0.04045;
const RGB_LINEAR_SCALE = 12.92;
const RGB_GAMMA_SCALE = 1.055;
const RGB_GAMMA_OFFSET = 0.055;

// XYZ to LAB Conversion Constants
const LAB_EPSILON = 0.008856;  // Threshold for linear/cubic conversion
const LAB_KAPPA = 7.787;       // (24389/339) ≈ 7.787
const LAB_SCALE_L = 116;
const LAB_SCALE_A = 500;
const LAB_SCALE_B = 200;
const LAB_Y_INTERCEPT = 16;     // 16/116 ≈ 0.13793, but stored as 16 for clarity

// Standard conversion functions
function rgbToXyz([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  r = r > RGB_GAMMA_THRESHOLD ? Math.pow((r + RGB_GAMMA_OFFSET) / RGB_GAMMA_SCALE, 2.4) : r / RGB_LINEAR_SCALE;
  g = g > RGB_GAMMA_THRESHOLD ? Math.pow((g + RGB_GAMMA_OFFSET) / RGB_GAMMA_SCALE, 2.4) : g / RGB_LINEAR_SCALE;
  b = b > RGB_GAMMA_THRESHOLD ? Math.pow((b + RGB_GAMMA_OFFSET) / RGB_GAMMA_SCALE, 2.4) : b / RGB_LINEAR_SCALE;
  return [
    (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100,
    (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100
  ];
}

function xyzToLab([x, y, z]) {
  x /= D65_REFERENCE_X; y /= D65_REFERENCE_Y; z /= D65_REFERENCE_Z;
  x = x > LAB_EPSILON ? Math.cbrt(x) : (x * LAB_KAPPA) + (LAB_Y_INTERCEPT / LAB_SCALE_L);
  y = y > LAB_EPSILON ? Math.cbrt(y) : (y * LAB_KAPPA) + (LAB_Y_INTERCEPT / LAB_SCALE_L);
  z = z > LAB_EPSILON ? Math.cbrt(z) : (z * LAB_KAPPA) + (LAB_Y_INTERCEPT / LAB_SCALE_L);
  return [(LAB_SCALE_L * y) - LAB_Y_INTERCEPT, LAB_SCALE_A * (x - y), LAB_SCALE_B * (y - z)];
}

function rgbToLab(rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

// Optimized squared distance (no Math.sqrt)
function squaredDistance(lab1, lab2) {
  return (
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  );
}

// Worker Message Handling
self.addEventListener('message', (event) => {
  const { imageData, palette } = event.data;
  const { data } = imageData;

  // 1. Precompute palette LAB values
  const paletteLab = palette.map(rgbToLab);

  // 2. Use a Map with integer keys for fast lookups
  const rgbToPaletteMap = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Use bit-shifted integer as key (faster than string)
    const key = (r << 16) | (g << 8) | b;

    let matchedColor;
    if (rgbToPaletteMap.has(key)) {
      // Fast path: Use cached result
      matchedColor = rgbToPaletteMap.get(key);
    } else {
      // Slow path: Compute LAB and find closest palette color
      const pixelLab = rgbToLab([r, g, b]);
      let minDistance = Infinity;
      let closestIndex = 0;

      // Iterate through the 32-color palette (fast for n=32)
      for (let j = 0; j < paletteLab.length; j++) {
        const dist = squaredDistance(pixelLab, paletteLab[j]);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = j;
        }
      }
      matchedColor = palette[closestIndex];
      // Cache the result for future pixels
      rgbToPaletteMap.set(key, matchedColor);
    }

    // Apply the matched color
    data[i] = matchedColor[0];     // Red
    data[i + 1] = matchedColor[1]; // Green
    data[i + 2] = matchedColor[2]; // Blue
    // Alpha channel (data[i + 3]) is preserved
  }

  // Send back the quantized image using transferable objects for zero-copy operation
  self.postMessage(imageData, [imageData.data.buffer]);
});
