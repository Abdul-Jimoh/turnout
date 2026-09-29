import { readFileSync, writeFileSync } from "node:fs";

const artifact = JSON.parse(readFileSync(new URL("../../contracts/out/Turnout.sol/Turnout.json", import.meta.url)));
const out = `export const turnoutAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
writeFileSync(new URL("../src/lib/abi.ts", import.meta.url), out);
console.log(`wrote ${artifact.abi.length} ABI entries`);
