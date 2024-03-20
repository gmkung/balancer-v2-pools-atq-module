import { returnTags } from "../src/index.mjs"; // Update the path as needed
import { writeFile } from "fs/promises";
import { Tag } from "atq-types";

// Function to convert an array of Tag objects to a CSV string
function jsonToCSV(items: Tag[]): string {
  const replacer = (key: string, value: any) => (value === null ? "" : value);
  const header = Object.keys(items[0]) as Array<keyof Tag>; // Cast the keys to an array of Tag's keys
  const csv = [
    header.join(","), // header row first
    ...items.map((row) =>
      header
        .map((fieldName) => JSON.stringify(row[fieldName], replacer))
        .join(",")
    ),
  ].join("\r\n");

  return csv;
}
async function test(): Promise<void> {
  try {
    const tags = await returnTags("1", "A20CharacterApiKeyThatWorks");

    if (tags instanceof Error) {
      // Handle error
      console.error(tags.message);
    } else {
      // Process tags
      const csv = jsonToCSV(tags);
      await writeFile("dist/tests/tags.csv", csv);
      console.log("Tags have been written to tags.csv");
    }
  } catch (error) {
    console.error(error);
  }
}

test();
