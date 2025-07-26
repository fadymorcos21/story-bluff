// plugins/removeDuplicatePrivacyFiles.js

const fs = require("fs");
const path = require("path");
const glob = require("glob");
console.log("🛠️ [Plugin] removeDuplicatePrivacyFiles loaded");

module.exports = function removeDuplicatePrivacyFiles(config) {
  console.log("🛠️ [Plugin] removeDuplicatePrivacyFiles loaded in function");

  return {
    ...config,
    hooks: {
      postExport: async () => {
        const matches = glob.sync("**/PrivacyInfo.xcprivacy", {
          ignore: ["**/node_modules/**"],
        });

        const seen = new Set();
        for (const filePath of matches) {
          const key = path.basename(filePath);
          if (seen.has(key)) {
            console.log(`Removing duplicate: ${filePath}`);
            fs.unlinkSync(filePath);
          } else {
            seen.add(key);
          }
        }
      },
    },
  };
};
