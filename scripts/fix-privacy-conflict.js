const fs = require("fs");
const path = require("path");
const glob = require("glob");

const matches = glob.sync("**/PrivacyInfo.xcprivacy", {
  ignore: ["**/node_modules/**"],
});

const seen = new Set();
for (const filePath of matches) {
  const fileKey = path.basename(filePath);
  if (seen.has(fileKey)) {
    console.log("🧹 Deleting duplicate:", filePath);
    fs.unlinkSync(filePath);
  } else {
    seen.add(fileKey);
  }
}
