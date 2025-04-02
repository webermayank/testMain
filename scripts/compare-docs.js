const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { diffLines } = require("diff");

const SRC_DIR = "src/";
const OUTPUT_FILE = "docs_changes.json";

// Function to extract JSDoc comments from a file
function extractJSDoc(content) {
  const regex = /\/\*\*[\s\S]*?\*\//g; // Match /** JSDoc comments */
  const matches = content.match(regex);
  return matches ? matches.join("\n") : "";
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

// Compare JSDoc content in changed files using diff package
function compareJSDoc() {
  const changedFiles = getChangedFiles();
  const changes = [];

  changedFiles.forEach((file) => {
    const fullPath = path.join(__dirname, "..", file);

    try {
      const oldContent = execSync(`git show HEAD~1:${file}`).toString();
      const newContent = fs.readFileSync(fullPath, "utf-8");

      const oldDocs = extractJSDoc(oldContent);
      const newDocs = extractJSDoc(newContent);

      const docDiff = diffLines(oldDocs, newDocs);

      let lineNumber = 1; // Track line numbers
      docDiff.forEach((part) => {
        if (part.added || part.removed) {
          changes.push({
            file,
            line: lineNumber,
            old: part.removed ? part.value.trim() : "",
            new: part.added ? part.value.trim() : "",
          });
        }
        lineNumber += part.count || 0;
      });
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  });

  return changes;
}

// Store changes in a JSON file
function saveChanges() {
  const changes = compareJSDoc();
  if (changes.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(changes, null, 2));
    console.log("JSDoc changes saved to", OUTPUT_FILE);
  } else {
    console.log("No JSDoc changes detected.");
  }
}

saveChanges();
