// This script generates a static file map from the Next.js /out directory
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../out");
const outputFile = path.resolve(__dirname, "../src/statics.js");

function getMimeType(ext) {
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function walkDir(dir, baseDir = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, baseDir));
    } else {
      const relativePath = "/" + path.relative(baseDir, fullPath);
      files.push({ path: relativePath, fullPath });
    }
  }

  return files;
}

function generateStatics() {
  if (!fs.existsSync(outDir)) {
    console.error(`Error: ${outDir} does not exist. Run 'next build' first.`);
    process.exit(1);
  }

  const files = walkDir(outDir);
  const imports = [];
  const fileMap = [];

  files.forEach((file, index) => {
    const ext = path.extname(file.path);
    const mimeType = getMimeType(ext);
    const varName = `file${index}`;

    // For binary files, use base64 encoding
    const isBinary = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".woff",
      ".woff2",
    ].includes(ext);

    if (isBinary) {
      const content = fs.readFileSync(file.fullPath);
      const base64 = content.toString("base64");
      imports.push(`const ${varName} = "${base64}";`);
      fileMap.push(
        `  "${file.path}": { content: ${varName}, mimeType: "${mimeType}", binary: true }`
      );
    } else {
      // Escape the content for JavaScript string
      const content = fs.readFileSync(file.fullPath, "utf-8");
      const escaped = JSON.stringify(content);
      imports.push(`const ${varName} = ${escaped};`);
      fileMap.push(
        `  "${file.path}": { content: ${varName}, mimeType: "${mimeType}", binary: false }`
      );
    }
  });

  const output = `// Auto-generated file - do not edit
// Generated from Next.js /out directory

${imports.join("\n")}

export const staticFiles = {
${fileMap.join(",\n")}
};

export function getStaticFile(path) {
  // Try exact match
  if (staticFiles[path]) {
    return staticFiles[path];
  }
  
  // Try with .html extension
  if (staticFiles[path + ".html"]) {
    return staticFiles[path + ".html"];
  }
  
  // Try index.html for directories
  const indexPath = path.endsWith("/") ? path + "index.html" : path + "/index.html";
  if (staticFiles[indexPath]) {
    return staticFiles[indexPath];
  }
  
  return null;
}
`;

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, output);
  console.log(`Generated ${outputFile} with ${files.length} files`);
}

generateStatics();
