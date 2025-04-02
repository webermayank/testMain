const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { diffLines } = require("diff"); // You'll need to install this package: npm install diff

const SRC_DIR = "src/";
const OUTPUT_FILE = "docs_changes.json";

// Function to extract JSDoc comments from a file with line numbers
function extractJSDocWithLines(content, filePath) {
  const lines = content.split("\n");
  const jsdocComments = [];
  let inJSDoc = false;
  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("/**") && !inJSDoc) {
      inJSDoc = true;
      startLine = i + 1; // 1-based line number
    } else if (line.endsWith("*/") && inJSDoc) {
      inJSDoc = false;
      jsdocComments.push({
        text: lines.slice(startLine - 1, i + 1).join("\n"),
        startLine: startLine,
        endLine: i + 1,
      });
    }
  }

  return jsdocComments;
}

// Get changed files between the last and previous commit
function getChangedFiles() {
  try {
    const output = execSync(`git diff --name-only HEAD~1 HEAD -- ${SRC_DIR}`)
      .toString()
      .trim()
      .split("\n");
    return output.filter((file) => file.endsWith(".js"));
  } catch (error) {
    console.error("Error getting changed files:", error);
    return [];
  }
}

// Compare JSDoc content in changed files and get line numbers
function compareJSDoc() {
  const changedFiles = getChangedFiles();
  const changes = [];

  changedFiles.forEach((file) => {
    console.log(`Processing file: ${file}`);
    const fullPath = path.join(__dirname, "..", file);

    try {
      const oldContent = execSync(`git show HEAD~1:${file}`).toString();
      const newContent = fs.readFileSync(fullPath, "utf-8");

      const oldDocs = extractJSDocWithLines(oldContent, file);
      const newDocs = extractJSDocWithLines(newContent, file);

      // Compare each JSDoc block
      oldDocs.forEach((oldDoc, index) => {
        if (newDocs[index]) {
          const diffResult = diffLines(oldDoc.text, newDocs[index].text);

          diffResult.forEach((part) => {
            if (part.added || part.removed) {
              changes.push({
                file: file,
                line: oldDoc.startLine, // Use the starting line of the JSDoc block
                old: part.removed ? part.value.trim() : "N/A",
                new: part.added ? part.value.trim() : "N/A",
              });
            }
          });
        } else {
          // JSDoc was removed
          changes.push({
            file: file,
            line: oldDoc.startLine,
            old: oldDoc.text.trim(),
            new: "N/A",
          });
        }
      });

      // Check for new JSDoc blocks
      newDocs.forEach((newDoc, index) => {
        if (!oldDocs[index]) {
          changes.push({
            file: file,
            line: newDoc.startLine,
            old: "N/A",
            new: newDoc.text.trim(),
          });
        }
      });

    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  });

  console.log("Detected changes:", changes);
  return changes;
}

// Store changes in a JSON file
function saveChanges() {
  const changes = compareJSDoc();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(changes, null, 2));
  if (changes.length > 0) {
    console.log("JSDoc changes saved to", OUTPUT_FILE);
  } else {
    console.log("No JSDoc changes detected. Empty file written.");
  }
}

saveChanges();