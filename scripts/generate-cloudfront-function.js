const fs = require("fs");
const path = require("path");

const redirects = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../redirects.json"), "utf8")
);

const redirectsMap = redirects.redirects.reduce((acc, r) => {
  acc[r.source] = { location: r.destination, permanent: r.permanent };
  return acc;
}, {});

const functionCode = `function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  var redirects = ${JSON.stringify(redirectsMap, null, 2)};
  
  if (redirects[uri]) {
    var redirect = redirects[uri];
    return {
      statusCode: redirect.permanent ? 301 : 302,
      statusDescription: redirect.permanent ? 'Moved Permanently' : 'Found',
      headers: {
        'location': { value: redirect.location }
      }
    };
  }
   // Append .html extension if URI doesn't have an extension and isn't a directory
  // This handles Next.js static export pages like /test-mint-burn -> /test-mint-burn.html
  if (!uri.includes('.') && !uri.endsWith('/')) {
    request.uri = uri + '.html';
  }
  return request;
}`;

const outputDir = path.join(__dirname, "../cloudfront-functions");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, "redirects.js"), functionCode);
console.log(
  "✅ CloudFront Function generated at cloudfront-functions/redirects.js"
);
