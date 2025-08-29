// Test metadata extraction logic
const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page - GitHub Repository</title>
    <meta name="description" content="This is a test page for testing metadata extraction. It should show up in the hover card.">
    <meta property="og:title" content="Open Graph Test Title">
    <meta property="og:description" content="Open Graph description for social media sharing">
    <meta property="og:image" content="https://example.com/test-image.jpg">
    <link rel="icon" href="https://github.com/favicon.ico">
    <link rel="shortcut icon" href="https://github.com/favicon.ico">
    <link rel="apple-touch-icon" href="https://github.com/apple-touch-icon.png">
</head>
<body>
    <h1>Test Page Header</h1>
    <p>This is a test paragraph that should be extracted as a fallback description if no meta description is found.</p>
    <p>Another paragraph to test content extraction.</p>
</body>
</html>`;

// Parse the HTML content to extract metadata
const parser = new DOMParser();
const doc = parser.parseFromString(testHTML, 'text/html');

console.log('Parsed document:', doc);
console.log('Title element:', doc.querySelector('title'));
console.log('Meta description:', doc.querySelector('meta[name="description"]'));
console.log('Meta og:description:', doc.querySelector('meta[property="og:description"]'));
console.log('Link icon:', doc.querySelector('link[rel="icon"]'));

// Extract title with multiple fallbacks
let title = doc.querySelector('title')?.textContent?.trim();
if (!title) {
  title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
}
if (!title) {
  title = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim();
}
if (!title) {
  title = doc.querySelector('h1')?.textContent?.trim();
}

// Extract description with multiple fallbacks
let description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
if (!description) {
  description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim();
}
if (!description) {
  description = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim();
}
if (!description) {
  // Try to get first paragraph text as fallback
  const firstP = doc.querySelector('p');
  if (firstP && firstP.textContent) {
    description = firstP.textContent.trim().substring(0, 150);
    if (description.length === 150) description += '...';
  }
}

// Try to find favicon with multiple strategies
let favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href');
if (!favicon) {
  favicon = doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href');
}
if (!favicon) {
  favicon = doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
}
if (!favicon) {
  favicon = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
}

console.log('Extracted metadata:', { title, description, favicon });
