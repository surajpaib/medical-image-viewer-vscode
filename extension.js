#!/usr/bin/env node
const vscode = require('vscode');
const { PNG } = require('pngjs');

function createGrayscaleImage(width, height, pixelData) {
  const png = new PNG({ width, height, colorType: 0, bitDepth: 8, inputHasAlpha: false });

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 0;
      png.data[idx] = pixelData[idx];
    }
  }

  return PNG.sync.write(png);
}

function normalizeInt16ArrayToUint8Array(imageData, min, max) {
  const scaleFactor = 255 / (max - min);
  return imageData.map(value => Math.round((value - min) * scaleFactor));
}

function displayTypedArrayAsImage(typedArray, width, height) {
  // Normalize image data to PNG pixel value range [0, 255] and create a Uint8Array
  const normalizedUint8Array = normalizeInt16ArrayToUint8Array(typedArray, -1024, 3072);

  // Convert the Uint8Array to a grayscale PNG buffer
  const pngBuffer = createGrayscaleImage(width, height, normalizedUint8Array);

  // Convert the PNG buffer to a base64-encoded data URL
  const base64Image = `data:image/jpeg;base64,${pngBuffer.toString('base64')}`;

  // Create a WebView panel
  const panel = vscode.window.createWebviewPanel(
    'typedArrayImage',
    'TypedArray Image',
    vscode.ViewColumn.One,
    {}
  );

  // Generate the panel's HTML content
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TypedArray Image</title>
    </head>
    <body>
        <img src="${base64Image}" alt="typed array image" />
    </body>
    </html>
  `;

  // Set the WebView panel's HTML content
  panel.webview.html = html;
}

function activate(context) {
  let disposable = vscode.commands.registerCommand('medical-image-viewer.loadFile', async function (uri) {
    try {

		const itk = await import('itk-wasm')
		const object = await itk.readLocalFile(uri.fsPath)
        vscode.window.showInformationMessage('Type: ' + object.imageType.componentType);
        vscode.window.showInformationMessage('Pixel: ' + object.imageType.pixelType);
		const sliceIndex = Math.floor(object.size[2]/2) // Change this to get a different slice
		const orientation = 'xy'; // Change 'xy' to 'xz', or 'yz' to get a slice in a different orientation
		const array2D = get2DSliceFrom3DArray(object.data, object.size[0], object.size[1], object.size[2], sliceIndex, orientation);
		displayTypedArrayAsImage(array2D, object.size[0], object.size[1])
        // Display the image
      
        // Insert image rendering and scrolling functionality here
      } catch (error) {
        vscode.window.showErrorMessage('Error opening file: ' + error.message);
      }
  });

  context.subscriptions.push(disposable);
}


function get2DSliceFrom3DArray(array3D, width, height, depth, sliceIndex, orientation) {
	if (array3D.length !== width * height * depth) {
	  throw new Error('Dimensions do not match the size of the 3D array');
	}
  
	let sliceWidth, sliceHeight;
	let startIndex;
  
	switch (orientation) {
	  case 'xy':
		sliceWidth = width;
		sliceHeight = height;
		startIndex = sliceIndex * width * height;
		break;
	  case 'xz':
		sliceWidth = width;
		sliceHeight = depth;
		startIndex = sliceIndex * width;
		break;
	  case 'yz':
		sliceWidth = height;
		sliceHeight = depth;
		startIndex = sliceIndex;
		break;
	  default:
		throw new Error(`Invalid orientation: ${orientation}. Expected 'xy', 'xz', or 'yz'.`);
	}
  
	const array2D = new Int16Array(sliceWidth * sliceHeight);
  
	for (let row = 0; row < sliceHeight; row++) {
	  for (let col = 0; col < sliceWidth; col++) {
		let sourceIndex;
		if (orientation === 'xy') {
		  sourceIndex = startIndex + row * width + col;
		} else if (orientation === 'xz') {
		  sourceIndex = startIndex + row * width * height + col;
		} else if (orientation === 'yz') {
		  sourceIndex = startIndex + row * width * height + col * width;
		}
		array2D[row * sliceWidth + col] = array3D[sourceIndex];
	  }
	}
  
	return array2D;
  }

exports.activate = activate;