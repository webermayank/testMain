const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { diffLines } = require("diff");

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
      console.log(`Found JSDoc start at line ${startLine} in ${filePath}`);
    } else if (line.endsWith("*/") && inJSDoc) {
      inJSDoc = false;
      const endLine = i + 1;
      const jsdocText = lines.slice(startLine - 1, endLine).join("\n");
      jsdocComments.push({
        text: jsdocText,
        startLine: startLine,
        endLine: endLine,
      });
      console.log(`Found JSDoc end at line ${endLine} in ${filePath}`);
    }
  }

  if (jsdocComments.length === 0) {
    console.log(`No JSDoc comments found in ${filePath}`);
  }

  return jsdocComments;
}

// Get changed files between the last and previous commit
function getChangedFiles() {
  try {
    console.log("Running git diff to find changed files...");
    const output = execSync(`git diff --name-only HEAD~1 HEAD -- ${SRC_DIR}`)
      .toString()
      .trim()
      .split("\n");
    console.log("Changed files:", output);
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

  if (changedFiles.length === 0) {
    console.log("No JavaScript files changed in src/");
    return changes;
  }

  changedFiles.forEach((file) => {
    console.log(`Processing file: ${file}`);
    const fullPath = path.join(__dirname, "..", file);

    try {
      const oldContent = execSync(`git show HEAD~1:${file}`).toString();
      const newContent = fs.readFileSync(fullPath, "utf-8");

      console.log(`Old content length for ${file}: ${oldContent.length}`);
      console.log(`New content length for ${file}: ${newContent.length}`);

      const oldDocs = extractJSDocWithLines(oldContent, file);
      const newDocs = extractJSDocWithLines(newContent, file);

      console.log(`Old JSDoc blocks in ${file}:`, oldDocs);
      console.log(`New JSDoc blocks in ${file}:`, newDocs);

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
              console.log(`Change detected in ${file} at line ${oldDoc.startLine}:`, {
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
          console.log(`JSDoc removed in ${file} at line ${oldDoc.startLine}:`, oldDoc.text.trim());
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
          console.log(`New JSDoc added in ${file} at line ${newDoc.startLine}:`, newDoc.text.trim());
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