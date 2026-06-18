const fs = require("fs");
const path = require("path");

const tronwebModule = require("tronweb");
const TronWeb = tronwebModule.TronWeb || tronwebModule.default || tronwebModule;

async function main() {
  let account;

  if (typeof TronWeb.createAccount === "function") {
    account = await TronWeb.createAccount();
  } else {
    const tronWeb = new TronWeb({
      fullHost: "https://api.shasta.trongrid.io",
    });
    account = await tronWeb.createAccount();
  }

  const address = account.address.base58;
  const hexAddress = account.address.hex;
  const privateKey = account.privateKey;

  const outputDir = path.join(process.cwd(), ".secrets");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, "mindpool-app-wallet.txt");

  const text = [
    "MINDPOOL GOLD TESTNET APP WALLET",
    "================================",
    `Address Base58: ${address}`,
    `Address Hex: ${hexAddress}`,
    `Private Key: ${privateKey}`,
    "",
    "IMPORTANT:",
    "1. Do not upload this file to GitHub.",
    "2. Do not paste private key in frontend.",
    "3. Address goes in wrangler.toml.",
    "4. Private key goes only into Cloudflare secret.",
  ].join("\n");

  fs.writeFileSync(outputFile, text, "utf8");

  console.log("Wallet created successfully.");
  console.log("Address Base58:", address);
  console.log("Private key saved locally at:");
  console.log(outputFile);
  console.log("");
  console.log("Do not share the private key.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});