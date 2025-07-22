/*
 * Author: Houston Zhang
 * SPDX-License-Identifier: Apache-2.0
 */


export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseBoxToScreenCoords(params: {
  boxStr: string;
  screenWidth: number;
  screenHeight: number;
}): { x: number | null; y: number | null } {
  const { boxStr, screenWidth, screenHeight } = params;
  
  if (!boxStr) {
    return { x: null, y: null };
  }

  try {
    // Remove brackets and parse numbers
    const coordsStr = boxStr.replace(/[\[\]()]/g, '');
    const coords = coordsStr.split(',').map(s => parseFloat(s.trim()));
    
    if (coords.length >= 2) {
      // Convert normalized coordinates (0-1) to screen coordinates
      const x = coords[0] * screenWidth;
      const y = coords[1] * screenHeight;
      return { x, y };
    }
  } catch (error) {
    console.error('Failed to parse box coordinates:', error);
  }
  
  return { x: null, y: null };
} 