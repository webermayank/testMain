const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { diff } = require("deep-diff");

const SRC_DIR = "src/";
const OUTPUT_FILE = "docs_changes.json";

// Function to extract JSDoc comments from a file
function extractJSDoc(content) {
  const regex = /\/\*\*[\s\S]*?\*\//g; // Match /** JSDoc comments */
  const matches = content.match(regex);
  return matches ? matches.join("\n\n") : "";
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

// Compare JSDoc content in changed files
function compareJSDoc() {
  const changedFiles = getChangedFiles();
  const changes = [];

  // Debugging: Log changed files
  console.log("Changed files:", changedFiles);

  changedFiles.forEach((file) => {
    console.log(`Processing file: ${file}`);
    const fullPath = path.join(__dirname, "..", file);

    try {
      const oldContent = execSync(`git show HEAD~1:${file}`).toString();
      const newContent = fs.readFileSync(fullPath, "utf-8");

      console.log(`Old JSDoc for ${file}:\n`, extractJSDoc(oldContent));
      console.log(`New JSDoc for ${file}:\n`, extractJSDoc(newContent));

      const oldDocs = extractJSDoc(oldContent);
      const newDocs = extractJSDoc(newContent);

      const docDiff = diff(oldDocs, newDocs);

      if (docDiff) {
        console.log(`Differences detected in ${file}:`, docDiff);
        docDiff.forEach((change) => {
          changes.push({
            file,
            line: change.path ? change.path.join(".") : "N/A",
            old: change.lhs || "",
            new: change.rhs || "",
          });
        });
      } else {
        console.log(`No differences detected in ${file}`);
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  });

  return changes;
}

// Store changes in a JSON file
function saveChanges() {
  const changes = compareJSDoc();
  // Always write the file, even if empty
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(changes, null, 2));
  if (changes.length > 0) {
    console.log("JSDoc changes saved to", OUTPUT_FILE);
  } else {
    console.log("No JSDoc changes detected. Empty file written.");
  }
}

saveChanges();
